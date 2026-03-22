require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const multer = require('multer');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET || 'nova-change-this-secret',
  resave: false, saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 7*24*60*60*1000, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(cors());
app.use(express.json({ limit: '4mb' }));
passport.serializeUser((u,done)=>done(null,u));
passport.deserializeUser((u,done)=>done(null,u));

if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
  }, async (_,__,profile,done) => {
    const user = { id:profile.id, name:profile.displayName, email:profile.emails?.[0]?.value, picture:profile.photos?.[0]?.value, token:'g_'+profile.id };
    if (pool) { try { await pool.query(`INSERT INTO users (google_id,name,email,picture,user_token) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (google_id) DO UPDATE SET name=$2,email=$3,picture=$4,last_login=NOW()`,[user.id,user.name,user.email,user.picture,user.token]); } catch(e){console.error('User save:',e.message);} }
    done(null,user);
  }));
}

// ─── DB ───────────────────────────────────────────────────────────────────────
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const agentTaskRuns = new Map();

async function initDB() {
  if (!pool) { console.log('No DATABASE_URL — running without database'); return; }
  try { await pool.query('SELECT 1'); console.log('Database connected'); } catch(e) { console.error('DB connection failed:',e.message); return; }
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, google_id VARCHAR(64) UNIQUE, name VARCHAR(128), email VARCHAR(128), picture TEXT, user_token VARCHAR(64) UNIQUE, is_banned BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW(), last_login TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS chats (id SERIAL PRIMARY KEY, chat_id VARCHAR(64) UNIQUE NOT NULL, user_token VARCHAR(64) NOT NULL, title VARCHAR(256), provider VARCHAR(32), model VARCHAR(128), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS chat_messages (id SERIAL PRIMARY KEY, chat_id VARCHAR(64) REFERENCES chats(chat_id) ON DELETE CASCADE, role VARCHAR(16) NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS memories (id SERIAL PRIMARY KEY, user_token VARCHAR(64) UNIQUE NOT NULL, content TEXT NOT NULL, updated_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS memory_history (id SERIAL PRIMARY KEY, user_token VARCHAR(64) NOT NULL, content TEXT NOT NULL, source VARCHAR(32) DEFAULT 'manual', note VARCHAR(256), created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS api_keys (id SERIAL PRIMARY KEY, provider VARCHAR(32) UNIQUE NOT NULL, api_key TEXT NOT NULL, label VARCHAR(128), updated_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS changelog (id SERIAL PRIMARY KEY, version VARCHAR(32) NOT NULL, title VARCHAR(256) NOT NULL, body TEXT NOT NULL, type VARCHAR(32) DEFAULT 'update', published BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS shared_chats (id SERIAL PRIMARY KEY, share_code VARCHAR(16) UNIQUE NOT NULL, title VARCHAR(256), creator_token VARCHAR(64) NOT NULL, provider VARCHAR(32), model VARCHAR(128), is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS shared_participants (id SERIAL PRIMARY KEY, share_code VARCHAR(16) REFERENCES shared_chats(share_code) ON DELETE CASCADE, user_token VARCHAR(64) NOT NULL, user_name VARCHAR(128), joined_at TIMESTAMP DEFAULT NOW(), UNIQUE(share_code, user_token))`);
    await pool.query(`CREATE TABLE IF NOT EXISTS shared_messages (id SERIAL PRIMARY KEY, share_code VARCHAR(16) REFERENCES shared_chats(share_code) ON DELETE CASCADE, user_token VARCHAR(64) NOT NULL, user_name VARCHAR(128), role VARCHAR(16) NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`ALTER TABLE shared_participants ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT NOW()`);
    await pool.query(`ALTER TABLE shared_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP`);
    await pool.query(`ALTER TABLE shared_messages ADD COLUMN IF NOT EXISTS reactions_json TEXT DEFAULT '{}'`);

    await pool.query(`CREATE TABLE IF NOT EXISTS folders (
      id SERIAL PRIMARY KEY, user_token VARCHAR(64) NOT NULL,
      name VARCHAR(128) NOT NULL, color VARCHAR(32) DEFAULT 'default',
      icon VARCHAR(32) DEFAULT '📁', position INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS folder_id INT REFERENCES folders(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS message_count INT DEFAULT 0`);
    await pool.query(`CREATE TABLE IF NOT EXISTS prompts (
      id SERIAL PRIMARY KEY, user_token VARCHAR(64) NOT NULL,
      title VARCHAR(128) NOT NULL, content TEXT NOT NULL,
      category VARCHAR(64) DEFAULT 'General', use_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS user_settings (
      id SERIAL PRIMARY KEY, user_token VARCHAR(64) UNIQUE NOT NULL,
      system_prompt TEXT, byok_groq TEXT, byok_cohere TEXT,
      search_enabled BOOLEAN DEFAULT false,
      tts_enabled BOOLEAN DEFAULT false, tts_voice VARCHAR(32) DEFAULT 'nova',
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS usage_stats (
      id SERIAL PRIMARY KEY, user_token VARCHAR(64) NOT NULL,
      date DATE NOT NULL DEFAULT CURRENT_DATE, provider VARCHAR(32),
      messages INT DEFAULT 0, tokens_est INT DEFAULT 0,
      UNIQUE(user_token, date, provider)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS pinned_messages (
      id SERIAL PRIMARY KEY, chat_id VARCHAR(64) REFERENCES chats(chat_id) ON DELETE CASCADE,
      user_token VARCHAR(64) NOT NULL, role VARCHAR(16), content TEXT NOT NULL,
      note VARCHAR(256), created_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS agent_tasks (
      id SERIAL PRIMARY KEY, task_id VARCHAR(64) UNIQUE NOT NULL,
      user_token VARCHAR(64) NOT NULL, title VARCHAR(256),
      status VARCHAR(24) DEFAULT 'queued', steps_json TEXT DEFAULT '[]',
      result TEXT, error TEXT, created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(), completed_at TIMESTAMP
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS user_files (
      id SERIAL PRIMARY KEY, file_id VARCHAR(64) UNIQUE NOT NULL,
      user_token VARCHAR(64) NOT NULL, name VARCHAR(256) NOT NULL,
      mime_type VARCHAR(128), size_bytes INT DEFAULT 0,
      extracted_text TEXT DEFAULT '', created_at TIMESTAMP DEFAULT NOW()
    )`);
    console.log('DB ready');
  } catch(e) { console.error('DB init:',e.message); }
}
initDB();

// ─── Providers ────────────────────────────────────────────────────────────────
const PROVIDERS = {
  groq: { name:'Groq', baseURL:'https://api.groq.com/openai/v1', keyEnv:'GROQ_API_KEY', models:['llama-3.3-70b-versatile','llama-3.1-70b-versatile','llama-3.1-8b-instant','mixtral-8x7b-32768','gemma2-9b-it'] },
  cohere: { name:'Cohere', baseURL:'https://api.cohere.com/compatibility/v1', keyEnv:'COHERE_API_KEY', models:['command-r-plus','command-r','command'] },
  ollama: { name:'Ollama (Local)', baseURL:null, keyEnv:null, models:['llama3.2','llama3.1','mistral','gemma2','phi3','deepseek-r1'] }
};
const IMG_PROVIDERS = {
  openai: { name:'OpenAI DALL-E', keyEnv:'OPENAI_API_KEY', models:['dall-e-3','dall-e-2'] },
  stability: { name:'Stability AI', keyEnv:'STABILITY_API_KEY', models:['stable-diffusion-xl-1024-v1-0'] }
};

async function getKey(provider) {
  const cfg = PROVIDERS[provider]; if (!cfg) return null;
  if (provider === 'ollama') return 'local';
  if (pool) { try { const r = await pool.query('SELECT api_key FROM api_keys WHERE provider=$1',[provider]); if (r.rows[0]?.api_key) return r.rows[0].api_key; } catch {} }
  return process.env[cfg.keyEnv] || null;
}
async function getImgKey(provider) {
  const cfg = IMG_PROVIDERS[provider]; if (!cfg) return null;
  if (pool) { try { const r = await pool.query('SELECT api_key FROM api_keys WHERE provider=$1',[provider]); if (r.rows[0]?.api_key) return r.rows[0].api_key; } catch {} }
  return process.env[cfg.keyEnv] || null;
}

// ─── Admin guard ──────────────────────────────────────────────────────────────
// FIX: Removed req.query acceptance — query params appear in server logs, exposing the token
const requireAdmin = (req,res,next) => {
  const t = req.headers['x-admin-token'] || req.body?.adminToken;
  if (t && process.env.ADMIN_TOKEN && t === process.env.ADMIN_TOKEN) return next();
  res.status(403).json({ error:'Unauthorized' });
};

function getRequestedUserToken(req) {
  return req.params.userToken || req.body?.userToken || req.headers['x-user-token'];
}

function requireUserAccess(req,res,next) {
  const requestedToken = getRequestedUserToken(req);
  const sessionToken = req.user?.token;
  if (!requestedToken) return res.status(400).json({ error:'userToken required' });
  if (!sessionToken || sessionToken !== requestedToken) {
    return res.status(403).json({ error:'Forbidden' });
  }
  next();
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

async function recordMemorySnapshot(userToken, content, source='manual', note='') {
  if (!pool || !userToken || !content?.trim()) return;
  try {
    await pool.query(
      'INSERT INTO memory_history (user_token,content,source,note) VALUES ($1,$2,$3,$4)',
      [userToken, content.slice(0, 5000), source, (note || '').slice(0, 256)]
    );
  } catch {}
}

async function extractFileText(file) {
  if (!file?.buffer) return '';
  if (file.mimetype === 'application/pdf') {
    const parsed = await pdfParse(file.buffer);
    return (parsed.text || '').replace(/\s+\n/g, '\n').trim().slice(0, 50000);
  }
  return file.buffer.toString('utf8').replace(/\u0000/g, ' ').trim().slice(0, 50000);
}

async function getUserFiles(userToken, fileIds=[]) {
  if (!pool || !userToken || !fileIds.length) return [];
  try {
    const r = await pool.query(
      'SELECT file_id,name,mime_type,size_bytes,extracted_text,created_at FROM user_files WHERE user_token=$1 AND file_id = ANY($2::varchar[]) ORDER BY created_at DESC',
      [userToken, fileIds]
    );
    return r.rows;
  } catch {
    return [];
  }
}

function buildFileContext(files) {
  if (!files.length) return '';
  return files.map((file, index) => {
    const snippet = (file.extracted_text || '').slice(0, 4000) || '[No extractable text found]';
    return `File ${index + 1}: ${file.name}\nType: ${file.mime_type || 'unknown'}\nContent:\n${snippet}`;
  }).join('\n\n');
}

app.post('/api/admin/verify', (req,res) => {
  const t = req.body?.token;
  res.json({ valid: !!(t && process.env.ADMIN_TOKEN && t === process.env.ADMIN_TOKEN) });
});

// ─── Rate limiting ────────────────────────────────────────────────────────────
const rateLimits = new Map();
function rateLimit(key, max=30, windowMs=60000) {
  const now = Date.now();
  if (!rateLimits.has(key)) rateLimits.set(key, { count:0, reset:now+windowMs });
  const e = rateLimits.get(key);
  if (now > e.reset) { e.count=0; e.reset=now+windowMs; }
  return ++e.count > max;
}
setInterval(()=>{ const now=Date.now(); rateLimits.forEach((v,k)=>{ if(now>v.reset) rateLimits.delete(k); }); }, 300000);

// ─── Static + Maintenance ─────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname,'public')));
let maintenanceMode=false, maintenanceMessage='NOVA is under maintenance. Back soon.';
app.use((req,res,next) => {
  if (maintenanceMode && req.path.startsWith('/api/') && !req.path.startsWith('/api/admin') && !req.path.startsWith('/auth'))
    return res.status(503).json({ maintenance:true, message:maintenanceMessage });
  next();
});

// ─── Providers endpoint ───────────────────────────────────────────────────────
app.get('/api/providers', async (req,res) => {
  const out={};
  for (const [id,cfg] of Object.entries(PROVIDERS)) { const key=await getKey(id); out[id]={ name:cfg.name, models:cfg.models, available:!!key }; }
  res.json(out);
});

// ─── Admin: API Keys ──────────────────────────────────────────────────────────
app.get('/api/admin/keys', requireAdmin, async (req,res) => {
  const keys={};
  for (const id of Object.keys(PROVIDERS)) { const k=await getKey(id); keys[id]={ set:!!k, source:id==='ollama'?'local':(pool?'db_or_env':'env') }; }
  res.json(keys);
});
app.post('/api/admin/keys', requireAdmin, async (req,res) => {
  const {provider,apiKey,label}=req.body;
  if (!provider||!PROVIDERS[provider]) return res.status(400).json({error:'Invalid provider'});
  if (!apiKey) return res.status(400).json({error:'apiKey required'});
  if (!pool) return res.status(500).json({error:'No DB. Set env var instead.'});
  try { await pool.query(`INSERT INTO api_keys (provider,api_key,label,updated_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT (provider) DO UPDATE SET api_key=$2,label=$3,updated_at=NOW()`,[provider,apiKey,label||provider]); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.delete('/api/admin/keys/:provider', requireAdmin, async (req,res) => {
  if (!pool) return res.status(500).json({error:'No DB'});
  try { await pool.query('DELETE FROM api_keys WHERE provider=$1',[req.params.provider]); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// ─── Image Generation ─────────────────────────────────────────────────────────
app.post('/api/image', async (req,res) => {
  const ip=req.ip||'unknown';
  if (rateLimit('img_'+ip,10,60000)) return res.status(429).json({error:'Rate limit exceeded'});
  const {provider='openai',model,prompt,size='1024x1024',n=1}=req.body;
  if (!prompt) return res.status(400).json({error:'Prompt required'});
  const cfg=IMG_PROVIDERS[provider]; if (!cfg) return res.status(400).json({error:'Unknown provider'});
  const apiKey=await getImgKey(provider); if (!apiKey) return res.status(400).json({error:`No API key for ${cfg.name}`});
  try {
    if (provider==='openai') {
      const r=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model:model||'dall-e-3',prompt,n,size,quality:'standard',response_format:'url'})});
      if (!r.ok){const d=await r.json();return res.status(r.status).json({error:d.error?.message||'Failed'});}
      const d=await r.json(); res.json({images:d.data.map(i=>i.url||i.b64_json)});
    } else if (provider==='stability') {
      const r=await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`,'Accept':'application/json'},body:JSON.stringify({text_prompts:[{text:prompt}],cfg_scale:7,height:1024,width:1024,steps:30,samples:n})});
      if (!r.ok){const d=await r.json();return res.status(r.status).json({error:d.message||'Failed'});}
      const d=await r.json(); res.json({images:d.artifacts.map(a=>`data:image/png;base64,${a.base64}`)});
    }
  } catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/image/providers', async (req,res) => {
  const providers={};
  for (const [id,cfg] of Object.entries(IMG_PROVIDERS)){const key=await getImgKey(id);providers[id]={name:cfg.name,models:cfg.models,active:!!key};}
  res.json({providers});
});

// ─── TTS ──────────────────────────────────────────────────────────────────────
app.post('/api/tts', async (req,res) => {
  const ip=req.ip||'unknown';
  if (rateLimit('tts_'+ip,20,60000)) return res.status(429).json({error:'Rate limit exceeded'});
  const {text,voice='nova'}=req.body;
  if (!text) return res.status(400).json({error:'Text required'});
  const apiKey=await getImgKey('openai');
  if (!apiKey) return res.status(400).json({error:'OpenAI API key required for TTS'});
  try {
    const r=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model:'tts-1',input:text.slice(0,4000),voice,response_format:'mp3'})});
    if (!r.ok){const d=await r.json().catch(()=>({}));return res.status(r.status).json({error:d.error?.message||'TTS failed'});}
    res.set('Content-Type','audio/mpeg');
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── Search (extracted as function so agent can call directly — no localhost HTTP) ──
// FIX: Agent was doing fetch('http://localhost:PORT/api/search') which breaks on Render
async function performSearch(query, timezone='UTC') {
  const q=query.toLowerCase();
  if (q.includes('today')||q.includes('date')||q.includes('time')||q.includes('what day')||q.includes('what time')) {
    try {
      const now=new Date();
      const dateStr=now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:timezone});
      const timeStr=now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:timezone});
      return {results:[{title:'Current Date & Time',url:'',snippet:'',content:`Today is ${dateStr}. The current time is ${timeStr} (${timezone}).`}],query,isDateTime:true};
    } catch {
      const now=new Date();
      return {results:[{title:'Current Date & Time',url:'',snippet:'',content:`Today is ${now.toDateString()}. Time: ${now.toLocaleTimeString()}.`}],query,isDateTime:true};
    }
  }
  const r=await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36','Accept':'text/html'}});
  if (!r.ok) throw new Error('Search failed');
  const html=await r.text();
  const results=[];
  const linkRe=/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const snipRe=/<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/g;
  const links=[...html.matchAll(linkRe)];
  const snips=[...html.matchAll(snipRe)];
  for (let i=0;i<Math.min(links.length,5);i++) {
    const url=links[i]?.[1]||'',title=links[i]?.[2]?.trim()||'',snippet=snips[i]?.[1]?.trim()||'';
    if (title&&url) results.push({title,url,snippet,content:''});
  }
  // FIX: Return explicit warning when results are empty instead of silent empty array
  if (!results.length) return {results:[],query,warning:'No results found — DuckDuckGo search may be temporarily unavailable'};
  for (let i=0;i<Math.min(results.length,2);i++) {
    try {
      if (results[i].url.startsWith('http')) {
        const pr=await fetch(results[i].url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'},signal:AbortSignal.timeout(5000)});
        if (pr.ok) {
          const text=(await pr.text()).replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,2000);
          results[i].content=text;
        }
      }
    } catch {}
  }
  return {results,query};
}

app.post('/api/search', async (req,res) => {
  const ip=req.ip||'unknown';
  if (rateLimit('search_'+ip,20,60000)) return res.status(429).json({error:'Rate limit exceeded'});
  const {query,timezone}=req.body;
  if (!query) return res.status(400).json({error:'Query required'});
  try { res.json(await performSearch(query,timezone)); } catch(e){res.status(500).json({error:e.message});}
});

// ─── Agent ────────────────────────────────────────────────────────────────────
const AGENT_TOOLS=[
  {type:'function',function:{name:'web_search',description:'Search the web for current information, recent events, or facts.',parameters:{type:'object',properties:{query:{type:'string'}},required:['query']}}},
  {type:'function',function:{name:'save_memory',description:'Save important facts about the user to long-term memory.',parameters:{type:'object',properties:{content:{type:'string'}},required:['content']}}},
  {type:'function',function:{name:'get_memory',description:'Retrieve stored memories about this user.',parameters:{type:'object',properties:{}}}}
  // FIX: Removed create_file — was a stub that did nothing and had no UI to display results
];

async function runAgentTask({ task, userToken, timezone='UTC', onStep=()=>{} }) {
  const key=await getKey('groq');
  if (!key) throw new Error('No AI provider available');
  const steps=[];
  const messages=[
    {role:'system',content:'You are NOVA Agent — an autonomous AI that completes tasks step by step using tools. Use web_search for current info. Use save_memory/get_memory for user context. Be concise and complete the task fully.'},
    {role:'user',content:task}
  ];
  const maxSteps=8;
  for (let i=0;i<maxSteps;i++) {
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',messages,tools:AGENT_TOOLS,tool_choice:'auto',max_tokens:1500}),
      signal:AbortSignal.timeout(30000)
    });
    if (!r.ok) throw new Error(`Groq error: ${r.status}`);
    const data=await r.json();
    const msg=data.choices?.[0]?.message;
    if (!msg) throw new Error('No response from AI');
    messages.push(msg);
    if (!msg.tool_calls?.length && msg.content) {
      const completeStep={step:i+1,type:'complete',content:msg.content};
      steps.push(completeStep);
      onStep([...steps]);
      break;
    }
    if (msg.tool_calls) {
      for (const call of msg.tool_calls) {
        let args;
        try{args=JSON.parse(call.function.arguments);}catch{args={};}
        let result='';
        steps.push({step:i+1,type:'tool',tool:call.function.name,args});
        if (call.function.name==='web_search') {
          try{const d=await performSearch(args.query||'',timezone);result=d.results?.map(item=>item.content||item.snippet).filter(Boolean).join('\n')||d.warning||'No results';}
          catch(e){result='Search failed: '+e.message;}
        } else if (call.function.name==='save_memory') {
          if (pool&&userToken){
            try{
              const memoryChunk=(args.content||'').slice(0,1000);
              await pool.query(`INSERT INTO memories (user_token,content) VALUES ($1,$2) ON CONFLICT (user_token) DO UPDATE SET content=memories.content||E'\n'||$2,updated_at=NOW()`,[userToken,memoryChunk]);
              const memoryRes=await pool.query('SELECT content FROM memories WHERE user_token=$1',[userToken]);
              await recordMemorySnapshot(userToken,memoryRes.rows[0]?.content||memoryChunk,'agent','Agent saved memory');
              result='Saved to memory';
            }catch{result='Memory save failed';}
          } else {
            result='Memory not available';
          }
        } else if (call.function.name==='get_memory') {
          if (pool&&userToken){try{const m=await pool.query('SELECT content FROM memories WHERE user_token=$1',[userToken]);result=m.rows[0]?.content||'No memories yet';}catch{result='Memory fetch failed';}}
          else{result='Memory not available';}
        }
        messages.push({role:'tool',tool_call_id:call.id,content:result});
        steps[steps.length-1].result=result;
        onStep([...steps]);
      }
    }
  }
  const lastStep=steps[steps.length-1];
  return { steps, result:lastStep?.content||'Task completed' };
}

app.post('/api/agent', async (req,res) => {
  const ip=req.ip||'unknown';
  // FIX: Strict separate rate limit — each agent call can cost up to 8 Groq API calls
  if (rateLimit('agent_'+ip,5,60000)) return res.status(429).json({error:'Rate limit exceeded. Agent limited to 5 tasks/min.'});
  const {task,userToken,timezone}=req.body;
  if (!task) return res.status(400).json({error:'Task required'});
  // FIX: Cap task size to prevent prompt injection via huge inputs
  if (task.length>2000) return res.status(400).json({error:'Task too long (max 2000 chars)'});
  try {
    const run=await runAgentTask({ task, userToken, timezone });
    res.json({success:true,steps:run.steps,result:run.result});
  } catch(e){res.status(500).json({error:e.message,steps:[]});}
});

app.post('/api/agent/tasks', requireUserAccess, async (req,res) => {
  const { task, userToken, timezone } = req.body;
  if (!task) return res.status(400).json({error:'Task required'});
  if (task.length>2000) return res.status(400).json({error:'Task too long (max 2000 chars)'});
  if (!pool) return res.status(503).json({error:'Database not available'});
  const taskId=createId('task');
  const title=task.split('\n')[0].slice(0,120);
  try{
    await pool.query(
      `INSERT INTO agent_tasks (task_id,user_token,title,status,steps_json)
       VALUES ($1,$2,$3,'queued','[]')`,
      [taskId,userToken,title]
    );
    agentTaskRuns.set(taskId, true);
    (async () => {
      try{
        await pool.query('UPDATE agent_tasks SET status=$2,updated_at=NOW() WHERE task_id=$1',[taskId,'running']);
        const run=await runAgentTask({
          task,
          userToken,
          timezone,
          onStep: async (steps) => {
            try{
              await pool.query('UPDATE agent_tasks SET steps_json=$2,updated_at=NOW() WHERE task_id=$1',[taskId,JSON.stringify(steps)]);
            } catch {}
          }
        });
        await pool.query(
          `UPDATE agent_tasks
           SET status='completed', steps_json=$2, result=$3, updated_at=NOW(), completed_at=NOW()
           WHERE task_id=$1`,
          [taskId,JSON.stringify(run.steps),run.result]
        );
      } catch (error) {
        await pool.query(
          `UPDATE agent_tasks
           SET status='failed', error=$2, updated_at=NOW(), completed_at=NOW()
           WHERE task_id=$1`,
          [taskId,error.message]
        ).catch(()=>{});
      } finally {
        agentTaskRuns.delete(taskId);
      }
    })();
    res.json({ok:true,taskId});
  } catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/agent/tasks/:userToken', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({tasks:[]});
  try{
    const r=await pool.query('SELECT task_id,title,status,steps_json,result,error,created_at,updated_at,completed_at FROM agent_tasks WHERE user_token=$1 ORDER BY created_at DESC LIMIT 20',[req.params.userToken]);
    res.json({tasks:r.rows.map(row=>({...row,steps:JSON.parse(row.steps_json||'[]')}))});
  } catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/agent/tasks/:userToken/:taskId', requireUserAccess, async (req,res) => {
  if (!pool) return res.status(404).json({error:'Not found'});
  try{
    const r=await pool.query('SELECT task_id,title,status,steps_json,result,error,created_at,updated_at,completed_at FROM agent_tasks WHERE user_token=$1 AND task_id=$2',[req.params.userToken,req.params.taskId]);
    const row=r.rows[0];
    if (!row) return res.status(404).json({error:'Not found'});
    res.json({task:{...row,steps:JSON.parse(row.steps_json||'[]')}});
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── Chat ─────────────────────────────────────────────────────────────────────
app.post('/api/chat', async (req,res) => {
  const ip=req.ip||'unknown';
  if (rateLimit(ip)) return res.status(429).json({error:{message:'Rate limit exceeded.'}});
  const {provider='groq',model,messages,max_tokens=2000,temperature=0.7,stream=false,userToken,fileIds=[]}=req.body;
  if (!messages||!Array.isArray(messages)||!messages.length) return res.status(400).json({error:{message:'messages required'}});
  const cfg=PROVIDERS[provider]; if (!cfg) return res.status(400).json({error:{message:`Unknown provider: ${provider}`}});
  let enrichedMessages=messages;
  if (Array.isArray(fileIds) && fileIds.length && req.user?.token && req.user.token===userToken) {
    const files=await getUserFiles(userToken,fileIds.slice(0,5));
    const fileContext=buildFileContext(files);
    if (fileContext) {
      enrichedMessages=[
        ...messages.slice(0,1),
        {role:'system',content:`The user attached files for this request. Use them as source material when relevant.\n\n${fileContext}`},
        ...messages.slice(1)
      ];
    }
  }
  if (provider==='ollama'){
    try{const r=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:model||'llama3.2',messages:enrichedMessages,stream:false})});if(!r.ok)return res.status(503).json({error:{message:'Ollama not running. Run: ollama serve'}});const d=await r.json();return res.json({choices:[{message:{role:'assistant',content:d.message?.content||''},finish_reason:'stop'}]});}
    catch{return res.status(503).json({error:{message:'Ollama not reachable at localhost:11434'}});}
  }
  const apiKey=await getKey(provider);
  if (!apiKey) return res.status(500).json({error:{message:`${cfg.name} API key not configured. Add it in Admin Panel → API Keys.`}});
  const reqBody=JSON.stringify({model:model||cfg.models[0],messages:enrichedMessages,max_tokens,temperature,stream});
  if (stream) {
    res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('Connection','keep-alive');
    try{
      const r=await fetch(`${cfg.baseURL}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:reqBody});
      if(!r.ok){const err=await r.text();res.write(`data: ${JSON.stringify({error:err})}\n\n`);res.write('data: [DONE]\n\n');return res.end();}
      const reader=r.body.getReader(),dec=new TextDecoder();
      while(true){const{done,value}=await reader.read();if(done)break;for(const line of dec.decode(value).split('\n')){if(!line.startsWith('data: '))continue;const d=line.slice(6);if(d==='[DONE]'){res.write('data: [DONE]\n\n');return res.end();}try{const p=JSON.parse(d);const c=p.choices?.[0]?.delta?.content||'';if(c)res.write(`data: ${JSON.stringify({content:c})}\n\n`);}catch{}}}
      res.write('data: [DONE]\n\n');res.end();
    }catch(e){res.write(`data: ${JSON.stringify({error:e.message})}\n\n`);res.write('data: [DONE]\n\n');res.end();}
    return;
  }
  try{const r=await fetch(`${cfg.baseURL}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:reqBody});const d=await r.json();if(!r.ok)return res.status(r.status).json(d);res.json(d);}
  catch(e){res.status(500).json({error:{message:e.message}});}
});

// ─── Memory ───────────────────────────────────────────────────────────────────
app.get('/api/memory/:userToken', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({memory:''});
  try{const r=await pool.query('SELECT content FROM memories WHERE user_token=$1',[req.params.userToken]);res.json({memory:r.rows[0]?.content||''});}
  catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/memory/:userToken/history', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({history:[]});
  try{
    const r=await pool.query('SELECT id,content,source,note,created_at FROM memory_history WHERE user_token=$1 ORDER BY created_at DESC LIMIT 20',[req.params.userToken]);
    res.json({history:r.rows});
  } catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/memory', requireUserAccess, async (req,res) => {
  const {userToken,content}=req.body;
  if (!userToken) return res.status(400).json({error:'userToken required'});
  if (!pool) return res.json({ok:true});
  try{
    const nextContent=(content||'').slice(0,5000);
    await pool.query(`INSERT INTO memories (user_token,content) VALUES ($1,$2) ON CONFLICT (user_token) DO UPDATE SET content=$2,updated_at=NOW()`,[userToken,nextContent]);
    await recordMemorySnapshot(userToken,nextContent,'manual','Manual update');
    res.json({ok:true});
  }
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/memory/learn', requireUserAccess, async (req,res) => {
  const {userToken,conversation}=req.body;
  if (!userToken||!conversation) return res.status(400).json({error:'Missing fields'});
  if (!pool) return res.json({ok:true});
  try{
    const memRes=await pool.query('SELECT content FROM memories WHERE user_token=$1',[userToken]);
    const existingMemory=memRes.rows[0]?.content||'';
    const key=await getKey('groq')||await getKey('cohere');
    if (!key) return res.json({ok:false,error:'No AI provider'});
    // FIX: Limit conversation size to prevent massive prompts
    const safeConv=conversation.slice(0,8000);
    const prompt=`You are NOVA's memory system. Extract important facts about the user from this conversation and merge with existing memory. Keep under 500 words. Bullet points only. Skip small talk.\n\nExisting memory:\n${existingMemory||'None'}\n\nConversation:\n${safeConv}\n\nOutput ONLY the updated memory:`;
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:'llama-3.1-8b-instant',messages:[{role:'user',content:prompt}],max_tokens:600,temperature:0.3})});
    if (!r.ok) return res.json({ok:false});
    const d=await r.json();
    const newMemory=d.choices?.[0]?.message?.content||existingMemory;
    await pool.query(`INSERT INTO memories (user_token,content) VALUES ($1,$2) ON CONFLICT (user_token) DO UPDATE SET content=$2,updated_at=NOW()`,[userToken,newMemory.slice(0,5000)]);
    await recordMemorySnapshot(userToken,newMemory,'learn','Auto-learn from recent conversation');
    res.json({ok:true,memory:newMemory});
  }catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/memory/:userToken/revert', requireUserAccess, async (req,res) => {
  const { historyId } = req.body;
  if (!historyId) return res.status(400).json({error:'historyId required'});
  if (!pool) return res.json({ok:true});
  try{
    const entry=await pool.query('SELECT content FROM memory_history WHERE id=$1 AND user_token=$2',[historyId,req.params.userToken]);
    const content=entry.rows[0]?.content;
    if (!content) return res.status(404).json({error:'History entry not found'});
    await pool.query(`INSERT INTO memories (user_token,content) VALUES ($1,$2) ON CONFLICT (user_token) DO UPDATE SET content=$2,updated_at=NOW()`,[req.params.userToken,content]);
    await recordMemorySnapshot(req.params.userToken,content,'revert',`Reverted to snapshot ${historyId}`);
    res.json({ok:true,memory:content});
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── Files ────────────────────────────────────────────────────────────────────
app.get('/api/files/:userToken', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({files:[]});
  try{
    const r=await pool.query('SELECT file_id,name,mime_type,size_bytes,created_at FROM user_files WHERE user_token=$1 ORDER BY created_at DESC LIMIT 30',[req.params.userToken]);
    res.json({files:r.rows});
  } catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/files/upload', upload.single('file'), requireUserAccess, async (req,res) => {
  const userToken=req.body?.userToken;
  const file=req.file;
  if (!userToken || !file) return res.status(400).json({error:'userToken and file are required'});
  if (!pool) return res.status(503).json({error:'Database not available'});
  try{
    const extractedText=await extractFileText(file);
    const fileId=createId('file');
    await pool.query(
      `INSERT INTO user_files (file_id,user_token,name,mime_type,size_bytes,extracted_text)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [fileId,userToken,file.originalname.slice(0,256),file.mimetype,file.size||0,extractedText]
    );
    res.json({ok:true,file:{file_id:fileId,name:file.originalname,mime_type:file.mimetype,size_bytes:file.size||0,excerpt:extractedText.slice(0,400)}});
  } catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/files/:userToken/:fileId', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({ok:true});
  try{
    await pool.query('DELETE FROM user_files WHERE user_token=$1 AND file_id=$2',[req.params.userToken,req.params.fileId]);
    res.json({ok:true});
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── Chats ────────────────────────────────────────────────────────────────────
// FIX: Restored full history join — previous version returned empty history arrays,
// breaking chat history loading for all logged-in users
app.get('/api/chats/:userToken', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({chats:[]});
  try{
    const r=await pool.query(
      `SELECT c.chat_id, c.title, c.provider, c.model, c.updated_at,
        (SELECT json_agg(json_build_object('role',role,'content',content) ORDER BY created_at)
         FROM chat_messages m WHERE m.chat_id=c.chat_id) as history
       FROM chats c WHERE c.user_token=$1 ORDER BY c.updated_at DESC LIMIT 60`,
      [req.params.userToken]
    );
    res.json({chats:r.rows.map(row=>({id:row.chat_id,title:row.title,provider:row.provider,model:row.model,updatedAt:row.updated_at,history:row.history||[]}))});
  }catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/chats/:userToken/:chatId/history', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({history:[]});
  try{
    const r=await pool.query(
      `SELECT m.role,m.content
       FROM chat_messages m
       JOIN chats c ON c.chat_id=m.chat_id
       WHERE m.chat_id=$1 AND c.user_token=$2
       ORDER BY m.created_at`,
      [req.params.chatId, req.params.userToken]
    );
    res.json({history:r.rows||[]});
  }
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/chats', requireUserAccess, async (req,res) => {
  const {userToken,chatId,title,history,provider,model}=req.body;
  if (!userToken||!chatId) return res.status(400).json({error:'Missing fields'});
  if (!pool) return res.json({ok:true});
  try{
    await pool.query(`INSERT INTO chats (chat_id,user_token,title,provider,model,updated_at) VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (chat_id) DO UPDATE SET title=$3,provider=$4,model=$5,updated_at=NOW()`,[chatId,userToken,(title||'Chat').slice(0,200),provider||'groq',model||'']);
    await pool.query('DELETE FROM chat_messages WHERE chat_id=$1',[chatId]);
    if (history?.length){const vals=history.map((_,i)=>`($1,$${i*2+2},$${i*2+3})`).join(',');await pool.query(`INSERT INTO chat_messages (chat_id,role,content) VALUES ${vals}`,[chatId,...history.flatMap(m=>[m.role,m.content])]);}
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/chats/:userToken/:chatId', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({ok:true});
  try{await pool.query('DELETE FROM chats WHERE chat_id=$1 AND user_token=$2',[req.params.chatId,req.params.userToken]);res.json({ok:true});}
  catch(e){res.status(500).json({error:e.message});}
});

// FIX: ALL THREE DEBUG ENDPOINTS REMOVED
// /api/debug/db, /api/debug/chats/:token, /api/debug/users were completely unprotected
// and exposed user tokens + database structure to anyone on the internet

// ─── Shared Chats ─────────────────────────────────────────────────────────────
function genShareCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<8;i++)s+=c[Math.floor(Math.random()*c.length)];return s;}

app.post('/api/shared/create', async (req,res) => {
  const {userToken,userName,title,provider,model}=req.body;
  if (!userToken) return res.status(400).json({error:'userToken required'});
  if (!pool) return res.status(503).json({error:'Database not available'});
  try{const code=genShareCode();await pool.query('INSERT INTO shared_chats (share_code,creator_token,title,provider,model) VALUES ($1,$2,$3,$4,$5)',[code,userToken,(title||'Shared Chat').slice(0,200),provider||'groq',model||'']);await pool.query('INSERT INTO shared_participants (share_code,user_token,user_name,last_seen) VALUES ($1,$2,$3,NOW())',[code,userToken,(userName||'User').slice(0,100)]);res.json({shareCode:code,title:title||'Shared Chat'});}
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/shared/join', async (req,res) => {
  const {shareCode,userToken,userName}=req.body;
  if (!shareCode||!userToken) return res.status(400).json({error:'shareCode and userToken required'});
  if (!pool) return res.status(503).json({error:'Database not available'});
  try{
    const chatRes=await pool.query('SELECT * FROM shared_chats WHERE share_code=$1 AND is_active=true',[shareCode]);
    if (!chatRes.rows.length) return res.status(404).json({error:'Shared chat not found or inactive'});
    const chat=chatRes.rows[0];
    await pool.query(`INSERT INTO shared_participants (share_code,user_token,user_name,last_seen) VALUES ($1,$2,$3,NOW()) ON CONFLICT (share_code,user_token) DO UPDATE SET user_name=$3,last_seen=NOW()`,[shareCode,userToken,(userName||'User').slice(0,100)]);
    const partsRes=await pool.query('SELECT user_token,user_name,joined_at,last_seen FROM shared_participants WHERE share_code=$1',[shareCode]);
    const msgsRes=await pool.query('SELECT id,user_token,user_name,role,content,created_at,edited_at,reactions_json FROM shared_messages WHERE share_code=$1 ORDER BY created_at ASC LIMIT 200',[shareCode]);
    res.json({shareCode:chat.share_code,title:chat.title,provider:chat.provider,model:chat.model,creatorToken:chat.creator_token,participants:partsRes.rows,messages:msgsRes.rows});
  }catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/shared/leave', async (req,res) => {
  const {shareCode,userToken}=req.body;
  if (!shareCode||!userToken) return res.status(400).json({error:'Missing fields'});
  if (!pool) return res.json({ok:true});
  try{await pool.query('DELETE FROM shared_participants WHERE share_code=$1 AND user_token=$2',[shareCode,userToken]);res.json({ok:true});}
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/shared/message', async (req,res) => {
  const {shareCode,userToken,userName,role,content}=req.body;
  if (!shareCode||!userToken||!role||!content) return res.status(400).json({error:'Missing fields'});
  if (!pool) return res.status(503).json({error:'Database not available'});
  try{
    // FIX: Verify user is a real participant before posting — prevents spoofing
    const p=await pool.query('SELECT 1 FROM shared_participants WHERE share_code=$1 AND user_token=$2',[shareCode,userToken]);
    if (!p.rows.length) return res.status(403).json({error:'Not a participant in this chat'});
    await pool.query('UPDATE shared_participants SET last_seen=NOW() WHERE share_code=$1 AND user_token=$2',[shareCode,userToken]);
    const r=await pool.query('INSERT INTO shared_messages (share_code,user_token,user_name,role,content) VALUES ($1,$2,$3,$4,$5) RETURNING id,created_at',[shareCode,userToken,(userName||'User').slice(0,100),role,content.slice(0,20000)]);
    await pool.query('UPDATE shared_chats SET updated_at=NOW() WHERE share_code=$1',[shareCode]);
    res.json({id:r.rows[0].id,created_at:r.rows[0].created_at});
  }catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/shared/presence', async (req,res) => {
  const { shareCode, userToken, userName } = req.body;
  if (!shareCode || !userToken) return res.status(400).json({error:'shareCode and userToken required'});
  if (!pool) return res.json({ok:true});
  try{
    await pool.query(`INSERT INTO shared_participants (share_code,user_token,user_name,last_seen) VALUES ($1,$2,$3,NOW()) ON CONFLICT (share_code,user_token) DO UPDATE SET user_name=$3,last_seen=NOW()`,[shareCode,userToken,(userName||'User').slice(0,100)]);
    res.json({ok:true});
  } catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/shared/message/:id', async (req,res) => {
  const { shareCode, userToken, content } = req.body;
  if (!shareCode || !userToken || !content) return res.status(400).json({error:'Missing fields'});
  if (!pool) return res.status(503).json({error:'Database not available'});
  try{
    const ownerCheck = await pool.query('SELECT user_token,share_code FROM shared_messages WHERE id=$1',[req.params.id]);
    const msg = ownerCheck.rows[0];
    if (!msg || msg.share_code !== shareCode) return res.status(404).json({error:'Message not found'});
    if (msg.user_token !== userToken) return res.status(403).json({error:'Only the author can edit this message'});
    await pool.query('UPDATE shared_messages SET content=$2,edited_at=NOW() WHERE id=$1',[req.params.id,content.slice(0,20000)]);
    res.json({ok:true});
  } catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/shared/message/:id/react', async (req,res) => {
  const { shareCode, userToken, emoji } = req.body;
  if (!shareCode || !userToken || !emoji) return res.status(400).json({error:'Missing fields'});
  if (!pool) return res.status(503).json({error:'Database not available'});
  try{
    const p=await pool.query('SELECT 1 FROM shared_participants WHERE share_code=$1 AND user_token=$2',[shareCode,userToken]);
    if (!p.rows.length) return res.status(403).json({error:'Not a participant in this chat'});
    const msgRes=await pool.query('SELECT reactions_json FROM shared_messages WHERE id=$1 AND share_code=$2',[req.params.id,shareCode]);
    const current=msgRes.rows[0];
    if (!current) return res.status(404).json({error:'Message not found'});
    let reactions={};
    try{reactions=JSON.parse(current.reactions_json||'{}');}catch{}
    const users=Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
    reactions[emoji]=users.includes(userToken) ? users.filter(token=>token!==userToken) : [...users,userToken];
    if (!reactions[emoji].length) delete reactions[emoji];
    await pool.query('UPDATE shared_messages SET reactions_json=$2 WHERE id=$1',[req.params.id,JSON.stringify(reactions)]);
    res.json({ok:true,reactions});
  } catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/shared/poll/:shareCode/:afterId', async (req,res) => {
  if (!pool) return res.json({messages:[],participants:[]});
  try{
    const userToken = getRequestedUserToken(req);
    if (!userToken) return res.status(400).json({error:'userToken required'});
    const participantRes = await pool.query('SELECT 1 FROM shared_participants WHERE share_code=$1 AND user_token=$2',[req.params.shareCode,userToken]);
    if (!participantRes.rows.length) return res.status(403).json({error:'Not a participant in this chat'});
    await pool.query('UPDATE shared_participants SET last_seen=NOW() WHERE share_code=$1 AND user_token=$2',[req.params.shareCode,userToken]);
    const msgsRes=await pool.query('SELECT id,user_token,user_name,role,content,created_at,edited_at,reactions_json FROM shared_messages WHERE share_code=$1 AND id > $2 ORDER BY id ASC LIMIT 50',[req.params.shareCode,parseInt(req.params.afterId)||0]);
    const partsRes=await pool.query('SELECT user_token,user_name,last_seen FROM shared_participants WHERE share_code=$1',[req.params.shareCode]);
    res.json({messages:msgsRes.rows,participants:partsRes.rows});
  }catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/shared/my/:userToken', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({sharedChats:[]});
  try{
    const r=await pool.query(`SELECT s.share_code,s.title,s.creator_token,s.provider,s.model,s.updated_at,(SELECT COUNT(*) FROM shared_participants p WHERE p.share_code=s.share_code) as participant_count FROM shared_participants p JOIN shared_chats s ON p.share_code=s.share_code WHERE p.user_token=$1 AND s.is_active=true ORDER BY s.updated_at DESC LIMIT 20`,[req.params.userToken]);
    res.json({sharedChats:r.rows.map(row=>({shareCode:row.share_code,title:row.title,creatorToken:row.creator_token,isOwner:row.creator_token===req.params.userToken,provider:row.provider,model:row.model,participantCount:parseInt(row.participant_count),updatedAt:row.updated_at}))});
  }catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/shared/:shareCode', async (req,res) => {
  const userToken=req.headers['x-user-token']||req.body?.userToken;
  const nextTitle=(req.body?.title||'').trim();
  if (!userToken) return res.status(400).json({error:'userToken required'});
  if (!nextTitle) return res.status(400).json({error:'title required'});
  if (!pool) return res.json({ok:true,title:nextTitle.slice(0,200)});
  try{
    const c=await pool.query('SELECT creator_token FROM shared_chats WHERE share_code=$1',[req.params.shareCode]);
    if (!c.rows.length) return res.status(404).json({error:'Not found'});
    if (c.rows[0].creator_token!==userToken) return res.status(403).json({error:'Only the owner can update this chat'});
    const updated=await pool.query('UPDATE shared_chats SET title=$2,updated_at=NOW() WHERE share_code=$1 RETURNING share_code,title,provider,model,creator_token',[req.params.shareCode,nextTitle.slice(0,200)]);
    res.json({ok:true,chat:{shareCode:updated.rows[0].share_code,title:updated.rows[0].title,provider:updated.rows[0].provider,model:updated.rows[0].model,creatorToken:updated.rows[0].creator_token}});
  }catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/shared/:shareCode', async (req,res) => {
  // FIX: Accept userToken from header OR body for flexibility
  const userToken=req.headers['x-user-token']||req.body?.userToken;
  if (!userToken) return res.status(400).json({error:'userToken required'});
  if (!pool) return res.json({ok:true});
  try{
    const c=await pool.query('SELECT creator_token FROM shared_chats WHERE share_code=$1',[req.params.shareCode]);
    if (!c.rows.length) return res.status(404).json({error:'Not found'});
    if (c.rows[0].creator_token!==userToken) return res.status(403).json({error:'Only the owner can close this chat'});
    await pool.query('UPDATE shared_chats SET is_active=false WHERE share_code=$1',[req.params.shareCode]);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message});}
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.get('/auth/google',(req,res,next)=>{if(!process.env.GOOGLE_CLIENT_ID)return res.redirect('/?error=google_not_configured');passport.authenticate('google',{scope:['profile','email']})(req,res,next);});
app.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/?error=auth_failed'}),(req,res)=>{res.redirect(`/#auth=${encodeURIComponent(JSON.stringify({token:req.user.token,user:{name:req.user.name,email:req.user.email,picture:req.user.picture}}))}`);});
app.get('/auth/me',(req,res)=>res.json({user:req.user||null}));
app.post('/auth/logout',(req,res)=>req.logout(()=>res.json({ok:true})));

// ─── Admin ────────────────────────────────────────────────────────────────────
app.get('/api/admin/status', requireAdmin, async (req,res) => {
  let users=0,chats=0,messages=0;
  if (pool){try{users=parseInt((await pool.query('SELECT COUNT(*) FROM users')).rows[0]?.count||0);chats=parseInt((await pool.query('SELECT COUNT(*) FROM chats')).rows[0]?.count||0);messages=parseInt((await pool.query('SELECT COUNT(*) FROM chat_messages')).rows[0]?.count||0);}catch{}}
  const providerStatus={};
  for(const[id,cfg]of Object.entries(PROVIDERS)){const k=await getKey(id);providerStatus[id]={name:cfg.name,active:!!k};}
  res.json({maintenance:maintenanceMode,message:maintenanceMessage,uptime:process.uptime(),memory:process.memoryUsage(),users,chats,messages,providers:providerStatus});
});
app.get('/api/admin/users', requireAdmin, async (req,res) => {
  if (!pool) return res.json({users:[]});
  try{const r=await pool.query(`SELECT u.id,u.name,u.email,u.picture,u.user_token,u.is_banned,u.created_at,u.last_login,(SELECT COUNT(*) FROM chats c WHERE c.user_token=u.user_token) as chat_count FROM users u ORDER BY u.last_login DESC LIMIT 500`);res.json({users:r.rows});}
  catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/admin/user/:id', requireAdmin, async (req,res) => {
  if (!pool) return res.json({ok:true});
  try{const u=await pool.query('SELECT user_token FROM users WHERE id=$1',[req.params.id]);if(u.rows[0]){const t=u.rows[0].user_token;await pool.query('DELETE FROM chats WHERE user_token=$1',[t]);await pool.query('DELETE FROM memories WHERE user_token=$1',[t]);}await pool.query('DELETE FROM users WHERE id=$1',[req.params.id]);res.json({ok:true});}
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/admin/user/:id/ban', requireAdmin, async (req,res) => {
  if (!pool) return res.json({ok:true});
  try{await pool.query('UPDATE users SET is_banned=$1 WHERE id=$2',[!!req.body.banned,req.params.id]);res.json({ok:true});}
  catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/admin/chats', requireAdmin, async (req,res) => {
  if (!pool) return res.json({chats:[]});
  const page=parseInt(req.query.page)||0,limit=50,search=req.query.search||'';
  try{
    let r;
    if(search){r=await pool.query(`SELECT c.chat_id,c.title,c.provider,c.model,c.updated_at,u.name as user_name,u.email as user_email FROM chats c LEFT JOIN users u ON c.user_token=u.user_token WHERE c.title ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1 ORDER BY c.updated_at DESC LIMIT $2 OFFSET $3`,[`%${search}%`,limit,page*limit]);}
    else{r=await pool.query(`SELECT c.chat_id,c.title,c.provider,c.model,c.updated_at,u.name as user_name,u.email as user_email FROM chats c LEFT JOIN users u ON c.user_token=u.user_token ORDER BY c.updated_at DESC LIMIT $1 OFFSET $2`,[limit,page*limit]);}
    const total=parseInt((await pool.query('SELECT COUNT(*) FROM chats')).rows[0]?.count||0);
    res.json({chats:r.rows,total,page,limit});
  }catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/admin/chats/:chatId/messages', requireAdmin, async (req,res) => {
  if (!pool) return res.json({messages:[]});
  try{const r=await pool.query('SELECT role,content,created_at FROM chat_messages WHERE chat_id=$1 ORDER BY created_at',[req.params.chatId]);res.json({messages:r.rows});}
  catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/admin/chats/:chatId', requireAdmin, async (req,res) => {
  if (!pool) return res.json({ok:true});
  try{await pool.query('DELETE FROM chats WHERE chat_id=$1',[req.params.chatId]);res.json({ok:true});}
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/admin/maintenance', requireAdmin, (req,res) => {
  const{enabled,message}=req.body;
  if(typeof enabled==='boolean')maintenanceMode=enabled;
  if(message)maintenanceMessage=message;
  res.json({ok:true,maintenance:maintenanceMode});
});
app.get('/api/changelog', async (req,res) => {
  if (!pool) return res.json({entries:[]});
  try{const r=await pool.query('SELECT * FROM changelog WHERE published=true ORDER BY created_at DESC LIMIT 50');res.json({entries:r.rows});}
  catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/admin/changelog', requireAdmin, async (req,res) => {
  if (!pool) return res.json({entries:[]});
  try{const r=await pool.query('SELECT * FROM changelog ORDER BY created_at DESC');res.json({entries:r.rows});}
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/admin/changelog', requireAdmin, async (req,res) => {
  const{version,title,body,type,published}=req.body;
  if(!version||!title||!body) return res.status(400).json({error:'version, title, body required'});
  if(!pool) return res.status(500).json({error:'No DB'});
  try{const r=await pool.query('INSERT INTO changelog (version,title,body,type,published) VALUES ($1,$2,$3,$4,$5) RETURNING *',[version,title,body,type||'update',published!==false]);res.json({ok:true,entry:r.rows[0]});}
  catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/admin/changelog/:id', requireAdmin, async (req,res) => {
  const{version,title,body,type,published}=req.body;
  if(!pool) return res.status(500).json({error:'No DB'});
  try{await pool.query('UPDATE changelog SET version=$1,title=$2,body=$3,type=$4,published=$5 WHERE id=$6',[version,title,body,type||'update',published!==false,req.params.id]);res.json({ok:true});}
  catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/admin/changelog/:id', requireAdmin, async (req,res) => {
  if(!pool) return res.json({ok:true});
  try{await pool.query('DELETE FROM changelog WHERE id=$1',[req.params.id]);res.json({ok:true});}
  catch(e){res.status(500).json({error:e.message});}
});


// ─── Folders ──────────────────────────────────────────────────────────────────
app.get('/api/folders/:userToken', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({folders:[]});
  try {
    const f = await pool.query('SELECT * FROM folders WHERE user_token=$1 ORDER BY position,id', [req.params.userToken]);
    const c = await pool.query('SELECT folder_id, COUNT(*) as count FROM chats WHERE user_token=$1 AND folder_id IS NOT NULL GROUP BY folder_id', [req.params.userToken]);
    const counts = Object.fromEntries(c.rows.map(r => [r.folder_id, parseInt(r.count)]));
    res.json({folders: f.rows.map(f => ({...f, chatCount: counts[f.id]||0}))});
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/folders', requireUserAccess, async (req,res) => {
  const {userToken,name,color,icon} = req.body;
  if (!userToken||!name) return res.status(400).json({error:'Missing fields'});
  if (!pool) return res.json({ok:true,folder:{id:Date.now(),name,color,icon}});
  try {
    const r = await pool.query('INSERT INTO folders (user_token,name,color,icon) VALUES ($1,$2,$3,$4) RETURNING *', [userToken,name.slice(0,128),color||'default',icon||'📁']);
    res.json({ok:true,folder:r.rows[0]});
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.put('/api/folders/:id', requireUserAccess, async (req,res) => {
  const {userToken,name,color,icon} = req.body;
  if (!pool) return res.json({ok:true});
  try {
    await pool.query('UPDATE folders SET name=$1,color=$2,icon=$3 WHERE id=$4 AND user_token=$5', [name,color,icon,req.params.id,userToken]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.delete('/api/folders/:id', requireUserAccess, async (req,res) => {
  const {userToken} = req.body;
  if (!pool) return res.json({ok:true});
  try {
    await pool.query('UPDATE chats SET folder_id=NULL WHERE folder_id=$1', [req.params.id]);
    await pool.query('DELETE FROM folders WHERE id=$1 AND user_token=$2', [req.params.id,userToken]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/chats/:chatId/folder', requireUserAccess, async (req,res) => {
  const {userToken,folderId} = req.body;
  if (!pool) return res.json({ok:true});
  try {
    await pool.query('UPDATE chats SET folder_id=$1 WHERE chat_id=$2 AND user_token=$3', [folderId||null,req.params.chatId,userToken]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/chats/:chatId/pin', requireUserAccess, async (req,res) => {
  const {userToken,pinned} = req.body;
  if (!pool) return res.json({ok:true});
  try {
    await pool.query('UPDATE chats SET pinned=$1 WHERE chat_id=$2 AND user_token=$3', [!!pinned,req.params.chatId,userToken]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ─── Chat Search ──────────────────────────────────────────────────────────────
app.get('/api/search/chats', requireUserAccess, async (req,res) => {
  const {userToken,q} = req.query;
  if (!userToken||!q) return res.json({results:[]});
  if (!pool) return res.json({results:[]});
  try {
    const r = await pool.query(
      `SELECT c.chat_id, c.title, c.provider, c.updated_at,
        (SELECT content FROM chat_messages m WHERE m.chat_id=c.chat_id AND m.content ILIKE $2 ORDER BY created_at LIMIT 1) as snippet
       FROM chats c WHERE c.user_token=$1 AND (c.title ILIKE $2 OR EXISTS (SELECT 1 FROM chat_messages m WHERE m.chat_id=c.chat_id AND m.content ILIKE $2))
       ORDER BY c.updated_at DESC LIMIT 30`,
      [userToken, `%${q}%`]
    );
    res.json({results: r.rows.filter(r=>r.snippet||r.title.toLowerCase().includes(q.toLowerCase()))});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ─── Prompt Library ───────────────────────────────────────────────────────────
app.get('/api/prompts/:userToken', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({prompts:[]});
  try {
    const r = await pool.query('SELECT * FROM prompts WHERE user_token=$1 ORDER BY use_count DESC, created_at DESC', [req.params.userToken]);
    res.json({prompts:r.rows});
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/prompts', async (req,res) => {
  const {userToken,title,content,category} = req.body;
  if (!userToken||!title||!content) return res.status(400).json({error:'Missing fields'});
  if (!pool) return res.json({ok:true,prompt:{id:Date.now(),title,content,category}});
  try {
    const r = await pool.query('INSERT INTO prompts (user_token,title,content,category) VALUES ($1,$2,$3,$4) RETURNING *', [userToken,title.slice(0,128),content.slice(0,4000),category||'General']);
    res.json({ok:true,prompt:r.rows[0]});
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.delete('/api/prompts/:id', async (req,res) => {
  const {userToken} = req.body;
  if (!pool) return res.json({ok:true});
  try {
    await pool.query('DELETE FROM prompts WHERE id=$1 AND user_token=$2', [req.params.id,userToken]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/prompts/:id/use', async (req,res) => {
  if (!pool) return res.json({ok:true});
  try { await pool.query('UPDATE prompts SET use_count=use_count+1 WHERE id=$1', [req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// ─── User Settings (system prompt, BYOK, TTS, search) ────────────────────────
app.get('/api/settings/:userToken', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({settings:{}});
  try {
    const r = await pool.query('SELECT system_prompt,byok_groq,byok_cohere,search_enabled,tts_enabled,tts_voice FROM user_settings WHERE user_token=$1', [req.params.userToken]);
    const s = r.rows[0]||{};
    // Mask BYOK keys — only tell frontend if they are SET, never return the actual key
    res.json({settings:{...s, byok_groq:s.byok_groq?'SET':null, byok_cohere:s.byok_cohere?'SET':null}});
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/settings', async (req,res) => {
  const {userToken,...fields} = req.body;
  if (!userToken) return res.status(400).json({error:'userToken required'});
  if (!pool) return res.json({ok:true});
  const allowed = ['system_prompt','byok_groq','byok_cohere','search_enabled','tts_enabled','tts_voice'];
  const updates = Object.entries(fields).filter(([k])=>allowed.includes(k));
  if (!updates.length) return res.json({ok:true});
  try {
    const setClauses = updates.map(([k],i)=>`${k}=$${i+2}`).join(',');
    await pool.query(
      `INSERT INTO user_settings (user_token,${updates.map(([k])=>k).join(',')}) VALUES ($1,${updates.map((_,i)=>`$${i+2}`).join(',')})
       ON CONFLICT (user_token) DO UPDATE SET ${setClauses},updated_at=NOW()`,
      [userToken,...updates.map(([,v])=>v)]
    );
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// BYOK — get user's own key if set, fall back to system key
async function getUserKey(userToken, provider) {
  if (pool && userToken) {
    try {
      const r = await pool.query(`SELECT byok_${provider} FROM user_settings WHERE user_token=$1`, [userToken]);
      if (r.rows[0]?.[`byok_${provider}`]) return r.rows[0][`byok_${provider}`];
    } catch {}
  }
  return getKey(provider);
}

// ─── Usage Stats ──────────────────────────────────────────────────────────────
app.post('/api/usage/track', async (req,res) => {
  const {userToken,provider,messages=1,tokensEst=0} = req.body;
  if (!userToken||!pool) return res.json({ok:true});
  try {
    await pool.query(
      `INSERT INTO usage_stats (user_token,provider,messages,tokens_est) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_token,date,provider) DO UPDATE SET messages=usage_stats.messages+$3,tokens_est=usage_stats.tokens_est+$4`,
      [userToken,provider,messages,tokensEst]
    );
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.get('/api/usage/:userToken', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({stats:[],totals:{}});
  try {
    const r = await pool.query(
      `SELECT date, provider, messages, tokens_est FROM usage_stats WHERE user_token=$1 ORDER BY date DESC LIMIT 90`,
      [req.params.userToken]
    );
    const totals = r.rows.reduce((a,row)=>({messages:(a.messages||0)+row.messages, tokens:(a.tokens||0)+row.tokens_est}),{});
    const streak = calcStreak(r.rows.map(r=>r.date));
    res.json({stats:r.rows, totals, streak});
  } catch(e) { res.status(500).json({error:e.message}); }
});
function calcStreak(dates) {
  const unique = [...new Set(dates.map(d=>new Date(d).toDateString()))];
  if (!unique.length) return 0;
  let streak=1, today=new Date().toDateString();
  if (unique[0]!==today) return 0;
  for (let i=1;i<unique.length;i++) {
    const a=new Date(unique[i-1]),b=new Date(unique[i]);
    if ((a-b)/(1000*60*60*24)===1) streak++;
    else break;
  }
  return streak;
}

// ─── Pinned Messages ──────────────────────────────────────────────────────────
app.get('/api/pinned/:userToken', requireUserAccess, async (req,res) => {
  if (!pool) return res.json({pinned:[]});
  try {
    const r = await pool.query('SELECT p.*,c.title as chat_title FROM pinned_messages p JOIN chats c ON p.chat_id=c.chat_id WHERE p.user_token=$1 ORDER BY p.created_at DESC LIMIT 50', [req.params.userToken]);
    res.json({pinned:r.rows});
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/pinned', requireUserAccess, async (req,res) => {
  const {chatId,userToken,role,content,note} = req.body;
  if (!chatId||!userToken||!content) return res.status(400).json({error:'Missing fields'});
  if (!pool) return res.json({ok:true});
  try {
    await pool.query('INSERT INTO pinned_messages (chat_id,user_token,role,content,note) VALUES ($1,$2,$3,$4,$5)', [chatId,userToken,role,content.slice(0,10000),note||'']);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.delete('/api/pinned/:id', requireUserAccess, async (req,res) => {
  const {userToken} = req.body;
  if (!pool) return res.json({ok:true});
  try {
    await pool.query('DELETE FROM pinned_messages WHERE id=$1 AND user_token=$2', [req.params.id,userToken]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ─── Export Chat ──────────────────────────────────────────────────────────────
app.get('/api/export/:userToken/:chatId', requireUserAccess, async (req,res) => {
  if (!pool) return res.status(503).json({error:'No DB'});
  try {
    const c = await pool.query('SELECT title,provider,model,created_at FROM chats WHERE chat_id=$1 AND user_token=$2', [req.params.chatId,req.params.userToken]);
    if (!c.rows.length) return res.status(404).json({error:'Not found'});
    const chat = c.rows[0];
    const msgs = await pool.query('SELECT role,content,created_at FROM chat_messages WHERE chat_id=$1 ORDER BY created_at', [req.params.chatId]);
    let md = `# ${chat.title||'NOVA Chat'}\n`;
    md += `**Provider:** ${chat.provider||'?'} · **Model:** ${chat.model||'?'}\n`;
    md += `**Date:** ${new Date(chat.created_at).toLocaleString()}\n\n---\n\n`;
    msgs.rows.forEach(m => {
      const role = m.role==='user'?'**You**':'**NOVA**';
      md += `${role}\n\n${m.content}\n\n---\n\n`;
    });
    res.set('Content-Type','text/markdown');
    res.set('Content-Disposition',`attachment; filename="nova-chat-${req.params.chatId.slice(-6)}.md"`);
    res.send(md);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ─── Fallback ─────────────────────────────────────────────────────────────────
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT,()=>{
  console.log(`NOVA running on :${PORT}`);
  console.log(`DB: ${pool?'connected':'not configured'}`);
  console.log(`Admin: ${process.env.ADMIN_TOKEN?'configured ✓':'NOT SET — set ADMIN_TOKEN env var'}`);
});
