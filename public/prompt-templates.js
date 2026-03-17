/**
 * Prompt Templates - Library of reusable prompts
 */

(function() {
  'use strict';

  const PromptTemplates = {
    // Built-in templates
    templates: [
      {
        id: 'code_review',
        name: 'Code Review',
        icon: '🔍',
        category: 'Development',
        description: 'Review code for bugs, style, and improvements',
        prompt: 'Review this code for:\n1. Bugs and errors\n2. Code style issues\n3. Performance optimizations\n4. Security concerns\n5. Best practices\n\nCode:\n{{input}}\n\nProvide specific suggestions with line references.'
      },
      {
        id: 'explain_code',
        name: 'Explain Code',
        icon: '📖',
        category: 'Development',
        description: 'Get a detailed explanation of what code does',
        prompt: 'Explain this code in detail:\n\n{{input}}\n\nBreak down:\n1. What it does overall\n2. Key functions/components\n3. How the logic flows\n4. Any important patterns used'
      },
      {
        id: 'refactor',
        name: 'Refactor Code',
        icon: '♻️',
        category: 'Development',
        description: 'Refactor code to improve quality',
        prompt: 'Refactor this code to improve:\n- Readability\n- Maintainability\n- Performance\n- Modern patterns\n\nOriginal:\n{{input}}\n\nProvide the refactored version with explanations of changes.'
      },
      {
        id: 'write_tests',
        name: 'Write Tests',
        icon: '🧪',
        category: 'Development',
        description: 'Generate unit tests for code',
        prompt: 'Write comprehensive unit tests for this code:\n\n{{input}}\n\nInclude tests for:\n1. Happy paths\n2. Edge cases\n3. Error handling\n4. Boundary conditions\n\nUse descriptive test names and arrange-act-assert pattern.'
      },
      {
        id: 'debug',
        name: 'Debug Error',
        icon: '🐛',
        category: 'Development',
        description: 'Help debug errors and exceptions',
        prompt: 'Help debug this error:\n\n{{input}}\n\nProvide:\n1. Root cause analysis\n2. Why this error occurs\n3. How to fix it\n4. How to prevent it'
      },
      {
        id: 'brainstorm',
        name: 'Brainstorm Ideas',
        icon: '💡',
        category: 'Planning',
        description: 'Generate ideas for a topic',
        prompt: 'Brainstorm ideas about: {{input}}\n\nProvide:\n1. 5-10 diverse ideas\n2. Pros/cons for each\n3. Feasibility assessment\n4. Next steps for the best options'
      },
      {
        id: 'summarize',
        name: 'Summarize Text',
        icon: '📝',
        category: 'Writing',
        description: 'Create a concise summary',
        prompt: 'Summarize this text concisely:\n\n{{input}}\n\nCapture the key points in 2-3 bullet points. Maintain accuracy.'
      },
      {
        id: 'email',
        name: 'Write Email',
        icon: '📧',
        category: 'Writing',
        description: 'Draft a professional email',
        prompt: 'Write a professional email about: {{input}}\n\nInclude:\n1. Clear subject line\n2. Professional greeting\n3. Concise body with clear purpose\n4. Call to action\n5. Professional closing'
      },
      {
        id: 'learning_path',
        name: 'Learning Path',
        icon: '🎓',
        category: 'Education',
        description: 'Create a learning roadmap',
        prompt: 'Create a learning path for: {{input}}\n\nStructure:\n1. Prerequisites\n2. Beginner topics (with resources)\n3. Intermediate topics\n4. Advanced topics\n5. Practice projects\n6. Estimated timeline'
      },
      {
        id: 'argument',
        name: 'Analyze Argument',
        icon: '⚖️',
        category: 'Analysis',
        description: 'Analyze pros and cons of a decision',
        prompt: 'Analyze this decision/topic: {{input}}\n\nProvide:\n1. Arguments for (with evidence)\n2. Arguments against (with evidence)\n3. Key considerations\n4. Recommendation with reasoning'
      },
      {
        id: 'sql_query',
        name: 'SQL Query',
        icon: '🗃️',
        category: 'Development',
        description: 'Write or optimize SQL queries',
        prompt: 'Help with this SQL task: {{input}}\n\nProvide:\n1. The SQL query\n2. Explanation of how it works\n3. Performance considerations\n4. Alternative approaches if applicable'
      },
      {
        id: 'regex',
        name: 'Regex Pattern',
        icon: '🔤',
        category: 'Development',
        description: 'Create regular expressions',
        prompt: 'Create a regex pattern for: {{input}}\n\nProvide:\n1. The regex pattern\n2. Explanation of each part\n3. Test cases that match\n4. Test cases that don\'t match'
      }
    ],

    // Get all templates
    getAll() {
      return this.templates;
    },

    // Get by category
    getByCategory(category) {
      return this.templates.filter(t => t.category === category);
    },

    // Get categories
    getCategories() {
      return [...new Set(this.templates.map(t => t.category))];
    },

    // Search templates
    search(query) {
      const q = query.toLowerCase();
      return this.templates.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    },

    // Get template by ID
    get(id) {
      return this.templates.find(t => t.id === id);
    },

    // Use template
    use(templateId, input) {
      const template = this.get(templateId);
      if (!template) return null;
      return template.prompt.replace('{{input}}', input);
    }
  };

  window.PromptTemplates = PromptTemplates;

  // UI
  window.openTemplatesModal = function() {
    const categories = PromptTemplates.getCategories();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'templates-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
        <div class="modal-top"><h2>📋 Prompt Templates</h2><button class="modal-close" onclick="closeTemplatesModal()">&times;</button></div>
        <div class="modal-body">
          <div style="margin-bottom: 16px;">
            <input type="text" id="template-search" placeholder="Search templates..." 
              oninput="filterTemplates(this.value)"
              style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
          </div>
          
          <div id="templates-list" style="display: grid; gap: 10px;">
            ${PromptTemplates.getAll().map(t => `
              <div class="template-card" data-category="${t.category}" style="padding: 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer;"
                onclick="useTemplate('${t.id}')">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="font-size: 24px;">${t.icon}</div>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text);">${t.name}</div>
                    <div style="font-size: 11px; color: var(--accent-light); margin-bottom: 2px;">${t.category}</div>
                    <div style="font-size: 12px; color: var(--muted);">${t.description}</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeTemplatesModal = function() {
    const modal = document.getElementById('templates-modal');
    if (modal) modal.remove();
  };

  window.filterTemplates = function(query) {
    const templates = query ? PromptTemplates.search(query) : PromptTemplates.getAll();
    const list = document.getElementById('templates-list');
    if (list) {
      list.innerHTML = templates.map(t => `
        <div class="template-card" style="padding: 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer;"
          onclick="useTemplate('${t.id}')">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 24px;">${t.icon}</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: var(--text);">${t.name}</div>
              <div style="font-size: 11px; color: var(--accent-light); margin-bottom: 2px;">${t.category}</div>
              <div style="font-size: 12px; color: var(--muted);">${t.description}</div>
            </div>
          </div>
        </div>
      `).join('');
    }
  };

  window.useTemplate = function(id) {
    const template = PromptTemplates.get(id);
    if (!template) return;

    const input = prompt(`${template.name}\n\n${template.description}\n\nEnter your input:`);
    if (!input) return;

    const fullPrompt = PromptTemplates.use(id, input);
    
    // Insert into chat input
    const activeInput = document.querySelector('textarea[id$="-msg-input"]:not([style*="display: none"])');
    if (activeInput) {
      activeInput.value = fullPrompt;
      autoResize(activeInput);
    }

    closeTemplatesModal();
  };

  // Add button to sidebar
  window.addTemplatesButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar && !document.getElementById('templates-btn')) {
      const btn = document.createElement('button');
      btn.id = 'templates-btn';
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '📋 Templates';
      btn.onclick = openTemplatesModal;
      btn.style.marginBottom = '8px';
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };

  setTimeout(addTemplatesButton, 5500);
  console.log('[Prompt Templates] Module loaded');
})();
