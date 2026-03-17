/**
 * Audit Logs - Track user actions and system events
 */

(function() {
  'use strict';

  const AuditLogs = {
    // Max logs to keep
    maxLogs: 1000,

    // Get all logs
    getLogs() {
      return JSON.parse(localStorage.getItem('nova_audit_logs') || '[]');
    },

    // Save logs
    saveLogs(logs) {
      // Keep only last maxLogs
      localStorage.setItem('nova_audit_logs', JSON.stringify(logs.slice(-this.maxLogs)));
    },

    // Log event
    log(action, details = {}, user = null) {
      const logs = this.getLogs();
      logs.push({
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        timestamp: Date.now(),
        action,
        details,
        user: user || this.getCurrentUser(),
        ip: 'local', // Would be server-side in production
        userAgent: navigator.userAgent
      });
      this.saveLogs(logs);
    },

    // Get current user
    getCurrentUser() {
      return localStorage.getItem('nova_user_email') || 'anonymous';
    },

    // Search logs
    search(query, startTime, endTime) {
      let logs = this.getLogs();
      
      if (query) {
        const q = query.toLowerCase();
        logs = logs.filter(l => 
          l.action.toLowerCase().includes(q) ||
          JSON.stringify(l.details).toLowerCase().includes(q) ||
          l.user.toLowerCase().includes(q)
        );
      }
      
      if (startTime) {
        logs = logs.filter(l => l.timestamp >= startTime);
      }
      
      if (endTime) {
        logs = logs.filter(l => l.timestamp <= endTime);
      }
      
      return logs.reverse();
    },

    // Get stats
    getStats() {
      const logs = this.getLogs();
      const stats = {
        total: logs.length,
        byAction: {},
        byUser: {},
        last24h: 0
      };

      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

      logs.forEach(l => {
        stats.byAction[l.action] = (stats.byAction[l.action] || 0) + 1;
        stats.byUser[l.user] = (stats.byUser[l.user] || 0) + 1;
        if (l.timestamp > dayAgo) stats.last24h++;
      });

      return stats;
    },

    // Export logs
    export() {
      return JSON.stringify(this.getLogs(), null, 2);
    },

    // Clear logs
    clear() {
      localStorage.removeItem('nova_audit_logs');
    }
  };

  window.AuditLogs = AuditLogs;

  // Hook into key actions
  const originalNewChat = window.newChat;
  window.newChat = function() {
    AuditLogs.log('chat_created', {});
    return originalNewChat?.();
  };

  const originalSendMessage = window.sendMessage;
  window.sendMessage = async function(p) {
    const inputEl = document.getElementById(p + '-msg-input');
    const text = inputEl?.value?.trim();
    if (text) {
      AuditLogs.log('message_sent', { length: text.length, platform: p });
    }
    return originalSendMessage?.(p);
  };

  const originalLoadChat = window.loadChat;
  window.loadChat = function(id) {
    AuditLogs.log('chat_loaded', { chatId: id });
    return originalLoadChat?.(id);
  };

  // UI
  window.openAuditModal = function() {
    const stats = AuditLogs.getStats();
    const logs = AuditLogs.getLogs().slice(-50).reverse();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'audit-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 700px; max-height: 80vh;">
        <div class="modal-top"><h2>📋 Audit Logs</h2><button class="modal-close" onclick="closeAuditModal()">&times;</button></div>
        <div class="modal-body" style="overflow-y: auto;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; text-align: center;">
            <div style="padding: 12px; background: var(--surface2); border-radius: var(--radius);">
              <div style="font-size: 24px; font-weight: 700; color: var(--accent);">${stats.total}</div>
              <div style="font-size: 11px; color: var(--muted);">Total Events</div>
            </div>
            <div style="padding: 12px; background: var(--surface2); border-radius: var(--radius);">
              <div style="font-size: 24px; font-weight: 700; color: var(--accent);">${stats.last24h}</div>
              <div style="font-size: 11px; color: var(--muted);">Last 24h</div>
            </div>
            <div style="padding: 12px; background: var(--surface2); border-radius: var(--radius);">
              <div style="font-size: 24px; font-weight: 700; color: var(--accent);">${Object.keys(stats.byUser).length}</div>
              <div style="font-size: 11px; color: var(--muted);">Active Users</div>
            </div>
          </div>
          
          <div style="margin-bottom: 16px; display: flex; gap: 8px;">
            <input type="text" id="audit-search" placeholder="Search logs..." style="flex: 1; padding: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
            <button onclick="exportAuditLogs()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; cursor: pointer;">Export</button>
            <button onclick="clearAuditLogs()" style="padding: 8px 16px; background: var(--red); border: none; border-radius: var(--radius-sm); color: #fff; cursor: pointer;">Clear</button>
          </div>
          
          <div style="display: grid; gap: 6px; font-family: var(--mono); font-size: 12px;">
            ${logs.length === 0 ? '<div style="color: var(--muted); padding: 20px; text-align: center;">No logs yet</div>' : logs.map(l => `
              <div style="padding: 10px; background: var(--surface2); border-radius: var(--radius-sm); border-left: 3px solid var(--accent);">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--accent-light);">${l.action}</span>
                  <span style="color: var(--muted);">${new Date(l.timestamp).toLocaleString()}</span>
                </div>
                <div style="color: var(--text); margin-top: 4px;">${l.user}</div>
                ${Object.keys(l.details).length > 0 ? `<div style="color: var(--muted); font-size: 10px; margin-top: 2px;">${JSON.stringify(l.details)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeAuditModal = function() {
    const modal = document.getElementById('audit-modal');
    if (modal) modal.remove();
  };

  window.exportAuditLogs = function() {
    const data = AuditLogs.export();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nova-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  window.clearAuditLogs = function() {
    if (confirm('Clear all audit logs?')) {
      AuditLogs.clear();
      closeAuditModal();
      setTimeout(openAuditModal, 300);
    }
  };

  console.log('[Audit Logs] Module loaded');
})();
