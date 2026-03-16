// Export Chats Module
// Provides download functionality for chats in multiple formats

(function() {
  'use strict';
  
  // Export chat as different formats
  window.exportChat = function(format, chatId) {
    const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
    const chat = chatId ? chats.find(c => c.id === chatId) : chats.find(c => c.id === state.currentChatId);
    
    if (!chat && state.history.length > 0) {
      // Export current chat
      const currentChat = {
        id: state.currentChatId || 'current',
        title: state.history[0]?.content?.slice(0, 50) || 'Untitled',
        history: state.history,
        createdAt: new Date().toISOString()
      };
      exportSingleChat(currentChat, format);
      return;
    }
    
    if (!chat) {
      showToast('No chat to export', 'error');
      return;
    }
    
    exportSingleChat(chat, format);
  };
  
  // Export all chats
  window.exportAllChats = function(format) {
    const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
    
    if (chats.length === 0) {
      showToast('No chats to export', 'error');
      return;
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `nova-chats-${timestamp}`;
    
    switch (format) {
      case 'json':
        downloadJSON(chats, filename + '.json');
        break;
      case 'markdown':
        downloadMarkdownMulti(chats, filename + '.md');
        break;
      case 'txt':
        downloadTXT(chats, filename + '.txt');
        break;
      default:
        downloadJSON(chats, filename + '.json');
    }
    
    showToast(`Exported ${chats.length} chats as ${format.toUpperCase()}`);
  };
  
  function exportSingleChat(chat, format) {
    const timestamp = new Date().toISOString().split('T')[0];
    const safeTitle = chat.title.replace(/[^a-z0-9]/gi, '_').slice(0, 30) || 'chat';
    const filename = `nova-${safeTitle}-${timestamp}`;
    
    switch (format) {
      case 'json':
        downloadJSON([chat], filename + '.json');
        break;
      case 'markdown':
        downloadMarkdown(chat, filename + '.md');
        break;
      case 'txt':
        downloadSingleTXT(chat, filename + '.txt');
        break;
      default:
        downloadJSON([chat], filename + '.json');
    }
    
    showToast(`Exported as ${format.toUpperCase()}`);
  }
  
  function downloadJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, filename, 'application/json');
  }
  
  function downloadMarkdown(chat, filename) {
    let md = `# ${chat.title}\n\n`;
    md += `Exported: ${new Date().toLocaleString()}\n\n`;
    md += `---\n\n`;
    
    chat.history.forEach(msg => {
      if (msg.role === 'user') {
        md += `## User\n\n${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        md += `## ${state.aiName || 'NOVA'}\n\n${msg.content}\n\n`;
      }
      md += `---\n\n`;
    });
    
    downloadFile(md, filename, 'text/markdown');
  }
  
  function downloadMarkdownMulti(chats, filename) {
    let md = `# NOVA Chat Export\n\n`;
    md += `Exported: ${new Date().toLocaleString()}\n`;
    md += `Total Chats: ${chats.length}\n\n`;
    md += `---\n\n`;
    
    chats.forEach((chat, index) => {
      md += `# Chat ${index + 1}: ${chat.title}\n\n`;
      
      chat.history.forEach(msg => {
        if (msg.role === 'user') {
          md += `**User:** ${msg.content}\n\n`;
        } else if (msg.role === 'assistant') {
          md += `**${state.aiName || 'NOVA'}:** ${msg.content}\n\n`;
        }
      });
      
      md += `---\n\n`;
    });
    
    downloadFile(md, filename, 'text/markdown');
  }
  
  function downloadTXT(chats, filename) {
    let txt = `NOVA Chat Export\n`;
    txt += `Exported: ${new Date().toLocaleString()}\n`;
    txt += `Total Chats: ${chats.length}\n`;
    txt += `================================\n\n`;
    
    chats.forEach((chat, index) => {
      txt += `CHAT ${index + 1}: ${chat.title}\n`;
      txt += `--------------------------------\n\n`;
      
      chat.history.forEach(msg => {
        if (msg.role === 'user') {
          txt += `USER: ${msg.content}\n\n`;
        } else if (msg.role === 'assistant') {
          txt += `${(state.aiName || 'NOVA').toUpperCase()}: ${msg.content}\n\n`;
        }
      });
      
      txt += `================================\n\n`;
    });
    
    downloadFile(txt, filename, 'text/plain');
  }
  
  function downloadSingleTXT(chat, filename) {
    let txt = `Chat: ${chat.title}\n`;
    txt += `Exported: ${new Date().toLocaleString()}\n`;
    txt += `================================\n\n`;
    
    chat.history.forEach(msg => {
      if (msg.role === 'user') {
        txt += `USER: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        txt += `${(state.aiName || 'NOVA').toUpperCase()}: ${msg.content}\n\n`;
      }
    });
    
    downloadFile(txt, filename, 'text/plain');
  }
  
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // Create export modal
  window.openExportModal = function() {
    const existing = document.getElementById('export-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'export-modal';
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '300';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-top"><h2>Export Chats</h2><button class="modal-close" onclick="closeExportModal()">&times;</button></div>
        <div class="modal-body">
          <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 12px; color: var(--text);">Current Chat</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button onclick="exportChat('json'); closeExportModal();" class="export-btn">JSON</button>
              <button onclick="exportChat('markdown'); closeExportModal();" class="export-btn">Markdown</button>
              <button onclick="exportChat('txt'); closeExportModal();" class="export-btn">Text</button>
            </div>
          </div>
          <div>
            <h4 style="margin-bottom: 12px; color: var(--text);">All Chats</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button onclick="exportAllChats('json'); closeExportModal();" class="export-btn secondary">All JSON</button>
              <button onclick="exportAllChats('markdown'); closeExportModal();" class="export-btn secondary">All Markdown</button>
              <button onclick="exportAllChats('txt'); closeExportModal();" class="export-btn secondary">All Text</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .export-btn { padding: 10px 20px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer; transition: all 0.2s; }
      .export-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4); }
      .export-btn.secondary { background: var(--surface2); border: 1px solid var(--border); color: var(--text); }
      .export-btn.secondary:hover { background: var(--surface3); }
    `;
    document.head.appendChild(style);
    
    modal.onclick = closeExportModal;
    document.body.appendChild(modal);
  };
  
  window.closeExportModal = function() {
    const modal = document.getElementById('export-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  // Override export button click
  const originalExportChats = window.exportChats;
  window.exportChats = function() {
    window.openExportModal();
  };
  
  console.log('[Export] Module loaded - chats can be exported as JSON/Markdown/Text');
})();
