// Animations Module - Smooth UI transitions
(function() {
  'use strict';
  
  // Inject animation styles
  const style = document.createElement('style');
  style.textContent = `
    /* Smooth transitions */
    .d-chat-item, .m-drawer-item {
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .d-msg, .m-msg {
      animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* Typing indicator animation */
    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .typing-indicator .dot {
      width: 8px;
      height: 8px;
      background: var(--accent);
      border-radius: 50%;
      animation: typingBounce 1.4s ease-in-out infinite;
    }
    
    .typing-indicator .dot:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .typing-indicator .dot:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typingBounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
    
    /* Button hover animations */
    .d-new-btn, .d-send-btn, .m-send-btn, .d-tool-pill {
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .d-new-btn:hover, .d-send-btn:hover:not(:disabled), .m-send-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
    }
    
    .d-new-btn:active, .d-send-btn:active, .m-send-btn:active {
      transform: translateY(0);
    }
    
    /* Modal animations */
    .modal-overlay {
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .modal-overlay.open {
      opacity: 1;
      visibility: visible;
    }
    
    .modal-overlay .modal {
      transform: scale(0.95) translateY(10px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .modal-overlay.open .modal {
      transform: scale(1) translateY(0);
    }
    
    /* Toast animations */
    .toast {
      animation: toastSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    @keyframes toastSlide {
      from {
        opacity: 0;
        transform: translateX(100%) translateY(-50%);
      }
      to {
        opacity: 1;
        transform: translateX(0) translateY(-50%);
      }
    }
    
    /* Welcome screen animations */
    .d-welcome-icon {
      animation: float 3s ease-in-out infinite;
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    .d-welcome {
      animation: fadeIn 0.5s ease forwards;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .d-welcome h1 {
      background-size: 200% auto;
      animation: shimmer 3s linear infinite;
    }
    
    @keyframes shimmer {
      0% { background-position: 0% center; }
      100% { background-position: 200% center; }
    }
    
    /* Suggestion card hover */
    .d-sug-card {
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .d-sug-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
    }
    
    /* Sidebar slide */
    #m-drawer {
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    /* Mobile nav animations */
    .m-icon-btn {
      transition: all 0.2s ease;
    }
    
    .m-icon-btn:hover {
      background: var(--surface2);
      transform: scale(1.05);
    }
    
    .m-icon-btn:active {
      transform: scale(0.95);
    }
    
    /* Input focus glow */
    #d-msg-input:focus, #m-msg-input:focus {
      box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
      transition: box-shadow 0.2s ease;
    }
    
    /* Code block hover reveal */
    pre {
      position: relative;
    }
    
    pre .code-run-btn {
      opacity: 0;
      transform: translateY(-5px);
      transition: all 0.2s ease;
    }
    
    pre:hover .code-run-btn {
      opacity: 1;
      transform: translateY(0);
    }
    
    /* Multi-model comparison cards */
    .multi-model-slot {
      animation: cardSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    @keyframes cardSlide {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    /* Settings sections */
    .settings-section {
      animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* Loading spinner */
    .loading-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--surface2);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* Pulse animation for new features */
    .pulse-new {
      animation: pulse 2s ease-in-out infinite;
    }
    
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
      50% { box-shadow: 0 0 0 8px rgba(139, 92, 246, 0); }
    }
    
    /* Stagger animations for lists */
    .stagger-list > * {
      opacity: 0;
      animation: slideIn 0.3s ease forwards;
    }
    
    .stagger-list > *:nth-child(1) { animation-delay: 0.05s; }
    .stagger-list > *:nth-child(2) { animation-delay: 0.1s; }
    .stagger-list > *:nth-child(3) { animation-delay: 0.15s; }
    .stagger-list > *:nth-child(4) { animation-delay: 0.2s; }
    .stagger-list > *:nth-child(5) { animation-delay: 0.25s; }
    .stagger-list > *:nth-child(6) { animation-delay: 0.3s; }
  `;
  
  document.head.appendChild(style);
  
  // Enhanced message append with animation
  const originalAppendMessage = window.appendMessage;
  window.appendMessage = function(role, content, animate) {
    if (originalAppendMessage) {
      originalAppendMessage(role, content, animate);
    }
    
    // Add stagger animation to chat list
    const chatList = document.querySelector('.d-chat-list, .m-chat-list');
    if (chatList) {
      chatList.classList.add('stagger-list');
    }
  };
  
  // Enhanced typing indicator
  window.showTypingAnimation = function() {
    const messages = document.querySelector('.chat-messages, #d-chat-messages, #m-chat-messages');
    if (!messages) return;
    
    const typing = document.createElement('div');
    typing.className = 'd-msg ai typing-msg';
    typing.innerHTML = `
      <div class="d-msg-content">
        <div class="typing-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    `;
    
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
    
    return typing;
  };
  
  // Smooth scroll to bottom
  window.smoothScrollToBottom = function() {
    const messages = document.querySelector('.chat-messages, #d-chat-messages, #m-chat-messages');
    if (messages) {
      messages.scrollTo({
        top: messages.scrollHeight,
        behavior: 'smooth'
      });
    }
  };
  
  // Page load animation sequence
  window.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';
    
    requestAnimationFrame(() => {
      document.body.style.transition = 'opacity 0.3s ease';
      document.body.style.opacity = '1';
    });
  });
  
  console.log('[Animations] Module loaded - Smooth UI transitions active');
})();
