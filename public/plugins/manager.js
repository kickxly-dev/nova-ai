// Plugin Manager UI for NOVA
// Provides interface for managing plugins

(function() {
  'use strict';
  
  // Plugin Manager UI Component
  window.NovaPluginManager = {
    open: function() {
      createPluginModal();
    },
    
    close: function() {
      const modal = document.getElementById('plugin-manager-modal');
      if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
      }
    },
    
    refresh: function() {
      renderPluginList();
    }
  };
  
  function createPluginModal() {
    // Remove existing
    const existing = document.getElementById('plugin-manager-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'plugin-manager-modal';
    modal.className = 'plugin-modal-overlay';
    modal.innerHTML = `
      <div class="plugin-modal-box" onclick="event.stopPropagation()">
        <button class="plugin-modal-close" onclick="NovaPluginManager.close()">&times;</button>
        
        <div class="plugin-modal-header">
          <h2>Plugin Manager</h2>
          <p>Enable or disable plugins to extend NOVA's capabilities</p>
        </div>
        
        <div class="plugin-modal-body">
          <div class="plugin-toolbar">
            <input type="text" id="plugin-search" placeholder="Search plugins..." onkeyup="filterPlugins()">
            <span id="plugin-count">Loading...</span>
          </div>
          
          <div id="plugin-list" class="plugin-list">
            <!-- Plugins rendered here -->
          </div>
          
          <div class="plugin-details" id="plugin-details" style="display:none;">
            <h3 id="detail-name">Plugin Name</h3>
            <p id="detail-description">Description</p>
            <div id="detail-tools" class="detail-tools"></div>
            <div id="detail-hooks" class="detail-hooks"></div>
          </div>
        </div>
        
        <div class="plugin-modal-footer">
          <button class="plugin-btn plugin-btn-secondary" onclick="NovaPluginManager.close()">Close</button>
          <button class="plugin-btn plugin-btn-primary" onclick="NovaPluginManager.refresh()">Refresh</button>
        </div>
      </div>
    `;
    
    // Close on outside click
    modal.onclick = function() {
      NovaPluginManager.close();
    };
    
    document.body.appendChild(modal);
    
    // Trigger animation
    setTimeout(() => {
      modal.classList.add('active');
      renderPluginList();
    }, 10);
  }
  
  function renderPluginList() {
    const list = document.getElementById('plugin-list');
    const count = document.getElementById('plugin-count');
    
    if (!list || !window.NovaPluginAPI) {
      if (list) list.innerHTML = '<div class="plugin-item"><p>Plugin system not ready...</p></div>';
      return;
    }
    
    const plugins = window.NovaPluginAPI.getAll();
    
    if (plugins.length === 0) {
      list.innerHTML = '<div class="plugin-empty"><p>No plugins installed</p><small>Plugins extend NOVA with custom tools and functions</small></div>';
      count.textContent = '0 plugins';
      return;
    }
    
    count.textContent = `${plugins.length} plugin${plugins.length !== 1 ? 's' : ''} (${plugins.filter(p => p.enabled).length} active)`;
    
    list.innerHTML = plugins.map(plugin => `
      <div class="plugin-item ${plugin.enabled ? 'enabled' : 'disabled'}" data-id="${plugin.id}">
        <div class="plugin-item-header">
          <div class="plugin-item-info">
            <h4>${escapeHtml(plugin.name)}</h4>
            <span class="plugin-version">v${escapeHtml(plugin.version)}</span>
            <span class="plugin-author">by ${escapeHtml(plugin.author)}</span>
          </div>
          <label class="plugin-toggle">
            <input type="checkbox" ${plugin.enabled ? 'checked' : ''} 
                   onchange="togglePlugin('${plugin.id}', this.checked)">
            <span class="plugin-toggle-slider"></span>
          </label>
        </div>
        <p class="plugin-description">${escapeHtml(plugin.description)}</p>
        <div class="plugin-item-meta">
          <span class="plugin-tools">${plugin.tools ? plugin.tools.length : 0} tools</span>
          ${plugin.hooks && Object.keys(plugin.hooks).length > 0 ? 
            `<span class="plugin-hooks">${Object.keys(plugin.hooks).length} hooks</span>` : ''}
          <button class="plugin-details-btn" onclick="showPluginDetails('${plugin.id}')">Details</button>
        </div>
      </div>
    `).join('');
  }
  
  // Global functions for UI
  window.togglePlugin = function(pluginId, enabled) {
    if (window.NovaPluginAPI) {
      window.NovaPluginAPI.setEnabled(pluginId, enabled);
      renderPluginList();
      
      const plugin = window.NovaPluginAPI.get(pluginId);
      window.NovaPluginAPI.notify(
        `${plugin.name} ${enabled ? 'enabled' : 'disabled'}`,
        'success'
      );
    }
  };
  
  window.filterPlugins = function() {
    const search = document.getElementById('plugin-search').value.toLowerCase();
    const items = document.querySelectorAll('.plugin-item');
    
    items.forEach(item => {
      const id = item.dataset.id;
      const plugin = window.NovaPluginAPI ? window.NovaPluginAPI.get(id) : null;
      
      if (!plugin) return;
      
      const matches = plugin.name.toLowerCase().includes(search) ||
                      plugin.description.toLowerCase().includes(search) ||
                      plugin.author.toLowerCase().includes(search);
      
      item.style.display = matches ? 'block' : 'none';
    });
  };
  
  window.showPluginDetails = function(pluginId) {
    const plugin = window.NovaPluginAPI ? window.NovaPluginAPI.get(pluginId) : null;
    if (!plugin) return;
    
    const details = document.getElementById('plugin-details');
    document.getElementById('detail-name').textContent = plugin.name;
    document.getElementById('detail-description').textContent = plugin.description;
    
    // Tools
    const toolsEl = document.getElementById('detail-tools');
    if (plugin.tools && plugin.tools.length > 0) {
      toolsEl.innerHTML = `
        <h5>Tools (${plugin.tools.length})</h5>
        ${plugin.tools.map(tool => `
          <div class="detail-tool-item">
            <strong>${escapeHtml(tool.name)}</strong>
            <p>${escapeHtml(tool.description)}</p>
          </div>
        `).join('')}
      `;
    } else {
      toolsEl.innerHTML = '<p>No tools provided</p>';
    }
    
    // Hooks
    const hooksEl = document.getElementById('detail-hooks');
    if (plugin.hooks && Object.keys(plugin.hooks).length > 0) {
      hooksEl.innerHTML = `
        <h5>Hooks (${Object.keys(plugin.hooks).length})</h5>
        <ul>
          ${Object.keys(plugin.hooks).map(hook => `<li>${escapeHtml(hook)}</li>`).join('')}
        </ul>
      `;
    } else {
      hooksEl.innerHTML = '';
    }
    
    details.style.display = 'block';
  };
  
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Listen for plugin system ready
  window.addEventListener('nova-plugins-ready', function() {
    console.log('[Plugin Manager] Plugin system ready');
  });
  
})();
