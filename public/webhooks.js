/**
 * Webhooks - Send/receive webhooks
 */

(function() {
  'use strict';

  const Webhooks = {
    // Store webhooks
    getWebhooks() {
      return JSON.parse(localStorage.getItem('nova_webhooks') || '[]');
    },

    saveWebhooks(webhooks) {
      localStorage.setItem('nova_webhooks', JSON.stringify(webhooks));
    },

    // Add webhook
    addWebhook(name, url, events = ['message']) {
      const webhooks = this.getWebhooks();
      webhooks.push({
        id: 'hook_' + Date.now(),
        name,
        url,
        events,
        active: true,
        created: Date.now()
      });
      this.saveWebhooks(webhooks);
      return webhooks[webhooks.length - 1];
    },

    // Remove webhook
    removeWebhook(id) {
      const webhooks = this.getWebhooks().filter(h => h.id !== id);
      this.saveWebhooks(webhooks);
    },

    // Toggle webhook
    toggleWebhook(id) {
      const webhooks = this.getWebhooks();
      const hook = webhooks.find(h => h.id === id);
      if (hook) {
        hook.active = !hook.active;
        this.saveWebhooks(webhooks);
      }
      return hook?.active;
    },

    // Send webhook
    async send(webhookId, payload) {
      const webhook = this.getWebhooks().find(h => h.id === webhookId);
      if (!webhook || !webhook.active) return false;

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            timestamp: Date.now(),
            source: 'nova-ai'
          })
        });
        return response.ok;
      } catch (e) {
        console.error('Webhook failed:', e);
        return false;
      }
    },

    // Send to all webhooks for an event
    async trigger(event, data) {
      const webhooks = this.getWebhooks().filter(h => 
        h.active && h.events.includes(event)
      );

      for (const hook of webhooks) {
        await this.send(hook.id, { event, data });
      }
    },

    // Test webhook
    async test(url) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            test: true,
            message: 'Test webhook from NOVA AI',
            timestamp: Date.now()
          })
        });
        return response.ok;
      } catch (e) {
        return false;
      }
    }
  };

  window.Webhooks = Webhooks;

  // Hook into sendMessage to trigger webhooks
  const originalSendMessage = window.sendMessage;
  window.sendMessage = async function(p) {
    const inputEl = document.getElementById(p + '-msg-input');
    const text = inputEl?.value?.trim();
    
    if (text) {
      Webhooks.trigger('message', { content: text, platform: p });
    }
    
    return originalSendMessage?.(p);
  };

  console.log('[Webhooks] Module loaded');
})();
