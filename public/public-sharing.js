/**
 * Public Sharing - Share chats publicly (read-only)
 */

(function() {
  'use strict';

  const PublicSharing = {
    // Generate public share link
    async share(chatId) {
      const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
      const chat = chats.find(c => c.id === chatId);
      
      if (!chat) return { error: 'Chat not found' };

      const shareId = 'pub_' + Math.random().toString(36).substr(2, 12);
      const shareData = {
        id: shareId,
        chatId,
        title: chat.title,
        messages: chat.history.slice(-50), // Last 50 messages
        created: Date.now(),
        views: 0
      };

      // Store in localStorage (in production would be server)
      const shares = JSON.parse(localStorage.getItem('nova_public_shares') || '[]');
      shares.push(shareData);
      localStorage.setItem('nova_public_shares', JSON.stringify(shares));

      return {
        success: true,
        shareId,
        url: `${window.location.origin}/?view=${shareId}`
      };
    },

    // Get shared chat
    getShared(shareId) {
      const shares = JSON.parse(localStorage.getItem('nova_public_shares') || '[]');
      return shares.find(s => s.id === shareId);
    },

    // Increment views
    recordView(shareId) {
      const shares = JSON.parse(localStorage.getItem('nova_public_shares') || '[]');
      const share = shares.find(s => s.id === shareId);
      if (share) {
        share.views = (share.views || 0) + 1;
        localStorage.setItem('nova_public_shares', JSON.stringify(shares));
      }
    },

    // Unshare
    unshare(shareId) {
      const shares = JSON.parse(localStorage.getItem('nova_public_shares') || '[]');
      const filtered = shares.filter(s => s.id !== shareId);
      localStorage.setItem('nova_public_shares', JSON.stringify(filtered));
    }
  };

  window.PublicSharing = PublicSharing;

  // Handle view parameter on load
  window.handlePublicView = function() {
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get('view');
    
    if (viewId && viewId.startsWith('pub_')) {
      const shared = PublicSharing.getShared(viewId);
      if (shared) {
        PublicSharing.recordView(viewId);
        displayPublicChat(shared);
        return true;
      }
    }
    return false;
  };

  function displayPublicChat(shared) {
    // Create read-only view
    const overlay = document.createElement('div');
    overlay.id = 'public-view-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: var(--bg); z-index: 9999;
      display: flex; flex-direction: column;
    `;
    
    overlay.innerHTML = `
      <div style="padding: 16px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 600;">📖 ${shared.title || 'Shared Conversation'}</div>
          <div style="font-size: 11px; color: var(--muted);">${shared.views} views • Shared ${new Date(shared.created).toLocaleDateString()}</div>
        </div>
        <button onclick="document.getElementById('public-view-overlay').remove()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; cursor: pointer;">Close</button>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 20px; max-width: 800px; margin: 0 auto; width: 100%;">
        ${shared.messages.map(m => `
          <div style="margin-bottom: 20px; ${m.role === 'user' ? 'text-align: right;' : ''}">
            <div style="display: inline-block; max-width: 80%; padding: 12px 16px; border-radius: var(--radius); 
              ${m.role === 'user' 
                ? 'background: var(--accent-glow); border: 1px solid rgba(139,92,246,0.3);' 
                : 'background: var(--surface); border: 1px solid var(--border);'}">
              <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px;">${m.role === 'user' ? 'You' : 'NOVA'}</div>
              <div style="white-space: pre-wrap;">${escapeHtml(m.content)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    document.body.appendChild(overlay);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // UI for sharing
  window.shareChatPublic = async function() {
    if (!window.state?.currentChatId) {
      alert('No active chat to share');
      return;
    }
    
    const result = await PublicSharing.share(window.state.currentChatId);
    
    if (result.success) {
      navigator.clipboard.writeText(result.url);
      alert(`Public link copied!\n${result.url}`);
    }
  };

  console.log('[Public Sharing] Module loaded');
})();
