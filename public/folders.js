// Chat Folders & Tags Module
// Organize conversations with folders and tags

(function() {
  'use strict';
  
  // Folder/Tag storage
  const FolderStore = {
    get: function() {
      return JSON.parse(localStorage.getItem('nova_chat_folders') || '{}');
    },
    set: function(data) {
      localStorage.setItem('nova_chat_folders', JSON.stringify(data));
    },
    getTags: function() {
      return JSON.parse(localStorage.getItem('nova_chat_tags') || '[]');
    },
    setTags: function(tags) {
      localStorage.setItem('nova_chat_tags', JSON.stringify(tags));
    }
  };
  
  // Predefined folders
  const DEFAULT_FOLDERS = {
    work: { name: 'Work', color: '#22c55e', icon: '💼' },
    personal: { name: 'Personal', color: '#8b5cf6', icon: '🏠' },
    coding: { name: 'Coding', color: '#3b82f6', icon: '</>' },
    ideas: { name: 'Ideas', color: '#f59e0b', icon: '💡' },
    archive: { name: 'Archive', color: '#6b7280', icon: '📦' }
  };
  
  // Get or create folders
  window.getFolders = function() {
    const stored = FolderStore.get();
    return { ...DEFAULT_FOLDERS, ...stored };
  };
  
  // Assign chat to folder
  window.assignChatToFolder = function(chatId, folderId) {
    const assignments = JSON.parse(localStorage.getItem('nova_folder_assignments') || '{}');
    if (folderId) {
      assignments[chatId] = folderId;
    } else {
      delete assignments[chatId];
    }
    localStorage.setItem('nova_folder_assignments', JSON.stringify(assignments));
    renderChatList(); // Refresh UI
  };
  
  // Get chat's folder
  window.getChatFolder = function(chatId) {
    const assignments = JSON.parse(localStorage.getItem('nova_folder_assignments') || '{}');
    return assignments[chatId] || null;
  };
  
  // Add tags to chat
  window.addChatTags = function(chatId, tags) {
    const allTags = FolderStore.getTags();
    const chatTags = JSON.parse(localStorage.getItem('nova_chat_tags_data') || '{}');
    
    // Add new tags to global list
    tags.forEach(tag => {
      if (!allTags.includes(tag)) {
        allTags.push(tag);
      }
    });
    FolderStore.setTags(allTags);
    
    // Assign to chat
    chatTags[chatId] = [...new Set([...(chatTags[chatId] || []), ...tags])];
    localStorage.setItem('nova_chat_tags_data', JSON.stringify(chatTags));
  };
  
  // Get chat tags
  window.getChatTags = function(chatId) {
    const chatTags = JSON.parse(localStorage.getItem('nova_chat_tags_data') || '{}');
    return chatTags[chatId] || [];
  };
  
  // Remove tag from chat
  window.removeChatTag = function(chatId, tag) {
    const chatTags = JSON.parse(localStorage.getItem('nova_chat_tags_data') || '{}');
    if (chatTags[chatId]) {
      chatTags[chatId] = chatTags[chatId].filter(t => t !== tag);
      localStorage.setItem('nova_chat_tags_data', JSON.stringify(chatTags));
    }
  };
  
  // Open folder manager
  window.openFolderManager = function() {
    const folders = getFolders();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '600';
    modal.id = 'folder-manager-modal';
    
    let content = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
        <div class="modal-top"><h2>Chat Folders</h2><button class="modal-close" onclick="closeFolderManager()">&times;</button></div>
        <div class="modal-body">
          <p style="color: var(--muted); margin-bottom: 16px;">Organize your chats into folders.</p>
          <div id="folder-list" style="display: flex; flex-direction: column; gap: 8px;">
    `;
    
    Object.entries(folders).forEach(([id, folder]) => {
      const chatCount = Object.values(JSON.parse(localStorage.getItem('nova_folder_assignments') || '{}')).filter(f => f === id).length;
      content += `
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--surface2); border-radius: var(--radius-sm);">
          <span style="font-size: 20px;">${folder.icon}</span>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: var(--text);">${folder.name}</div>
            <div style="font-size: 11px; color: var(--muted);">${chatCount} chats</div>
          </div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${folder.color};"></div>
        </div>
      `;
    });
    
    content += `
          </div>
          <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border);">
            <h4 style="margin-bottom: 12px; color: var(--text);">Filter by Folder</h4>
            <select id="folder-filter" onchange="filterChatsByFolder(this.value)" style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
              <option value="">All Chats</option>
              ${Object.entries(folders).map(([id, folder]) => `<option value="${id}">${folder.icon} ${folder.name}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    modal.onclick = closeFolderManager;
    document.body.appendChild(modal);
  };
  
  window.closeFolderManager = function() {
    const modal = document.getElementById('folder-manager-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  // Filter chats by folder
  window.filterChatsByFolder = function(folderId) {
    closeFolderManager();
    const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
    const assignments = JSON.parse(localStorage.getItem('nova_folder_assignments') || '{}');
    
    if (!folderId) {
      // Show all
      window.renderChatList();
      return;
    }
    
    // Filter and re-render
    const filtered = chats.filter(c => assignments[c.id] === folderId);
    
    // Update UI
    [['d-chat-list','d-chat-item','d-chat-dot'],['m-chat-list','m-drawer-item','m-drawer-dot']].forEach(([listId, itemCls, dotCls]) => {
      const list = document.getElementById(listId);
      if (!list) return;
      list.innerHTML = '';
      
      if (filtered.length === 0) {
        list.innerHTML = '<p style="color: var(--muted); padding: 16px; text-align: center;">No chats in this folder</p>';
        return;
      }
      
      filtered.slice(-10).reverse().forEach(chat => {
        const item = document.createElement('div');
        item.className = itemCls + (chat.id === state.currentChatId ? ' active' : '');
        item.innerHTML = '<div class="' + dotCls + '"></div><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">' + chat.title + '</span>';
        item.onclick = () => { loadChat(chat.id); if (listId === 'm-chat-list') closeDrawer(); };
        list.appendChild(item);
      });
    });
    
    showToast(`Showing ${filtered.length} chats`);
  };
  
  // Context menu for chat items
  window.showChatContextMenu = function(chatId, x, y) {
    const folders = getFolders();
    const currentFolder = getChatFolder(chatId);
    const currentTags = getChatTags(chatId);
    
    const menu = document.createElement('div');
    menu.className = 'chat-context-menu';
    menu.style.cssText = `position: fixed; left: ${x}px; top: ${y}px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px; z-index: 1000; min-width: 180px; box-shadow: var(--shadow-lg);`;
    
    let content = '<div style="font-size: 12px; font-weight: 600; color: var(--muted); padding: 4px 8px; margin-bottom: 4px;">Move to Folder</div>';
    
    Object.entries(folders).forEach(([id, folder]) => {
      const isCurrent = currentFolder === id;
      content += `
        <div onclick="assignChatToFolder('${chatId}', '${isCurrent ? '' : id}'); document.querySelector('.chat-context-menu').remove();" 
             style="padding: 6px 8px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 8px; ${isCurrent ? 'background: var(--accent-glow);' : ''}">
          <span>${folder.icon}</span>
          <span style="flex: 1;">${folder.name}</span>
          ${isCurrent ? '<span style="color: var(--accent);">✓</span>' : ''}
        </div>
      `;
    });
    
    content += '<div style="border-top: 1px solid var(--border); margin: 8px 0;"></div>';
    content += `<div onclick="deleteChat('${chatId}'); document.querySelector('.chat-context-menu').remove();" style="padding: 6px 8px; cursor: pointer; border-radius: 4px; color: var(--red);">🗑️ Delete Chat</div>`;
    
    menu.innerHTML = content;
    document.body.appendChild(menu);
    
    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 10);
  };
  
  // Override renderChatList to show folder indicators
  const originalRenderChatList = window.renderChatList;
  window.renderChatList = function() {
    // Call original first
    if (originalRenderChatList) {
      originalRenderChatList();
    }
    
    // Add folder indicators and context menus
    const folders = getFolders();
    const assignments = JSON.parse(localStorage.getItem('nova_folder_assignments') || '{}');
    
    document.querySelectorAll('.d-chat-item, .m-drawer-item').forEach(item => {
      const chatId = item.onclick?.toString().match(/loadChat\('([^']+)'\)/)?.[1];
      if (!chatId) return;
      
      const folderId = assignments[chatId];
      if (folderId && folders[folderId]) {
        const folder = folders[folderId];
        const dot = item.querySelector('.d-chat-dot, .m-drawer-dot');
        if (dot) {
          dot.style.background = folder.color;
          dot.title = folder.name;
        }
      }
      
      // Add right-click context menu
      item.oncontextmenu = function(e) {
        e.preventDefault();
        showChatContextMenu(chatId, e.clientX, e.clientY);
      };
    });
  };
  
  // Add folder button to sidebar
  window.addFolderButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (!sidebar) return;
    
    const btn = document.createElement('button');
    btn.className = 'd-plugins-btn';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> Folders';
    btn.onclick = openFolderManager;
    btn.style.marginBottom = '8px';
    
    // Insert before first button
    sidebar.insertBefore(btn, sidebar.firstChild);
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(addFolderButton, 2000);
    });
  } else {
    setTimeout(addFolderButton, 2000);
  }
  
  console.log('[Folders] Module loaded - chats can be organized with folders and tags');
})();
