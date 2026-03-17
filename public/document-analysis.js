/**
 * Document Analysis - PDF, Spreadsheets, OCR
 */

(function() {
  'use strict';

  // PDF.js CDN
  const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

  const DocumentAnalysis = {
    // Load PDF.js dynamically
    async loadPDFJS() {
      if (window.pdfjsLib) return window.pdfjsLib;
      
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PDFJS_URL;
        script.onload = () => resolve(window.pdfjsLib);
        script.onerror = reject;
        document.head.appendChild(script);
      });
    },

    // Extract text from PDF
    async extractPDF(file) {
      try {
        const pdfjsLib = await this.loadPDFJS();
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 50); // Limit to 50 pages
        
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += `\n--- Page ${i} ---\n${pageText}`;
        }
        
        return {
          type: 'pdf',
          filename: file.name,
          pages: pdf.numPages,
          extracted: maxPages,
          text: fullText.slice(0, 50000), // Limit size
          totalLength: fullText.length
        };
      } catch (err) {
        throw new Error('Failed to extract PDF: ' + err.message);
      }
    },

    // Parse CSV/Excel
    async parseSpreadsheet(file) {
      const text = await file.text();
      const extension = file.name.split('.').pop().toLowerCase();
      
      if (extension === 'csv') {
        return this.parseCSV(text, file.name);
      } else if (extension === 'json') {
        return this.parseJSON(text, file.name);
      } else {
        // For xlsx, we'd need a library - fallback to basic parsing
        return {
          type: 'spreadsheet',
          filename: file.name,
          format: extension,
          text: text.slice(0, 30000),
          note: 'For full Excel support, convert to CSV first'
        };
      }
    },

    // Parse CSV
    parseCSV(text, filename) {
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0]?.split(',').map(h => h.trim()) || [];
      const rows = [];
      
      for (let i = 1; i < Math.min(lines.length, 1000); i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });
        rows.push(row);
      }

      // Calculate basic stats for numeric columns
      const stats = {};
      headers.forEach(header => {
        const nums = rows.map(r => parseFloat(r[header])).filter(n => !isNaN(n));
        if (nums.length > 0) {
          stats[header] = {
            count: nums.length,
            sum: nums.reduce((a, b) => a + b, 0),
            avg: nums.reduce((a, b) => a + b, 0) / nums.length,
            min: Math.min(...nums),
            max: Math.max(...nums)
          };
        }
      });

      return {
        type: 'csv',
        filename,
        headers,
        rowCount: lines.length - 1,
        rows: rows.slice(0, 100), // First 100 rows
        stats,
        preview: this.formatCSVPreview(headers, rows.slice(0, 10))
      };
    },

    // Parse JSON
    parseJSON(text, filename) {
      try {
        const data = JSON.parse(text);
        return {
          type: 'json',
          filename,
          structure: this.inferJSONStructure(data),
          preview: JSON.stringify(data, null, 2).slice(0, 10000),
          itemCount: Array.isArray(data) ? data.length : Object.keys(data).length
        };
      } catch (err) {
        return { type: 'json', filename, error: 'Invalid JSON' };
      }
    },

    // Infer JSON structure
    inferJSONStructure(data) {
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        return {
          type: 'array',
          length: data.length,
          itemType: typeof first,
          keys: typeof first === 'object' ? Object.keys(first) : null
        };
      } else if (typeof data === 'object') {
        return {
          type: 'object',
          keys: Object.keys(data)
        };
      }
      return { type: typeof data };
    },

    // Format CSV preview
    formatCSVPreview(headers, rows) {
      let text = headers.join(' | ') + '\n';
      text += headers.map(() => '---').join(' | ') + '\n';
      rows.forEach(row => {
        text += headers.map(h => row[h] || '').join(' | ') + '\n';
      });
      return text;
    },

    // OCR for images (using Tesseract.js)
    async ocrImage(file) {
      // Load Tesseract.js dynamically
      if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      showToast('Running OCR...');
      
      try {
        const result = await window.Tesseract.recognize(
          file,
          'eng',
          { 
            logger: m => {
              if (m.status === 'recognizing text') {
                console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
              }
            }
          }
        );

        return {
          type: 'ocr',
          filename: file.name,
          text: result.data.text,
          confidence: result.data.confidence,
          words: result.data.words?.length || 0
        };
      } catch (err) {
        throw new Error('OCR failed: ' + err.message);
      }
    },

    // Format for AI
    formatForAI(result) {
      switch(result.type) {
        case 'pdf':
          return `\n\n=== PDF DOCUMENT: ${result.filename} ===\n` +
            `Pages: ${result.pages} (extracted ${result.extracted})\n\n` +
            `Content:\n${result.text.slice(0, 8000)}\n` +
            (result.totalLength > 8000 ? `\n[... ${result.totalLength - 8000} more characters ...]` : '') +
            `\n=== END PDF ===`;
        
        case 'csv':
          return `\n\n=== SPREADSHEET: ${result.filename} ===\n` +
            `Rows: ${result.rowCount} | Columns: ${result.headers.length}\n` +
            `Columns: ${result.headers.join(', ')}\n\n` +
            (Object.keys(result.stats).length > 0 ? 
              `Statistics:\n${Object.entries(result.stats).map(([k, v]) => 
                `  ${k}: avg=${v.avg.toFixed(2)}, min=${v.min}, max=${v.max}`
              ).join('\n')}\n\n` : '') +
            `Preview (first ${result.rows.length} rows):\n${result.preview}\n` +
            `\n=== END SPREADSHEET ===`;
        
        case 'json':
          return `\n\n=== JSON FILE: ${result.filename} ===\n` +
            `Type: ${result.structure.type}\n` +
            (result.structure.length ? `Items: ${result.structure.length}\n` : '') +
            (result.structure.keys ? `Keys: ${result.structure.keys.join(', ')}\n` : '') +
            `\nPreview:\n${result.preview}\n` +
            `\n=== END JSON ===`;
        
        case 'ocr':
          return `\n\n=== OCR RESULT: ${result.filename} ===\n` +
            `Confidence: ${result.confidence.toFixed(1)}% | Words: ${result.words}\n\n` +
            `Text:\n${result.text}\n` +
            `\n=== END OCR ===`;
        
        default:
          return `\n\n=== FILE: ${result.filename} ===\n${result.text || result.preview || 'Binary file'}\n=== END FILE ===`;
      }
    }
  };

  // Expose globally
  window.DocumentAnalysis = DocumentAnalysis;

  // Enhanced file upload handler
  const originalHandleFileUpload = window.handleFileUpload;
  window.handleFileUpload = async function(event, platform) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if it's a document we can analyze
    const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isSpreadsheet = file.name.match(/\.(csv|xlsx?|json)$/i);
    const isImage = file.type.startsWith('image/');

    if (isPDF || isSpreadsheet) {
      showToast(`Analyzing ${file.name}...`);
      
      try {
        let result;
        if (isPDF) {
          result = await DocumentAnalysis.extractPDF(file);
        } else {
          result = await DocumentAnalysis.parseSpreadsheet(file);
        }

        // Add to input
        const formatted = DocumentAnalysis.formatForAI(result);
        const input = document.getElementById(platform + '-msg-input');
        if (input) {
          input.value = `[Analyzed ${file.name}]\n${formatted}\n\n${input.value}`;
          autoResize(input);
        }
        
        showToast(`${file.name} analyzed!`);
        return;
      } catch (err) {
        showToast('Analysis failed: ' + err.message, 'error');
        // Fall through to original handler
      }
    }

    if (isImage && file.size < 5 * 1024 * 1024) {
      // Offer OCR option
      const useOCR = confirm('Run OCR on this image to extract text?');
      if (useOCR) {
        try {
          const result = await DocumentAnalysis.ocrImage(file);
          const formatted = DocumentAnalysis.formatForAI(result);
          const input = document.getElementById(platform + '-msg-input');
          if (input) {
            input.value = `[OCR: ${file.name}]\n${formatted}\n\n${input.value}`;
            autoResize(input);
          }
          showToast('OCR complete!');
          return;
        } catch (err) {
          showToast('OCR failed: ' + err.message, 'error');
        }
      }
    }

    // Fall back to original handler
    if (originalHandleFileUpload) {
      return originalHandleFileUpload(event, platform);
    }
  };

  console.log('[Document Analysis] Module loaded - PDF, CSV, OCR support');
})();
