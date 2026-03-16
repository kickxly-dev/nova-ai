// Voice Input/Output Module
// Speech-to-text and text-to-speech functionality

(function() {
  'use strict';
  
  let recognition = null;
  let synthesis = window.speechSynthesis;
  let isListening = false;
  let isSpeaking = false;
  
  // Check browser support
  const hasSpeechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const hasSpeechSynthesis = 'speechSynthesis' in window;
  
  // Initialize speech recognition
  function initRecognition() {
    if (!hasSpeechRecognition) return null;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = function() {
      isListening = true;
      updateVoiceUI(true);
      showToast('Listening...');
    };
    
    recognition.onresult = function(event) {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      
      // Update input
      ['d-msg-input', 'm-msg-input'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
          input.value = transcript;
          input.dispatchEvent(new Event('input'));
        }
      });
    };
    
    recognition.onerror = function(event) {
      console.error('Speech recognition error:', event.error);
      isListening = false;
      updateVoiceUI(false);
      
      if (event.error === 'not-allowed') {
        showToast('Microphone access denied');
      } else if (event.error === 'no-speech') {
        showToast('No speech detected');
      } else {
        showToast('Voice input error: ' + event.error);
      }
    };
    
    recognition.onend = function() {
      isListening = false;
      updateVoiceUI(false);
    };
    
    return recognition;
  }
  
  // Toggle voice input
  window.toggleVoiceInput = function(platform) {
    if (!hasSpeechRecognition) {
      showToast('Voice input not supported in this browser');
      return;
    }
    
    if (!recognition) {
      recognition = initRecognition();
    }
    
    if (isListening) {
      recognition.stop();
      isListening = false;
      updateVoiceUI(false);
    } else {
      try {
        recognition.start();
      } catch (err) {
        showToast('Could not start voice input');
      }
    }
  };
  
  // Update voice button UI
  function updateVoiceUI(listening) {
    ['d-voice-btn', 'm-voice-btn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.toggle('active', listening);
        btn.style.color = listening ? 'var(--accent)' : '';
      }
    });
  }
  
  // Text-to-speech for AI responses
  window.speakText = function(text) {
    if (!hasSpeechSynthesis) return;
    
    // Stop any current speech
    synthesis.cancel();
    
    // Clean text (remove markdown)
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\n/g, ' ')
      .slice(0, 500); // Limit length
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to find a good voice
    const voices = synthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes('Google') || 
      v.name.includes('Samantha') ||
      v.name.includes('Microsoft') ||
      (v.lang === 'en-US' && v.name.includes('Female'))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onstart = () => { isSpeaking = true; };
    utterance.onend = () => { isSpeaking = false; };
    utterance.onerror = () => { isSpeaking = false; };
    
    synthesis.speak(utterance);
  };
  
  // Stop speaking
  window.stopSpeaking = function() {
    if (hasSpeechSynthesis) {
      synthesis.cancel();
      isSpeaking = false;
    }
  };
  
  // Toggle TTS auto-read for AI responses
  window.ttsEnabled = localStorage.getItem('nova_tts_enabled') === 'true';
  
  window.toggleTTS = function() {
    window.ttsEnabled = !window.ttsEnabled;
    localStorage.setItem('nova_tts_enabled', window.ttsEnabled);
    showToast(window.ttsEnabled ? 'Text-to-speech enabled' : 'Text-to-speech disabled');
    
    if (!window.ttsEnabled) {
      window.stopSpeaking();
    }
  };
  
  // Override appendMessage to auto-speak AI responses
  const originalAppendMessage = window.appendMessage;
  window.appendMessage = function(role, content, animate) {
    // Call original
    if (originalAppendMessage) {
      originalAppendMessage(role, content, animate);
    }
    
    // Speak AI responses if enabled
    if (role === 'ai' && window.ttsEnabled && content && !content.includes('[Image')) {
      window.speakText(content);
    }
  };
  
  // Add TTS button to UI
  window.addTTSButton = function() {
    const pillContainers = [
      document.querySelector('.d-tools'),
      document.querySelector('.m-tools-row')
    ];
    
    pillContainers.forEach(container => {
      if (!container) return;
      
      const btn = document.createElement('div');
      btn.className = 'd-tool-pill' + (window.ttsEnabled ? ' active' : '');
      btn.id = 'tts-pill';
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg> TTS';
      btn.onclick = function() {
        window.toggleTTS();
        this.classList.toggle('active', window.ttsEnabled);
      };
      btn.title = 'Toggle text-to-speech';
      
      container.appendChild(btn);
    });
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addTTSButton, 1000);
    });
  } else {
    setTimeout(window.addTTSButton, 1000);
  }
  
  // Pre-load voices
  if (hasSpeechSynthesis) {
    synthesis.getVoices();
    synthesis.onvoiceschanged = () => synthesis.getVoices();
  }
  
  console.log('[Voice] Module loaded - Speech recognition:', hasSpeechRecognition, 'TTS:', hasSpeechSynthesis);
})();
