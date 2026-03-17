/**
 * Custom Tools - Create your own AI tools
 */

(function() {
  'use strict';

  const CustomTools = {
    // Get custom tools
    getTools() {
      return JSON.parse(localStorage.getItem('nova_custom_tools') || '[]');
    },

    saveTools(tools) {
      localStorage.setItem('nova_custom_tools', JSON.stringify(tools));
    },

    // Create new tool
    create(name, description, prompt, icon = '🔧') {
      const tools = this.getTools();
      const tool = {
        id: 'tool_' + Date.now(),
        name,
        description,
        prompt,
        icon,
        created: Date.now()
      };
      tools.push(tool);
      this.saveTools(tools);
      return tool;
    },

    // Delete tool
    delete(id) {
      const tools = this.getTools().filter(t => t.id !== id);
      this.saveTools(tools);
    },

    // Execute tool
    async execute(toolId, input) {
      const tool = this.getTools().find(t => t.id === toolId);
      if (!tool) return { error: 'Tool not found' };

      // Build full prompt
      const fullPrompt = tool.prompt.replace('{{input}}', input);

      // Send to AI
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: window.state?.provider || 'nova',
            model: window.state?.model || 'auto',
            messages: [
              { role: 'system', content: fullPrompt },
              { role: 'user', content: input }
            ],
            max_tokens: 1000,
            temperature: 0.7
          })
        });

        const data = await res.json();
        return {
          success: true,
          result: data.choices?.[0]?.message?.content || 'No response'
        };
      } catch (err) {
        return { error: err.message };
      }
    }
  };

  window.CustomTools = CustomTools;

  // UI
  window.openCustomToolsModal = function() {
    const tools = CustomTools.getTools();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'custom-tools-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
        <div class="modal-top"><h2>🔧 Custom Tools</h2><button class="modal-close" onclick="closeCustomToolsModal()">&times;</button></div>
        <div class="modal-body">
          <div style="margin-bottom: 20px; padding: 16px; background: var(--surface2); border-radius: var(--radius);">
            <h3 style="margin-bottom: 12px;">Create New Tool</h3>
            <input type="text" id="tool-name" placeholder="Tool name (e.g., Code Reviewer)" style="width: 100%; padding: 10px; margin-bottom: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
            <input type="text" id="tool-desc" placeholder="Description" style="width: 100%; padding: 10px; margin-bottom: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
            <textarea id="tool-prompt" placeholder="System prompt. Use {{input}} for user input..." rows="4" style="width: 100%; padding: 10px; margin-bottom: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); resize: vertical;"></textarea>
            <button onclick="createCustomTool()" style="width: 100%; padding: 10px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">Create Tool</button>
          </div>
          
          <h3 style="margin-bottom: 12px;">Your Tools (${tools.length})</h3>
          <div id="tools-list" style="display: grid; gap: 10px;">
            ${tools.map(t => `
              <div style="padding: 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 600;">${t.icon} ${t.name}</div>
                  <div style="font-size: 12px; color: var(--muted);">${t.description}</div>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button onclick="useCustomTool('${t.id}')" style="padding: 6px 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-size: 12px; cursor: pointer;">Use</button>
                  <button onclick="deleteCustomTool('${t.id}')" style="padding: 6px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--red); font-size: 12px; cursor: pointer;">×</button>
                </div>
              </div>
            `).join('') || '<div style="color: var(--muted);">No custom tools yet</div>'}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeCustomToolsModal = function() {
    const modal = document.getElementById('custom-tools-modal');
    if (modal) modal.remove();
  };

  window.createCustomTool = function() {
    const name = document.getElementById('tool-name').value.trim();
    const desc = document.getElementById('tool-desc').value.trim();
    const prompt = document.getElementById('tool-prompt').value.trim();
    
    if (!name || !prompt) {
      alert('Name and prompt are required');
      return;
    }
    
    CustomTools.create(name, desc, prompt);
    showToast('Tool created!');
    closeCustomToolsModal();
    setTimeout(openCustomToolsModal, 300);
  };

  window.useCustomTool = async function(id) {
    const tool = CustomTools.getTools().find(t => t.id === id);
    if (!tool) return;
    
    const input = prompt(`Enter input for ${tool.name}:`);
    if (!input) return;
    
    showToast(`Running ${tool.name}...`);
    const result = await CustomTools.execute(id, input);
    
    if (result.success) {
      appendMessage('ai', `**${tool.name} Result:**\n\n${result.result}`);
    } else {
      showToast(result.error, 'error');
    }
  };

  window.deleteCustomTool = function(id) {
    if (confirm('Delete this tool?')) {
      CustomTools.delete(id);
      closeCustomToolsModal();
      setTimeout(openCustomToolsModal, 300);
    }
  };

  console.log('[Custom Tools] Module loaded');
})();
