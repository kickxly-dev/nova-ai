// Multi-Model Mode - Ask all AIs simultaneously, compare responses
(function() {
  'use strict';
  
  const MULTI_MODEL_CONFIG = {
    enabled: false,
    providers: ['openai', 'anthropic', 'google'],
    models: {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-haiku',
      google: 'gemini-1.5-flash'
    }
  };
  
  // Toggle multi-model mode
  window.toggleMultiModel = function() {
    MULTI_MODEL_CONFIG.enabled = !MULTI_MODEL_CONFIG.enabled;
    
    const btn = document.getElementById('multi-model-toggle');
    if (btn) {
      btn.classList.toggle('active', MULTI_MODEL_CONFIG.enabled);
    }
    
    showToast(MULTI_MODEL_CONFIG.enabled ? 'Multi-model mode enabled' : 'Multi-model mode disabled');
    
    if (MULTI_MODEL_CONFIG.enabled) {
      openMultiModelSettings();
    }
  };
  
  // Open multi-model settings
  window.openMultiModelSettings = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '600';
    modal.id = 'multi-model-modal';
    
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
        <div class="modal-top"><h2>Multi-Model Mode</h2><button class="modal-close" onclick="closeMultiModelSettings()">&times;</button></div>
        <div class="modal-body">
          <p style="color: var(--muted); margin-bottom: 16px;">Ask multiple AI models at once and compare their responses.</p>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 12px; color: var(--text); font-weight: 500;">Select Models to Compare</label>
            <div style="display: grid; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: var(--surface2); border-radius: var(--radius-sm);">
                <input type="checkbox" class="multi-model-check" value="openai" checked>
                <span>GPT-4o-mini (OpenAI)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: var(--surface2); border-radius: var(--radius-sm);">
                <input type="checkbox" class="multi-model-check" value="anthropic" checked>
                <span>Claude 3 Haiku (Anthropic)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: var(--surface2); border-radius: var(--radius-sm);">
                <input type="checkbox" class="multi-model-check" value="google" checked>
                <span>Gemini Flash (Google)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: var(--surface2); border-radius: var(--radius-sm);">
                <input type="checkbox" class="multi-model-check" value="groq">
                <span>Llama 3.1 (Groq - Fast)</span>
              </label>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <input type="checkbox" id="multi-model-sync" checked>
            <label for="multi-model-sync" style="color: var(--text);">Sync context between models</label>
          </div>
        </div>
        <div class="modal-footer" style="padding: 16px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px;">
          <button onclick="closeMultiModelSettings()" style="padding: 8px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Cancel</button>
          <button onclick="saveMultiModelSettings()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">Save</button>
        </div>
      </div>
    `;
    
    modal.onclick = closeMultiModelSettings;
    document.body.appendChild(modal);
  };
  
  window.closeMultiModelSettings = function() {
    const modal = document.getElementById('multi-model-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.saveMultiModelSettings = function() {
    const checked = document.querySelectorAll('.multi-model-check:checked');
    MULTI_MODEL_CONFIG.providers = Array.from(checked).map(c => c.value);
    closeMultiModelSettings();
    showToast(`${MULTI_MODEL_CONFIG.providers.length} models selected`);
  };
  
  // Send message to multiple models
  window.sendMultiModelMessage = async function(text) {
    if (!MULTI_MODEL_CONFIG.enabled || MULTI_MODEL_CONFIG.providers.length === 0) {
      return false;
    }
    
    // Add user message once
    appendMessage('user', text);
    
    // Create comparison container
    const comparisonId = 'multi-model-' + Date.now();
    const container = createComparisonContainer(comparisonId);
    
    // Send to all selected models in parallel
    const promises = MULTI_MODEL_CONFIG.providers.map(provider => 
      fetchModelResponse(provider, text, comparisonId)
    );
    
    await Promise.all(promises);
    
    return true;
  };
  
  function createComparisonContainer(id) {
    const messages = document.querySelector('.chat-messages, #d-chat-messages, #m-chat-messages');
    if (!messages) return;
    
    const container = document.createElement('div');
    container.id = id;
    container.className = 'multi-model-container';
    container.style.cssText = 'margin: 16px 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;';
    
    container.innerHTML = `
      <div style="padding: 12px 16px; background: var(--surface2); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
        <span style="font-weight: 600; color: var(--text);">🔄 Multi-Model Comparison</span>
        <span class="multi-model-status" style="font-size: 12px; color: var(--muted);">Loading...</span>
      </div>
      <div class="multi-model-responses" style="display: grid; gap: 1px; background: var(--border);"></div>
    `;
    
    messages.appendChild(container);
    messages.scrollTop = messages.scrollHeight;
    
    return container;
  }
  
  async function fetchModelResponse(provider, text, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const responsesDiv = container.querySelector('.multi-model-responses');
    
    // Create response slot
    const slot = document.createElement('div');
    slot.className = 'multi-model-slot';
    slot.style.cssText = 'background: var(--surface); padding: 16px;';
    slot.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span class="model-badge" style="padding: 4px 8px; background: var(--accent-glow); border-radius: 4px; font-size: 11px; font-weight: 600; color: var(--accent-light);">${provider.toUpperCase()}</span>
        <span class="model-status" style="font-size: 12px; color: var(--muted);">Thinking...</span>
      </div>
      <div class="model-response" style="color: var(--text); line-height: 1.6;"></div>
    `;
    
    responsesDiv.appendChild(slot);
    
    try {
      const messages = [
        { role: 'system', content: state.systemPrompt },
        ...state.history.slice(-5),
        { role: 'user', content: text }
      ];
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider,
          model: MULTI_MODEL_CONFIG.models[provider] || 'default',
          messages: messages,
          max_tokens: 1000,
          temperature: 0.7,
          userToken: userToken
        })
      });
      
      if (!res.ok) throw new Error('Request failed');
      
      const data = await res.json();
      const reply = data.choices[0].message.content;
      
      // Update slot with response
      slot.querySelector('.model-status').textContent = 'Complete';
      slot.querySelector('.model-status').style.color = 'var(--green)';
      slot.querySelector('.model-response').innerHTML = formatResponse(reply);
      
    } catch (err) {
      slot.querySelector('.model-status').textContent = 'Error';
      slot.querySelector('.model-status').style.color = 'var(--red)';
      slot.querySelector('.model-response').textContent = 'Failed to get response';
    }
    
    // Update overall status
    const allComplete = container.querySelectorAll('.model-status').length === 
                       container.querySelectorAll('.model-status').length;
    const hasErrors = container.querySelectorAll('.model-status').some(s => s.textContent === 'Error');
    
    const statusEl = container.querySelector('.multi-model-status');
    if (statusEl) {
      statusEl.textContent = hasErrors ? 'Partially complete' : 'Complete';
    }
  }
  
  function formatResponse(text) {
    // Simple markdown formatting
    return text
      .replace(/```([\s\S]*?)```/g, '<pre style="background: var(--surface2); padding: 12px; border-radius: var(--radius-sm); overflow-x: auto;"><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code style="background: var(--surface2); padding: 2px 4px; border-radius: 3px; font-family: var(--mono);">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
  
  // Override sendMessage to check for multi-model
  const originalSendMessage = window.sendMessage;
  window.sendMessage = async function(p) {
    const inputEl = document.getElementById(p + '-msg-input');
    if (!inputEl) return;
    
    const text = inputEl.value.trim();
    if (!text || state.isTyping) return;
    
    // Check if multi-model is enabled
    if (MULTI_MODEL_CONFIG.enabled) {
      inputEl.value = '';
      inputEl.style.height = 'auto';
      state.isTyping = true;
      
      const sent = await window.sendMultiModelMessage(text);
      if (sent) {
        state.isTyping = false;
        updateSendButtons();
        return;
      }
    }
    
    // Fall back to original
    return originalSendMessage(p);
  };
  
  // Add multi-model toggle button
  window.addMultiModelButton = function() {
    const containers = [
      document.querySelector('.d-tools'),
      document.querySelector('.m-tools-row')
    ];
    
    containers.forEach(container => {
      if (!container) return;
      
      const btn = document.createElement('div');
      btn.className = 'd-tool-pill';
      btn.id = 'multi-model-toggle';
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Multi';
      btn.title = 'Multi-model comparison mode';
      btn.onclick = function(e) {
        if (e.shiftKey) {
          openMultiModelSettings();
        } else {
          window.toggleMultiModel();
        }
      };
      
      container.appendChild(btn);
    });
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addMultiModelButton, 2000);
    });
  } else {
    setTimeout(window.addMultiModelButton, 2000);
  }
  
  console.log('[MultiModel] Module loaded - Compare multiple AIs simultaneously');
})();
