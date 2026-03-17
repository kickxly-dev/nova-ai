/**
 * Loading Screen - Clean 3-second splash animation
 */

(function() {
  'use strict';

  const LoadingScreen = {
    duration: 3000, // 3 seconds
    
    // Create and show loading screen
    show() {
      // Check if already shown this session
      if (sessionStorage.getItem('nova_loaded')) return;
      
      const loader = document.createElement('div');
      loader.id = 'nova-loader';
      loader.innerHTML = `
        <div class="loader-container">
          <div class="loader-logo">
            <div class="logo-icon">
              <svg viewBox="0 0 100 100" width="80" height="80">
                <defs>
                  <linearGradient id="loaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
                    <stop offset="50%" style="stop-color:#7c3aed;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <rect x="10" y="10" width="80" height="80" rx="20" fill="url(#loaderGrad)" filter="url(#glow)" class="logo-bg"/>
                <text x="50" y="62" text-anchor="middle" fill="white" font-family="Inter, sans-serif" font-weight="700" font-size="40" class="logo-text">N</text>
              </svg>
            </div>
            <div class="logo-pulse"></div>
          </div>
          <div class="loader-brand">
            <span class="brand-name">NOVA</span>
            <span class="brand-tagline">AI Assistant</span>
          </div>
          <div class="loader-progress">
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
            <div class="progress-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      `;
      
      // Styles
      const style = document.createElement('style');
      style.textContent = `
        #nova-loader {
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, #0d0d0f 0%, #141416 50%, #0d0d0f 100%);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: loaderFadeOut 0.5s ease-out 2.8s forwards;
        }
        
        .loader-container {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          animation: loaderScale 0.3s ease-out;
        }
        
        .loader-logo {
          position: relative;
          width: 100px;
          height: 100px;
        }
        
        .logo-icon {
          position: relative;
          z-index: 2;
          animation: logoFloat 2s ease-in-out infinite;
        }
        
        .logo-icon svg {
          animation: logoRotate 3s ease-in-out infinite;
        }
        
        .logo-bg {
          animation: logoPulse 2s ease-in-out infinite;
        }
        
        .logo-text {
          animation: textGlow 1.5s ease-in-out infinite alternate;
        }
        
        .logo-pulse {
          position: absolute;
          inset: -10px;
          border: 2px solid rgba(139, 92, 246, 0.3);
          border-radius: 30px;
          animation: pulseRing 2s ease-out infinite;
        }
        
        .loader-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        
        .brand-name {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: 0.1em;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: textReveal 0.6s ease-out 0.3s both;
        }
        
        .brand-tagline {
          font-size: 14px;
          color: #71717a;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          animation: textReveal 0.6s ease-out 0.5s both;
        }
        
        .loader-progress {
          width: 200px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        
        .progress-bar {
          width: 100%;
          height: 3px;
          background: rgba(139, 92, 246, 0.2);
          border-radius: 2px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #8b5cf6, #ec4899);
          width: 0%;
          animation: progressFill 2.5s ease-out forwards;
        }
        
        .progress-dots {
          display: flex;
          gap: 6px;
        }
        
        .progress-dots span {
          width: 6px;
          height: 6px;
          background: #8b5cf6;
          border-radius: 50%;
          animation: dotPulse 1s ease-in-out infinite;
        }
        
        .progress-dots span:nth-child(2) { animation-delay: 0.2s; }
        .progress-dots span:nth-child(3) { animation-delay: 0.4s; }
        
        /* Animations */
        @keyframes loaderFadeOut {
          to {
            opacity: 0;
            visibility: hidden;
          }
        }
        
        @keyframes loaderScale {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        
        @keyframes logoRotate {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(2deg); }
          75% { transform: rotate(-2deg); }
        }
        
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes textGlow {
          from { filter: drop-shadow(0 0 2px rgba(255,255,255,0.3)); }
          to { filter: drop-shadow(0 0 8px rgba(255,255,255,0.6)); }
        }
        
        @keyframes pulseRing {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        
        @keyframes textReveal {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes progressFill {
          to { width: 100%; }
        }
        
        @keyframes dotPulse {
          0%, 100% { 
            transform: scale(1);
            opacity: 0.5;
          }
          50% { 
            transform: scale(1.2);
            opacity: 1;
          }
        }
      `;
      
      document.head.appendChild(style);
      document.body.appendChild(loader);
      
      // Mark as loaded
      setTimeout(() => {
        sessionStorage.setItem('nova_loaded', 'true');
        loader.remove();
        style.remove();
      }, this.duration);
    }
  };

  // Auto-show on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => LoadingScreen.show());
  } else {
    LoadingScreen.show();
  }

  window.LoadingScreen = LoadingScreen;
  console.log('[Loading Screen] 3-second splash animation ready');
})();
