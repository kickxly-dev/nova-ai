// Vision for All - Enable image support on all providers
// OpenAI, Claude, Gemini, and Ollama vision support

(function() {
  'use strict';
  
  // Vision capability by provider
  const VISION_PROVIDERS = {
    openai: { models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4-vision-preview'], maxSize: 20 },
    anthropic: { models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'], maxSize: 10 },
    google: { models: ['gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash'], maxSize: 10 },
    ollama: { models: ['llava', 'llava-phi3', 'bakllava', 'moondream'], maxSize: 10 },
    groq: { models: ['llava-v1.5-7b-4096-preview'], maxSize: 10 }
  };
  
  // Check if current model supports vision
  window.supportsVision = function() {
    const provider = state.provider;
    const model = state.model;
    
    const config = VISION_PROVIDERS[provider];
    if (!config) return false;
    
    return config.models.some(m => model.toLowerCase().includes(m.toLowerCase()));
  };
  
  // Convert image to base64 with size limit
  window.prepareImageForVision = async function(imageData, provider) {
    const config = VISION_PROVIDERS[provider] || { maxSize: 10 };
    const maxSizeMB = config.maxSize;
    
    // If already base64 data URL
    if (imageData.startsWith('data:')) {
      // Check size
      const base64 = imageData.split(',')[1];
      const sizeMB = (base64.length * 3 / 4) / 1024 / 1024;
      
      if (sizeMB > maxSizeMB) {
        // Compress/resize
        return await compressImage(imageData, maxSizeMB);
      }
      
      return imageData;
    }
    
    return imageData;
  };
  
  // Compress image to meet size requirements
  async function compressImage(dataUrl, maxSizeMB) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Scale down if needed
        const maxPixels = 2048;
        if (width > maxPixels || height > maxPixels) {
          if (width > height) {
            height = (height / width) * maxPixels;
            width = maxPixels;
          } else {
            width = (width / height) * maxPixels;
            height = maxPixels;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Try different quality levels
        let quality = 0.9;
        let result = canvas.toDataURL('image/jpeg', quality);
        
        while (result.length * 3 / 4 / 1024 / 1024 > maxSizeMB && quality > 0.3) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        
        resolve(result);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }
  
  // Format image message for different providers
  window.formatVisionMessage = async function(text, imageData, provider) {
    const preparedImage = await window.prepareImageForVision(imageData, provider);
    
    switch (provider) {
      case 'openai':
        return {
          role: 'user',
          content: [
            { type: 'text', text: text },
            { type: 'image_url', image_url: { url: preparedImage } }
          ]
        };
        
      case 'anthropic':
        // Extract base64 from data URL
        const base64Anthropic = preparedImage.split(',')[1];
        const mediaType = preparedImage.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
        return {
          role: 'user',
          content: [
            { type: 'text', text: text },
            { 
              type: 'image', 
              source: { 
                type: 'base64', 
                media_type: mediaType, 
                data: base64Anthropic 
              } 
            }
          ]
        };
        
      case 'google':
        const base64Google = preparedImage.split(',')[1];
        return {
          role: 'user',
          parts: [
            { text: text },
            { 
              inline_data: { 
                mime_type: 'image/jpeg', 
                data: base64Google 
              } 
            }
          ]
        };
        
      case 'ollama':
        const base64Ollama = preparedImage.split(',')[1];
        return {
          role: 'user',
          content: text,
          images: [base64Ollama]
        };
        
      default:
        return { role: 'user', content: text + '\n\n[Image attached]' };
    }
  };
  
  // Override sendMessage to handle vision
  const originalSendMessage = window.sendMessage;
  window.sendMessage = async function(p) {
    const inputEl = document.getElementById(p + '-msg-input');
    if (!inputEl) return;
    
    const text = inputEl.value.trim();
    if (!text && !window.attachedImageData) return;
    if (state.isTyping) return;
    
    // If image attached and vision not supported, warn
    if (window.attachedImageData && !window.supportsVision()) {
      showToast('Current model does not support vision. Try: GPT-4o, Claude 3, or Gemini.', 'warning');
    }
    
    // Call original sendMessage
    return originalSendMessage(p);
  };
  
  // Add vision indicator to UI
  window.addVisionIndicator = function() {
    const containers = [
      document.querySelector('.d-tools'),
      document.querySelector('.m-tools-row')
    ];
    
    containers.forEach(container => {
      if (!container) return;
      
      const indicator = document.createElement('div');
      indicator.id = 'vision-indicator';
      indicator.className = 'd-tool-pill';
      indicator.style.cssText = 'opacity: 0.5; pointer-events: none;';
      indicator.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> Vision';
      
      container.appendChild(indicator);
    });
    
    // Update indicator on model change
    window.updateVisionIndicator = function() {
      const indicators = document.querySelectorAll('#vision-indicator');
      const supported = window.supportsVision();
      
      indicators.forEach(ind => {
        ind.style.opacity = supported ? '1' : '0.3';
        ind.style.color = supported ? 'var(--accent-light)' : '';
        ind.title = supported ? 'Vision enabled for this model' : 'Model does not support vision';
      });
    };
    
    // Hook into model selection
    const originalSetModel = window.setModel;
    window.setModel = function(m) {
      originalSetModel(m);
      setTimeout(window.updateVisionIndicator, 100);
    };
    
    // Initial update
    setTimeout(window.updateVisionIndicator, 1000);
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addVisionIndicator, 2000);
    });
  } else {
    setTimeout(window.addVisionIndicator, 2000);
  }
  
  console.log('[Vision] Module loaded - Image support for all providers');
})();
