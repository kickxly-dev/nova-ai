const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Provider config ──────────────────────────────────────────────────────────
// All providers use the OpenAI-compatible /v1/chat/completions format
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
};

// ─── Tell the frontend which providers are available ─────────────────────────
app.get('/api/providers', (req, res) => {
  const available = {};
  for (const [id, cfg] of Object.entries(PROVIDERS)) {
    available[id] = {
      name: cfg.name,
      available: !!process.env[cfg.keyEnv],
    };
  }
  res.json(available);
});

// ─── Unified chat proxy ───────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { provider = 'openai', model, messages, max_tokens = 1500, temperature = 0.7 } = req.body;

  const cfg = PROVIDERS[provider];
  if (!cfg) {
    return res.status(400).json({ error: { message: `Unknown provider: ${provider}` } });
  }

  const apiKey = process.env[cfg.keyEnv];
  if (!apiKey) {
    return res.status(500).json({
      error: { message: `${cfg.name} API key not set. Add ${cfg.keyEnv} in Render environment variables.` }
    });
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    // OpenRouter requires these extra headers
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

// ─── Fallback ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`NOVA server running on port ${PORT}`);
  console.log('Available providers:');
  for (const [id, cfg] of Object.entries(PROVIDERS)) {
    const hasKey = !!process.env[cfg.keyEnv];
    console.log(`  ${hasKey ? '✓' : '✗'} ${cfg.name} (${cfg.keyEnv})`);
  }
});
