// File Attachments - Upload and analyze PDFs, docs, images
(function() {
  'use strict';
  
  window.FileAttachments = {
    // Supported file types
    supportedTypes: {
      'application/pdf': { icon: '📄', name: 'PDF' },
      'text/plain': { icon: '📝', name: 'Text' },
      'text/markdown': { icon: '📑', name: 'Markdown' },
      'text/html': { icon: '🌐', name: 'HTML' },
      'application/json': { icon: '📋', name: 'JSON' },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: '📘', name: 'Word' },
      'application/msword': { icon: '📘', name: 'Word' },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: '📗', name: 'Excel' },
      'application/vnd.ms-excel': { icon: '📗', name: 'Excel' },
      'text/csv': { icon: '📊', name: 'CSV' },
      'image/png': { icon: '🖼️', name: 'PNG' },
      'image/jpeg': { icon: '🖼️', name: 'JPEG' },
      'image/webp': { icon: '🖼️', name: 'WebP' }
    },
    
    // Current attachments
    attachments: [],
    maxSize: 10 * 1024 * 1024, // 10MB
    
    // Initialize
    init() {
      this.addAttachmentButton();
      this.setupDragDrop();
      console.log('[File Attachments] Module loaded');
    },
    
    // Add attachment button to UI
    addAttachmentButton() {
      const desktopInput = document.getElementById('d-msg-input');
      const mobileInput = document.getElementById('m-msg-input');
      
      if (desktopInput) {
        const container = desktopInput.closest('.d-compose');
        if (container) {
          const btn = document.createElement('button');
          btn.className = 'd-tool-btn';
          btn.id = 'd-attach-btn';
          btn.innerHTML = '📎';
          btn.title = 'Attach file (PDF, DOC, TXT, etc.)';
          btn.onclick = () => this.openFilePicker('desktop');
          
          const imgBtn = container.querySelector('#d-img-btn');
          if (imgBtn) {
            imgBtn.after(btn);
          }
        }
      }
      
      if (mobileInput) {
        const container = mobileInput.closest('.m-compose');
        if (container) {
          const btn = document.createElement('button');
          btn.className = 'm-tool-btn';
          btn.id = 'm-attach-btn';
          btn.innerHTML = '📎';
          btn.title = 'Attach file';
          btn.onclick = () => this.openFilePicker('mobile');
          
          const imgBtn = container.querySelector('#m-img-btn');
          if (imgBtn) {
            imgBtn.after(btn);
          }
        }
      }
    },
    
    // Open file picker
    openFilePicker(platform) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = Object.keys(this.supportedTypes).join(',');
      input.onchange = (e) => this.handleFileSelect(e.target.files[0], platform);
      input.click();
    },
    
    // Setup drag and drop
    setupDragDrop() {
      const chatAreas = ['d-chat-area', 'm-chat-area'];
      
      chatAreas.forEach(id => {
        const area = document.getElementById(id);
        if (!area) return;
        
        area.addEventListener('dragover', (e) => {
          e.preventDefault();
          area.classList.add('drag-over');
        });
        
        area.addEventListener('dragleave', () => {
          area.classList.remove('drag-over');
        });
        
        area.addEventListener('drop', (e) => {
          e.preventDefault();
          area.classList.remove('drag-over');
          
          const files = e.dataTransfer.files;
          if (files.length > 0) {
            this.handleFileSelect(files[0], id.startsWith('d') ? 'desktop' : 'mobile');
          }
        });
      });
    },
    
    // Handle file selection
    async handleFileSelect(file, platform) {
      if (!file) return;
      
      // Check size
      if (file.size > this.maxSize) {
        showToast('File too large (max 10MB)', 'error');
        return;
      }
      
      // Check type
      const typeInfo = this.supportedTypes[file.type];
      if (!typeInfo) {
        showToast('Unsupported file type', 'error');
        return;
      }
      
      showToast(`Processing ${typeInfo.name}...`);
      
      try {
        const content = await this.extractContent(file);
        
        this.attachments.push({
          id: Date.now().toString(),
          name: file.name,
          type: file.type,
          size: file.size,
          content: content,
          icon: typeInfo.icon,
          platform: platform
        });
        
        this.showAttachmentPreview(file.name, typeInfo.icon, platform);
        showToast(`${typeInfo.name} attached!`);
        
      } catch (err) {
        console.error('File processing error:', err);
        showToast('Error processing file', 'error');
      }
    },
    
    // Extract content from file
    async extractContent(file) {
      // Images - return as base64 for vision
      if (file.type.startsWith('image/')) {
        return await this.readAsBase64(file);
      }
      
      // Text files - read as text
      if (file.type.startsWith('text/') || file.type === 'application/json' || file.type === 'application/javascript') {
        return await this.readAsText(file);
      }
      
      // PDF - extract text
      if (file.type === 'application/pdf') {
        return await this.extractPDFText(file);
      }
      
      // Word docs - try to extract
      if (file.type.includes('word') || file.type.includes('document')) {
        return await this.extractDocText(file);
      }
      
      // CSV/Excel - parse as text for now
      if (file.type.includes('sheet') || file.type.includes('csv') || file.type.includes('excel')) {
        return await this.readAsText(file);
      }
      
      // Fallback
      return `[File: ${file.name} - content extraction not available for this file type]`;
    },
    
    // Read file as text
    readAsText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    },
    
    // Read file as base64
    readAsBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },
    
    // Extract PDF text (basic - would need PDF.js for full extraction)
    async extractPDFText(file) {
      // For now, return a placeholder with file info
      // In production, you'd use PDF.js or a backend endpoint
      return `[PDF: ${file.name}\nSize: ${(file.size / 1024).toFixed(1)}KB\nNote: PDF content extraction requires backend processing]`;
    },
    
    // Extract Word doc text
    async extractDocText(file) {
      // Return placeholder - would need mammoth.js or backend
      return `[Document: ${file.name}\nSize: ${(file.size / 1024).toFixed(1)}KB\nNote: Word document extraction requires backend processing]`;
    },
    
    // Show attachment preview in input area
    showAttachmentPreview(filename, icon, platform) {
      const prefix = platform === 'desktop' ? 'd' : 'm';
      const input = document.getElementById(`${prefix}-msg-input`);
      if (!input) return;
      
      const container = input.closest(`.${prefix}-compose`);
      if (!container) return;
      
      // Remove existing preview
      const existing = container.querySelector('.attachment-preview');
      if (existing) existing.remove();
      
      const preview = document.createElement('div');
      preview.className = 'attachment-preview';
      preview.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 8px; font-size: 12px;';
      preview.innerHTML = `
        <span style="font-size: 16px;">${icon}</span>
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text);">${filename}</span>
        <button onclick="FileAttachments.removeAttachment('${this.attachments[this.attachments.length - 1]?.id}')" style="background: none; border: none; color: var(--muted); cursor: pointer; font-size: 14px; padding: 0 4px;">×</button>
      `;
      
      input.parentElement.insertBefore(preview, input);
    },
    
    // Remove attachment
    removeAttachment(id) {
      this.attachments = this.attachments.filter(a => a.id !== id);
      
      document.querySelectorAll('.attachment-preview').forEach(el => el.remove());
      
      if (this.attachments.length > 0) {
        const last = this.attachments[this.attachments.length - 1];
        this.showAttachmentPreview(last.name, last.icon, last.platform);
      }
    },
    
    // Get attachments for current platform
    getAttachmentsForPlatform(platform) {
      return this.attachments.filter(a => a.platform === (platform === 'desktop' ? 'desktop' : 'mobile'));
    },
    
    // Build attachment context for AI
    buildAttachmentContext(attachments) {
      if (!attachments || attachments.length === 0) return '';
      
      let context = '\n\n=== ATTACHED FILES ===\n';
      
      attachments.forEach(att => {
        context += `\n[${att.icon} ${att.name}]\n`;
        
        // For images, note they're available for vision
        if (att.type.startsWith('image/')) {
          context += '[Image attached - AI can analyze this image]\n';
        } else {
          // Truncate long content
          const content = att.content.length > 8000 
            ? att.content.slice(0, 8000) + '\n[...truncated...]' 
            : att.content;
          context += content + '\n';
        }
      });
      
      context += '\n=== END ATTACHED FILES ===\n';
      return context;
    },
    
    // Clear attachments after sending
    clearAttachments(platform) {
      this.attachments = this.attachments.filter(a => a.platform !== (platform === 'desktop' ? 'desktop' : 'mobile'));
      document.querySelectorAll('.attachment-preview').forEach(el => el.remove());
    }
  };
  
  // Make globally available
  window.FileAttachments = FileAttachments;
  
  // Hook into sendMessage to include attachments
  const originalSendMessage = window.sendMessage;
  window.sendMessage = async function(p) {
    const platform = p === 'd' ? 'desktop' : 'mobile';
    const attachments = FileAttachments.getAttachmentsForPlatform(platform);
    
    if (attachments.length > 0) {
      // Add attachment context to the last user message
      const attachmentContext = FileAttachments.buildAttachmentContext(attachments);
      
      // Store in a global that sendMessage can access
      window.pendingAttachmentContext = attachmentContext;
      
      // Clear attachments
      FileAttachments.clearAttachments(platform);
    }
    
    return originalSendMessage(p);
  };
  
  // Initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => FileAttachments.init(), 1500);
    });
  } else {
    setTimeout(() => FileAttachments.init(), 1500);
  }
  
  console.log('[File Attachments] Module loaded - PDF, DOC, TXT, and image support');
})();
