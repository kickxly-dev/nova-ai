// AI Agents - Multi-step tasks with tool chaining
(function() {
  'use strict';
  
  // Agent state management
  window.AIAgent = {
    active: false,
    currentTask: null,
    stepCount: 0,
    maxSteps: 10,
    context: {},
    
    // Predefined agent templates
    templates: {
      'research': {
        name: 'Research Agent',
        description: 'Deep research on any topic with web search and synthesis',
        systemPrompt: `You are a Research Agent. Your goal is to thoroughly research topics and provide comprehensive answers.

WORKFLOW:
1. Plan your research approach
2. Search for current information using web search
3. Analyze and synthesize findings
4. Structure your response with clear sections
5. Cite sources when possible

Always think step-by-step and show your reasoning.`,
        tools: ['web_search', 'memory_read'],
        maxSteps: 5
      },
      'code': {
        name: 'Code Agent',
        description: 'Write, debug, and improve code with execution',
        systemPrompt: `You are a Code Agent. You write, test, and debug code.

WORKFLOW:
1. Understand the requirements
2. Write clean, documented code
3. Test by executing the code
4. Fix any errors
5. Optimize and explain the solution

Use the code execution tool to test your solutions.`,
        tools: ['code_execute', 'file_read', 'file_write'],
        maxSteps: 8
      },
      'data': {
        name: 'Data Analysis Agent',
        description: 'Analyze data, create visualizations, find insights',
        systemPrompt: `You are a Data Analysis Agent. You process and analyze data to find insights.

WORKFLOW:
1. Load and validate the data
2. Explore patterns and statistics
3. Create visualizations or summaries
4. Draw actionable conclusions
5. Present findings clearly

Use code execution for data processing.`,
        tools: ['code_execute', 'chart_generate', 'file_read'],
        maxSteps: 6
      },
      'writing': {
        name: 'Writing Agent',
        description: 'Create and refine content with iterative improvement',
        systemPrompt: `You are a Writing Agent. You create, edit, and improve written content.

WORKFLOW:
1. Understand the writing goal and audience
2. Create an outline or first draft
3. Review and self-edit
4. Improve clarity, style, and impact
5. Deliver polished final content

Think about structure, tone, and engagement.`,
        tools: ['memory_read', 'web_search'],
        maxSteps: 4
      }
    },
    
    // Start an agent task
    async start(templateId, userInput) {
      const template = this.templates[templateId];
      if (!template) {
        showToast('Unknown agent type', 'error');
        return;
      }
      
      this.active = true;
      this.currentTask = {
        template: template,
        input: userInput,
        steps: [],
        startTime: Date.now()
      };
      this.stepCount = 0;
      this.context = {};
      
      // Show agent UI
      this.showAgentUI(template.name, userInput);
      
      // Add initial message
      appendMessage('ai', `🤖 **${template.name}** activated\n\n**Task:** ${userInput}\n\n*Starting workflow...*`);
      
      // Begin autonomous execution
      await this.executeStep(userInput);
    },
    
    // Execute a single step
    async executeStep(input) {
      if (!this.active || this.stepCount >= this.maxSteps) {
        this.finish();
        return;
      }
      
      this.stepCount++;
      this.updateAgentStatus(`Step ${this.stepCount}/${this.currentTask.template.maxSteps}`);
      
      // Build messages for this step
      const messages = [
        { 
          role: 'system', 
          content: this.currentTask.template.systemPrompt + 
                   '\n\nYou are on step ' + this.stepCount + ' of ' + this.currentTask.template.maxSteps + 
                   '. Available tools: ' + this.currentTask.template.tools.join(', ')
        },
        { role: 'user', content: input }
      ];
      
      // Add previous steps to context
      this.currentTask.steps.forEach(step => {
        messages.push({ role: 'assistant', content: step.action });
        messages.push({ role: 'user', content: step.result || 'Continue' });
      });
      
      try {
        // Get AI response
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: state.provider,
            model: state.model,
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7,
            userToken: userToken
          })
        });
        
        const data = await res.json();
        const response = data.choices[0].message.content;
        
        // Parse for tool calls
        const toolCall = this.parseToolCall(response);
        
        if (toolCall) {
          // Execute tool
          const toolResult = await this.executeTool(toolCall);
          
          // Store step
          this.currentTask.steps.push({
            step: this.stepCount,
            action: response,
            tool: toolCall,
            result: toolResult,
            timestamp: Date.now()
          });
          
          // Continue with tool result
          await this.executeStep(`Tool result: ${toolResult}\n\nContinue with the task.`);
        } else {
          // Final response
          this.currentTask.steps.push({
            step: this.stepCount,
            action: response,
            result: null,
            timestamp: Date.now()
          });
          
          appendMessage('ai', response);
          
          // Check if done or needs more steps
          if (this.stepCount < this.currentTask.template.maxSteps && 
              !response.toLowerCase().includes('complete') &&
              !response.toLowerCase().includes('done')) {
            await this.executeStep('Continue to next step.');
          } else {
            this.finish();
          }
        }
        
      } catch (err) {
        console.error('Agent step error:', err);
        appendMessage('ai', `❌ Error in step ${this.stepCount}: ${err.message}`);
        this.finish();
      }
    },
    
    // Parse tool call from AI response
    parseToolCall(response) {
      // Look for patterns like: TOOL: web_search(query="...")
      const toolMatch = response.match(/TOOL:\s*(\w+)\(([^)]+)\)/);
      if (toolMatch) {
        const toolName = toolMatch[1];
        const argsStr = toolMatch[2];
        
        // Parse arguments
        const args = {};
        const argMatches = argsStr.matchAll(/(\w+)=["']([^"']+)["']/g);
        for (const match of argMatches) {
          args[match[1]] = match[2];
        }
        
        return { name: toolName, args };
      }
      
      // Alternative: CODE block for code execution
      const codeMatch = response.match(/```(?:python|javascript|js)\n([\s\S]*?)```/);
      if (codeMatch && this.currentTask.template.tools.includes('code_execute')) {
        return { 
          name: 'code_execute', 
          args: { code: codeMatch[1], language: 'javascript' }
        };
      }
      
      return null;
    },
    
    // Execute a tool
    async executeTool(toolCall) {
      switch (toolCall.name) {
        case 'web_search':
          const searchResult = await window.performWebSearchV2(toolCall.args.query);
          return searchResult?.text || 'Search completed';
          
        case 'code_execute':
          const execResult = await window.executeCodeBlock(
            toolCall.args.code, 
            toolCall.args.language || 'javascript'
          );
          return execResult.output || execResult.error || 'Code executed';
          
        case 'memory_read':
          const memory = window.getMemorySummary ? window.getMemorySummary() : '';
          return memory || 'No memory available';
          
        case 'file_read':
          // Use document RAG
          const docs = window.queryDocuments ? window.queryDocuments(toolCall.args.query || '') : [];
          return docs.length > 0 ? JSON.stringify(docs.slice(0, 3)) : 'No relevant files found';
          
        default:
          return `Tool ${toolCall.name} not implemented`;
      }
    },
    
    // Show agent UI
    showAgentUI(name, task) {
      const indicator = document.createElement('div');
      indicator.id = 'agent-indicator';
      indicator.className = 'agent-running';
      indicator.style.cssText = 'position: fixed; top: 16px; right: 16px; padding: 12px 16px; background: var(--accent); color: #000; border-radius: var(--radius); font-weight: 600; z-index: 1000; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); animation: pulse 2s infinite;';
      indicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></span>
          <span>${name}</span>
          <span id="agent-status" style="font-size: 12px; opacity: 0.8;">Running...</span>
        </div>
        <button onclick="AIAgent.stop()" style="margin-top: 8px; padding: 4px 8px; background: rgba(0,0,0,0.2); border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">Stop</button>
      `;
      
      document.body.appendChild(indicator);
    },
    
    // Update agent status
    updateAgentStatus(status) {
      const statusEl = document.getElementById('agent-status');
      if (statusEl) {
        statusEl.textContent = status;
      }
    },
    
    // Stop the agent
    stop() {
      this.active = false;
      const indicator = document.getElementById('agent-indicator');
      if (indicator) {
        indicator.remove();
      }
      showToast('Agent stopped');
    },
    
    // Finish the agent
    finish() {
      this.active = false;
      const indicator = document.getElementById('agent-indicator');
      if (indicator) {
        indicator.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>✅</span>
            <span>Complete</span>
          </div>
        `;
        setTimeout(() => indicator.remove(), 3000);
      }
      
      appendMessage('ai', `✅ **Agent Complete**\n\nCompleted in ${this.stepCount} steps (${Math.round((Date.now() - this.currentTask.startTime) / 1000)}s)`);
    }
  };
  
  // Make globally available
  window.AIAgent = AIAgent;
  
  // Open agent selector
  window.openAgentSelector = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '600';
    modal.id = 'agent-selector-modal';
    
    let content = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
        <div class="modal-top"><h2>🤖 AI Agents</h2><button class="modal-close" onclick="closeAgentSelector()">&times;</button></div>
        <div class="modal-body">
          <p style="color: var(--muted); margin-bottom: 16px;">Agents autonomously complete multi-step tasks using tools.</p>
          <div style="display: grid; gap: 12px;">
    `;
    
    Object.entries(AIAgent.templates).forEach(([id, template]) => {
      content += `
        <div onclick="selectAgent('${id}')" style="padding: 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: all 0.2s;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <span style="font-size: 24px;">${template.name.includes('Research') ? '🔍' : template.name.includes('Code') ? '</>' : template.name.includes('Data') ? '📊' : '✍️'}</span>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: var(--text);">${template.name}</div>
              <div style="font-size: 12px; color: var(--muted);">${template.description}</div>
            </div>
            <span style="font-size: 11px; color: var(--accent);">${template.maxSteps} steps</span>
          </div>
          <div style="font-size: 11px; color: var(--muted2);">Tools: ${template.tools.join(', ')}</div>
        </div>
      `;
    });
    
    content += `
          </div>
          <div style="margin-top: 20px; padding: 12px; background: var(--accent-glow); border-radius: var(--radius); border: 1px solid rgba(139, 92, 246, 0.2);">
            <p style="margin: 0; font-size: 12px; color: var(--text2);">
              <strong>How it works:</strong> Agents run autonomously, executing multiple steps to complete your task. They can search the web, run code, and use other tools.
            </p>
          </div>
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    modal.onclick = closeAgentSelector;
    document.body.appendChild(modal);
  };
  
  window.closeAgentSelector = function() {
    const modal = document.getElementById('agent-selector-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.selectAgent = function(agentId) {
    closeAgentSelector();
    
    // Prompt for task
    const input = prompt(`Enter your task for the ${AIAgent.templates[agentId].name}:`);
    if (input) {
      AIAgent.start(agentId, input);
    }
  };
  
  // Add agent button to UI
  window.addAgentButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar) {
      const btn = document.createElement('button');
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> AI Agents';
      btn.onclick = openAgentSelector;
      btn.style.marginBottom = '8px';
      
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addAgentButton, 2000);
    });
  } else {
    setTimeout(window.addAgentButton, 2000);
  }
  
  console.log('[AI Agents] Module loaded - Autonomous multi-step task execution');
})();
