// NOVA Plugin System
// Allows custom tools/functions to extend AI capabilities

(function() {
  'use strict';

  // Plugin registry
  const plugins = new Map();
  const hooks = new Map();
  
  // Plugin API exposed to plugins
  window.NovaPluginAPI = {
    // Register a plugin
    register: function(plugin) {
      if (!plugin.id || !plugin.name) {
        console.error('Plugin must have id and name');
        return false;
      }
      
      if (plugins.has(plugin.id)) {
        console.warn(`Plugin ${plugin.id} already registered, overwriting`);
      }
      
      plugin.enabled = plugin.enabled !== false; // default true
      plugin.version = plugin.version || '1.0.0';
      plugin.author = plugin.author || 'Unknown';
      plugin.description = plugin.description || '';
      plugin.tools = plugin.tools || [];
      plugin.hooks = plugin.hooks || {};
      
      plugins.set(plugin.id, plugin);
      
      // Register hooks
      if (plugin.hooks) {
        Object.keys(plugin.hooks).forEach(hookName => {
          if (!hooks.has(hookName)) {
            hooks.set(hookName, []);
          }
          hooks.get(hookName).push({
            pluginId: plugin.id,
            handler: plugin.hooks[hookName]
          });
        });
      }
      
      console.log(`[Plugin] Registered: ${plugin.name} v${plugin.version}`);
      
      // Initialize if enabled
      if (plugin.enabled && plugin.init) {
        try {
          plugin.init();
        } catch (err) {
          console.error(`[Plugin] Init error for ${plugin.id}:`, err);
        }
      }
      
      return true;
    },
    
    // Unregister a plugin
    unregister: function(pluginId) {
      const plugin = plugins.get(pluginId);
      if (!plugin) return false;
      
      // Cleanup
      if (plugin.destroy) {
        try {
          plugin.destroy();
        } catch (err) {
          console.error(`[Plugin] Destroy error for ${pluginId}:`, err);
        }
      }
      
      // Remove hooks
      hooks.forEach((handlers, hookName) => {
        const filtered = handlers.filter(h => h.pluginId !== pluginId);
        hooks.set(hookName, filtered);
      });
      
      plugins.delete(pluginId);
      console.log(`[Plugin] Unregistered: ${pluginId}`);
      return true;
    },
    
    // Enable/disable plugin
    setEnabled: function(pluginId, enabled) {
      const plugin = plugins.get(pluginId);
      if (!plugin) return false;
      
      plugin.enabled = enabled;
      
      if (enabled && plugin.init && !plugin._initialized) {
        plugin.init();
        plugin._initialized = true;
      }
      
      // Save to localStorage
      savePluginState();
      
      return true;
    },
    
    // Get all plugins
    getAll: function() {
      return Array.from(plugins.values());
    },
    
    // Get plugin by ID
    get: function(pluginId) {
      return plugins.get(pluginId);
    },
    
    // Execute hook
    executeHook: function(hookName, context) {
      const handlers = hooks.get(hookName) || [];
      let result = context;
      
      handlers.forEach(({ pluginId, handler }) => {
        const plugin = plugins.get(pluginId);
        if (plugin && plugin.enabled) {
          try {
            result = handler(result) || result;
          } catch (err) {
            console.error(`[Plugin] Hook error in ${pluginId}.${hookName}:`, err);
          }
        }
      });
      
      return result;
    },
    
    // Get all enabled tools for AI function calling
    getTools: function() {
      const tools = [];
      plugins.forEach(plugin => {
        if (plugin.enabled && plugin.tools) {
          plugin.tools.forEach(tool => {
            tools.push({
              ...tool,
              pluginId: plugin.id
            });
          });
        }
      });
      return tools;
    },
    
    // Execute a tool
    executeTool: async function(toolName, args) {
      // Find tool
      let tool = null;
      let plugin = null;
      
      plugins.forEach(p => {
        if (p.enabled && p.tools) {
          const t = p.tools.find(tool => tool.name === toolName);
          if (t) {
            tool = t;
            plugin = p;
          }
        }
      });
      
      if (!tool || !tool.execute) {
        throw new Error(`Tool ${toolName} not found`);
      }
      
      console.log(`[Plugin] Executing ${toolName} from ${plugin.name}`);
      
      try {
        const result = await tool.execute(args);
        return {
          success: true,
          result: result,
          plugin: plugin.name
        };
      } catch (err) {
        console.error(`[Plugin] Tool error ${toolName}:`, err);
        return {
          success: false,
          error: err.message,
          plugin: plugin.name
        };
      }
    },
    
    // Show UI notification
    notify: function(message, type = 'info') {
      if (window.showToast) {
        window.showToast(message, type);
      } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
      }
    },
    
    // Storage for plugins (namespaced)
    storage: {
      get: function(key, defaultValue = null) {
        const data = localStorage.getItem(`nova_plugin_${key}`);
        return data ? JSON.parse(data) : defaultValue;
      },
      set: function(key, value) {
        localStorage.setItem(`nova_plugin_${key}`, JSON.stringify(value));
      },
      remove: function(key) {
        localStorage.removeItem(`nova_plugin_${key}`);
      }
    }
  };
  
  // Save plugin states to localStorage
  function savePluginState() {
    const states = {};
    plugins.forEach((plugin, id) => {
      states[id] = {
        enabled: plugin.enabled
      };
    });
    localStorage.setItem('nova_plugin_states', JSON.stringify(states));
  }
  
  // Load plugin states from localStorage
  function loadPluginState() {
    const data = localStorage.getItem('nova_plugin_states');
    return data ? JSON.parse(data) : {};
  }
  
  // Apply saved states
  const savedStates = loadPluginState();
  
  // Override register to apply saved states
  const originalRegister = window.NovaPluginAPI.register;
  window.NovaPluginAPI.register = function(plugin) {
    if (savedStates[plugin.id] !== undefined) {
      plugin.enabled = savedStates[plugin.id].enabled;
    }
    return originalRegister.call(this, plugin);
  };
  
  // Initialize plugin system
  function init() {
    console.log('[Plugin System] Initialized');
    
    // Load built-in plugins
    loadBuiltinPlugins();
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('nova-plugins-ready'));
  }
  
  // Load built-in plugins
  function loadBuiltinPlugins() {
    // Built-in plugins will be defined in separate files or below
    if (window.NovaBuiltinPlugins) {
      window.NovaBuiltinPlugins.forEach(plugin => {
        window.NovaPluginAPI.register(plugin);
      });
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Expose to global for debugging
  window._novaPlugins = plugins;
  window._novaHooks = hooks;
  
})();
