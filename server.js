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

// ─── API: Image Generation (Hugging Face - Free) ───────────────────────────────
app.post('/api/image', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: { message: 'Prompt is required' } });
  }

  try {
    // Use Hugging Face free inference API (Stable Diffusion)
    const response = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt: 'blurry, bad quality, distorted',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      // If model is loading, return a placeholder
      if (errorText.includes('loading') || response.status === 503) {
        // Fallback to Pollinations
        const encodedPrompt = encodeURIComponent(prompt);
        const randomSeed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${randomSeed}`;
        return res.json({
          data: [{
            url: imageUrl,
            revised_prompt: prompt
          }]
        });
      }
      throw new Error(`Hugging Face API error: ${response.status}`);
    }

    // Hugging Face returns the image as a blob
    const imageBuffer = await response.buffer();
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    res.json({
      data: [{
        url: dataUrl,
        revised_prompt: prompt
      }]
    });
  } catch (err) {
    // Fallback to Pollinations on any error
    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const randomSeed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${randomSeed}`;
      res.json({
        data: [{
          url: imageUrl,
          revised_prompt: prompt
        }]
      });
    } catch (fallbackErr) {
      res.status(500).json({ error: { message: err.message } });
    }
  }
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

// ─── Fallback ────────────────────────────────────────────────────────────────
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
