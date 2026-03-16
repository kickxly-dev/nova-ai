// Document RAG - Upload documents for AI knowledge base
(function() {
  'use strict';
  
  const DOCUMENT_STORE = {
    docs: JSON.parse(localStorage.getItem('nova_documents') || '[]'),
    
    save() {
      localStorage.setItem('nova_documents', JSON.stringify(this.docs));
    },
    
    add(doc) {
      this.docs.push({
        id: Date.now().toString(),
        name: doc.name,
        content: doc.content.slice(0, 50000), // Limit size
        chunks: this.chunkText(doc.content),
        uploaded: Date.now()
      });
      this.save();
    },
    
    delete(id) {
      this.docs = this.docs.filter(d => d.id !== id);
      this.save();
    },
    
    chunkText(text, chunkSize = 1000) {
      const chunks = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
      }
      return chunks;
    },
    
    search(query) {
      const results = [];
      const queryWords = query.toLowerCase().split(/\s+/);
      
      this.docs.forEach(doc => {
        let relevance = 0;
        
        doc.chunks.forEach((chunk, idx) => {
          const chunkLower = chunk.toLowerCase();
          let matches = 0;
          
          queryWords.forEach(word => {
            if (chunkLower.includes(word)) matches++;
          });
          
          if (matches > 0) {
            relevance += matches;
            results.push({
              docId: doc.id,
              docName: doc.name,
              chunk: chunk.slice(0, 300),
              relevance,
              position: idx
            });
          }
        });
      });
      
      return results.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
    }
  };
  
  // Upload document
  window.uploadDocument = async function(file) {
    if (!file) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.md,.pdf,.doc,.docx';
      input.onchange = (e) => {
        if (e.target.files[0]) processDocument(e.target.files[0]);
      };
      input.click();
      return;
    }
    
    await processDocument(file);
  };
  
  async function processDocument(file) {
    showToast(`Processing ${file.name}...`);
    
    try {
      let content = '';
      
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // Use existing PDF extraction
        const reader = new FileReader();
        content = await new Promise((resolve) => {
          reader.onload = async (e) => {
            const text = await window.extractPDFText(e.target.result);
            resolve(text);
          };
          reader.readAsArrayBuffer(file);
        });
      } else {
        // Text files
        content = await file.text();
      }
      
      // Add to store
      DOCUMENT_STORE.add({
        name: file.name,
        content: content
      });
      
      showToast(`Document "${file.name}" added to knowledge base`);
      
      // Reopen manager if open
      const modal = document.getElementById('document-manager-modal');
      if (modal) {
        closeDocumentManager();
        openDocumentManager();
      }
      
    } catch (err) {
      console.error('Document upload error:', err);
      showToast('Failed to process document', 'error');
    }
  }
  
  // Query documents
  window.queryDocuments = function(query) {
    return DOCUMENT_STORE.search(query);
  };
  
  // Get context for AI
  window.getDocumentContext = function(query) {
    const results = DOCUMENT_STORE.search(query);
    if (results.length === 0) return '';
    
    let context = '\n\n=== RELEVANT DOCUMENT CONTEXT ===\n';
    results.forEach((r, i) => {
      context += `[${i + 1}] From "${r.docName}":\n${r.chunk}\n\n`;
    });
    context += '=== END DOCUMENT CONTEXT ===\n\n';
    
    return context;
  };
  
  // Open document manager
  window.openDocumentManager = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '600';
    modal.id = 'document-manager-modal';
    
    const docs = DOCUMENT_STORE.docs;
    
    let content = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
        <div class="modal-top"><h2>📚 Knowledge Base</h2><button class="modal-close" onclick="closeDocumentManager()">&times;</button></div>
        <div class="modal-body">
          <p style="color: var(--muted); margin-bottom: 16px;">Upload documents to give the AI context for answering questions.</p>
          
          <div style="margin-bottom: 20px;">
            <button onclick="uploadDocument()" style="width: 100%; padding: 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload Document
            </button>
            <p style="font-size: 11px; color: var(--muted); margin-top: 8px; text-align: center;">Supports: TXT, MD, PDF (text-based)</p>
          </div>
    `;
    
    if (docs.length === 0) {
      content += '<p style="color: var(--muted); text-align: center; padding: 32px;">No documents yet. Upload your first document above.</p>';
    } else {
      content += `<div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">${docs.length} document${docs.length !== 1 ? 's' : ''} stored</div>`;
      content += '<div style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto;">';
      
      docs.forEach(doc => {
        const size = (doc.content.length / 1024).toFixed(1);
        content += `
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--surface2); border-radius: var(--radius-sm);">
            <span style="font-size: 24px;">📄</span>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${doc.name}</div>
              <div style="font-size: 11px; color: var(--muted);">${size} KB • ${doc.chunks.length} chunks</div>
            </div>
            <button onclick="deleteDocument('${doc.id}')" style="padding: 6px 10px; background: var(--red); border: none; border-radius: var(--radius-sm); color: #fff; font-size: 11px; cursor: pointer;">Delete</button>
          </div>
        `;
      });
      
      content += '</div>';
    }
    
    content += `
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    modal.onclick = closeDocumentManager;
    document.body.appendChild(modal);
  };
  
  window.closeDocumentManager = function() {
    const modal = document.getElementById('document-manager-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.deleteDocument = function(id) {
    if (confirm('Delete this document from the knowledge base?')) {
      DOCUMENT_STORE.delete(id);
      showToast('Document deleted');
      closeDocumentManager();
      openDocumentManager();
    }
  };
  
  // Add document button
  window.addDocumentButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar) {
      const btn = document.createElement('button');
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Knowledge Base';
      btn.onclick = openDocumentManager;
      btn.style.marginBottom = '8px';
      
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };
  
  // Override sendMessage to include document context
  const originalSendMessage = window.sendMessage;
  window.sendMessage = async function(p) {
    const inputEl = document.getElementById(p + '-msg-input');
    if (!inputEl) return;
    
    const text = inputEl.value.trim();
    if (!text || state.isTyping) return;
    
    // Add document context if available
    if (DOCUMENT_STORE.docs.length > 0) {
      const docContext = window.getDocumentContext(text);
      if (docContext) {
        // Store for use in system prompt
        window.pendingDocumentContext = docContext;
      }
    }
    
    return originalSendMessage(p);
  };
  
  // Hook into message building
  const originalBuildMessages = window.buildMessages;
  window.buildMessages = function(text) {
    let messages = originalBuildMessages ? originalBuildMessages(text) : [
      { role: 'system', content: state.systemPrompt },
      ...state.history.slice(-20),
      { role: 'user', content: text }
    ];
    
    // Add document context to system prompt
    if (window.pendingDocumentContext) {
      messages[0].content += window.pendingDocumentContext;
      window.pendingDocumentContext = null;
    }
    
    return messages;
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addDocumentButton, 2000);
    });
  } else {
    setTimeout(window.addDocumentButton, 2000);
  }
  
  console.log('[DocumentRAG] Module loaded - Upload docs for AI context');
})();
