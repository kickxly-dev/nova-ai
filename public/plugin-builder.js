// Plugin Builder - Visual plugin creator UI
(function() {
  'use strict';
  
  window.PluginBuilder = {
    // Create plugin from visual builder
    createPlugin(config) {
      const plugin = {
        id: 'custom_' + Date.now(),
        name: config.name,
        description: config.description,
        version: '1.0.0',
        author: 'Custom',
        enabled: true,
        tools: config.tools || [],
        custom: true
      };
      
      // Register with plugin system
      if (window.NovaPluginAPI) {
        NovaPluginAPI.register(plugin);
      }
      
      // Save to localStorage
      const customPlugins = JSON.parse(localStorage.getItem('nova_custom_plugins') || '[]');
      customPlugins.push(plugin);
      localStorage.setItem('nova_custom_plugins', JSON.stringify(customPlugins));
      
      return plugin;
    },
    
    // Generate tool from config
    generateTool(config) {
      return {
        name: config.name,
        description: config.description,
        parameters: config.parameters || {},
        execute: this.generateExecuteFunction(config)
      };
    },
    
    // Generate execute function based on type
    generateExecuteFunction(config) {
      switch (config.type) {
        case 'webhook':
          return async (params) => {
            const url = config.webhookUrl;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(params)
            });
            return await res.json();
          };
          
        case 'api':
          return async (params) => {
            let url = config.apiUrl;
            // Replace parameters in URL
            Object.entries(params).forEach(([key, value]) => {
              url = url.replace(`{${key}}`, encodeURIComponent(value));
            });
            
            const res = await fetch(url, {
              method: config.method || 'GET',
              headers: config.headers || {}
            });
            return await res.json();
          };
          
        case 'javascript':
          return new Function('params', config.code);
          
        case 'transform':
          return async (params) => {
            // Simple data transformation
            let result = config.template || '';
            Object.entries(params).forEach(([key, value]) => {
              result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
            });
            return { result };
          };
          
        default:
          return async () => ({ error: 'Unknown tool type' });
      }
    }
  };
  
  // Open plugin builder
  window.openPluginBuilder = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '700';
    modal.id = 'plugin-builder-modal';
    
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-top"><h2>🔌 Plugin Builder</h2><button class="modal-close" onclick="closePluginBuilder()">&times;</button></div>
        <div class="modal-body">
          <p style="color: var(--muted); margin-bottom: 16px;">Create custom plugins that the AI can use. No coding required!</p>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; color: var(--text); font-weight: 500;">Plugin Name</label>
            <input type="text" id="pb-name" placeholder="My Custom Tool" style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; color: var(--text); font-weight: 500;">Description</label>
            <input type="text" id="pb-description" placeholder="What does this plugin do?" style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 12px; color: var(--text); font-weight: 500;">Tool Type</label>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <label style="padding: 12px; background: var(--surface2); border: 2px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: all 0.2s;" onclick="selectToolType('api', this)">
                <input type="radio" name="tool-type" value="api" style="margin-bottom: 8px;">
                <div style="font-weight: 600; color: var(--text);">📡 API Call</div>
                <div style="font-size: 12px; color: var(--muted);">Fetch data from any API</div>
              </label>
              <label style="padding: 12px; background: var(--surface2); border: 2px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: all 0.2s;" onclick="selectToolType('webhook', this)">
                <input type="radio" name="tool-type" value="webhook" style="margin-bottom: 8px;">
                <div style="font-weight: 600; color: var(--text);">🔗 Webhook</div>
                <div style="font-size: 12px; color: var(--muted);">Send data to external service</div>
              </label>
              <label style="padding: 12px; background: var(--surface2); border: 2px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: all 0.2s;" onclick="selectToolType('transform', this)">
                <input type="radio" name="tool-type" value="transform" style="margin-bottom: 8px;">
                <div style="font-weight: 600; color: var(--text);">🔄 Transformer</div>
                <div style="font-size: 12px; color: var(--muted);">Format and transform data</div>
              </label>
              <label style="padding: 12px; background: var(--surface2); border: 2px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: all 0.2s;" onclick="selectToolType('javascript', this)">
                <input type="radio" name="tool-type" value="javascript" style="margin-bottom: 8px;">
                <div style="font-weight: 600; color: var(--text);">⚡ JavaScript</div>
                <div style="font-size: 12px; color: var(--muted);">Custom code execution</div>
              </label>
            </div>
          </div>
          
          <div id="tool-config" style="display: none;">
            <!-- Dynamic config based on type -->
          </div>
          
          <div style="margin-top: 20px; padding: 16px; background: var(--surface2); border-radius: var(--radius); border: 1px solid var(--border);">
            <h4 style="margin-bottom: 12px; color: var(--text);">Parameters</h4>
            <p style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">Define what inputs your tool needs:</p>
            <div id="pb-parameters" style="display: flex; flex-direction: column; gap: 8px;">
              <!-- Parameters added here -->
            </div>
            <button onclick="addParameter()" style="margin-top: 12px; padding: 8px 16px; background: var(--surface3); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; font-size: 12px;">+ Add Parameter</button>
          </div>
          
          <div style="margin-top: 20px;">
            <button onclick="saveCustomPlugin()" style="width: 100%; padding: 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">Create Plugin</button>
          </div>
        </div>
      </div>
    `;
    
    modal.onclick = closePluginBuilder;
    document.body.appendChild(modal);
    
    // Add first parameter by default
    addParameter();
  };
  
  window.closePluginBuilder = function() {
    const modal = document.getElementById('plugin-builder-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.selectToolType = function(type, el) {
    // Update UI
    document.querySelectorAll('#plugin-builder-modal label').forEach(l => {
      l.style.borderColor = 'var(--border)';
    });
    el.style.borderColor = 'var(--accent)';
    
    const configDiv = document.getElementById('tool-config');
    configDiv.style.display = 'block';
    
    // Show appropriate config
    switch (type) {
      case 'api':
        configDiv.innerHTML = `
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; color: var(--text);">API URL</label>
            <input type="text" id="pb-api-url" placeholder="https://api.example.com/data/{param}" style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
            <p style="font-size: 11px; color: var(--muted); margin-top: 4px;">Use {param} for dynamic values</p>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div>
              <label style="display: block; margin-bottom: 6px; color: var(--text);">Method</label>
              <select id="pb-api-method" style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label style="display: block; margin-bottom: 6px; color: var(--text);">Auth Header (optional)</label>
              <input type="text" id="pb-api-auth" placeholder="Bearer token" style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
            </div>
          </div>
        `;
        break;
        
      case 'webhook':
        configDiv.innerHTML = `
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; color: var(--text);">Webhook URL</label>
            <input type="text" id="pb-webhook-url" placeholder="https://hooks.zapier.com/..." style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; color: var(--text);">Secret (optional)</label>
            <input type="password" id="pb-webhook-secret" placeholder="For signature verification" style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
          </div>
        `;
        break;
        
      case 'transform':
        configDiv.innerHTML = `
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; color: var(--text);">Output Template</label>
            <textarea id="pb-transform-template" placeholder="Result: {{input}} processed" style="width: 100%; height: 100px; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-family: var(--mono);"></textarea>
            <p style="font-size: 11px; color: var(--muted); margin-top: 4px;">Use {{param}} to insert values</p>
          </div>
        `;
        break;
        
      case 'javascript':
        configDiv.innerHTML = `
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; color: var(--text);">JavaScript Code</label>
            <textarea id="pb-js-code" placeholder="// params contains input parameters\nreturn { result: params.input.toUpperCase() };" style="width: 100%; height: 200px; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-family: var(--mono); font-size: 13px;"></textarea>
            <p style="font-size: 11px; color: var(--muted); margin-top: 4px;">Access inputs via params object. Return an object with results.</p>
          </div>
        `;
        break;
    }
  };
  
  window.addParameter = function() {
    const container = document.getElementById('pb-parameters');
    const id = 'param_' + Date.now();
    
    const param = document.createElement('div');
    param.className = 'pb-parameter';
    param.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: center;';
    param.innerHTML = `
      <input type="text" placeholder="Parameter name" class="pb-param-name" style="padding: 8px; background: var(--surface3); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px;">
      <select class="pb-param-type" style="padding: 8px; background: var(--surface3); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px;">
        <option value="string">String</option>
        <option value="number">Number</option>
        <option value="boolean">Boolean</option>
      </select>
      <button onclick="this.parentElement.remove()" style="padding: 8px; background: var(--red); border: none; border-radius: var(--radius-sm); color: #fff; cursor: pointer; font-size: 12px;">×</button>
    `;
    
    container.appendChild(param);
  };
  
  window.saveCustomPlugin = function() {
    const name = document.getElementById('pb-name').value;
    const description = document.getElementById('pb-description').value;
    const type = document.querySelector('input[name="tool-type"]:checked')?.value;
    
    if (!name || !type) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Collect parameters
    const parameters = {};
    document.querySelectorAll('.pb-parameter').forEach(p => {
      const name = p.querySelector('.pb-param-name').value;
      const type = p.querySelector('.pb-param-type').value;
      if (name) {
        parameters[name] = { type, description: name };
      }
    });
    
    // Build tool config
    let toolConfig = {
      name: name.toLowerCase().replace(/\s+/g, '_'),
      description,
      type,
      parameters
    };
    
    // Add type-specific config
    switch (type) {
      case 'api':
        toolConfig.apiUrl = document.getElementById('pb-api-url').value;
        toolConfig.method = document.getElementById('pb-api-method').value;
        toolConfig.headers = {};
        const auth = document.getElementById('pb-api-auth').value;
        if (auth) toolConfig.headers['Authorization'] = auth;
        break;
      case 'webhook':
        toolConfig.webhookUrl = document.getElementById('pb-webhook-url').value;
        break;
      case 'transform':
        toolConfig.template = document.getElementById('pb-transform-template').value;
        break;
      case 'javascript':
        toolConfig.code = document.getElementById('pb-js-code').value;
        break;
    }
    
    // Create plugin
    const plugin = PluginBuilder.createPlugin({
      name,
      description,
      tools: [PluginBuilder.generateTool(toolConfig)]
    });
    
    showToast(`Plugin "${name}" created!`);
    closePluginBuilder();
    
    // Refresh plugin manager if open
    if (typeof NovaPluginManager !== 'undefined') {
      NovaPluginManager.refresh();
    }
  };
  
  // Add plugin builder button to manager
  const originalInit = window.NovaPluginManager?.init;
  if (window.NovaPluginManager) {
    window.NovaPluginManager.init = function() {
      originalInit?.call(this);
      
      // Add builder button
      const panel = document.querySelector('.plugin-manager-panel');
      if (panel) {
        const builderBtn = document.createElement('button');
        builderBtn.className = 'plugin-builder-btn';
        builderBtn.textContent = '+ Create Custom Plugin';
        builderBtn.style.cssText = 'margin-top: 16px; padding: 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer; width: 100%;';
        builderBtn.onclick = openPluginBuilder;
        panel.appendChild(builderBtn);
      }
    };
  }
  
  // Load custom plugins on init
  window.loadCustomPlugins = function() {
    const custom = JSON.parse(localStorage.getItem('nova_custom_plugins') || '[]');
    custom.forEach(p => {
      if (window.NovaPluginAPI && p.enabled !== false) {
        NovaPluginAPI.register(p);
      }
    });
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(loadCustomPlugins, 3000);
    });
  } else {
    setTimeout(loadCustomPlugins, 3000);
  }
  
  console.log('[PluginBuilder] Module loaded - Visual plugin creator');
})();
