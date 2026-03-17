/**
 * Chat Folders & Tags Module - Organize conversations
 */

(function() {
  'use strict';

  const ChatFolders = {
    // Default folders
    defaultFolders: [
      { id: 'all', name: 'All Chats', icon: '💬', color: '#8b5cf6', system: true },
      { id: 'favorites', name: 'Favorites', icon: '⭐', color: '#f59e0b', system: true },
      { id: 'work', name: 'Work', icon: '💼', color: '#3b82f6' },
      { id: 'personal', name: 'Personal', icon: '🏠', color: '#10b981' },
      { id: 'projects', name: 'Projects', icon: '🚀', color: '#ec4899' },
      { id: 'ideas', name: 'Ideas', icon: '💡', color: '#f97316' }
    ],

    // Get folders from localStorage
    getFolders() {
      const saved = localStorage.getItem('nova_chat_folders');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch(e) {}
      }
      return this.defaultFolders;
    },

    // Save folders
    saveFolders(folders) {
      localStorage.setItem('nova_chat_folders', JSON.stringify(folders));
    },

    // Get chat folder assignments
    getChatFolders() {
      const saved = localStorage.getItem('nova_chat_folder_assignments');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch(e) {}
      }
      return {};
    },

    // Assign chat to folder
    assignChatToFolder(chatId, folderId) {
      const assignments = this.getChatFolders();
      if (folderId) {
        assignments[chatId] = folderId;
      } else {
        delete assignments[chatId];
      }
      localStorage.setItem('nova_chat_folder_assignments', JSON.stringify(assignments));
    },

    // Get folder for chat
    getChatFolder(chatId) {
      return this.getChatFolders()[chatId] || null;
    },

    // Add custom folder
    addFolder(name, icon, color) {
      const folders = this.getFolders();
      const id = 'custom_' + Date.now();
      folders.push({
        id,
        name: name.slice(0, 20),
        icon: icon || '📁',
        color: color || '#8b5cf6',
        custom: true
      });
      this.saveFolders(folders);
      return id;
    },

    // Delete custom folder
    deleteFolder(folderId) {
      const folders = this.getFolders();
      const folder = folders.find(f => f.id === folderId);
      if (folder && folder.custom) {
        const newFolders = folders.filter(f => f.id !== folderId);
        this.saveFolders(newFolders);
        // Remove assignments to this folder
        const assignments = this.getChatFolders();
        Object.keys(assignments).forEach(chatId => {
          if (assignments[chatId] === folderId) {
            delete assignments[chatId];
          }
        });
        localStorage.setItem('nova_chat_folder_assignments', JSON.stringify(assignments));
        return true;
      }
      return false;
    },

    // Get chats in folder
    getChatsInFolder(folderId, allChats) {
      if (folderId === 'all') return allChats;
      if (folderId === 'favorites') {
        const favorites = JSON.parse(localStorage.getItem('nova_favorite_chats') || '[]');
        return allChats.filter(c => favorites.includes(c.id));
      }
      const assignments = this.getChatFolders();
      return allChats.filter(c => assignments[c.id] === folderId);
    },

    // Toggle favorite
    toggleFavorite(chatId) {
      const favorites = JSON.parse(localStorage.getItem('nova_favorite_chats') || '[]');
      const idx = favorites.indexOf(chatId);
      if (idx > -1) {
        favorites.splice(idx, 1);
      } else {
        favorites.push(chatId);
      }
      localStorage.setItem('nova_favorite_chats', JSON.stringify(favorites));
      return idx === -1; // true if added
    },

    // Check if favorite
    isFavorite(chatId) {
      const favorites = JSON.parse(localStorage.getItem('nova_favorite_chats') || '[]');
      return favorites.includes(chatId);
    }
  };

  // Expose globally
  window.ChatFolders = ChatFolders;

  // Build folder UI in sidebar
  window.buildFolderUI = function() {
    const folders = ChatFolders.getFolders();
    const currentFolder = window.currentFolder || 'all';
    
    // Create folder section HTML
    let html = '<div class="folder-section">';
    html += '<div class="folder-header">Folders</div>';
    
    folders.forEach(folder => {
      const isActive = currentFolder === folder.id;
      html += `<div class="folder-item ${isActive ? 'active' : ''}" data-folder="${folder.id}" onclick="selectFolder('${folder.id}')">`;
      html += `<span class="folder-icon" style="color:${folder.color}">${folder.icon}</span>`;
      html += `<span class="folder-name">${folder.name}</span>`;
      if (folder.custom) {
        html += `<span class="folder-delete" onclick="event.stopPropagation();deleteFolder('${folder.id}')">×</span>`;
      }
      html += '</div>';
    });
    
    html += '<div class="folder-item folder-add" onclick="showAddFolder()">';
    html += '<span class="folder-icon">+</span>';
    html += '<span class="folder-name">New Folder</span>';
    html += '</div>';
    html += '</div>';
    
    return html;
  };

  // Select folder
  window.selectFolder = function(folderId) {
    window.currentFolder = folderId;
    window.renderChatList();
    // Re-render folder UI to update active state
    const folderSection = document.querySelector('.folder-section');
    if (folderSection) {
      folderSection.outerHTML = window.buildFolderUI();
    }
  };

  // Delete folder
  window.deleteFolder = function(folderId) {
    if (confirm('Delete this folder? Chats will not be deleted.')) {
      ChatFolders.deleteFolder(folderId);
      if (window.currentFolder === folderId) {
        window.currentFolder = 'all';
      }
      window.renderChatList();
      const folderSection = document.querySelector('.folder-section');
      if (folderSection) {
        folderSection.outerHTML = window.buildFolderUI();
      }
    }
  };

  // Show add folder dialog
  window.showAddFolder = function() {
    const name = prompt('Folder name:');
    if (name && name.trim()) {
      const icons = ['📁', '📂', '🗂️', '📊', '📈', '📝', '🔖', '🏷️', '📌', '🔔'];
      const icon = icons[Math.floor(Math.random() * icons.length)];
      const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#f97316', '#ef4444', '#06b6d4'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      ChatFolders.addFolder(name.trim(), icon, color);
      const folderSection = document.querySelector('.folder-section');
      if (folderSection) {
        folderSection.outerHTML = window.buildFolderUI();
      }
    }
  };

  // Initialize current folder
  window.currentFolder = 'all';

})();
