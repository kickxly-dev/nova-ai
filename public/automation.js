// Zapier & Make Integration - Connect to 5000+ apps
(function() {
  'use strict';
  
  window.ZapierIntegration = {
    webhookUrl: localStorage.getItem('nova_zapier_webhook'),
    
    setWebhook(url) {
      this.webhookUrl = url;
      localStorage.setItem('nova_zapier_webhook', url);
    },
    
    // Trigger Zapier zap
    async trigger(data) {
      if (!this.webhookUrl) {
        throw new Error('Zapier webhook not configured');
      }
      
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          timestamp: Date.now(),
          source: 'nova-ai'
        })
      });
      
      if (!res.ok) throw new Error('Zapier trigger failed');
      return await res.json();
    },
    
    // Send chat to Zapier
    async sendChat(chatData) {
      return await this.trigger({
        event: 'chat_completed',
        chat: chatData
      });
    },
    
    // Send AI response to Zapier
    async sendAIResponse(prompt, response) {
      return await this.trigger({
        event: 'ai_response',
        prompt: prompt.slice(0, 1000),
        response: response.slice(0, 2000),
        model: state.model,
        provider: state.provider
      });
    }
  };
  
  window.MakeIntegration = {
    webhookUrl: localStorage.getItem('nova_make_webhook'),
    apiKey: localStorage.getItem('nova_make_api_key'),
    
    setConfig(url, apiKey) {
      this.webhookUrl = url;
      this.apiKey = apiKey;
      localStorage.setItem('nova_make_webhook', url);
      localStorage.setItem('nova_make_api_key', apiKey);
    },
    
    async trigger(data) {
      if (!this.webhookUrl) {
        throw new Error('Make webhook not configured');
      }
      
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['Authorization'] = `Token ${this.apiKey}`;
      }
      
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      
      if (!res.ok) throw new Error('Make trigger failed');
      return true;
    },
    
    // Execute Make scenario with specific data
    async executeScenario(scenarioId, data) {
      return await this.trigger({
        scenario: scenarioId,
        payload: data,
        timestamp: new Date().toISOString()
      });
    }
  };
  
  // Open automation modal
  window.openAutomationModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '600';
    modal.id = 'automation-modal';
    
    const hasZapier = !!ZapierIntegration.webhookUrl;
    const hasMake = !!MakeIntegration.webhookUrl;
    
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
        <div class="modal-top"><h2>⚡ Automation</h2><button class="modal-close" onclick="closeAutomationModal()">&times;</button></div>
        <div class="modal-body">
          <p style="color: var(--muted); margin-bottom: 16px;">Connect NOVA to 5000+ apps via Zapier and Make (Integromat)</p>
          
          <!-- Zapier -->
          <div style="margin-bottom: 20px; padding: 16px; background: var(--surface2); border-radius: var(--radius); border: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <span style="font-size: 28px; color: #FF4A00;">⚡</span>
              <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--text);">Zapier</div>
                <div style="font-size: 12px; color: var(--muted);">${hasZapier ? '✓ Connected' : 'Connect 5000+ apps'}</div>
              </div>
            </div>
            <input type="password" id="zapier-webhook" value="${ZapierIntegration.webhookUrl || ''}" placeholder="https://hooks.zapier.com/hooks/catch/..." style="width: 100%; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); margin-bottom: 8px;">
            <div style="display: flex; gap: 8px;">
              <button onclick="saveZapierWebhook()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer; font-size: 12px;">Save</button>
              <button onclick="testZapier()" style="padding: 8px 16px; background: var(--surface3); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; font-size: 12px;">Test</button>
            </div>
          </div>
          
          <!-- Make -->
          <div style="margin-bottom: 20px; padding: 16px; background: var(--surface2); border-radius: var(--radius); border: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <span style="font-size: 28px; color: #6D4CFF;">🔧</span>
              <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--text);">Make (Integromat)</div>
                <div style="font-size: 12px; color: var(--muted);">${hasMake ? '✓ Connected' : 'Advanced automations'}</div>
              </div>
            </div>
            <input type="password" id="make-webhook" value="${MakeIntegration.webhookUrl || ''}" placeholder="https://hook.make.com/..." style="width: 100%; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); margin-bottom: 8px;">
            <input type="password" id="make-apikey" value="${MakeIntegration.apiKey || ''}" placeholder="API Key (optional)" style="width: 100%; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); margin-bottom: 8px;">
            <div style="display: flex; gap: 8px;">
              <button onclick="saveMakeConfig()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer; font-size: 12px;">Save</button>
              <button onclick="testMake()" style="padding: 8px 16px; background: var(--surface3); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; font-size: 12px;">Test</button>
            </div>
          </div>
          
          <!-- Automation Ideas -->
          <div style="padding: 16px; background: var(--accent-glow); border-radius: var(--radius); border: 1px solid rgba(139, 92, 246, 0.2);">
            <h4 style="margin-bottom: 12px; color: var(--text);">💡 Popular Automations</h4>
            <ul style="margin: 0; padding-left: 20px; color: var(--text2); font-size: 13px; line-height: 1.8;">
              <li>Save AI responses to Google Sheets</li>
              <li>Create tasks from chats in Asana/Trello</li>
              <li>Post summaries to Slack/Discord</li>
              <li>Save code snippets to GitHub Gist</li>
              <li>Trigger email notifications</li>
              <li>Add calendar events from AI suggestions</li>
            </ul>
          </div>
        </div>
      </div>
    `;
    
    modal.onclick = closeAutomationModal;
    document.body.appendChild(modal);
  };
  
  window.closeAutomationModal = function() {
    const modal = document.getElementById('automation-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.saveZapierWebhook = function() {
    const url = document.getElementById('zapier-webhook').value;
    if (url) {
      ZapierIntegration.setWebhook(url);
      showToast('Zapier connected!');
      closeAutomationModal();
      openAutomationModal();
    }
  };
  
  window.saveMakeConfig = function() {
    const url = document.getElementById('make-webhook').value;
    const key = document.getElementById('make-apikey').value;
    if (url) {
      MakeIntegration.setConfig(url, key);
      showToast('Make connected!');
      closeAutomationModal();
      openAutomationModal();
    }
  };
  
  window.testZapier = async function() {
    try {
      await ZapierIntegration.trigger({
        event: 'test',
        message: 'Hello from NOVA AI!',
        timestamp: Date.now()
      });
      showToast('Zapier test successful!');
    } catch (err) {
      showToast('Test failed: ' + err.message, 'error');
    }
  };
  
  window.testMake = async function() {
    try {
      await MakeIntegration.trigger({
        test: true,
        message: 'Hello from NOVA AI!',
        timestamp: new Date().toISOString()
      });
      showToast('Make test successful!');
    } catch (err) {
      showToast('Test failed: ' + err.message, 'error');
    }
  };
  
  // Auto-send AI responses to automations
  const originalAppendMessage = window.appendMessage;
  window.appendMessage = function(role, content, animate) {
    if (originalAppendMessage) {
      originalAppendMessage(role, content, animate);
    }
    
    // Send to automations if enabled
    if (role === 'ai') {
      const lastUserMsg = state.history[state.history.length - 1]?.content || '';
      
      if (ZapierIntegration.webhookUrl) {
        ZapierIntegration.sendAIResponse(lastUserMsg, content).catch(console.error);
      }
      
      if (MakeIntegration.webhookUrl) {
        MakeIntegration.trigger({
          event: 'ai_response',
          timestamp: new Date().toISOString(),
          data: {
            prompt: lastUserMsg.slice(0, 500),
            response: content.slice(0, 1000),
            model: state.model,
            provider: state.provider
          }
        }).catch(console.error);
      }
    }
  };
  
  // Add button to UI
  window.addAutomationButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar) {
      const btn = document.createElement('button');
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Automation';
      btn.onclick = openAutomationModal;
      btn.style.marginBottom = '8px';
      
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addAutomationButton, 2000);
    });
  } else {
    setTimeout(window.addAutomationButton, 2000);
  }
  
  console.log('[Automation] Module loaded - Zapier & Make integration');
})();
