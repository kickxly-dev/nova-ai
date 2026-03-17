/**
 * Slack & Discord Integration - Notifications and messages
 */

(function() {
  'use strict';

  const SlackIntegration = {
    getWebhook() {
      return localStorage.getItem('nova_slack_webhook') || '';
    },
    
    setWebhook(url) {
      localStorage.setItem('nova_slack_webhook', url);
    },

    async sendMessage(text, blocks = null) {
      const webhook = this.getWebhook();
      if (!webhook) throw new Error('Slack webhook not configured');

      const payload = blocks ? { blocks } : { text };
      
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to send Slack message');
      return { success: true };
    }
  };

  const DiscordIntegration = {
    getWebhook() {
      return localStorage.getItem('nova_discord_webhook') || '';
    },
    
    setWebhook(url) {
      localStorage.setItem('nova_discord_webhook', url);
    },

    async sendMessage(content, embeds = null) {
      const webhook = this.getWebhook();
      if (!webhook) throw new Error('Discord webhook not configured');

      const payload = { content };
      if (embeds) payload.embeds = embeds;
      
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to send Discord message');
      return { success: true };
    }
  };

  window.SlackIntegration = SlackIntegration;
  window.DiscordIntegration = DiscordIntegration;

  window.handleSlackCommand = async function(command, args) {
    try {
      if (command === 'slack_send') {
        await SlackIntegration.sendMessage(args);
        return { success: true, formatted: '✅ Message sent to Slack' };
      }
      return { error: 'Unknown Slack command' };
    } catch(err) {
      return { error: err.message };
    }
  };

  window.handleDiscordCommand = async function(command, args) {
    try {
      if (command === 'discord_send') {
        await DiscordIntegration.sendMessage(args);
        return { success: true, formatted: '✅ Message sent to Discord' };
      }
      return { error: 'Unknown Discord command' };
    } catch(err) {
      return { error: err.message };
    }
  };

  window.openNotificationsModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'notifications-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
        <div class="modal-top"><h2>🔔 Notifications</h2><button class="modal-close" onclick="closeNotificationsModal()">&times;</button></div>
        <div class="modal-body">
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Slack Webhook URL</label>
            <input type="text" id="slack-webhook" value="${SlackIntegration.getWebhook()}" placeholder="https://hooks.slack.com/services/..." style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
          </div>
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Discord Webhook URL</label>
            <input type="text" id="discord-webhook" value="${DiscordIntegration.getWebhook()}" placeholder="https://discord.com/api/webhooks/..." style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <button onclick="testSlack()" style="padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Test Slack</button>
            <button onclick="testDiscord()" style="padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Test Discord</button>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px;">
          <button onclick="closeNotificationsModal()" style="padding: 8px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Close</button>
          <button onclick="saveWebhooks()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeNotificationsModal = function() {
    const modal = document.getElementById('notifications-modal');
    if (modal) modal.remove();
  };

  window.saveWebhooks = function() {
    const slack = document.getElementById('slack-webhook').value.trim();
    const discord = document.getElementById('discord-webhook').value.trim();
    if (slack) SlackIntegration.setWebhook(slack);
    if (discord) DiscordIntegration.setWebhook(discord);
    showToast('Webhooks saved!');
    closeNotificationsModal();
  };

  window.testSlack = async function() {
    try {
      await SlackIntegration.sendMessage('🧪 Test message from NOVA AI');
      showToast('Slack test sent!');
    } catch(err) {
      showToast('Slack failed: ' + err.message, 'error');
    }
  };

  window.testDiscord = async function() {
    try {
      await DiscordIntegration.sendMessage('🧪 Test message from NOVA AI');
      showToast('Discord test sent!');
    } catch(err) {
      showToast('Discord failed: ' + err.message, 'error');
    }
  };

  window.addNotificationsButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar && !document.getElementById('notifications-btn')) {
      const btn = document.createElement('button');
      btn.id = 'notifications-btn';
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '🔔 Notifications';
      btn.onclick = openNotificationsModal;
      btn.style.marginBottom = '8px';
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };

  setTimeout(addNotificationsButton, 3500);
  console.log('[Notifications] Slack/Discord module loaded');
})();
