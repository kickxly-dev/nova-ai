/**
 * Plugin Marketplace - Discover and manage plugins
 */

(function() {
  'use strict';

  const PluginMarketplace = {
    // Built-in plugin catalog
    catalog: [
      {
        id: 'weather',
        name: 'Weather',
        description: 'Get real-time weather information for any location',
        author: 'NOVA Team',
        version: '1.0.0',
        icon: '🌤️',
        category: 'utilities',
        installed: false
      },
      {
        id: 'news',
        name: 'News Headlines',
        description: 'Latest news headlines from various sources',
        author: 'NOVA Team',
        version: '1.0.0',
        icon: '📰',
        category: 'utilities',
        installed: false
      },
      {
        id: 'calculator',
        name: 'Calculator',
        description: 'Advanced calculator with math expressions',
        author: 'NOVA Team',
        version: '1.0.0',
        icon: '🧮',
        category: 'utilities',
        installed: false
      },
      {
        id: 'translator',
        name: 'Translator',
        description: 'Translate text between languages',
        author: 'NOVA Team',
        version: '1.0.0',
        icon: '🌐',
        category: 'utilities',
        installed: false
      },
      {
        id: 'stock',
        name: 'Stock Prices',
        description: 'Real-time stock market data',
        author: 'NOVA Team',
        version: '1.0.0',
        icon: '📈',
        category: 'finance',
        installed: false
      },
      {
        id: 'crypto',
        name: 'Crypto Prices',
        description: 'Cryptocurrency prices and charts',
        author: 'NOVA Team',
        version: '1.0.0',
        icon: '₿',
        category: 'finance',
        installed: false
      },
      {
        id: 'wiki',
        name: 'Wikipedia',
        description: 'Search and read Wikipedia articles',
        author: 'NOVA Team',
        version: '1.0.0',
        icon: '📚',
        category: 'knowledge',
        installed: false
      },
      {
        id: 'jokes',
        name: 'Jokes',
        description: 'Get random jokes and humor',
        author: 'NOVA Team',
        version: '1.0.0',
        icon: '😄',
        category: 'entertainment',
        installed: false
      }
    ],

    // Get installed plugins
    getInstalled() {
      return JSON.parse(localStorage.getItem('nova_installed_plugins') || '[]');
    },

    // Save installed plugins
    saveInstalled(plugins) {
      localStorage.setItem('nova_installed_plugins', JSON.stringify(plugins));
    },

    // Install plugin
    install(pluginId) {
      const installed = this.getInstalled();
      const plugin = this.catalog.find(p => p.id === pluginId);
      
      if (!plugin) return false;
      if (installed.includes(pluginId)) return false;
      
      installed.push(pluginId);
      this.saveInstalled(installed);
      
      // Initialize plugin
      this.initializePlugin(plugin);
      
      return true;
    },

    // Uninstall plugin
    uninstall(pluginId) {
      const installed = this.getInstalled().filter(id => id !== pluginId);
      this.saveInstalled(installed);
      return true;
    },

    // Initialize a plugin
    initializePlugin(plugin) {
      // Register command handlers
      window[`plugin_${plugin.id}`] = async (args) => {
        return this.executePlugin(plugin.id, args);
      };
    },

    // Execute plugin command
    async executePlugin(pluginId, args) {
      switch(pluginId) {
        case 'weather':
          return { result: `🌤️ Weather for "${args}": Sunny, 72°F (simulated)` };
        case 'news':
          return { result: '📰 Latest headlines:\n• Tech breakthrough announced\n• Markets reach new highs\n• AI assistant popularity grows' };
        case 'calculator':
          try {
            // eslint-disable-next-line no-eval
            const result = eval(args);
            return { result: `🧮 ${args} = ${result}` };
          } catch {
            return { error: 'Invalid expression' };
          }
        case 'translator':
          return { result: `🌐 Translation: "${args}" → [Translated text would appear here]` };
        case 'stock':
          return { result: `📈 ${args.toUpperCase()}: $150.25 (+2.3%)` };
        case 'crypto':
          return { result: `₿ BTC: $45,230 | ETH: $2,890` };
        case 'wiki':
          return { result: `📚 Wikipedia: "${args}" - [Article summary would appear here]` };
        case 'jokes':
          const jokes = [
            "Why don't scientists trust atoms? Because they make up everything!",
            "Why did the scarecrow win an award? He was outstanding in his field!",
            "Why don't eggs tell jokes? They'd crack each other up!"
          ];
          return { result: `😄 ${jokes[Math.floor(Math.random() * jokes.length)]}` };
        default:
          return { error: 'Unknown plugin' };
      }
    },

    // Get all plugins with installation status
    getPlugins() {
      const installed = this.getInstalled();
      return this.catalog.map(p => ({
        ...p,
        installed: installed.includes(p.id)
      }));
    },

    // Search plugins
    search(query) {
      const q = query.toLowerCase();
      return this.getPlugins().filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    },

    // Get plugin by ID
    getPlugin(id) {
      return this.getPlugins().find(p => p.id === id);
    },

    // Initialize all installed plugins
    initInstalled() {
      const installed = this.getInstalled();
      for (const id of installed) {
        const plugin = this.catalog.find(p => p.id === id);
        if (plugin) this.initializePlugin(plugin);
      }
    }
  };

  // Expose globally
  window.PluginMarketplace = PluginMarketplace;

  // UI
  window.openMarketplaceModal = function() {
    const plugins = PluginMarketplace.getPlugins();
    const categories = [...new Set(plugins.map(p => p.category))];
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'marketplace-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
        <div class="modal-top">
          <h2>🔌 Plugin Marketplace</h2>
          <button class="modal-close" onclick="closeMarketplaceModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <input type="text" id="plugin-search" placeholder="Search plugins..." 
              oninput="searchPlugins(this.value)"
              style="flex: 1; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
          </div>
          
          <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <button onclick="filterPlugins('all')" class="plugin-filter active" style="padding: 6px 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-size: 12px; cursor: pointer;">All</button>
            ${categories.map(c => `<button onclick="filterPlugins('${c}')" class="plugin-filter" style="padding: 6px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; cursor: pointer;">${c}</button>`).join('')}
          </div>
          
          <div id="plugin-list" style="display: grid; gap: 12px;">
            ${plugins.map(p => `
              <div class="plugin-card" data-category="${p.category}" style="padding: 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); display: flex; gap: 12px; align-items: center;">
                <div style="font-size: 32px;">${p.icon}</div>
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: var(--text);">${p.name}</div>
                  <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">${p.description}</div>
                  <div style="font-size: 11px; color: var(--accent-light);">by ${p.author} • v${p.version}</div>
                </div>
                <button onclick="${p.installed ? `uninstallPlugin('${p.id}')` : `installPlugin('${p.id}')`}" 
                  style="padding: 8px 16px; background: ${p.installed ? 'var(--red)' : 'var(--accent)'}; border: none; border-radius: var(--radius-sm); color: ${p.installed ? '#fff' : '#000'}; font-weight: 600; cursor: pointer; font-size: 12px;">
                  ${p.installed ? 'Uninstall' : 'Install'}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeMarketplaceModal = function() {
    const modal = document.getElementById('marketplace-modal');
    if (modal) modal.remove();
  };

  window.searchPlugins = function(query) {
    const results = PluginMarketplace.search(query);
    updatePluginList(results);
  };

  window.filterPlugins = function(category) {
    document.querySelectorAll('.plugin-filter').forEach(b => {
      b.style.background = 'var(--surface2)';
      b.style.color = 'var(--text)';
    });
    event.target.style.background = 'var(--accent)';
    event.target.style.color = '#000';
    
    const plugins = category === 'all' 
      ? PluginMarketplace.getPlugins()
      : PluginMarketplace.getPlugins().filter(p => p.category === category);
    updatePluginList(plugins);
  };

  window.updatePluginList = function(plugins) {
    const list = document.getElementById('plugin-list');
    if (list) {
      list.innerHTML = plugins.map(p => `
        <div class="plugin-card" data-category="${p.category}" style="padding: 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); display: flex; gap: 12px; align-items: center;">
          <div style="font-size: 32px;">${p.icon}</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: var(--text);">${p.name}</div>
            <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">${p.description}</div>
            <div style="font-size: 11px; color: var(--accent-light);">by ${p.author} • v${p.version}</div>
          </div>
          <button onclick="${p.installed ? `uninstallPlugin('${p.id}')` : `installPlugin('${p.id}')`}" 
            style="padding: 8px 16px; background: ${p.installed ? 'var(--red)' : 'var(--accent)'}; border: none; border-radius: var(--radius-sm); color: ${p.installed ? '#fff' : '#000'}; font-weight: 600; cursor: pointer; font-size: 12px;">
            ${p.installed ? 'Uninstall' : 'Install'}
          </button>
        </div>
      `).join('');
    }
  };

  window.installPlugin = function(id) {
    if (PluginMarketplace.install(id)) {
      showToast('Plugin installed!');
      openMarketplaceModal();
    }
  };

  window.uninstallPlugin = function(id) {
    if (PluginMarketplace.uninstall(id)) {
      showToast('Plugin uninstalled');
      openMarketplaceModal();
    }
  };

  // Initialize installed plugins on load
  PluginMarketplace.initInstalled();

  console.log('[Plugin Marketplace] Module loaded');
})();
