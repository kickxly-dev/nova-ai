// Chat Persistence Module
// Syncs chats between localStorage and database

(function() {
  'use strict';
  
  // Load chats from database
  window.loadChatsFromDB = async function() {
    const userToken = window.userToken || localStorage.getItem('nova_user_token');
    if (!userToken) {
      console.log('[ChatPersistence] No user token, using localStorage only');
      return null;
    }
    
    try {
      const res = await fetch('/api/chats/' + encodeURIComponent(userToken));
      if (!res.ok) {
        console.log('[ChatPersistence] Database not available, using localStorage');
        return null;
      }
      
      const data = await res.json();
      if (data.chats && data.chats.length > 0) {
        console.log('[ChatPersistence] Loaded', data.chats.length, 'chats from database');
        // Merge with localStorage chats (database takes priority)
        const localChats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
        const dbChatIds = new Set(data.chats.map(c => c.id));
        
        // Keep local chats not in DB
        const mergedChats = [
          ...data.chats,
          ...localChats.filter(c => !dbChatIds.has(c.id))
        ].slice(-50); // Keep last 50
        
        localStorage.setItem('nova_chats', JSON.stringify(mergedChats));
        return mergedChats;
      }
      return null;
    } catch (err) {
      console.log('[ChatPersistence] Error loading from DB:', err.message);
      return null;
    }
  };
  
  // Save chat to database
  window.saveChatToDB = async function(chatId, title, history) {
    const userToken = window.userToken || localStorage.getItem('nova_user_token');
    if (!userToken) return false;
    
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userToken: userToken,
          chatId: chatId,
          title: title?.slice(0, 256) || 'Untitled',
          history: history.slice(-100) // Save last 100 messages
        })
      });
      
      if (!res.ok) {
        console.log('[ChatPersistence] Failed to save to DB, keeping localStorage only');
        return false;
      }
      
      console.log('[ChatPersistence] Chat saved to database:', chatId);
      return true;
    } catch (err) {
      console.log('[ChatPersistence] Error saving to DB:', err.message);
      return false;
    }
  };
  
  // Delete chat from database
  window.deleteChatFromDB = async function(chatId) {
    const userToken = window.userToken || localStorage.getItem('nova_user_token');
    if (!userToken) return false;
    
    try {
      const res = await fetch('/api/chats/' + encodeURIComponent(userToken) + '/' + encodeURIComponent(chatId), {
        method: 'DELETE'
      });
      
      if (!res.ok) return false;
      console.log('[ChatPersistence] Chat deleted from database:', chatId);
      return true;
    } catch (err) {
      console.log('[ChatPersistence] Error deleting from DB:', err.message);
      return false;
    }
  };
  
  // Override saveCurrentChat to sync with DB
  const originalSaveCurrentChat = window.saveCurrentChat;
  window.saveCurrentChat = async function(firstMsg) {
    // Call original function first (saves to localStorage)
    if (originalSaveCurrentChat) {
      originalSaveCurrentChat(firstMsg);
    }
    
    // Then sync to database
    if (state.currentChatId && state.history.length > 0) {
      const title = firstMsg?.slice(0, 32) || state.history[0]?.content?.slice(0, 32) || 'Untitled';
      await window.saveChatToDB(state.currentChatId, title, state.history);
    }
  };
  
  // Auto-save chats periodically
  setInterval(function() {
    if (state.currentChatId && state.history.length > 0 && !state.isTyping) {
      const lastMsg = state.history[state.history.length - 1];
      const title = state.history[0]?.content?.slice(0, 32) || 'Untitled';
      window.saveChatToDB(state.currentChatId, title, state.history);
    }
  }, 30000); // Auto-save every 30 seconds
  
  // Override delete chat to also delete from DB
  const originalDeleteChat = window.deleteChat;
  window.deleteChat = async function(chatId) {
    // Delete from database
    await window.deleteChatFromDB(chatId);
    
    // Delete from localStorage
    let chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
    chats = chats.filter(c => c.id !== chatId);
    localStorage.setItem('nova_chats', JSON.stringify(chats));
    
    // If deleting current chat, create new one
    if (state.currentChatId === chatId) {
      state.currentChatId = null;
      state.history = [];
      window.newChat();
    }
    
    window.renderChatList();
    window.showToast('Chat deleted');
  };
  
  // Load chats from DB on init
  window.addEventListener('nova-plugins-ready', async function() {
    console.log('[ChatPersistence] Loading chats from database...');
    await window.loadChatsFromDB();
    if (window.renderChatList) window.renderChatList();
  });
  
  // Also try loading on regular init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async function() {
      await window.loadChatsFromDB();
    });
  } else {
    window.loadChatsFromDB();
  }
  
  console.log('[ChatPersistence] Module loaded - chats will sync to database');
})();
