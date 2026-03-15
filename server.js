const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
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
  // FREE - Hugging Face
  huggingface: {
    name: 'Hugging Face',
    baseURL: 'https://api-inference.huggingface.co/models',
    keyEnv: 'HUGGINGFACE_API_KEY',
    free: true,
    freeTier: true,
  },
  // PAID providers
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    keyEnv: 'OPENAI_API_KEY',
  },
  groq: {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
  },
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
  together: {
    name: 'Together AI',
    baseURL: 'https://api.together.xyz/v1',
    keyEnv: 'TOGETHER_API_KEY',
    freeTier: true,
  },
  mistral: {
    name: 'Mistral',
    baseURL: 'https://api.mistral.ai/v1',
    keyEnv: 'MISTRAL_API_KEY',
  },
  cohere: {
    name: 'Cohere',
    baseURL: 'https://api.cohere.com/compatibility/v1',
    keyEnv: 'COHERE_API_KEY',
  },
  perplexity: {
    name: 'Perplexity',
    baseURL: 'https://api.perplexity.ai',
    keyEnv: 'PERPLEXITY_API_KEY',
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
      const response = await fetch('http://localhost:11434/api/chat', {
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
        error: { message: `Ollama not running. Install: curl -fsSL https://ollama.com/install.sh | sh && ollama pull llama3.2` }
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
      
      const response = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
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

  // ─── STANDARD: OpenAI-compatible APIs ───────────────────────────────────────
  try {
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
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
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
