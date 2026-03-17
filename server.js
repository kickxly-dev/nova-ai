require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();

// Trust proxy for secure cookies behind Render's load balancer
app.set('trust proxy', 1);

// Session configuration for OAuth (production only)
app.use(session({
  secret: process.env.SESSION_SECRET || 'nova-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'none' } // 7 days
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    const user = {
      id: profile.id,
      name: profile.displayName,
      email: profile.emails?.[0]?.value,
      picture: profile.photos?.[0]?.value,
      token: 'g_' + profile.id
    };
    // Store user in database if available
    if (pool) {
      try {
        await pool.query(`
          INSERT INTO users (google_id, name, email, picture, user_token)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (google_id) DO UPDATE SET name = $2, email = $3, picture = $4, last_login = NOW()
        `, [user.id, user.name, user.email, user.picture, user.token]);
      } catch (err) {
        console.error('Error saving user:', err.message);
      }
    }
    return done(null, user);
  }));
}

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Admin Page Route (MUST BE BEFORE static files and fallback) ─────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database ────────────────────────────────────────────────────────────────
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

async function initDB() {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id VARCHAR(64) UNIQUE,
        name VARCHAR(128),
        email VARCHAR(128),
        picture TEXT,
        user_token VARCHAR(64) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_api_keys (
        id SERIAL PRIMARY KEY,
        user_token VARCHAR(64) NOT NULL,
        provider VARCHAR(32) NOT NULL,
        api_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_token, provider)
      )
    `);
    // Chat persistence tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        chat_id VARCHAR(64) UNIQUE NOT NULL,
        user_token VARCHAR(64) NOT NULL,
        title VARCHAR(256),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        chat_id VARCHAR(64) REFERENCES chats(chat_id) ON DELETE CASCADE,
        role VARCHAR(16) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Database initialized');
  } catch (err) {
    console.error('Database init error:', err.message);
  }
}

initDB();

// ─── Provider config ──────────────────────────────────────────────────────────
const PROVIDERS = {
  // FREE - Local AI (Ollama)
  ollama: {
    name: 'Ollama (Local)',
    baseURL: 'http://localhost:11434/v1',
    keyEnv: null, // No key needed!
    free: true,
    local: true,
  },
  // FREE - NOVA hosted model
  nova: {
    name: 'NOVA Free',
    baseURL: null, // Custom handler
    keyEnv: null,
    free: true,
    hosted: true,
  },
  // FREE - Groq (fast inference)
  groq: {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    free: true,
    freeTier: true,
  },
  // FREE - Hugging Face
  huggingface: {
    name: 'Hugging Face',
    baseURL: 'https://api-inference.huggingface.co/models',
    keyEnv: 'HUGGINGFACE_API_KEY',
    free: true,
    freeTier: true,
  },
  // FREE - DeepSeek
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    keyEnv: 'DEEPSEEK_API_KEY',
    free: true,
    freeTier: true,
  },
  // FREE - NVIDIA Build (OpenAI-compatible)
  nvidia: {
    name: 'NVIDIA Build',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    keyEnv: 'NVIDIA_API_KEY',
    free: true,
    freeTier: true,
  },
  // FREE - NOVA Custom (wrapper around Groq with custom prompts)
  nova_custom: {
    name: 'NOVA Custom',
    baseURL: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    free: true,
    freeTier: true,
    wrapper: true,
  },
  // PAID providers
  anthropic_compat: {
    name: 'Anthropic (via OpenRouter)',
    baseURL: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
  },
  openrouter: {
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
  },
  cohere: {
    name: 'Cohere',
    baseURL: 'https://api.cohere.com/compatibility/v1',
    keyEnv: 'COHERE_API_KEY',
  },
  tavily: {
    name: 'Tavily (Search)',
    baseURL: null,
    keyEnv: 'TAVILY_API_KEY',
  },
};

// ─── Helper: get API key (user DB key takes priority, then env var) ──────────
async function getApiKey(provider, userToken) {
  const cfg = PROVIDERS[provider];
  if (!cfg) return null;

  // FREE providers - no key needed
  if (cfg.free && !cfg.keyEnv) {
    return 'free'; // Mark as available
  }

  // Check user's stored key first
  if (userToken && pool) {
    try {
      const result = await pool.query(
        'SELECT api_key FROM user_api_keys WHERE user_token = $1 AND provider = $2',
        [userToken, provider]
      );
      if (result.rows.length > 0) return result.rows[0].api_key;
    } catch (err) {
      console.error('DB key lookup error:', err.message);
    }
  }

  return process.env[cfg.keyEnv] || null;
}

// ─── API: Save user API key ──────────────────────────────────────────────────
app.post('/api/keys', async (req, res) => {
  const { userToken, provider, apiKey } = req.body;
  if (!userToken || !provider || !apiKey) {
    return res.status(400).json({ error: 'Missing userToken, provider, or apiKey' });
  }
  if (!PROVIDERS[provider]) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    await pool.query(
      `INSERT INTO user_api_keys (user_token, provider, api_key, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_token, provider)
       DO UPDATE SET api_key = $3, updated_at = NOW()`,
      [userToken, provider, apiKey]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Get which providers a user has keys for ────────────────────────────
app.get('/api/keys/:userToken', async (req, res) => {
  const { userToken } = req.params;
  if (!pool) {
    return res.json({});
  }
  try {
    const result = await pool.query(
      'SELECT provider FROM user_api_keys WHERE user_token = $1',
      [userToken]
    );
    const keys = {};
    result.rows.forEach(row => { keys[row.provider] = true; });
    res.json(keys);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Delete user API key ────────────────────────────────────────────────
app.delete('/api/keys', async (req, res) => {
  const { userToken, provider } = req.body;
  if (!userToken || !provider) {
    return res.status(400).json({ error: 'Missing userToken or provider' });
  }
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    await pool.query(
      'DELETE FROM user_api_keys WHERE user_token = $1 AND provider = $2',
      [userToken, provider]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Tell the frontend which providers are available ────────────────────
app.get('/api/providers', async (req, res) => {
  const userToken = req.query.userToken;
  const available = {};

  for (const [id, cfg] of Object.entries(PROVIDERS)) {
    const key = await getApiKey(id, userToken);
    available[id] = {
      name: cfg.name,
      available: !!key,
    };
  }
  res.json(available);
});

// ─── API: Unified chat proxy ─────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { provider = 'openai', model, messages, max_tokens = 1500, temperature = 0.7, userToken } = req.body;

  const cfg = PROVIDERS[provider];
  if (!cfg) {
    return res.status(400).json({ error: { message: `Unknown provider: ${provider}` } });
  }

  const apiKey = await getApiKey(provider, userToken);
  if (!apiKey) {
    return res.status(500).json({
      error: { message: `No API key found for ${cfg.name}. Add your key in Settings.` }
    });
  }

  // ─── FREE: Ollama (Local AI) ───────────────────────────────────────────────
  if (provider === 'ollama') {
    try {
      // Check if Ollama is running
      const ollamaModel = model || 'llama3.2';
      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return res.status(503).json({
          error: { message: `Ollama not running. Start it with: ollama serve. Details: ${errData.error || 'Connection refused'}` }
        });
      }

      const data = await response.json();
      // Convert Ollama format to OpenAI format
      res.json({
        choices: [{
          message: { role: 'assistant', content: data.message?.content || '' },
          finish_reason: 'stop',
        }],
        model: ollamaModel,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    } catch (err) {
      res.status(503).json({
        error: { message: `Ollama not running at 127.0.0.1:11434. Start it with: ollama serve. Error: ${err.message}` }
      });
    }
    return;
  }

  // ─── FREE: NOVA Hosted (using free inference APIs) ───────────────────────────
  if (provider === 'nova') {
    try {
      // Use free Hugging Face inference as fallback
      const hfModel = 'microsoft/DialoGPT-large';
      const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:';
      
      const response = await fetch(`https://router.huggingface.co/hf-inference/models/${hfModel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: Math.min(max_tokens, 500),
            temperature: temperature,
            return_full_text: false,
          },
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        // Fallback to a simple response
        return res.json({
          choices: [{
            message: { role: 'assistant', content: `NOVA Free mode: The hosted model is loading. Try again in 30 seconds, or use Ollama for unlimited local AI!\n\nTo use Ollama:\n1. Install: curl -fsSL https://ollama.com/install.sh | sh\n2. Run: ollama pull llama3.2\n3. Select "Ollama (Local)" from the provider menu` },
            finish_reason: 'stop',
          }],
        });
      }

      const generatedText = Array.isArray(data) ? data[0]?.generated_text : data.generated_text || 'Sorry, I could not generate a response. Try Ollama for local AI!';
      
      res.json({
        choices: [{
          message: { role: 'assistant', content: generatedText },
          finish_reason: 'stop',
        }],
        model: 'nova-free',
      });
    } catch (err) {
      res.json({
        choices: [{
          message: { role: 'assistant', content: `NOVA Free mode error: ${err.message}\n\nFor unlimited free AI, install Ollama:\n1. curl -fsSL https://ollama.com/install.sh | sh\n2. ollama pull llama3.2\n3. Select "Ollama (Local)" from provider menu` },
          finish_reason: 'stop',
        }],
      });
    }
    return;
  }

  // ─── FREE: Hugging Face Inference API ─────────────────────────────────────────
  if (provider === 'huggingface') {
    try {
      const hfKey = apiKey !== 'free' ? apiKey : null;
      
      if (!hfKey) {
        return res.json({
          choices: [{
            message: { role: 'assistant', content: 'Hugging Face requires an API key with Inference API permissions.\n\n1. Go to: https://huggingface.co/settings/tokens\n2. Create a new token\n3. Enable "Make calls to the serverless Inference API" permission\n4. Add your key in Settings > API Keys' },
            finish_reason: 'stop',
          }],
        });
      }

      const hfModel = model || 'meta-llama/Llama-3.2-3B-Instruct';
      const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:';
      
      const response = await fetch(`https://router.huggingface.co/hf-inference/models/${hfModel}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hfKey}`,
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: Math.min(max_tokens, 500),
            temperature: temperature,
            return_full_text: false,
          },
        }),
      });

      // Check if response is OK before parsing JSON
      if (!response.ok) {
        const text = await response.text();
        return res.json({
          choices: [{
            message: { role: 'assistant', content: `Hugging Face error: ${response.status} - ${text}\n\nThe model may be loading or unavailable. Try a different model like:\n- meta-llama/Llama-3.2-3B-Instruct\n- mistralai/Mistral-7B-Instruct-v0.3` },
            finish_reason: 'stop',
          }],
        });
      }

      const data = await response.json();
      
      if (data.error) {
        return res.json({
          choices: [{
            message: { role: 'assistant', content: `Hugging Face error: ${data.error}\n\nTry a different model or check your API key.` },
            finish_reason: 'stop',
          }],
        });
      }

      const generatedText = Array.isArray(data) ? data[0]?.generated_text : data.generated_text || 'No response generated.';
      
      res.json({
        choices: [{
          message: { role: 'assistant', content: generatedText },
          finish_reason: 'stop',
        }],
        model: hfModel,
      });
    } catch (err) {
      res.json({
        choices: [{
          message: { role: 'assistant', content: `Hugging Face error: ${err.message}` },
          finish_reason: 'stop',
        }],
      });
    }
    return;
  }

  // ─── FREE: DeepSeek (OpenAI-compatible) ───────────────────────────────────────
  if (provider === 'deepseek') {
    try {
      const deepseekKey = apiKey !== 'free' ? apiKey : null;
      
      if (!deepseekKey) {
        return res.json({
          choices: [{
            message: { role: 'assistant', content: 'DeepSeek requires an API key. Get free credits at: https://platform.deepseek.com/api_keys\n\nAdd your key in Settings > API Keys.' },
            finish_reason: 'stop',
          }],
        });
      }

      const deepseekModel = model || 'deepseek-chat';
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: deepseekModel,
          messages: messages,
          max_tokens: max_tokens,
          temperature: temperature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.json({
          choices: [{
            message: { role: 'assistant', content: `DeepSeek error: ${response.status} - ${errorText}\n\nCheck your API key or try again.` },
            finish_reason: 'stop',
          }],
        });
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.json({
        choices: [{
          message: { role: 'assistant', content: `DeepSeek error: ${err.message}` },
          finish_reason: 'stop',
        }],
      });
    }
    return;
  }

  // ─── FREE: NVIDIA Build (OpenAI-compatible) ─────────────────────────────────────
  if (provider === 'nvidia') {
    try {
      const nvidiaKey = apiKey !== 'free' ? apiKey : null;
      
      if (!nvidiaKey) {
        return res.json({
          choices: [{
            message: { role: 'assistant', content: 'NVIDIA Build requires an API key. Get a free key at: https://build.nvidia.com/explore/discover\n\nAdd your key in Settings > API Keys.' },
            finish_reason: 'stop',
          }],
        });
      }

      const nvidiaModel = model || 'meta/llama-3.1-8b-instruct';
      // NVIDIA uses a different endpoint structure
      const response = await fetch(`https://api.nvidia.com/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${nvidiaKey}`,
        },
        body: JSON.stringify({
          model: nvidiaModel,
          messages: messages,
          max_tokens: max_tokens,
          temperature: temperature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.json({
          choices: [{
            message: { role: 'assistant', content: `NVIDIA Build error: ${response.status} - ${errorText}\n\nCheck your API key or try a different model.` },
            finish_reason: 'stop',
          }],
        });
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.json({
        choices: [{
          message: { role: 'assistant', content: `NVIDIA Build error: ${err.message}` },
          finish_reason: 'stop',
        }],
      });
    }
    return;
  }

  // ─── FREE: Groq (OpenAI-compatible) ──────────────────────────────────────────
  if (provider === 'groq') {
    try {
      const groqKey = apiKey !== 'free' ? apiKey : null;
      
      if (!groqKey) {
        return res.json({
          choices: [{
            message: { role: 'assistant', content: 'Groq requires an API key. Get one free at: https://console.groq.com/keys\n\nAdd your key in Settings > API Keys.' },
            finish_reason: 'stop',
          }],
        });
      }

      const groqModel = model || 'llama-3.3-70b-versatile';
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: groqModel,
          messages: messages,
          max_tokens: max_tokens,
          temperature: temperature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.json({
          choices: [{
            message: { role: 'assistant', content: `Groq error: ${response.status} - ${errorText}\n\nCheck your API key or try again later.` },
            finish_reason: 'stop',
          }],
        });
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.json({
        choices: [{
          message: { role: 'assistant', content: `Groq error: ${err.message}` },
          finish_reason: 'stop',
        }],
      });
    }
    return;
  }

  // ─── FREE: NOVA Custom (wrapper with custom system prompt) ─────────────────────
  if (provider === 'nova_custom') {
    try {
      const groqKey = apiKey !== 'free' ? apiKey : null;
      
      if (!groqKey) {
        return res.json({
          choices: [{
            message: { role: 'assistant', content: 'NOVA Custom requires a Groq API key. Get one free at: https://console.groq.com/keys\n\nAdd your key in Settings > API Keys.' },
            finish_reason: 'stop',
          }],
        });
      }

      // Add custom NOVA system prompt to messages
      const novaSystemPrompt = {
        role: 'system',
        content: 'You are NOVA, a brilliant AI assistant created by NOVA AI. You are direct, helpful, and give concise high-quality answers. You have a friendly personality and occasionally use emoji. You were custom-built for this platform.'
      };
      
      const enhancedMessages = [novaSystemPrompt, ...messages];
      const novaModel = model || 'llama-3.3-70b-versatile';
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: novaModel,
          messages: enhancedMessages,
          max_tokens: max_tokens,
          temperature: temperature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.json({
          choices: [{
            message: { role: 'assistant', content: `NOVA Custom error: ${response.status} - ${errorText}\n\nCheck your API key or try again later.` },
            finish_reason: 'stop',
          }],
        });
      }

      const data = await response.json();
      // Override the model name to show NOVA Custom
      if (data.model) data.model = 'nova-custom';
      res.json(data);
    } catch (err) {
      res.json({
        choices: [{
          message: { role: 'assistant', content: `NOVA Custom error: ${err.message}` },
          finish_reason: 'stop',
        }],
      });
    }
    return;
  }

  // ─── STANDARD: OpenAI-compatible APIs ───────────────────────────────────────
  try {
    if (!cfg || !cfg.baseURL) {
      return res.json({
        choices: [{
          message: { role: 'assistant', content: `Provider "${provider}" is not configured. Please select a different provider.` },
          finish_reason: 'stop',
        }],
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (provider === 'openrouter' || provider === 'anthropic_compat') {
      headers['HTTP-Referer'] = 'https://nova-ai.onrender.com';
      headers['X-Title'] = 'NOVA AI';
    }

    const response = await fetch(`${cfg.baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, max_tokens, temperature }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || data.error || JSON.stringify(data);
      return res.json({
        choices: [{
          message: { role: 'assistant', content: `${provider} error (${response.status}): ${errorMsg}\n\nCheck your API key or try a different provider.` },
          finish_reason: 'stop',
        }],
      });
    }

    res.json(data);
  } catch (err) {
    res.json({
      choices: [{
        message: { role: 'assistant', content: `${provider} error: ${err.message}\n\nCheck your network connection or try again.` },
        finish_reason: 'stop',
      }],
    });
  }
});

// ─── API: Image Generation (Coming Soon) ───────────────────────────────
app.post('/api/image', async (req, res) => {
  res.status(503).json({ 
    error: { 
      message: 'Image generation coming soon! We\'re working on integrating a free AI image API. Check back later.' 
    } 
  });
});

// ─── API: Web Search (Tavily) ────────────────────────────────────────────────
app.post('/api/search', async (req, res) => {
  const { query, userToken } = req.body;

  if (!query) {
    return res.status(400).json({ error: { message: 'Query is required' } });
  }

  // Try Tavily API key from user DB or env
  let tavilyKey = null;
  if (userToken && pool) {
    try {
      const result = await pool.query(
        'SELECT api_key FROM user_api_keys WHERE user_token = $1 AND provider = $2',
        [userToken, 'tavily']
      );
      if (result.rows.length > 0) tavilyKey = result.rows[0].api_key;
    } catch (err) {
      console.error('DB key lookup error:', err.message);
    }
  }
  if (!tavilyKey) tavilyKey = process.env.TAVILY_API_KEY || null;

  if (!tavilyKey) {
    return res.status(500).json({
      error: { message: 'No Tavily API key found. Add it in Settings (provider: tavily).' }
    });
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tavilyKey}`,
      },
      body: JSON.stringify({
        query: query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ─── API: Python Execution ────────────────────────────────────────────────────
const { spawn } = require('child_process');

app.post('/api/python', async (req, res) => {
  const { code, userToken } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }

  // Security: limit execution time and code length
  if (code.length > 10000) {
    return res.status(400).json({ error: 'Code too long (max 10KB)' });
  }

  // Run Python with timeout
  const timeout = 10000; // 10 seconds
  let output = '';
  let stderr = '';
  let timedOut = false;

  const python = spawn('python3', ['-c', code], {
    timeout: timeout,
    shell: false,
  });

  const timer = setTimeout(() => {
    timedOut = true;
    python.kill('SIGKILL');
  }, timeout);

  python.stdout.on('data', (data) => {
    output += data.toString();
  });

  python.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  python.on('close', (code) => {
    clearTimeout(timer);

    if (timedOut) {
      return res.json({ error: 'Execution timed out (10s limit)', output, stderr });
    }

    if (code !== 0 && !output) {
      return res.json({ error: stderr || 'Python error', output, stderr });
    }

    res.json({ output: output.trim(), stderr: stderr.trim() });
  });

  python.on('error', (err) => {
    clearTimeout(timer);
    if (err.code === 'ENOENT') {
      res.json({ error: 'Python3 not installed on server. Contact admin.' });
    } else {
      res.json({ error: err.message });
    }
  });
});

// ─── Auth Routes ─────────────────────────────────────────────────────────────
app.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect('/?error=google_not_configured');
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
  (req, res) => {
    const user = req.user;
    // Redirect to home with user data in URL fragment (client-side accessible)
    res.redirect(`/#auth=${encodeURIComponent(JSON.stringify({ token: user.token, user: { name: user.name, email: user.email, picture: user.picture } }))}`);
  }
);

app.get('/auth/me', (req, res) => {
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.json({ user: null });
  }
});

app.post('/auth/logout', (req, res) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

// ─── API: Chat Persistence ───────────────────────────────────────────────────

// Get all chats for a user
app.get('/api/chats/:userToken', async (req, res) => {
  const { userToken } = req.params;
  if (!pool) return res.json({ chats: [] });
  try {
    const result = await pool.query(
      `SELECT c.chat_id, c.title, c.created_at, c.updated_at,
        (SELECT json_agg(json_build_object('role', role, 'content', content, 'created_at', created_at) ORDER BY created_at)
         FROM chat_messages m WHERE m.chat_id = c.chat_id) as history
       FROM chats c
       WHERE c.user_token = $1
       ORDER BY c.updated_at DESC
       LIMIT 50`,
      [userToken]
    );
    const chats = result.rows.map(row => ({
      id: row.chat_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      history: row.history || []
    }));
    res.json({ chats });
  } catch (err) {
    console.error('Error loading chats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Save or update a chat
app.post('/api/chats', async (req, res) => {
  const { userToken, chatId, title, history } = req.body;
  if (!userToken || !chatId) {
    return res.status(400).json({ error: 'Missing userToken or chatId' });
  }
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    // Insert or update chat
    await pool.query(
      `INSERT INTO chats (chat_id, user_token, title, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (chat_id) DO UPDATE SET title = $3, updated_at = NOW()`,
      [chatId, userToken, title?.slice(0, 256) || 'Untitled']
    );
    
    // Delete old messages and insert new ones
    await pool.query('DELETE FROM chat_messages WHERE chat_id = $1', [chatId]);
    
    if (history && history.length > 0) {
      const values = history.map((msg, i) => 
        `($1, $2, $3, NOW() + INTERVAL '${i} milliseconds')`
      ).join(',');
      const params = [chatId];
      history.forEach(msg => {
        params.push(msg.role, msg.content);
      });
      
      // Build parameterized query
      let paramIndex = 1;
      const queryValues = history.map(msg => {
        paramIndex += 2;
        return `($1, $${paramIndex-1}, $${paramIndex}, NOW())`;
      }).join(',');
      
      const query = `INSERT INTO chat_messages (chat_id, role, content, created_at) VALUES ${queryValues}`;
      const flatParams = [chatId, ...history.flatMap(msg => [msg.role, msg.content])];
      
      await pool.query(query, flatParams);
    }
    
    res.json({ ok: true, chatId });
  } catch (err) {
    console.error('Error saving chat:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete a chat
app.delete('/api/chats/:userToken/:chatId', async (req, res) => {
  const { userToken, chatId } = req.params;
  if (!pool) return res.json({ ok: true });
  try {
    // Verify ownership before deleting
    const result = await pool.query(
      'DELETE FROM chats WHERE chat_id = $1 AND user_token = $2 RETURNING *',
      [chatId, userToken]
    );
    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'Chat not found or access denied' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting chat:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin & Maintenance Mode ───────────────────────────────────────────────
let maintenanceMode = false;
let maintenanceMessage = 'NOVA is currently under maintenance. Please check back soon.';

// Admin middleware - check for admin token
const requireAdmin = (req, res, next) => {
  const adminToken = req.headers['x-admin-token'] || req.body?.adminToken;
  if (adminToken === process.env.ADMIN_TOKEN || adminToken === 'nova-admin-2024') {
    return next();
  }
  res.status(403).json({ error: 'Admin access required' });
};

// Maintenance mode middleware (applied before fallback)
app.use((req, res, next) => {
  if (maintenanceMode && !req.path.startsWith('/admin') && !req.path.startsWith('/auth')) {
    return res.status(503).json({ 
      maintenance: true, 
      message: maintenanceMessage 
    });
  }
  next();
});

// Admin routes
app.get('/admin/status', (req, res) => {
  res.json({ 
    maintenance: maintenanceMode, 
    message: maintenanceMessage,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.post('/admin/maintenance', requireAdmin, (req, res) => {
  const { enabled, message } = req.body;
  maintenanceMode = enabled;
  if (message) maintenanceMessage = message;
  res.json({ 
    success: true, 
    maintenance: maintenanceMode, 
    message: maintenanceMessage 
  });
});

app.post('/admin/toggle-maintenance', requireAdmin, (req, res) => {
  maintenanceMode = !maintenanceMode;
  res.json({ 
    success: true, 
    maintenance: maintenanceMode, 
    message: maintenanceMessage 
  });
});

app.get('/admin/users', requireAdmin, async (req, res) => {
  if (!pool) return res.json({ users: [] });
  try {
    const result = await pool.query('SELECT id, name, email, created_at, last_login FROM users ORDER BY last_login DESC LIMIT 100');
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin/stats', requireAdmin, async (req, res) => {
  if (!pool) return res.json({ stats: { users: 0, chats: 0 } });
  try {
    const usersResult = await pool.query('SELECT COUNT(*) FROM users');
    res.json({ 
      stats: { 
        users: parseInt(usersResult.rows[0]?.count || 0)
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Fallback ────────────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`NOVA server running on port ${PORT}`);
  console.log(`Database: ${pool ? 'connected' : 'not configured'}`);
  console.log('Server-side provider keys:');
  for (const [id, cfg] of Object.entries(PROVIDERS)) {
    const hasKey = !!process.env[cfg.keyEnv];
    console.log(`  ${hasKey ? '✓' : '✗'} ${cfg.name} (${cfg.keyEnv})`);
  }
});
