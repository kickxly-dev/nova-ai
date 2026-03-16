// Workflows - Save and replay prompt sequences
(function() {
  'use strict';
  
  window.WorkflowManager = {
    workflows: JSON.parse(localStorage.getItem('nova_workflows') || '[]'),
    
    save() {
      localStorage.setItem('nova_workflows', JSON.stringify(this.workflows));
    },
    
    // Create new workflow
    create(name, description, steps) {
      const workflow = {
        id: Date.now().toString(),
        name,
        description,
        steps: steps || [],
        created: Date.now(),
        runs: 0
      };
      this.workflows.push(workflow);
      this.save();
      return workflow;
    },
    
    // Delete workflow
    delete(id) {
      this.workflows = this.workflows.filter(w => w.id !== id);
      this.save();
    },
    
    // Update workflow
    update(id, updates) {
      const idx = this.workflows.findIndex(w => w.id === id);
      if (idx >= 0) {
        this.workflows[idx] = { ...this.workflows[idx], ...updates };
        this.save();
      }
    },
    
    // Run workflow
    async run(workflowId, variables = {}) {
      const workflow = this.workflows.find(w => w.id === workflowId);
      if (!workflow) {
        showToast('Workflow not found', 'error');
        return;
      }
      
      showToast(`Running workflow: ${workflow.name}`);
      
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        
        // Replace variables in prompt
        let prompt = step.prompt;
        Object.entries(variables).forEach(([key, value]) => {
          prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });
        
        // Execute step
        if (step.type === 'ai') {
          await this.runAIStep(prompt, step.model);
        } else if (step.type === 'tool') {
          await this.runToolStep(step.tool, step.args);
        } else if (step.type === 'input') {
          const userInput = prompt('Workflow input: ' + prompt);
          variables[step.variable] = userInput;
        }
        
        // Wait between steps if needed
        if (step.delay) {
          await new Promise(r => setTimeout(r, step.delay));
        }
      }
      
      workflow.runs++;
      this.save();
      
      showToast(`Workflow "${workflow.name}" complete!`);
    },
    
    async runAIStep(prompt, model) {
      const messages = [
        { role: 'system', content: state.systemPrompt },
        { role: 'user', content: prompt }
      ];
      
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: state.provider,
            model: model || state.model,
            messages,
            max_tokens: 2000,
            temperature: 0.7,
            userToken: userToken
          })
        });
        
        const data = await res.json();
        const response = data.choices[0].message.content;
        
        appendMessage('ai', `**[Workflow Step]**\n${response}`);
        
        return response;
      } catch (err) {
        console.error('Workflow step error:', err);
        throw err;
      }
    },
    
    async runToolStep(tool, args) {
      // Execute various tools
      switch (tool) {
        case 'web_search':
          return await window.performWebSearchV2(args.query);
        case 'save_memory':
          if (window.extractMemoryFacts) {
            window.extractMemoryFacts(args.fact, '');
          }
          return 'Memory saved';
        default:
          return 'Tool executed';
      }
    },
    
    // Get example workflows
    getTemplates() {
      return [
        {
          name: 'Blog Post Creator',
          description: 'Research, outline, and write a complete blog post',
          steps: [
            { type: 'input', prompt: 'Enter blog topic:', variable: 'topic' },
            { type: 'ai', prompt: 'Research and create an outline for a blog post about: {{topic}}', model: 'gpt-4o' },
            { type: 'ai', prompt: 'Write the full blog post based on the outline above about {{topic}}. Include engaging introduction, clear sections, and compelling conclusion.', model: 'gpt-4o' }
          ]
        },
        {
          name: 'Code Review Workflow',
          description: 'Analyze, suggest improvements, and create tests',
          steps: [
            { type: 'input', prompt: 'Paste code to review:', variable: 'code' },
            { type: 'ai', prompt: 'Review this code and identify bugs, security issues, and performance problems:\n\n{{code}}' },
            { type: 'ai', prompt: 'Suggest specific improvements and refactored version of the code.' },
            { type: 'ai', prompt: 'Write unit tests for this code.' }
          ]
        },
        {
          name: 'Deep Research',
          description: 'Multi-step research with synthesis',
          steps: [
            { type: 'input', prompt: 'Research topic:', variable: 'topic' },
            { type: 'tool', tool: 'web_search', args: { query: '{{topic}} latest news 2025' } },
            { type: 'ai', prompt: 'Based on the search results, identify key themes and questions to explore about {{topic}}' },
            { type: 'ai', prompt: 'Create a comprehensive research summary with sources and actionable insights about {{topic}}' }
          ]
        },
        {
          name: 'Email Sequence',
          description: 'Create a 3-part email marketing sequence',
          steps: [
            { type: 'input', prompt: 'Product/Service:', variable: 'product' },
            { type: 'input', prompt: 'Target audience:', variable: 'audience' },
            { type: 'ai', prompt: 'Write email #1 (Welcome/Education) for {{product}} targeting {{audience}}' },
            { type: 'ai', prompt: 'Write email #2 (Value/Case Study) for {{product}} targeting {{audience}}' },
            { type: 'ai', prompt: 'Write email #3 (CTO/Offer) for {{product}} targeting {{audience}}' }
          ]
        }
      ];
    }
  };
  
  // Make globally available
  window.WorkflowManager = WorkflowManager;
  
  // Open workflow manager
  window.openWorkflowManager = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '600';
    modal.id = 'workflow-manager-modal';
    
    let content = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 700px;">
        <div class="modal-top"><h2>⚡ Workflows</h2><button class="modal-close" onclick="closeWorkflowManager()">&times;</button></div>
        <div class="modal-body">
          <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button onclick="createNewWorkflow()" style="padding: 10px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">+ New Workflow</button>
            <button onclick="showWorkflowTemplates()" style="padding: 10px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">📋 Templates</button>
          </div>
          
          <div id="workflows-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto;">
    `;
    
    if (WorkflowManager.workflows.length === 0) {
      content += '<p style="color: var(--muted); text-align: center; padding: 32px;">No workflows yet. Create one or use a template!</p>';
    } else {
      WorkflowManager.workflows.forEach(wf => {
        content += `
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--surface2); border-radius: var(--radius-sm); border: 1px solid var(--border);">
            <div style="flex: 1;">
              <div style="font-weight: 600; color: var(--text);">${wf.name}</div>
              <div style="font-size: 12px; color: var(--muted);">${wf.description || ''} • ${wf.steps.length} steps • ${wf.runs} runs</div>
            </div>
            <button onclick="WorkflowManager.run('${wf.id}')" style="padding: 6px 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-size: 12px; cursor: pointer;">▶ Run</button>
            <button onclick="editWorkflow('${wf.id}')" style="padding: 6px 12px; background: var(--surface3); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; cursor: pointer;">Edit</button>
            <button onclick="deleteWorkflowConfirm('${wf.id}')" style="padding: 6px 12px; background: var(--red); border: none; border-radius: var(--radius-sm); color: #fff; font-size: 12px; cursor: pointer;">🗑</button>
          </div>
        `;
      });
    }
    
    content += `
          </div>
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    modal.onclick = closeWorkflowManager;
    document.body.appendChild(modal);
  };
  
  window.closeWorkflowManager = function() {
    const modal = document.getElementById('workflow-manager-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.createNewWorkflow = function() {
    const name = prompt('Workflow name:');
    if (!name) return;
    
    const description = prompt('Description (optional):');
    
    WorkflowManager.create(name, description, []);
    closeWorkflowManager();
    openWorkflowManager();
    showToast('Workflow created! Click Edit to add steps.');
  };
  
  window.showWorkflowTemplates = function() {
    const templates = WorkflowManager.getTemplates();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '650';
    modal.id = 'workflow-templates-modal';
    
    let content = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
        <div class="modal-top"><h2>📋 Workflow Templates</h2><button class="modal-close" onclick="closeWorkflowTemplates()">&times;</button></div>
        <div class="modal-body">
          <p style="color: var(--muted); margin-bottom: 16px;">Choose a template to get started quickly:</p>
          <div style="display: flex; flex-direction: column; gap: 12px;">
    `;
    
    templates.forEach((tpl, idx) => {
      content += `
        <div onclick="useTemplate(${idx})" style="padding: 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: all 0.2s;">
          <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">${tpl.name}</div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 8px;">${tpl.description}</div>
          <div style="font-size: 11px; color: var(--accent);">${tpl.steps.length} steps</div>
        </div>
      `;
    });
    
    content += `
          </div>
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    modal.onclick = closeWorkflowTemplates;
    document.body.appendChild(modal);
  };
  
  window.closeWorkflowTemplates = function() {
    const modal = document.getElementById('workflow-templates-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.useTemplate = function(idx) {
    const templates = WorkflowManager.getTemplates();
    const tpl = templates[idx];
    
    WorkflowManager.create(tpl.name, tpl.description, tpl.steps);
    closeWorkflowTemplates();
    closeWorkflowManager();
    openWorkflowManager();
    showToast(`Created workflow: ${tpl.name}`);
  };
  
  window.editWorkflow = function(id) {
    const wf = WorkflowManager.workflows.find(w => w.id === id);
    if (!wf) return;
    
    alert(`Workflow Editor\n\nWorkflow: ${wf.name}\n\nSteps:\n${wf.steps.map((s, i) => `${i + 1}. ${s.type}: ${s.prompt?.slice(0, 50) || s.tool}...`).join('\n')}\n\n(Visual editor coming in next update!)`);
  };
  
  window.deleteWorkflowConfirm = function(id) {
    if (confirm('Delete this workflow?')) {
      WorkflowManager.delete(id);
      closeWorkflowManager();
      openWorkflowManager();
      showToast('Workflow deleted');
    }
  };
  
  // Add workflow button to UI
  window.addWorkflowButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar) {
      const btn = document.createElement('button');
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Workflows';
      btn.onclick = openWorkflowManager;
      btn.style.marginBottom = '8px';
      
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addWorkflowButton, 2000);
    });
  } else {
    setTimeout(window.addWorkflowButton, 2000);
  }
  
  console.log('[Workflows] Module loaded - Save and replay prompt sequences');
})();
