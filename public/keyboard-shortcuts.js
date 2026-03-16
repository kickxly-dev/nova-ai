// Keyboard Shortcuts - Power user key combos
(function() {
  'use strict';
  
  const SHORTCUTS = {
    // Message input
    'Enter': { action: 'send', when: 'input' },
    'Shift+Enter': { action: 'newline', when: 'input' },
    'Ctrl+K': { action: 'focusInput', when: 'global' },
    
    // Navigation
    'Ctrl+N': { action: 'newChat', when: 'global' },
    'Ctrl+O': { action: 'openSettings', when: 'global' },
    'Ctrl+Shift+T': { action: 'toggleTheme', when: 'global' },
    'Ctrl+P': { action: 'togglePersonality', when: 'global' },
    
    // Chat management
    'Ctrl+S': { action: 'saveChat', when: 'global' },
    'Ctrl+E': { action: 'exportChat', when: 'global' },
    'Ctrl+D': { action: 'deleteChat', when: 'global' },
    
    // Tools
    'Ctrl+W': { action: 'toggleWebSearch', when: 'global' },
    'Ctrl+M': { action: 'toggleMultiModel', when: 'global' },
    'Ctrl+L': { action: 'clearChat', when: 'global' },
    
    // Navigation between chats
    'Alt+Up': { action: 'prevChat', when: 'global' },
    'Alt+Down': { action: 'nextChat', when: 'global' },
    
    // Special
    'Escape': { action: 'closeModals', when: 'global' },
    'Ctrl+?': { action: 'showShortcuts', when: 'global' },
    'Ctrl+H': { action: 'showShortcuts', when: 'global' }
  };
  
  // Handle keyboard events
  document.addEventListener('keydown', function(e) {
    const key = [];
    if (e.ctrlKey) key.push('Ctrl');
    if (e.shiftKey) key.push('Shift');
    if (e.altKey) key.push('Alt');
    if (e.metaKey) key.push('Cmd');
    key.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    
    const shortcut = key.join('+');
    const config = SHORTCUTS[shortcut];
    
    if (!config) return;
    
    // Check context
    const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    if (config.when === 'input' && !isInput) return;
    if (config.when === 'global' && isInput && shortcut !== 'Ctrl+K') return;
    
    e.preventDefault();
    executeShortcut(config.action);
  });
  
  function executeShortcut(action) {
    switch (action) {
      case 'send':
        const platform = document.activeElement?.id?.startsWith('m-') ? 'm' : 'd';
        sendMessage(platform);
        break;
        
      case 'newline':
        // Allow default behavior (Shift+Enter)
        return true;
        
      case 'focusInput':
        const input = document.querySelector('#d-msg-input:not([disabled])') || 
                     document.querySelector('#m-msg-input:not([disabled])');
        if (input) {
          input.focus();
          showToast('Focused input (Ctrl+K)', 'info');
        }
        break;
        
      case 'newChat':
        newChat();
        showToast('New chat (Ctrl+N)', 'info');
        break;
        
      case 'openSettings':
        openSettings();
        break;
        
      case 'toggleTheme':
        quickThemeToggle();
        break;
        
      case 'togglePersonality':
        openPersonalitySelector();
        break;
        
      case 'saveChat':
        saveCurrentChat();
        showToast('Chat saved (Ctrl+S)', 'info');
        break;
        
      case 'exportChat':
        openExportModal();
        break;
        
      case 'deleteChat':
        if (state.currentChatId && confirm('Delete current chat?')) {
          deleteChat(state.currentChatId);
        }
        break;
        
      case 'toggleWebSearch':
        const searchPill = document.getElementById('web-search-pill');
        if (searchPill) searchPill.click();
        break;
        
      case 'toggleMultiModel':
        const multiBtn = document.getElementById('multi-model-toggle');
        if (multiBtn) multiBtn.click();
        break;
        
      case 'clearChat':
        clearMessages();
        showToast('Chat cleared (Ctrl+L)', 'info');
        break;
        
      case 'prevChat':
        navigateChat(-1);
        break;
        
      case 'nextChat':
        navigateChat(1);
        break;
        
      case 'closeModals':
        document.querySelectorAll('.modal-overlay.open').forEach(m => {
          m.classList.remove('open');
          setTimeout(() => m.remove(), 300);
        });
        break;
        
      case 'showShortcuts':
        showShortcutsModal();
        break;
    }
  }
  
  // Navigate between chats
  function navigateChat(direction) {
    const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
    if (chats.length === 0) return;
    
    const currentIndex = chats.findIndex(c => c.id === state.currentChatId);
    let newIndex;
    
    if (currentIndex === -1) {
      newIndex = direction > 0 ? 0 : chats.length - 1;
    } else {
      newIndex = currentIndex + direction;
      if (newIndex < 0) newIndex = chats.length - 1;
      if (newIndex >= chats.length) newIndex = 0;
    }
    
    if (chats[newIndex]) {
      loadChat(chats[newIndex].id);
      showToast(`Chat ${newIndex + 1}/${chats.length}`, 'info');
    }
  }
  
  // Show shortcuts modal
  window.showShortcutsModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '700';
    modal.id = 'shortcuts-modal';
    
    const categories = {
      'Message Input': [
        { key: 'Enter', desc: 'Send message' },
        { key: 'Shift+Enter', desc: 'New line' },
        { key: 'Ctrl+K', desc: 'Focus input' }
      ],
      'Chat Management': [
        { key: 'Ctrl+N', desc: 'New chat' },
        { key: 'Ctrl+S', desc: 'Save chat' },
        { key: 'Ctrl+E', desc: 'Export chat' },
        { key: 'Ctrl+D', desc: 'Delete chat' },
        { key: 'Ctrl+L', desc: 'Clear messages' }
      ],
      'Navigation': [
        { key: 'Alt+↑', desc: 'Previous chat' },
        { key: 'Alt+↓', desc: 'Next chat' },
        { key: 'Escape', desc: 'Close modals' }
      ],
      'Tools & Settings': [
        { key: 'Ctrl+O', desc: 'Open settings' },
        { key: 'Ctrl+Shift+T', desc: 'Toggle theme' },
        { key: 'Ctrl+P', desc: 'AI personality' },
        { key: 'Ctrl+W', desc: 'Toggle web search' },
        { key: 'Ctrl+M', desc: 'Toggle multi-model' }
      ],
      'Help': [
        { key: 'Ctrl+? or Ctrl+H', desc: 'Show shortcuts' }
      ]
    };
    
    let content = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
        <div class="modal-top"><h2>⌨️ Keyboard Shortcuts</h2><button class="modal-close" onclick="closeShortcutsModal()">&times;</button></div>
        <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
    `;
    
    Object.entries(categories).forEach(([cat, shortcuts]) => {
      content += `
        <div style="margin-bottom: 20px;">
          <h4 style="color: var(--accent); margin-bottom: 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">${cat}</h4>
          <div style="display: grid; gap: 8px;">
      `;
      
      shortcuts.forEach(s => {
        content += `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--surface2); border-radius: var(--radius-sm);">
            <span style="color: var(--text2); font-size: 13px;">${s.desc}</span>
            <kbd style="padding: 4px 8px; background: var(--surface3); border: 1px solid var(--border); border-radius: 4px; font-family: var(--mono); font-size: 11px; color: var(--text);">${s.key}</kbd>
          </div>
        `;
      });
      
      content += '</div></div>';
    });
    
    content += `
        </div>
        <div class="modal-footer" style="padding: 16px; border-top: 1px solid var(--border);">
          <p style="font-size: 12px; color: var(--muted); text-align: center; margin: 0;">Tip: Press any shortcut while viewing this modal to try it!</p>
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    modal.onclick = closeShortcutsModal;
    document.body.appendChild(modal);
  };
  
  window.closeShortcutsModal = function() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  // Show toast for shortcut usage (with cooldown)
  const shortcutToasts = {};
  function showToast(message, type) {
    if (type === 'info') {
      // Debounce info toasts
      const key = message.split(' ')[0];
      if (shortcutToasts[key]) return;
      shortcutToasts[key] = setTimeout(() => delete shortcutToasts[key], 2000);
    }
    
    // Use existing showToast or create simple one
    if (window.showToast) {
      window.showToast(message, type);
    }
  }
  
  console.log('[KeyboardShortcuts] Module loaded - Press Ctrl+H for help');
})();
