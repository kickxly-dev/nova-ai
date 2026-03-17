/**
 * Import Conversations from ChatGPT, Claude, and other AI exports
 */

(function() {
  'use strict';

  const ImportExports = {
    // Parse ChatGPT export
    async parseChatGPTExport(jsonData) {
      const conversations = [];
      
      for (const conv of jsonData) {
        const messages = [];
        let title = conv.title || 'Imported Chat';
        
        // Map ChatGPT format
        if (conv.mapping) {
          const messageMap = conv.mapping;
          const root = Object.values(messageMap).find(m => !m.parent);
          
          if (root) {
            let current = root;
            while (current) {
              const msg = current.message;
              if (msg && msg.content && msg.content.parts) {
                const text = msg.content.parts.join('');
                if (text.trim()) {
                  messages.push({
                    role: msg.author.role === 'user' ? 'user' : 'assistant',
                    content: text,
                    timestamp: msg.create_time * 1000
                  });
                }
              }
              current = current.children?.length ? messageMap[current.children[0]] : null;
            }
          }
        }
        
        if (messages.length > 0) {
          conversations.push({
            id: 'imported_' + conv.id || Date.now(),
            title: title.slice(0, 50),
            history: messages,
            importedFrom: 'ChatGPT',
            importedAt: Date.now()
          });
        }
      }
      
      return conversations;
    },

    // Parse Claude export
    async parseClaudeExport(data) {
      const conversations = [];
      
      // Claude exports can be in different formats
      if (Array.isArray(data)) {
        for (const conv of data) {
          const messages = [];
          
          if (conv.chat_messages) {
            for (const msg of conv.chat_messages) {
              messages.push({
                role: msg.sender === 'human' ? 'user' : 'assistant',
                content: msg.text,
                timestamp: new Date(msg.created_at).getTime()
              });
            }
          }
          
          if (messages.length > 0) {
            conversations.push({
              id: 'claude_' + conv.uuid || Date.now(),
              title: conv.name?.slice(0, 50) || 'Claude Import',
              history: messages,
              importedFrom: 'Claude',
              importedAt: Date.now()
            });
          }
        }
      }
      
      return conversations;
    },

    // Parse generic format
    async parseGeneric(data) {
      const conversations = [];
      
      if (Array.isArray(data)) {
        // Array of messages
        if (data[0]?.role) {
          conversations.push({
            id: 'generic_' + Date.now(),
            title: 'Imported Chat',
            history: data,
            importedFrom: 'Generic',
            importedAt: Date.now()
          });
        } else if (data[0]?.history) {
          // Array of conversations
          for (const conv of data) {
            conversations.push({
              id: conv.id || 'generic_' + Date.now(),
              title: conv.title || 'Imported Chat',
              history: conv.history || conv.messages || [],
              importedFrom: conv.importedFrom || 'Generic',
              importedAt: Date.now()
            });
          }
        }
      }
      
      return conversations;
    },

    // Detect format and parse
    async detectAndParse(file) {
      const text = await file.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (e) {
        // Try as text conversation
        return this.parseTextConversation(text);
      }

      // Detect format
      if (data.__schema__ === 'conversations' || Array.isArray(data) && data[0]?.mapping) {
        return { format: 'ChatGPT', conversations: await this.parseChatGPTExport(data) };
      } else if (data.chat_messages || (Array.isArray(data) && data[0]?.chat_messages)) {
        return { format: 'Claude', conversations: await this.parseClaudeExport(data) };
      } else {
        return { format: 'Generic', conversations: await this.parseGeneric(data) };
      }
    },

    // Parse plain text as conversation
    parseTextConversation(text) {
      const lines = text.split('\n');
      const messages = [];
      let currentRole = null;
      let currentContent = '';

      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('User:') || trimmed.startsWith('Human:')) {
          if (currentContent) {
            messages.push({ role: currentRole, content: currentContent.trim() });
          }
          currentRole = 'user';
          currentContent = trimmed.replace(/^(User|Human):\s*/, '');
        } else if (trimmed.startsWith('Assistant:') || trimmed.startsWith('AI:')) {
          if (currentContent) {
            messages.push({ role: currentRole, content: currentContent.trim() });
          }
          currentRole = 'assistant';
          currentContent = trimmed.replace(/^(Assistant|AI):\s*/, '');
        } else if (trimmed) {
          currentContent += '\n' + trimmed;
        }
      }

      if (currentContent && currentRole) {
        messages.push({ role: currentRole, content: currentContent.trim() });
      }

      return {
        format: 'Text',
        conversations: messages.length > 0 ? [{
          id: 'text_' + Date.now(),
          title: 'Imported Text',
          history: messages,
          importedFrom: 'Text',
          importedAt: Date.now()
        }] : []
      };
    },

    // Import conversations to local storage
    async importConversations(file) {
      const { format, conversations } = await this.detectAndParse(file);

      if (conversations.length === 0) {
        throw new Error('No conversations found in file');
      }

      // Get existing chats
      const existing = JSON.parse(localStorage.getItem('nova_chats') || '[]');
      
      // Merge (imported chats go first)
      const merged = [...conversations, ...existing].slice(0, 100); // Keep last 100
      
      // Save
      localStorage.setItem('nova_chats', JSON.stringify(merged));

      return {
        imported: conversations.length,
        format,
        total: merged.length
      };
    },

    // Export in various formats
    export(format = 'nova') {
      const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');

      switch(format) {
        case 'chatgpt':
          return this.exportAsChatGPT(chats);
        case 'claude':
          return this.exportAsClaude(chats);
        case 'json':
        default:
          return JSON.stringify(chats, null, 2);
      }
    },

    exportAsChatGPT(chats) {
      return chats.map(chat => ({
        id: chat.id,
        title: chat.title,
        create_time: (chat.createdAt || Date.now()) / 1000,
        mapping: chat.history.reduce((acc, msg, idx) => {
          const id = msg.id || `msg_${idx}`;
          acc[id] = {
            id,
            message: {
              id,
              author: { role: msg.role === 'user' ? 'user' : 'assistant' },
              content: { parts: [msg.content] },
              create_time: (msg.timestamp || Date.now()) / 1000
            }
          };
          return acc;
        }, {})
      }));
    },

    exportAsClaude(chats) {
      return chats.map(chat => ({
        uuid: chat.id,
        name: chat.title,
        chat_messages: chat.history.map(msg => ({
          sender: msg.role === 'user' ? 'human' : 'assistant',
          text: msg.content,
          created_at: new Date(msg.timestamp || Date.now()).toISOString()
        }))
      }));
    }
  };

  // Expose globally
  window.ImportExports = ImportExports;

  // UI
  window.openImportModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'import-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 450px;">
        <div class="modal-top"><h2>📥 Import Conversations</h2><button class="modal-close" onclick="closeImportModal()">&times;</button></div>
        <div class="modal-body">
          <p style="margin-bottom: 16px; color: var(--muted);">
            Import conversations from ChatGPT, Claude, or other AI assistants.
          </p>
          
          <div style="border: 2px dashed var(--border); border-radius: var(--radius); padding: 30px; text-align: center;">
            <label style="cursor: pointer;">
              <input type="file" accept=".json,.txt,.zip" onchange="handleImportFile(this.files[0])" style="display: none;">
              <div style="font-size: 40px; margin-bottom: 10px;">📁</div>
              <div style="color: var(--text);">Click to upload export file</div>
              <div style="font-size: 12px; color: var(--muted); margin-top: 8px;">Supports: ChatGPT, Claude, JSON, TXT</div>
            </label>
          </div>
          
          <div style="margin-top: 20px; font-size: 12px; color: var(--muted);">
            <strong>How to export:</strong><br>
            • ChatGPT: Settings → Data controls → Export data<br>
            • Claude: Settings → Account → Export data<br>
            • Other: Save conversation as .txt with "User:" and "Assistant:" prefixes
          </div>
        </div>
        <div class="modal-footer">
          <button onclick="closeImportModal()" style="padding: 8px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeImportModal = function() {
    const modal = document.getElementById('import-modal');
    if (modal) modal.remove();
  };

  window.handleImportFile = async function(file) {
    if (!file) return;

    try {
      showToast('Importing...');
      const result = await ImportExports.importConversations(file);
      
      showToast(`Imported ${result.imported} conversations from ${result.format}!`);
      
      if (window.renderChatList) window.renderChatList();
      closeImportModal();
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
  };

  // Add button
  window.addImportButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar && !document.getElementById('import-btn')) {
      const btn = document.createElement('button');
      btn.id = 'import-btn';
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '📥 Import';
      btn.onclick = openImportModal;
      btn.style.marginBottom = '8px';
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };

  setTimeout(addImportButton, 5000);
  console.log('[Import Exports] Module loaded');
})();
