// Web Search v2 - Enhanced Search with Tavily & SerpAPI
// Provides better results with citations

(function() {
  'use strict';
  
  const SearchAPIs = {
    // Tavily API - High-quality AI search
    async tavily(query, apiKey) {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          search_depth: 'advanced',
          max_results: 8,
          include_answer: true,
          include_images: false,
          include_raw_content: true
        })
      });
      
      if (!res.ok) throw new Error('Tavily API error');
      const data = await res.json();
      
      return {
        answer: data.answer,
        results: data.results?.map(r => ({
          title: r.title,
          url: r.url,
          content: r.content,
          raw_content: r.raw_content,
          score: r.score
        })) || []
      };
    },
    
    // SerpAPI - Google search results
    async serpapi(query, apiKey) {
      const params = new URLSearchParams({
        q: query,
        api_key: apiKey,
        engine: 'google',
        num: 8,
        hl: 'en'
      });
      
      const res = await fetch(`https://serpapi.com/search?${params}`);
      if (!res.ok) throw new Error('SerpAPI error');
      const data = await res.json();
      
      const results = [];
      
      // Organic results
      if (data.organic_results) {
        data.organic_results.slice(0, 6).forEach(r => {
          results.push({
            title: r.title,
            url: r.link,
            content: r.snippet,
            source: 'Google'
          });
        });
      }
      
      // Knowledge graph
      if (data.knowledge_graph) {
        results.unshift({
          title: data.knowledge_graph.title || 'Knowledge Panel',
          url: data.knowledge_graph.website || '#',
          content: data.knowledge_graph.description || '',
          source: 'Knowledge Graph',
          isFeatured: true
        });
      }
      
      // AI Overview if available
      if (data.ai_overview?.text) {
        return {
          answer: data.ai_overview.text,
          results: results
        };
      }
      
      return { results };
    },
    
    // DuckDuckGo Instant Answers (free, no key needed)
    async duckduckgo(query) {
      // Use our server proxy or direct
      try {
        const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
        if (!res.ok) throw new Error('DDG API error');
        const data = await res.json();
        
        const results = [];
        
        if (data.AbstractText) {
          results.push({
            title: data.Heading || query,
            url: data.AbstractURL || '#',
            content: data.AbstractText,
            source: 'DuckDuckGo',
            isFeatured: true
          });
        }
        
        if (data.RelatedTopics) {
          data.RelatedTopics.slice(0, 5).forEach(t => {
            if (t.Text) {
              results.push({
                title: t.Text.split(' - ')[0],
                url: t.FirstURL || '#',
                content: t.Text.split(' - ').slice(1).join(' - '),
                source: 'Related'
              });
            }
          });
        }
        
        return { results };
      } catch (err) {
        // Fallback to scrape
        return this.fallbackSearch(query);
      }
    },
    
    // Fallback web scraping
    async fallbackSearch(query) {
      try {
        const res = await fetch('/api/search?q=' + encodeURIComponent(query));
        if (!res.ok) throw new Error('Search failed');
        return await res.json();
      } catch (err) {
        return { 
          results: [],
          error: 'Search temporarily unavailable'
        };
      }
    }
  };
  
  // Main search function
  window.performWebSearchV2 = async function(query) {
    const settings = JSON.parse(localStorage.getItem('nova_search_settings') || '{}');
    const provider = settings.provider || 'auto';
    
    // Get API keys
    const keys = JSON.parse(localStorage.getItem('nova_api_keys') || '{}');
    
    showToast('Searching the web...', 'info');
    
    try {
      let result;
      
      // Try providers in order of quality
      if ((provider === 'auto' || provider === 'tavily') && keys.tavily) {
        try {
          result = await SearchAPIs.tavily(query, keys.tavily);
        } catch (e) {
          console.log('Tavily failed, trying fallback');
        }
      }
      
      if (!result && (provider === 'auto' || provider === 'serpapi') && keys.serpapi) {
        try {
          result = await SearchAPIs.serpapi(query, keys.serpapi);
        } catch (e) {
          console.log('SerpAPI failed, trying fallback');
        }
      }
      
      if (!result) {
        result = await SearchAPIs.duckduckgo(query);
      }
      
      // Format for AI
      const searchContext = formatSearchResults(result, query);
      
      // Store for use in chat
      window.lastSearchResults = searchContext;
      
      // Auto-send to AI if enabled
      if (settings.autoSend !== false) {
        await sendMessageWithSearch(query, searchContext);
      }
      
      return searchContext;
      
    } catch (err) {
      console.error('Search error:', err);
      showToast('Search failed: ' + err.message, 'error');
      return null;
    }
  };
  
  // Format search results for AI context
  function formatSearchResults(result, query) {
    let context = `Web search results for "${query}":\n\n`;
    
    if (result.answer) {
      context += `## Quick Answer\n${result.answer}\n\n`;
    }
    
    if (result.results && result.results.length > 0) {
      context += `## Sources\n\n`;
      
      result.results.forEach((r, i) => {
        context += `[${i + 1}] **${r.title}**\n`;
        context += `URL: ${r.url}\n`;
        context += `${r.content?.slice(0, 500) || 'No description available'}\n\n`;
      });
    }
    
    context += `\nBased on these search results, please provide a comprehensive answer. Cite sources using [1], [2], etc. when referencing specific information.`;
    
    return {
      text: context,
      results: result.results,
      query: query
    };
  }
  
  // Send message with search context
  async function sendMessageWithSearch(query, searchContext) {
    // Add user message
    appendMessage('user', query + ' \n\n*Searching the web...*');
    
    // Build messages with search context
    const sys = state.systemPrompt + '\n\nYou have access to real-time web search results. Use them to provide accurate, up-to-date information. Always cite your sources with [1], [2], etc.';
    const messages = [
      { role: 'system', content: sys },
      ...state.history.slice(-10),
      { role: 'user', content: searchContext.text + '\n\nUser question: ' + query }
    ];
    
    // Send to AI
    appendTyping();
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: state.provider,
          model: state.model,
          messages: messages,
          max_tokens: 2000,
          temperature: 0.7,
          userToken: userToken
        })
      });
      
      if (!res.ok) throw new Error('AI request failed');
      
      const data = await res.json();
      const reply = data.choices[0].message.content;
      
      // Add citations UI
      const replyWithCitations = addCitationsUI(reply, searchContext.results);
      
      removeTyping();
      appendMessage('ai', replyWithCitations);
      
      // Save to history
      state.history.push({ role: 'user', content: query });
      state.history.push({ role: 'assistant', content: reply });
      saveCurrentChat(query);
      
    } catch (err) {
      removeTyping();
      showToast('Error: ' + err.message, 'error');
    }
  }
  
  // Add citations UI to AI response
  function addCitationsUI(text, results) {
    if (!results || results.length === 0) return text;
    
    // Replace [1], [2] with clickable links
    let withLinks = text;
    results.forEach((r, i) => {
      const citation = `[${i + 1}]`;
      const link = `<a href="${r.url}" target="_blank" class="citation-link" title="${r.title}">${citation}</a>`;
      withLinks = withLinks.replace(new RegExp('\\[' + (i + 1) + '\\]', 'g'), link);
    });
    
    return withLinks;
  }
  
  // Open search settings
  window.openSearchSettings = function() {
    const settings = JSON.parse(localStorage.getItem('nova_search_settings') || '{}');
    const keys = JSON.parse(localStorage.getItem('nova_api_keys') || '{}');
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '600';
    modal.id = 'search-settings-modal';
    
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
        <div class="modal-top"><h2>Web Search Settings</h2><button class="modal-close" onclick="closeSearchSettings()">&times;</button></div>
        <div class="modal-body">
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text); font-weight: 500;">Search Provider</label>
            <select id="search-provider" style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
              <option value="auto" ${settings.provider === 'auto' ? 'selected' : ''}>Auto (Best Available)</option>
              <option value="tavily" ${settings.provider === 'tavily' ? 'selected' : ''}>Tavily (Recommended)</option>
              <option value="serpapi" ${settings.provider === 'serpapi' ? 'selected' : ''}>SerpAPI (Google)</option>
              <option value="duckduckgo" ${settings.provider === 'duckduckgo' ? 'selected' : ''}>DuckDuckGo (Free)</option>
            </select>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text); font-weight: 500;">Tavily API Key</label>
            <input type="password" id="tavily-key" value="${keys.tavily || ''}" placeholder="tvly-..." style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
            <p style="font-size: 12px; color: var(--muted); margin-top: 4px;">Get free key at tavily.com</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text); font-weight: 500;">SerpAPI Key</label>
            <input type="password" id="serpapi-key" value="${keys.serpapi || ''}" placeholder="Enter SerpAPI key..." style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
            <p style="font-size: 12px; color: var(--muted); margin-top: 4px;">Get key at serpapi.com</p>
          </div>
          
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
            <input type="checkbox" id="auto-send-search" ${settings.autoSend !== false ? 'checked' : ''} style="width: 18px; height: 18px;">
            <label for="auto-send-search" style="color: var(--text);">Automatically search & answer</label>
          </div>
        </div>
        <div class="modal-footer" style="padding: 16px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px;">
          <button onclick="closeSearchSettings()" style="padding: 8px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Cancel</button>
          <button onclick="saveSearchSettings()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">Save</button>
        </div>
      </div>
    `;
    
    modal.onclick = closeSearchSettings;
    document.body.appendChild(modal);
  };
  
  window.closeSearchSettings = function() {
    const modal = document.getElementById('search-settings-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.saveSearchSettings = function() {
    const provider = document.getElementById('search-provider').value;
    const tavilyKey = document.getElementById('tavily-key').value;
    const serpapiKey = document.getElementById('serpapi-key').value;
    const autoSend = document.getElementById('auto-send-search').checked;
    
    // Save settings
    localStorage.setItem('nova_search_settings', JSON.stringify({
      provider,
      autoSend
    }));
    
    // Save keys
    const keys = JSON.parse(localStorage.getItem('nova_api_keys') || '{}');
    if (tavilyKey) keys.tavily = tavilyKey;
    if (serpapiKey) keys.serpapi = serpapiKey;
    localStorage.setItem('nova_api_keys', JSON.stringify(keys));
    
    showToast('Search settings saved');
    closeSearchSettings();
  };
  
  // Override web search trigger
  const originalPerformWebSearch = window.performWebSearch;
  window.performWebSearch = function(query) {
    // Use v2 if available, else fall back
    if (window.performWebSearchV2) {
      return window.performWebSearchV2(query);
    }
    return originalPerformWebSearch?.(query);
  };
  
  // Add search button
  window.addSearchButton = function() {
    const containers = [
      document.querySelector('.d-tools'),
      document.querySelector('.m-tools-row')
    ];
    
    containers.forEach(container => {
      if (!container) return;
      
      const btn = document.createElement('div');
      btn.className = 'd-tool-pill';
      btn.id = 'web-search-pill';
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> Web';
      btn.title = 'Toggle web search';
      btn.onclick = function() {
        state.tools.search = !state.tools.search;
        this.classList.toggle('active', state.tools.search);
        showToast(state.tools.search ? 'Web search enabled' : 'Web search disabled');
      };
      
      // Add settings button next to it
      const settingsBtn = document.createElement('span');
      settingsBtn.innerHTML = '⚙️';
      settingsBtn.style.cssText = 'margin-left: 4px; cursor: pointer; opacity: 0.6;';
      settingsBtn.onclick = (e) => {
        e.stopPropagation();
        openSearchSettings();
      };
      btn.appendChild(settingsBtn);
      
      // Check initial state
      if (state.tools.search) btn.classList.add('active');
      
      container.appendChild(btn);
    });
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addSearchButton, 2000);
    });
  } else {
    setTimeout(window.addSearchButton, 2000);
  }
  
  console.log('[WebSearch v2] Module loaded - Tavily, SerpAPI, DuckDuckGo support');
})();
