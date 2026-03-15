# Testing NOVA AI

## Overview
NOVA AI is an Express.js app serving a single-page frontend (`public/index.html`) with a Node.js backend (`server.js`). It supports multiple LLM providers and stores per-user API keys in a PostgreSQL database.

## Devin Secrets Needed
- `DATABASE_URL` — PostgreSQL connection string for the Render database (required for key management features)
- Provider API keys (e.g., `GROQ_API_KEY`, `OPENAI_API_KEY`) — optional, only needed if testing actual chat completion

## Local Setup
1. `cd /home/ubuntu/repos/nova-ai`
2. `npm install` (installs express, cors, pg)
3. Start server: `DATABASE_URL="<connection_string>" npm start`
4. Server runs on port 3000 by default
5. Confirm logs show:
   - `NOVA server running on port 3000`
   - `Database: connected`
   - `Database initialized`

## Key Features to Test

### 1. UI Layout (Desktop)
- Navigate to `http://localhost:3000`
- Verify sidebar with NOVA branding, New Chat button, Settings
- Verify welcome screen with suggestion cards
- Verify provider picker in top bar
- Verify tool pills (Memory, Search, Tools, Images)

### 2. Settings Modal
- Click "Settings" in sidebar → opens modal
- 3 tabs: General, API Keys, Memory
- General tab: AI Name input, System Prompt textarea
- Memory tab: Memory textarea with placeholder
- API Keys tab: Lists all 7 providers with status indicators

### 3. API Key Management (Save/Delete)
- Settings → API Keys tab
- Click "Add Key" on a provider row → input field appears
- Type a key and click "Save" → toast shows "[Provider] key saved"
- Dot turns green, status changes to "Your key active"
- Buttons change to "Update" and "Remove"
- Click "Remove" → key deleted, dot turns gray, status reverts to "No key set"
- Keys are stored in PostgreSQL `user_api_keys` table with unique constraint on (user_token, provider)

### 4. Provider Availability
- After saving a key, the provider appears as available (green dot) in the provider dropdown
- Providers without keys show "no key" badge and are grayed out
- The `selectProvider(id)` JavaScript function handles selection

### 5. Model Selection
- Open provider dropdown → "Model" section shows model chips for the selected provider
- Clicking a model chip updates the provider button label (e.g., "OpenAI / gpt-4o-mini")

### 6. Chat Error Handling
- Sending a message with no valid API key shows error message:
  "Error: No API key found for [Provider]. Add your key in Settings."
  "Add your API key for **[Provider]** in Settings > API Keys."

### 7. Chat with Valid Key
- Requires a real provider API key to test actual chat completion
- The backend proxies requests to the provider's OpenAI-compatible endpoint

## Known Quirks
- The provider dropdown has a document-level click listener that closes it when clicking outside. Browser automation tools may have trouble clicking provider options in the dropdown due to event propagation. Using `selectProvider('provider_id')` via JavaScript console is a reliable alternative for testing.
- The frontend generates a unique user token (`u_` + UUID) stored in localStorage. Each browser session gets its own token for key isolation.
- When the "Remove" button is clicked and the UI rebuilds, the "Add Key" button may appear toggled open (showing the input field). This is a minor cosmetic quirk.

## API Endpoints
- `GET /api/providers?userToken=<token>` — returns provider availability (checks user DB keys + server env vars)
- `GET /api/keys/<userToken>` — returns which providers have user-saved keys (does NOT return actual key values)
- `POST /api/keys` — body: `{userToken, provider, apiKey}` — saves/updates a key
- `DELETE /api/keys` — body: `{userToken, provider}` — deletes a key
- `POST /api/chat` — body: `{provider, model, messages, userToken}` — sends chat request through the selected provider

## Testing Without Real API Keys
You can test the full key management flow (save, load, delete) with fake keys. The key is stored in the database regardless of validity. Chat will return an error from the provider if the key is invalid, which also tests error handling.
