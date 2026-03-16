// Notion & Slack Integration - Export/sync conversations
(function() {
  'use strict';
  
  window.NotionIntegration = {
    token: localStorage.getItem('nova_notion_token'),
    
    setToken(token) {
      this.token = token;
      localStorage.setItem('nova_notion_token', token);
    },
    
    async api(endpoint, options = {}) {
      if (!this.token) throw new Error('Notion token not set');
      
      const res = await fetch(`https://api.notion.com/v1${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Notion API error');
      }
      
      return await res.json();
    },
    
    // Search pages
    async searchPages(query = '') {
      return await this.api('/search', {
        method: 'POST',
        body: JSON.stringify({ query })
      });
    },
    
    // Create page with chat content
    async exportChat(pageTitle, chatContent, parentPageId = null) {
      // Format chat as Notion blocks
      const blocks = this.formatChatForNotion(chatContent);
      
      const body = {
        parent: parentPageId ? { page_id: parentPageId } : { database_id: null },
        properties: {
          title: {
            title: [{ text: { content: pageTitle } }]
          }
        },
        children: blocks
      };
      
      if (!parentPageId) {
        // Create in workspace - need to handle differently
        delete body.parent.database_id;
        body.parent = { type: 'page_id', page_id: null }; // Will be set by user
      }
      
      return await this.api('/pages', {
        method: 'POST',
        body: JSON.stringify(body)
      });
    },
    
    // Format chat messages as Notion blocks
    formatChatForNotion(messages) {
      return messages.map(msg => {
        if (msg.role === 'user') {
          return {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { text: { content: '👤 User: ' }, annotations: { bold: true } },
                { text: { content: msg.content } }
              ]
            }
          };
        } else {
          return {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { text: { content: '🤖 AI: ' }, annotations: { bold: true, color: 'purple' } },
                { text: { content: msg.content.slice(0, 2000) } }
              ]
            }
          };
        }
      });
    }
  };
  
  window.SlackIntegration = {
    webhookUrl: localStorage.getItem('nova_slack_webhook'),
    
    setWebhook(url) {
      this.webhookUrl = url;
      localStorage.setItem('nova_slack_webhook', url);
    },
    
    async sendMessage(text, blocks = []) {
      if (!this.webhookUrl) throw new Error('Slack webhook not set');
      
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.slice(0, 3000),
          blocks: blocks
        })
      });
      
      if (!res.ok) throw new Error('Slack webhook failed');
      return true;
    },
    
    async exportChat(chatTitle, messages) {
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: chatTitle.slice(0, 150)
          }
        },
        { type: 'divider' }
      ];
      
      messages.slice(-20).forEach(msg => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${msg.role === 'user' ? '👤 User' : '🤖 AI'}:*\n${msg.content.slice(0, 1000)}`
          }
        });
      });
      
      return await this.sendMessage(`Chat export: ${chatTitle}`, blocks);
    }
  };
  
  // Open integration modal
  window.openIntegrationModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '600';
    modal.id = 'integration-modal';
    
    const hasNotion = !!NotionIntegration.token;
    const hasSlack = !!SlackIntegration.webhookUrl;
    
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
        <div class="modal-top"><h2>🔗 Integrations</h2><button class="modal-close" onclick="closeIntegrationModal()">&times;</button></div>
        <div class="modal-body">
          <!-- Notion -->
          <div style="margin-bottom: 24px; padding: 16px; background: var(--surface2); border-radius: var(--radius); border: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <span style="font-size: 28px;">📋</span>
              <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--text);">Notion</div>
                <div style="font-size: 12px; color: var(--muted);">${hasNotion ? '✓ Connected' : 'Not connected'}</div>
              </div>
            </div>
            <input type="password" id="notion-token" value="${NotionIntegration.token || ''}" placeholder="Notion integration token..." style="width: 100%; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); margin-bottom: 8px;">
            <button onclick="saveNotionToken()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer; font-size: 12px;">Save Token</button>
          </div>
          
          <!-- Slack -->
          <div style="margin-bottom: 24px; padding: 16px; background: var(--surface2); border-radius: var(--radius); border: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <span style="font-size: 28px;">💬</span>
              <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--text);">Slack</div>
                <div style="font-size: 12px; color: var(--muted);">${hasSlack ? '✓ Connected' : 'Not connected'}</div>
              </div>
            </div>
            <input type="password" id="slack-webhook" value="${SlackIntegration.webhookUrl || ''}" placeholder="https://hooks.slack.com/services/..." style="width: 100%; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); margin-bottom: 8px;">
            <button onclick="saveSlackWebhook()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer; font-size: 12px;">Save Webhook</button>
          </div>
          
          <!-- Export Options -->
          ${(hasNotion || hasSlack) ? `
          <div style="padding: 16px; background: var(--accent-glow); border-radius: var(--radius); border: 1px solid rgba(139, 92, 246, 0.2);">
            <h4 style="margin-bottom: 12px; color: var(--text);">Export Current Chat</h4>
            <div style="display: flex; gap: 8px;">
              ${hasNotion ? `<button onclick="exportToNotion()" style="flex: 1; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">📋 To Notion</button>` : ''}
              ${hasSlack ? `<button onclick="exportToSlack()" style="flex: 1; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">💬 To Slack</button>` : ''}
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;
    
    modal.onclick = closeIntegrationModal;
    document.body.appendChild(modal);
  };
  
  window.closeIntegrationModal = function() {
    const modal = document.getElementById('integration-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.saveNotionToken = function() {
    const token = document.getElementById('notion-token').value;
    if (token) {
      NotionIntegration.setToken(token);
      showToast('Notion connected!');
      closeIntegrationModal();
      openIntegrationModal();
    }
  };
  
  window.saveSlackWebhook = function() {
    const url = document.getElementById('slack-webhook').value;
    if (url) {
      SlackIntegration.setWebhook(url);
      showToast('Slack connected!');
      closeIntegrationModal();
      openIntegrationModal();
    }
  };
  
  window.exportToNotion = async function() {
    const title = state.history[0]?.content?.slice(0, 50) || 'Chat Export';
    
    try {
      await NotionIntegration.exportChat(title, state.history);
      showToast('Exported to Notion!');
      closeIntegrationModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  
  window.exportToSlack = async function() {
    const title = state.history[0]?.content?.slice(0, 50) || 'Chat Export';
    
    try {
      await SlackIntegration.exportChat(title, state.history);
      showToast('Exported to Slack!');
      closeIntegrationModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  
  // Add button to UI
  window.addIntegrationsButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar) {
      const btn = document.createElement('button');
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Integrations';
      btn.onclick = openIntegrationModal;
      btn.style.marginBottom = '8px';
      
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addIntegrationsButton, 2000);
    });
  } else {
    setTimeout(window.addIntegrationsButton, 2000);
  }
  
  console.log('[Integrations] Module loaded - Notion & Slack export');
})();
