// Collapsible Sidebar - Clean up crowded UI
(function() {
  'use strict';
  
  const SIDEBAR_STATE = {
    collapsed: localStorage.getItem('nova_sidebar_collapsed') === 'true',
    hidden: localStorage.getItem('nova_sidebar_hidden') === 'true'
  };
  
  window.SidebarManager = {
    init() {
      this.addStyles();
      this.addToggleButton();
      this.applyState();
    },
    
    addStyles() {
      const style = document.createElement('style');
      style.textContent = `
        /* Collapsed sidebar styles */
        .d-sidebar.collapsed {
          width: 0 !important;
          min-width: 0 !important;
          overflow: hidden !important;
          border-right: none !important;
          padding: 0 !important;
        }
        
        .d-sidebar.collapsed * {
          opacity: 0;
          pointer-events: none;
        }
        
        /* Sidebar toggle button */
        .sidebar-toggle-btn {
          position: fixed;
          left: 12px;
          top: 12px;
          z-index: 100;
          width: 36px;
          height: 36px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text2);
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        
        .d-sidebar:not(.collapsed) ~ .sidebar-toggle-btn,
        .d-sidebar:not(.collapsed) + * + .sidebar-toggle-btn {
          left: 272px;
        }
        
        .sidebar-toggle-btn:hover {
          background: var(--surface2);
          color: var(--text);
        }
        
        /* Floating sidebar for when collapsed */
        .sidebar-floating {
          position: fixed;
          left: 12px;
          top: 60px;
          width: 260px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 12px;
          z-index: 99;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          display: none;
          flex-direction: column;
          gap: 8px;
          max-height: calc(100vh - 80px);
          overflow-y: auto;
        }
        
        .sidebar-floating.active {
          display: flex;
        }
        
        /* Clean up sidebar bot - group buttons */
        .d-sidebar-bot {
          max-height: 200px;
          overflow-y: auto;
        }
        
        .d-sidebar-bot::-webkit-scrollbar {
          width: 4px;
        }
        
        .d-sidebar-bot::-webkit-scrollbar-thumb {
          background: var(--surface3);
          border-radius: 2px;
        }
        
        /* Compact button style */
        .d-sidebar-bot button {
          padding: 8px 10px;
          font-size: 12px;
        }
        
        /* Group related buttons */
        .sidebar-group {
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 4px;
          margin-bottom: 6px;
        }
        
        .sidebar-group-title {
          font-size: 10px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 6px;
          margin-bottom: 4px;
        }
        
        /* When sidebar is hidden, main area takes full width */
        .d-sidebar.hidden + .d-main,
        .d-sidebar.collapsed + .d-main {
          margin-left: 0;
        }
      `;
      document.head.appendChild(style);
    },
    
    addToggleButton() {
      // Add toggle button
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'sidebar-toggle-btn';
      toggleBtn.id = 'sidebar-toggle-btn';
      toggleBtn.innerHTML = '☰';
      toggleBtn.title = 'Toggle Sidebar (Ctrl+B)';
      toggleBtn.onclick = () => this.toggle();
      
      document.body.appendChild(toggleBtn);
      
      // Add floating sidebar container
      const floatingSidebar = document.createElement('div');
      floatingSidebar.className = 'sidebar-floating';
      floatingSidebar.id = 'sidebar-floating';
      floatingSidebar.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">Hover over ☰ button to see sidebar</div>';
      
      document.body.appendChild(floatingSidebar);
      
      // Hover behavior for floating sidebar
      toggleBtn.addEventListener('mouseenter', () => {
        if (SIDEBAR_STATE.collapsed) {
          document.getElementById('sidebar-floating').classList.add('active');
        }
      });
      
      floatingSidebar.addEventListener('mouseleave', () => {
        floatingSidebar.classList.remove('active');
      });
    },
    
    toggle() {
      SIDEBAR_STATE.collapsed = !SIDEBAR_STATE.collapsed;
      localStorage.setItem('nova_sidebar_collapsed', SIDEBAR_STATE.collapsed);
      this.applyState();
    },
    
    applyState() {
      const sidebar = document.querySelector('.d-sidebar');
      const toggleBtn = document.getElementById('sidebar-toggle-btn');
      
      if (!sidebar) return;
      
      if (SIDEBAR_STATE.collapsed) {
        sidebar.classList.add('collapsed');
        if (toggleBtn) {
          toggleBtn.innerHTML = '☰';
          toggleBtn.style.left = '12px';
        }
      } else {
        sidebar.classList.remove('collapsed');
        if (toggleBtn) {
          toggleBtn.innerHTML = '←';
          toggleBtn.style.left = '272px';
        }
      }
    },
    
    // Group buttons in sidebar
    organizeSidebar() {
      const sidebarBot = document.querySelector('.d-sidebar-bot');
      if (!sidebarBot) return;
      
      // Get all buttons
      const buttons = Array.from(sidebarBot.querySelectorAll('button'));
      
      // Create groups
      const groups = {
        'AI Tools': [],
        'Integrations': [],
        'Export & Share': [],
        'System': []
      };
      
      buttons.forEach(btn => {
        const text = btn.textContent.toLowerCase();
        if (text.includes('agent') || text.includes('workflow') || text.includes('knowledge')) {
          groups['AI Tools'].push(btn);
        } else if (text.includes('github') || text.includes('integration') || text.includes('automation') || text.includes('zapier')) {
          groups['Integrations'].push(btn);
        } else if (text.includes('export') || text.includes('share')) {
          groups['Export & Share'].push(btn);
        } else {
          groups['System'].push(btn);
        }
      });
      
      // Clear and rebuild with groups
      sidebarBot.innerHTML = '';
      
      Object.entries(groups).forEach(([groupName, groupButtons]) => {
        if (groupButtons.length === 0) return;
        
        const groupDiv = document.createElement('div');
        groupDiv.className = 'sidebar-group';
        
        const title = document.createElement('div');
        title.className = 'sidebar-group-title';
        title.textContent = groupName;
        groupDiv.appendChild(title);
        
        groupButtons.forEach(btn => {
          btn.style.marginBottom = '2px';
          groupDiv.appendChild(btn);
        });
        
        sidebarBot.appendChild(groupDiv);
      });
    }
  };
  
  // Keyboard shortcut: Ctrl+B to toggle
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      SidebarManager.toggle();
    }
  });
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        SidebarManager.init();
        SidebarManager.organizeSidebar();
      }, 2500);
    });
  } else {
    setTimeout(() => {
      SidebarManager.init();
      SidebarManager.organizeSidebar();
    }, 2500);
  }
  
  console.log('[SidebarManager] Module loaded - Press Ctrl+B to toggle sidebar');
})();
