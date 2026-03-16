// Streaming Chat Module for NOVA
// Provides real-time streaming responses for faster perceived performance

(function() {
  'use strict';
  
  // Streaming message helpers
  window.createStreamingMessage = function() {
    var elements = [];
    [['d','d-msg','d-avatar','d-bubble'],['m','m-msg','m-avatar','m-bubble']].forEach(function(cfg) {
      var p = cfg[0], msgCls = cfg[1], avCls = cfg[2], bubCls = cfg[3];
      var area = document.getElementById(p + '-chat-area');
      if (!area) return;
      
      // Remove typing indicator
      var typing = document.getElementById(p + '-typing');
      if (typing) typing.remove();
      
      var welcome = document.getElementById(p + '-welcome');
      if (welcome) welcome.remove();
      
      var msg = document.createElement('div');
      msg.className = msgCls + ' ai';
      msg.id = p + '-streaming';
      
      var inner = '';
      if (state.tools.memory && state.memory) {
        inner += '<div class="memory-badge"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3"/></svg> Memory</div>';
      }
      inner += '<div class="streaming-content"></div>';
      
      msg.innerHTML = '<div class="' + avCls + ' ai">' + state.aiName[0] + '</div><div class="' + bubCls + ' bubble">' + inner + '</div>';
      area.appendChild(msg);
      area.scrollTop = area.scrollHeight;
      elements.push(msg);
    });
    return elements;
  };
  
  window.updateStreamingMessage = function(elements, content) {
    elements.forEach(function(el) {
      var contentDiv = el.querySelector('.streaming-content');
      if (contentDiv && window.formatContent) {
        contentDiv.innerHTML = window.formatContent(content);
        var area = el.parentElement;
        if (area) area.scrollTop = area.scrollHeight;
      }
    });
  };
  
  window.finalizeStreamingMessage = function(elements, finalContent) {
    elements.forEach(function(el) { el.remove(); });
    if (window.appendMessage) {
      window.appendMessage('ai', finalContent);
    }
  };
  
  // Override sendMessage for Ollama to use streaming
  var originalSendMessage = window.sendMessage;
  
  window.sendMessageStreaming = async function(p) {
    var inputEl = document.getElementById(p + '-msg-input');
    if (!inputEl) return;
    var text = inputEl.value.trim();
    if (!text || state.isTyping) return;
    
    // Only use streaming for Ollama
    if (state.provider !== 'ollama') {
      return originalSendMessage(p);
    }
    
    inputEl.value = '';
    inputEl.style.height = 'auto';
    state.isTyping = true;
    ['d-send-btn','m-send-btn'].forEach(function(id) { 
      var el = document.getElementById(id); 
      if (el) el.disabled = true; 
    });
    
    if (window.appendMessage) window.appendMessage('user', text);
    
    // Handle image generation mode
    if (state.imageMode) {
      if (window.generateImage) await window.generateImage(text);
      return;
    }
    
    // Handle web search queries
    if (state.tools.search && /search|look up|what's new|what is happening|current|latest|recent|news/i.test(text)) {
      if (window.performWebSearch) await window.performWebSearch(text);
      return;
    }
    
    // Regular chat with streaming
    var sys = state.systemPrompt;
    if (state.tools.memory && state.memory) {
      sys += '\n\n=== USER MEMORY ===\n' + state.memory + '\n=== END USER MEMORY ===';
    }
    
    var messages = [{ role: 'system', content: sys }].concat(state.history).concat([{ role: 'user', content: text }]);
    
    if (window.appendTyping) window.appendTyping();
    
    try {
      var ollamaModel = state.model || 'llama3.2';
      var ollamaMessages = messages.map(function(m) { 
        return { role: m.role, content: m.content }; 
      });
      
      // Add image to last user message if present
      if (window.attachedImageData && ollamaMessages.length > 0) {
        var lastMsg = ollamaMessages[ollamaMessages.length - 1];
        if (lastMsg.role === 'user') {
          var base64Data = window.attachedImageData.split(',')[1];
          lastMsg.images = [base64Data];
        }
      }
      
      // Create streaming container
      var streamingEl = window.createStreamingMessage();
      
      var res = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: ollamaMessages,
          stream: true
        })
      });
      
      if (!res.ok) {
        throw new Error('Ollama not running at 127.0.0.1:11434. Start with: ollama serve');
      }
      
      // Handle streaming response
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var fullContent = '';
      
      while (true) {
        var { done, value } = await reader.read();
        if (done) break;
        
        var chunk = decoder.decode(value, { stream: true });
        var lines = chunk.split('\n');
        
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (line.trim()) {
            try {
              var json = JSON.parse(line);
              if (json.message && json.message.content) {
                fullContent += json.message.content;
                window.updateStreamingMessage(streamingEl, fullContent);
              }
            } catch (e) {}
          }
        }
      }
      
      // Clear attached image
      window.attachedImageData = null;
      var attachmentEl = document.getElementById('d-image-attachment');
      if (attachmentEl) attachmentEl.style.display = 'none';
      
      // Finalize the message
      window.finalizeStreamingMessage(streamingEl, fullContent);
      
      // Update history
      state.history.push({ role: 'user', content: text });
      state.history.push({ role: 'assistant', content: fullContent });
      if (state.history.length > 40) state.history = state.history.slice(-40);
      
      // Track conversation
      if (window.incrementConversationCount) window.incrementConversationCount();
      if (window.learnFromConversation) window.learnFromConversation(text, fullContent);
      if (window.saveCurrentChat) window.saveCurrentChat(text);
      
    } catch(err) {
      if (window.removeTyping) window.removeTyping();
      var provName = PROVIDERS[state.provider] ? PROVIDERS[state.provider].name : state.provider;
      var errorMsg = err.message || 'Unknown error';
      if (window.appendMessage) {
        window.appendMessage('ai', '**Error:** ' + errorMsg + '\n\n<button class="retry-btn" onclick="retryLastMessage()">Retry</button>');
      }
    }
    
    state.isTyping = false;
    ['d-send-btn','m-send-btn'].forEach(function(id) { 
      var el = document.getElementById(id); 
      if (el) el.disabled = false; 
    });
    inputEl.focus();
  };
  
  // Replace original sendMessage with streaming version
  window.sendMessage = window.sendMessageStreaming;
  
  console.log('[Streaming] Module loaded - Ollama will use streaming responses');
})();
