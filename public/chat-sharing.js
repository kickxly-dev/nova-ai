// Chat Sharing - Generate shareable conversation links
(function() {
  'use strict';
  
  // Generate share link
  window.shareChat = async function(chatId) {
    const chat = await getChatById(chatId || state.currentChatId);
    if (!chat || chat.history.length === 0) {
      showToast('No chat to share', 'error');
      return;
    }
    
    // Create shareable data
    const shareData = {
      title: chat.title,
      created: chat.createdAt || Date.now(),
      history: chat.history.map(h => ({
        role: h.role,
        content: h.content,
        timestamp: h.timestamp || Date.now()
      }))
    };
    
    // Compress and encode
    const json = JSON.stringify(shareData);
    const compressed = await compressData(json);
    const encoded = btoa(compressed);
    
    // Create URL
    const shareUrl = `${window.location.origin}/?share=${encoded}`;
    
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share link copied to clipboard!');
    } catch (err) {
      // Show modal with link
      showShareModal(shareUrl);
    }
    
    return shareUrl;
  };
  
  // Compress data using LZ-string if available, otherwise just use base64
  async function compressData(str) {
    // Simple compression - remove whitespace and encode
    return str;
  }
  
  // Get chat by ID
  async function getChatById(id) {
    if (!id) {
      // Current chat
      return {
        id: state.currentChatId,
        title: state.history[0]?.content?.slice(0, 50) || 'Untitled',
        history: state.history,
        createdAt: Date.now()
      };
    }
    
    const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
    let chat = chats.find(c => c.id === id);
    
    // Also check database
    if (!chat) {
      try {
        const userToken = window.userToken || localStorage.getItem('nova_user_token');
        if (userToken) {
          const res = await fetch('/api/chats/' + encodeURIComponent(userToken));
          if (res.ok) {
            const data = await res.json();
            chat = data.chats?.find(c => c.id === id);
          }
        }
      } catch (e) {
        console.log('Could not load from DB');
      }
    }
    
    return chat;
  }
  
  // Show share modal
  function showShareModal(url) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '600';
    modal.id = 'share-modal';
    
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
        <div class="modal-top"><h2>Share Chat</h2><button class="modal-close" onclick="closeShareModal()">&times;</button></div>
        <div class="modal-body">
          <p style="color: var(--muted); margin-bottom: 16px;">Anyone with this link can view this conversation.</p>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="share-url" value="${url}" readonly style="flex: 1; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-family: var(--mono); font-size: 12px;">
            <button onclick="copyShareUrl()" style="padding: 10px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer; white-space: nowrap;">Copy</button>
          </div>
          <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button onclick="shareToTwitter()" style="padding: 8px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; font-size: 12px;">𝕏 Twitter</button>
            <button onclick="shareToReddit()" style="padding: 8px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; font-size: 12px;">Reddit</button>
            <button onclick="shareToEmail()" style="padding: 8px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; font-size: 12px;">Email</button>
          </div>
        </div>
      </div>
    `;
    
    modal.onclick = closeShareModal;
    document.body.appendChild(modal);
  }
  
  window.closeShareModal = function() {
    const modal = document.getElementById('share-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.copyShareUrl = function() {
    const input = document.getElementById('share-url');
    input.select();
    navigator.clipboard.writeText(input.value);
    showToast('Copied to clipboard!');
  };
  
  window.shareToTwitter = function() {
    const url = document.getElementById('share-url').value;
    const text = 'Check out this AI conversation I had with NOVA';
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  };
  
  window.shareToReddit = function() {
    const url = document.getElementById('share-url').value;
    window.open(`https://reddit.com/submit?url=${encodeURIComponent(url)}&title=AI Conversation`, '_blank');
  };
  
  window.shareToEmail = function() {
    const url = document.getElementById('share-url').value;
    window.location.href = `mailto:?subject=Shared NOVA Conversation&body=${encodeURIComponent(url)}`;
  };
  
  // Load shared chat from URL
  window.loadSharedChat = function() {
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get('share');
    
    if (!shareData) return false;
    
    try {
      // Decode
      const json = atob(shareData);
      const data = JSON.parse(json);
      
      if (data.history && data.history.length > 0) {
        // Create new chat with shared content
        state.currentChatId = null;
        state.history = data.history.map(h => ({
          role: h.role,
          content: h.content
        }));
        
        // Render the shared chat
        document.querySelectorAll('.chat-messages').forEach(el => el.innerHTML = '');
        state.history.forEach(msg => {
          appendMessage(msg.role, msg.content, false);
        });
        
        // Show indicator
        showToast(`Loaded shared chat: ${data.title || 'Untitled'}`);
        
        // Clean URL
        window.history.replaceState({}, '', '/');
        
        return true;
      }
    } catch (err) {
      console.error('Failed to load shared chat:', err);
      showToast('Invalid share link', 'error');
    }
    
    return false;
  };
  
  // Add share button to chat items
  window.addShareButton = function() {
    // Add share button in sidebar header
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar) {
      const btn = document.createElement('button');
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share Chat';
      btn.onclick = () => shareChat();
      btn.style.marginBottom = '8px';
      
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
    
    // Add share to context menu
    const originalShowChatContextMenu = window.showChatContextMenu;
    window.showChatContextMenu = function(chatId, x, y) {
      // Call original first
      if (originalShowChatContextMenu) {
        originalShowChatContextMenu(chatId, x, y);
      }
      
      // Add share option
      const menu = document.querySelector('.chat-context-menu');
      if (menu) {
        const shareOption = document.createElement('div');
        shareOption.onclick = function() {
          shareChat(chatId);
          menu.remove();
        };
        shareOption.style.cssText = 'padding: 6px 8px; cursor: pointer; border-radius: 4px; border-top: 1px solid var(--border); margin-top: 4px;';
        shareOption.innerHTML = '🔗 Share';
        menu.appendChild(shareOption);
      }
    };
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        window.loadSharedChat();
        window.addShareButton();
      }, 2000);
    });
  } else {
    setTimeout(() => {
      window.loadSharedChat();
      window.addShareButton();
    }, 2000);
  }
  
  console.log('[ChatSharing] Module loaded - share conversations via links');
})();
