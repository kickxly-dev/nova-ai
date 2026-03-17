/**
 * Web Browsing Module - AI can browse websites and read page content
 * Extracts readable text from URLs for AI analysis
 */

(function() {
  'use strict';

  const WebBrowser = {
    // Cache for browsed pages (avoid re-fetching)
    cache: new Map(),
    maxCacheSize: 10,
    
    /**
     * Browse a URL and extract readable content
     */
    async browseUrl(url) {
      // Check cache first
      if (this.cache.has(url)) {
        return this.cache.get(url);
      }
      
      try {
        // Use a CORS proxy or our backend
        const content = await this.fetchPageContent(url);
        
        // Cache the result
        this.addToCache(url, content);
        
        return content;
      } catch (err) {
        return {
          success: false,
          error: err.message,
          url: url,
          content: null
        };
      }
    },
    
    /**
     * Fetch page content via backend proxy
     */
    async fetchPageContent(url) {
      // Try to use backend proxy first
      try {
        const res = await fetch('/api/browse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        if (res.ok) {
          const data = await res.json();
          return {
            success: true,
            url: url,
            title: data.title || '',
            content: data.content,
            links: data.links || [],
            timestamp: Date.now()
          };
        }
      } catch (e) {
        // Backend proxy not available, try direct fetch with CORS
      }
      
      // Fallback: Try direct fetch (may fail due to CORS)
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NOVA-AI/1.0)'
          }
        });
        
        if (!res.ok) throw new Error('Failed to fetch: ' + res.status);
        
        const html = await res.text();
        return this.parseHtml(url, html);
      } catch (err) {
        // Return error with helpful message
        return {
          success: false,
          error: 'Cannot access this URL directly. The site may block automated access.',
          url: url,
          content: null
        };
      }
    },
    
    /**
     * Parse HTML and extract readable content
     */
    parseHtml(url, html) {
      // Create a DOM parser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Get title
      const title = doc.title || doc.querySelector('h1')?.textContent || 'Untitled';
      
      // Remove script and style elements
      doc.querySelectorAll('script, style, nav, header, footer, aside, .ads, .advertisement').forEach(el => el.remove());
      
      // Try to find main content
      let content = '';
      const contentSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.content',
        '.article',
        '.post-content',
        '.entry-content',
        '#content',
        '.main-content'
      ];
      
      for (const selector of contentSelectors) {
        const el = doc.querySelector(selector);
        if (el) {
          content = this.extractText(el);
          break;
        }
      }
      
      // Fallback to body if no content found
      if (!content) {
        const body = doc.querySelector('body');
        if (body) {
          content = this.extractText(body);
        }
      }
      
      // Extract links
      const links = Array.from(doc.querySelectorAll('a[href]'))
        .map(a => ({
          text: a.textContent.trim().slice(0, 100),
          href: this.resolveUrl(url, a.getAttribute('href'))
        }))
        .filter(link => link.text && link.href.startsWith('http'))
        .slice(0, 10);
      
      return {
        success: true,
        url: url,
        title: title.trim(),
        content: this.cleanContent(content),
        links: links,
        timestamp: Date.now()
      };
    },
    
    /**
     * Extract text from element
     */
    extractText(element) {
      if (!element) return '';
      
      // Clone to avoid modifying original
      const clone = element.cloneNode(true);
      
      // Replace block elements with newlines
      clone.querySelectorAll('p, div, br, li, h1, h2, h3, h4, h5, h6').forEach(el => {
        el.insertAdjacentText('afterend', '\n');
      });
      
      return clone.textContent || '';
    },
    
    /**
     * Clean up extracted content
     */
    cleanContent(text) {
      if (!text) return '';
      
      return text
        .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
        .replace(/\s{2,}/g, ' ')     // Remove excessive spaces
        .replace(/^\s+|\s+$/g, '')  // Trim
        .slice(0, 8000);            // Limit length
    },
    
    /**
     * Resolve relative URLs
     */
    resolveUrl(base, href) {
      if (!href) return '';
      if (href.startsWith('http')) return href;
      if (href.startsWith('//')) return 'https:' + href;
      if (href.startsWith('/')) {
        const url = new URL(base);
        return url.origin + href;
      }
      return new URL(href, base).href;
    },
    
    /**
     * Add to cache
     */
    addToCache(url, content) {
      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(url, content);
    },
    
    /**
     * Format browsing result for AI context
     */
    formatForAI(result) {
      if (!result.success) {
        return `\n\n[Web Browsing Error: ${result.error}]`;
      }
      
      let output = `\n\n=== WEB PAGE CONTENT ===\n`;
      output += `URL: ${result.url}\n`;
      output += `Title: ${result.title}\n`;
      output += `Content:\n${result.content}\n`;
      
      if (result.links && result.links.length > 0) {
        output += `\nRelated Links:\n`;
        result.links.forEach(link => {
          output += `- ${link.text}: ${link.href}\n`;
        });
      }
      
      output += `=== END WEB PAGE ===`;
      return output;
    },
    
    /**
     * Check if a URL is browseable
     */
    isBrowseableUrl(url) {
      try {
        const u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    }
  };
  
  // Expose globally
  window.WebBrowser = WebBrowser;
  
  // Auto-detect URLs in messages and offer to browse
  document.addEventListener('DOMContentLoaded', function() {
    // Add browse command handler
    const originalSendMessage = window.sendMessage;
    
    // URL detection regex
    const urlRegex = /https?:\/\/[^\s]+/g;
    
    // Listen for browse commands in messages
    const detectBrowseCommand = function(text) {
      // Check for explicit browse command
      const browseMatch = text.match(/browse\s+(https?:\/\/[^\s]+)/i);
      if (browseMatch) {
        return browseMatch[1];
      }
      
      // Check for "visit/read/check/open" + URL
      const actionMatch = text.match(/(?:visit|read|check|open)\s+(https?:\/\/[^\s]+)/i);
      if (actionMatch) {
        return actionMatch[1];
      }
      
      return null;
    };
    
    // Make available for AI command detection
    window.detectBrowseCommand = detectBrowseCommand;
    window.browseUrl = (url) => WebBrowser.browseUrl(url);
  });
  
})();
