// File Upload Improvements Module
// Better PDF parsing, code file handling, and enhanced file support

(function() {
  'use strict';
  
  // Enhanced PDF text extraction using pdf.js (if available) or fallback
  window.extractPDFText = async function(arrayBuffer) {
    try {
      // Try to use pdf-parse or pdfjs if available on server
      // For now, provide a basic extraction
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Look for text streams in PDF
      const textChunks = [];
      const decoder = new TextDecoder('utf-8');
      const textDecoderLatin1 = new TextDecoder('latin1');
      
      // Try multiple encodings
      let fullText = decoder.decode(uint8Array);
      
      // Extract text between common PDF text markers
      const textMatches = fullText.match(/\(([^)]{10,500})\)/g);
      if (textMatches) {
        textMatches.forEach(match => {
          const clean = match.slice(1, -1)
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '')
            .replace(/\\\\/g, '\\')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')');
          if (clean.length > 10) textChunks.push(clean);
        });
      }
      
      // Also look for BT/ET (Begin/End Text) blocks
      const btMatches = fullText.match(/BT[\s\S]*?ET/g);
      if (btMatches) {
        btMatches.forEach(block => {
          const text = block.match(/\[?\(([^)]+)\)\]?/g);
          if (text) {
            text.forEach(t => {
              const clean = t.replace(/[\[\]\(\)]/g, '')
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t');
              if (clean.length > 5) textChunks.push(clean);
            });
          }
        });
      }
      
      const result = textChunks.join(' ').slice(0, 50000); // Limit to 50KB
      return result.length > 100 ? result : '[PDF text extraction limited. The PDF may be image-based or encrypted.]';
    } catch (err) {
      console.error('[FileUpload] PDF extraction error:', err);
      return '[Error extracting PDF text]';
    }
  };
  
  // Enhanced code file parsing
  window.parseCodeFile = async function(content, filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    // Language detection
    const langMap = {
      'js': 'javascript', 'jsx': 'jsx',
      'ts': 'typescript', 'tsx': 'tsx',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp', 'c': 'c', 'h': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'r': 'r',
      'sql': 'sql',
      'html': 'html', 'htm': 'html',
      'css': 'css', 'scss': 'scss', 'sass': 'sass',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml', 'yml': 'yaml',
      'md': 'markdown',
      'sh': 'bash', 'bash': 'bash',
      'dockerfile': 'dockerfile'
    };
    
    const language = langMap[ext] || 'text';
    
    // Get file stats
    const lines = content.split('\n');
    const stats = {
      totalLines: lines.length,
      codeLines: lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#') && !l.trim().startsWith('/*') && !l.trim().startsWith('*')).length,
      commentLines: lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('#') || l.trim().startsWith('/*') || l.trim().startsWith('*') || l.trim().startsWith('<!--')).length,
      blankLines: lines.filter(l => !l.trim()).length
    };
    
    // Extract imports/includes
    const imports = [];
    const importPatterns = [
      /import\s+(.+?)\s+from\s+['"](.+?)['"]/g,  // ES6 imports
      /import\s+['"](.+?)['"]/g,  // Side-effect imports
      /const\s+(.+?)\s+=\s+require\(['"](.+?)['"]\)/g,  // CommonJS
      /from\s+(.+?)\s+import/g,  // Python
      /#include\s+[<"](.+?)[>"]/g,  // C/C++
      /using\s+(.+?);/g,  // C#
      /import\s+"(.+?)"/g,  // Go
      /use\s+(.+?);/g,  // Rust
    ];
    
    importPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1] || match[2]);
      }
    });
    
    // Extract function/class definitions
    const definitions = [];
    const defPatterns = [
      /(?:async\s+)?function\s+(\w+)/g,
      /class\s+(\w+)/g,
      /const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
      /def\s+(\w+)/g,  // Python
      /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(\w+)\s*\([^)]*\)\s*{/g,  // Java/C#
    ];
    
    defPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        definitions.push(match[1]);
      }
    });
    
    return {
      language,
      stats,
      imports: [...new Set(imports)].slice(0, 20),
      definitions: [...new Set(definitions)].slice(0, 30),
      summary: `Language: ${language}\nLines: ${stats.totalLines} (code: ${stats.codeLines}, comments: ${stats.commentLines}, blank: ${stats.blankLines})\nImports: ${imports.length > 0 ? imports.slice(0, 10).join(', ') : 'None detected'}\nMain definitions: ${definitions.length > 0 ? definitions.slice(0, 10).join(', ') : 'None detected'}`
    };
  };
  
  // Enhanced file handler
  window.handleFileUploadEnhanced = async function(file) {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    
    if (file.size > MAX_SIZE) {
      showToast('File too large. Max 10MB.', 'error');
      return null;
    }
    
    const reader = new FileReader();
    const ext = file.name.split('.').pop().toLowerCase();
    
    return new Promise((resolve, reject) => {
      reader.onload = async function(e) {
        try {
          let result = {
            name: file.name,
            type: file.type,
            size: file.size,
            text: null,
            data: null,
            summary: null
          };
          
          // Handle different file types
          if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
            // Images - return base64 for vision models
            result.data = e.target.result; // base64
            result.type = 'image';
            
          } else if (ext === 'pdf') {
            // PDFs - extract text
            const arrayBuffer = e.target.result;
            result.text = await window.extractPDFText(arrayBuffer);
            result.type = 'pdf';
            result.summary = `PDF: ${file.name}\nExtracted text length: ${result.text.length} chars\nPreview: ${result.text.slice(0, 200)}...`;
            
          } else if (['doc', 'docx'].includes(ext)) {
            // Word docs - limited support
            result.text = '[Word document - text extraction limited. Please convert to PDF or paste text directly.]';
            result.type = 'document';
            
          } else if (['txt', 'md', 'json', 'xml', 'csv', 'log'].includes(ext) || 
                     ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'html', 'css', 'scss', 'sass', 'yaml', 'yml', 'sql', 'sh', 'bash'].includes(ext)) {
            // Text/code files
            const text = e.target.result;
            result.text = text;
            
            if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'html', 'css', 'scss', 'sass', 'sql'].includes(ext)) {
              // Parse code file
              const parsed = await window.parseCodeFile(text, file.name);
              result.type = 'code';
              result.language = parsed.language;
              result.summary = parsed.summary;
              result.parsed = parsed;
            } else {
              result.type = 'text';
              result.summary = `Text file: ${file.name}\nLength: ${text.length} chars\nLines: ${text.split('\n').length}\nPreview: ${text.slice(0, 200)}...`;
            }
            
          } else {
            // Binary/other files
            result.text = `[Binary file: ${file.name}. Type: ${file.type || 'unknown'}]`;
            result.type = 'binary';
          }
          
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      // Read as appropriate format
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
        reader.readAsDataURL(file);
      } else if (ext === 'pdf') {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  };
  
  // Override original file upload handler
  const originalHandleFileUpload = window.handleFileUpload;
  window.handleFileUpload = async function(platform) {
    const input = document.getElementById(platform + '-file-input');
    if (!input || !input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    showToast(`Processing ${file.name}...`);
    
    try {
      const result = await window.handleFileUploadEnhanced(file);
      if (!result) return;
      
      // Store result for sending
      window.lastUploadedFile = result;
      
      if (result.type === 'image') {
        // For images, set as attachment for vision
        window.attachedImageData = result.data;
        showToast('Image attached - ready to send');
        
      } else if (result.text) {
        // For text files, insert content into message
        const msgInput = document.getElementById(platform + '-msg-input');
        if (msgInput) {
          const prefix = `File: ${result.name}\n\n${result.summary || result.text.slice(0, 500)}\n\n`;
          msgInput.value = prefix + msgInput.value;
          msgInput.dispatchEvent(new Event('input'));
          showToast(`${result.type === 'code' ? 'Code' : 'Text'} file loaded`);
        }
      }
      
      // Clear input
      input.value = '';
      
    } catch (err) {
      console.error('[FileUpload] Error:', err);
      showToast('Error processing file', 'error');
    }
  };
  
  // Add file drop zone support
  window.setupFileDropZone = function() {
    const dropZones = [
      document.getElementById('d-chat-area'),
      document.getElementById('m-chat-area')
    ];
    
    dropZones.forEach(zone => {
      if (!zone) return;
      
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.style.background = 'var(--accent-glow)';
      });
      
      zone.addEventListener('dragleave', () => {
        zone.style.background = '';
      });
      
      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.style.background = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          const file = files[0];
          showToast(`Processing ${file.name}...`);
          
          try {
            const result = await window.handleFileUploadEnhanced(file);
            if (result) {
              window.lastUploadedFile = result;
              
              if (result.type === 'image') {
                window.attachedImageData = result.data;
                showToast('Image attached');
              } else if (result.text) {
                const platform = zone.id.startsWith('m-') ? 'm' : 'd';
                const msgInput = document.getElementById(platform + '-msg-input');
                if (msgInput) {
                  msgInput.value = `File: ${result.name}\n\n${result.summary || result.text.slice(0, 500)}\n\n` + msgInput.value;
                  msgInput.dispatchEvent(new Event('input'));
                }
              }
            }
          } catch (err) {
            showToast('Error processing file', 'error');
          }
        }
      });
    });
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(setupFileDropZone, 2000);
    });
  } else {
    setTimeout(setupFileDropZone, 2000);
  }
  
  console.log('[FileUpload] Enhanced module loaded - better PDF, code, and file support');
})();
