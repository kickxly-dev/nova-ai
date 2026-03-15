# NOVA — Your AI Assistant

A custom AI web app powered by OpenAI, with memory, web search awareness, tools, and image generation. Auto-detects mobile vs desktop and serves a different UI for each.

## Deploy to Render (free)

### Step 1 — Push to GitHub
1. Create a new repo on github.com
2. Run these commands in the `nova-ai` folder:
```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nova-ai.git
git push -u origin main
```

### Step 2 — Deploy on Render
1. Go to **render.com** and sign up / log in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account and select the `nova-ai` repo
4. Render will auto-detect the settings from `render.yaml`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Click **"Advanced"** → **"Add Environment Variable"**
   - Key: `OPENAI_API_KEY`
   - Value: `your-openai-key-here`
6. Click **"Create Web Service"**

Render will build and deploy. You'll get a live URL like `https://nova-ai.onrender.com` in ~2 minutes.

### Step 3 — Use it
Open your Render URL on any device. It auto-detects mobile vs desktop. Go to Settings to customize the AI name, system prompt, and memory.

## Project Structure
```
nova-ai/
├── server.js          # Express backend + API proxy
├── package.json
├── render.yaml        # Render deploy config
├── .gitignore
└── public/
    └── index.html     # Full frontend (mobile + desktop)
```

## Features
- 🧠 Memory — tell it things about yourself, it remembers every message
- 🔍 Search awareness — detects when you want current info
- ⚡ Tool detection — spots calculator/weather/time requests
- 🖼️ Image mode — describe and queue image generation
- 📱 Auto mobile/desktop UI detection
- 💬 Chat history with sidebar/drawer
- 🔒 API key secured server-side, never in the browser
