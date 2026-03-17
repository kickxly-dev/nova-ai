/**
 * Real-time Collaboration Module - Share and edit chats together
 */

(function() {
  'use strict';

  const Collaboration = {
    // Generate share link for chat
    generateShareLink(chatId) {
      const token = this.generateToken();
      const shareData = {
        chatId,
        token,
        created: Date.now(),
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      };
      
      // Store share data
      const shares = this.getShares();
      shares[chatId] = shareData;
      localStorage.setItem('nova_chat_shares', JSON.stringify(shares));
      
      return `${window.location.origin}/?share=${chatId}&token=${token}`;
    },

    // Generate random token
    generateToken() {
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    },

    // Get all shares
    getShares() {
      const saved = localStorage.getItem('nova_chat_shares');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch(e) {}
      }
      return {};
    },

    // Validate share link
    validateShare(chatId, token) {
      const shares = this.getShares();
      const share = shares[chatId];
      if (!share) return false;
      if (share.token !== token) return false;
      if (Date.now() > share.expires) return false;
      return true;
    },

    // Get shared chat data (simulated - in production would fetch from server)
    getSharedChat(chatId) {
      const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
      return chats.find(c => c.id === chatId);
    },

    // Join shared chat
    joinSharedChat(chatId, token) {
      if (!this.validateShare(chatId, token)) {
        return { error: 'Invalid or expired share link' };
      }
      
      const chat = this.getSharedChat(chatId);
      if (!chat) {
        return { error: 'Chat not found' };
      }
      
      // Create local copy for collaboration
      const collabChat = {
        ...chat,
        id: 'collab_' + Date.now(),
        sharedFrom: chatId,
        sharedToken: token,
        title: chat.title + ' (Shared)'
      };
      
      // Add to local chats
      const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
      chats.push(collabChat);
      localStorage.setItem('nova_chats', JSON.stringify(chats));
      
      return { success: true, chat: collabChat };
    },

    // Broadcast update (simulated with localStorage events)
    broadcastUpdate(chatId, update) {
      const event = {
        type: 'collab_update',
        chatId,
        update,
        timestamp: Date.now(),
        user: this.getUserId()
      };
      localStorage.setItem('nova_collab_event', JSON.stringify(event));
      // Trigger storage event
      window.dispatchEvent(new StorageEvent('storage', { key: 'nova_collab_event' }));
    },

    // Get user ID
    getUserId() {
      let id = localStorage.getItem('nova_collab_user_id');
      if (!id) {
        id = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('nova_collab_user_id', id);
      }
      return id;
    },

    // Listen for collaboration updates
    listenForUpdates(callback) {
      window.addEventListener('storage', (e) => {
        if (e.key === 'nova_collab_event') {
          try {
            const event = JSON.parse(localStorage.getItem('nova_collab_event'));
            if (event && event.type === 'collab_update') {
              callback(event);
            }
          } catch(e) {}
        }
      });
    }
  };

  // Expose globally
  window.Collaboration = Collaboration;

  // Share current chat
  window.shareCurrentChat = function() {
    if (!window.state || !window.state.currentChatId) {
      window.showToast('No active chat to share');
      return;
    }
    
    const link = Collaboration.generateShareLink(window.state.currentChatId);
    
    // Copy to clipboard
    navigator.clipboard.writeText(link).then(() => {
      window.showToast('Share link copied!');
    }).catch(() => {
      prompt('Share link:', link);
    });
  };

  // Check for share link on load
  window.checkForShareLink = function() {
    const url = new URL(window.location.href);
    const shareId = url.searchParams.get('share');
    const token = url.searchParams.get('token');
    
    if (shareId && token) {
      const result = Collaboration.joinSharedChat(shareId, token);
      if (result.success) {
        window.showToast('Joined shared chat!');
        // Load the shared chat
        window.state.chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
        window.renderChatList();
        return result.chat.id;
      } else {
        window.showToast('Error: ' + result.error);
      }
    }
    return null;
  };

  // Initialize collaboration on load
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
      const joinedChatId = window.checkForShareLink();
      if (joinedChatId) {
        window.loadChat(joinedChatId);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      // Setup real-time sync listener
      Collaboration.listenForUpdates((event) => {
        if (window.state && window.state.currentChatId === event.chatId) {
          // Show indicator that someone else updated
          window.showToast('Chat updated by collaborator');
        }
      });
    }, 1000);
  });

})();
