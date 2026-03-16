// Knowledge Base for AI - Enhanced document retrieval and context
(function() {
  'use strict';
  
  window.KnowledgeBase = {
    documents: JSON.parse(localStorage.getItem('nova_kb_documents') || '[]'),
    embeddings: JSON.parse(localStorage.getItem('nova_kb_embeddings') || '{}'),
    
    // Save to storage
    save() {
      localStorage.setItem('nova_kb_documents', JSON.stringify(this.documents));
      localStorage.setItem('nova_kb_embeddings', JSON.stringify(this.embeddings));
    },
    
    // Add document with optional embedding
    async addDocument(file, content, metadata = {}) {
      const doc = {
        id: Date.now().toString(),
        name: file.name || 'Untitled',
        content: content.slice(0, 100000), // 100KB limit
        chunks: this.chunkContent(content),
        metadata: {
          ...metadata,
          added: Date.now(),
          size: content.length,
          type: file.type || 'text/plain'
        }
      };
      
      this.documents.push(doc);
      this.save();
      
      // Generate simple keyword "embedding"
      this.embeddings[doc.id] = this.generateSimpleEmbedding(content);
      this.save();
      
      return doc;
    },
    
    // Delete document
    deleteDocument(id) {
      this.documents = this.documents.filter(d => d.id !== id);
      delete this.embeddings[id];
      this.save();
    },
    
    // Chunk content for better retrieval
    chunkContent(content, chunkSize = 1500, overlap = 200) {
      const chunks = [];
      let start = 0;
      
      while (start < content.length) {
        let end = start + chunkSize;
        
        // Try to end at sentence or paragraph
        if (end < content.length) {
          const nextPeriod = content.indexOf('.', end);
          const nextNewline = content.indexOf('\n', end);
          if (nextPeriod > 0 && nextPeriod < end + 100) end = nextPeriod + 1;
          else if (nextNewline > 0 && nextNewline < end + 100) end = nextNewline + 1;
        }
        
        chunks.push({
          text: content.slice(start, end).trim(),
          start,
          end,
          index: chunks.length
        });
        
        start = end - overlap;
        if (start >= content.length) break;
      }
      
      return chunks;
    },
    
    // Generate simple keyword embedding (fallback for no API)
    generateSimpleEmbedding(text) {
      // Extract keywords and their frequencies
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .filter(w => !this.stopWords.includes(w));
      
      const freq = {};
      words.forEach(w => {
        freq[w] = (freq[w] || 0) + 1;
      });
      
      // Return top keywords
      return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100)
        .map(([word, count]) => word);
    },
    
    stopWords: ['this', 'that', 'with', 'from', 'they', 'have', 'will', 'been', 'their', 'said', 'each', 'which', 'were', 'does', 'where', 'when', 'than', 'them', 'these', 'what', 'know', 'just', 'only', 'also', 'after', 'back', 'other', 'many', 'then', 'them', 'well', 'were', 'look', 'than', 'time', 'very', 'when', 'much', 'would', 'there', 'could', 'should'],
    
    // Semantic search using keyword matching + TF-IDF-like scoring
    search(query, topK = 5) {
      const queryWords = query.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
      
      const scores = [];
      
      this.documents.forEach(doc => {
        let score = 0;
        const matchedChunks = [];
        
        // Score chunks
        doc.chunks.forEach(chunk => {
          let chunkScore = 0;
          const chunkLower = chunk.text.toLowerCase();
          
          queryWords.forEach(qw => {
            // Exact phrase match (higher score)
            if (chunkLower.includes(query.toLowerCase())) {
              chunkScore += 10;
            }
            
            // Word match
            const regex = new RegExp(`\\b${qw}\\b`, 'g');
            const matches = chunkLower.match(regex);
            if (matches) {
              chunkScore += matches.length * 3;
            }
            
            // Partial match
            if (chunkLower.includes(qw)) {
              chunkScore += 1;
            }
          });
          
          // Boost title/heading matches
          if (chunk.index < 2) chunkScore *= 1.5;
          
          if (chunkScore > 0) {
            matchedChunks.push({
              ...chunk,
              score: chunkScore
            });
            score += chunkScore;
          }
        });
        
        if (score > 0) {
          scores.push({
            doc,
            score,
            chunks: matchedChunks.sort((a, b) => b.score - a.score).slice(0, 3)
          });
        }
      });
      
      return scores
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    },
    
    // Get context for AI prompt
    getContextForQuery(query, maxTokens = 2000) {
      const results = this.search(query, 5);
      
      if (results.length === 0) {
        return '';
      }
      
      let context = '\n\n=== KNOWLEDGE BASE CONTEXT ===\n';
      context += `Query: "${query}"\n`;
      context += `Found ${results.length} relevant document(s)\n\n`;
      
      let totalLength = 0;
      
      results.forEach((result, idx) => {
        context += `--- Document ${idx + 1}: ${result.doc.name} ---\n`;
        
        result.chunks.forEach(chunk => {
          const text = chunk.text.slice(0, 500);
          if (totalLength + text.length < maxTokens) {
            context += text + '\n\n';
            totalLength += text.length;
          }
        });
      });
      
      context += '=== END KNOWLEDGE BASE ===\n\n';
      
      return context;
    },
    
    // Get all documents summary
    getSummary() {
      return {
        total: this.documents.length,
        totalSize: this.documents.reduce((sum, d) => sum + d.metadata.size, 0),
        documents: this.documents.map(d => ({
          id: d.id,
          name: d.name,
          chunks: d.chunks.length,
          added: d.metadata.added
        }))
      };
    }
  };
  
  // Open Knowledge Base Manager
  window.openKnowledgeBase = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '700';
    modal.id = 'kb-modal';
    
    const summary = KnowledgeBase.getSummary();
    
    let content = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 700px;">
        <div class="modal-top"><h2>📚 Knowledge Base</h2><button class="modal-close" onclick="closeKnowledgeBase()">&times;</button></div>
        <div class="modal-body">
          <div style="display: flex; gap: 16px; margin-bottom: 20px;">
            <div style="flex: 1; padding: 16px; background: var(--surface2); border-radius: var(--radius); text-align: center;">
              <div style="font-size: 28px; font-weight: 700; color: var(--accent);">${summary.total}</div>
              <div style="font-size: 12px; color: var(--muted);">Documents</div>
            </div>
            <div style="flex: 1; padding: 16px; background: var(--surface2); border-radius: var(--radius); text-align: center;">
              <div style="font-size: 28px; font-weight: 700; color: var(--accent);">${(summary.totalSize / 1024).toFixed(1)}</div>
              <div style="font-size: 12px; color: var(--muted);">KB Total</div>
            </div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <input type="file" id="kb-upload" accept=".txt,.md,.pdf,.json,.csv" style="display: none;" onchange="handleKBUpload(event)">
            <button onclick="document.getElementById('kb-upload').click()" style="width: 100%; padding: 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload Document
            </button>
            <p style="font-size: 11px; color: var(--muted); margin-top: 8px; text-align: center;">AI will automatically reference these documents when answering questions</p>
          </div>
          
          <div style="margin-bottom: 16px;">
            <input type="text" id="kb-search" placeholder="Search knowledge base..." onkeyup="searchKB(this.value)" style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
          </div>
          
          <div id="kb-documents" style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto;">
    `;
    
    if (KnowledgeBase.documents.length === 0) {
      content += '<p style="color: var(--muted); text-align: center; padding: 32px;">No documents yet. Upload files to build your knowledge base!</p>';
    } else {
      KnowledgeBase.documents.forEach(doc => {
        content += `
          <div class="kb-doc" data-id="${doc.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--surface2); border-radius: var(--radius-sm); border: 1px solid var(--border);">
            <span style="font-size: 24px;">📄</span>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${doc.name}</div>
              <div style="font-size: 11px; color: var(--muted);">${doc.chunks.length} chunks • ${(doc.metadata.size / 1024).toFixed(1)} KB</div>
            </div>
            <button onclick="deleteKBDocument('${doc.id}')" style="padding: 6px 10px; background: var(--red); border: none; border-radius: var(--radius-sm); color: #fff; font-size: 11px; cursor: pointer;">Delete</button>
          </div>
        `;
      });
    }
    
    content += `
          </div>
          
          <div id="kb-search-results" style="display: none; margin-top: 16px; padding: 16px; background: var(--surface2); border-radius: var(--radius); border: 1px solid var(--border);">
            <h4 style="margin-bottom: 12px; color: var(--text);">Search Results</h4>
            <div id="kb-results-list"></div>
          </div>
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    modal.onclick = closeKnowledgeBase;
    document.body.appendChild(modal);
  };
  
  window.closeKnowledgeBase = function() {
    const modal = document.getElementById('kb-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.handleKBUpload = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    showToast(`Processing ${file.name}...`);
    
    try {
      let content = '';
      
      if (file.name.endsWith('.pdf')) {
        // Use existing PDF extraction
        const arrayBuffer = await file.arrayBuffer();
        content = await window.extractPDFText(arrayBuffer);
      } else {
        content = await file.text();
      }
      
      await KnowledgeBase.addDocument(file, content);
      showToast(`Added "${file.name}" to knowledge base!`);
      closeKnowledgeBase();
      openKnowledgeBase();
      
    } catch (err) {
      showToast('Failed to process file', 'error');
    }
  };
  
  window.deleteKBDocument = function(id) {
    if (confirm('Delete this document from the knowledge base?')) {
      KnowledgeBase.deleteDocument(id);
      showToast('Document deleted');
      closeKnowledgeBase();
      openKnowledgeBase();
    }
  };
  
  window.searchKB = function(query) {
    const resultsDiv = document.getElementById('kb-search-results');
    const listDiv = document.getElementById('kb-results-list');
    
    if (!query.trim()) {
      resultsDiv.style.display = 'none';
      return;
    }
    
    const results = KnowledgeBase.search(query, 5);
    
    if (results.length === 0) {
      listDiv.innerHTML = '<p style="color: var(--muted);">No relevant documents found</p>';
    } else {
      listDiv.innerHTML = results.map(r => `
        <div style="margin-bottom: 12px; padding: 12px; background: var(--surface); border-radius: var(--radius-sm);">
          <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">${r.doc.name} <span style="color: var(--accent); font-size: 12px;">(${r.score} matches)</span></div>
          <div style="font-size: 12px; color: var(--muted2);">${r.chunks[0]?.text.slice(0, 150)}...</div>
        </div>
      `).join('');
    }
    
    resultsDiv.style.display = 'block';
  };
  
  // Integrate with chat - automatically include KB context
  const originalSendMessage = window.sendMessage;
  window.sendMessage = async function(p) {
    const inputEl = document.getElementById(p + '-msg-input');
    if (!inputEl) return;
    
    const text = inputEl.value.trim();
    
    // Add KB context if documents exist and query seems informational
    if (KnowledgeBase.documents.length > 0 && text.length > 10) {
      const kbContext = KnowledgeBase.getContextForQuery(text);
      if (kbContext) {
        window.pendingKBContext = kbContext;
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
    
    // Inject KB context into system prompt
    if (window.pendingKBContext) {
      messages[0].content += '\n\n' + window.pendingKBContext;
      window.pendingKBContext = null;
    }
    
    return messages;
  };
  
  // Add KB button to UI
  window.addKBButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar) {
      const btn = document.createElement('button');
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Knowledge Base';
      btn.onclick = openKnowledgeBase;
      btn.style.marginBottom = '8px';
      
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addKBButton, 2000);
    });
  } else {
    setTimeout(window.addKBButton, 2000);
  }
  
  console.log('[KnowledgeBase] Module loaded - AI can now use uploaded documents');
})();
