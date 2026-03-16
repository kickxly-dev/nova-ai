// Code Execution - Run Python/JavaScript directly in chat
(function() {
  'use strict';
  
  // Code block execution
  window.executeCodeBlock = async function(code, language) {
    if (language === 'javascript' || language === 'js') {
      return executeJavaScript(code);
    } else if (language === 'python' || language === 'py') {
      return executePython(code);
    } else {
      return { error: 'Execution not supported for ' + language };
    }
  };
  
  // Execute JavaScript safely
  function executeJavaScript(code) {
    const output = [];
    const errors = [];
    let result = null;
    
    // Create safe console
    const safeConsole = {
      log: (...args) => output.push(args.map(a => String(a)).join(' ')),
      error: (...args) => errors.push(args.map(a => String(a)).join(' ')),
      warn: (...args) => output.push('⚠️ ' + args.map(a => String(a)).join(' '))
    };
    
    try {
      // Wrap in function with safe console
      const wrappedCode = `
        (function(console) {
          ${code}
        })(arguments[0])
      `;
      
      result = eval(wrappedCode);
      
      // Convert result to string if needed
      if (result !== undefined && output.length === 0) {
        output.push(String(result));
      }
      
      return {
        output: output.join('\n') || 'undefined',
        error: errors.length > 0 ? errors.join('\n') : null,
        result: result
      };
    } catch (err) {
      return {
        output: output.join('\n') || '',
        error: err.message,
        result: null
      };
    }
  }
  
  // Execute Python (using Pyodide if available, otherwise server)
  async function executePython(code) {
    // Check if Pyodide is loaded
    if (window.pyodide) {
      try {
        // Redirect stdout
        window.pyodide.setStdout({ batched: (text) => console.log(text) });
        window.pyodide.setStderr({ batched: (text) => console.error(text) });
        
        const result = await window.pyodide.runPythonAsync(code);
        
        return {
          output: String(result) || 'Code executed successfully',
          error: null,
          result: result
        };
      } catch (err) {
        return {
          output: '',
          error: err.message,
          result: null
        };
      }
    }
    
    // Fall back to server execution
    try {
      const res = await fetch('/api/execute/python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      if (!res.ok) throw new Error('Server execution failed');
      return await res.json();
    } catch (err) {
      return {
        output: '',
        error: 'Python execution not available. Install Pyodide or configure server execution.',
        result: null
      };
    }
  }
  
  // Load Pyodide on demand
  window.loadPyodide = async function() {
    if (window.pyodide) return window.pyodide;
    
    showToast('Loading Python runtime...', 'info');
    
    try {
      // Load from CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      
      window.pyodide = await loadPyodide();
      showToast('Python runtime ready!');
      
      return window.pyodide;
    } catch (err) {
      console.error('Failed to load Pyodide:', err);
      showToast('Failed to load Python runtime', 'error');
      return null;
    }
  };
  
  // Add run buttons to code blocks
  window.addCodeRunButtons = function() {
    // Observer to watch for new code blocks
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element
            const codeBlocks = node.matches?.('pre code') ? [node] : node.querySelectorAll?.('pre code') || [];
            codeBlocks.forEach(addRunButtonToCodeBlock);
          }
        });
      });
    });
    
    // Observe chat messages
    const chatArea = document.querySelector('.chat-messages, #d-chat-messages, #m-chat-messages');
    if (chatArea) {
      observer.observe(chatArea, { childList: true, subtree: true });
    }
    
    // Add buttons to existing blocks
    document.querySelectorAll('pre code').forEach(addRunButtonToCodeBlock);
  };
  
  function addRunButtonToCodeBlock(block) {
    const pre = block.parentElement;
    if (!pre || pre.querySelector('.code-run-btn')) return;
    
    // Detect language
    let language = 'javascript';
    const className = block.className || '';
    if (className.includes('python') || className.includes('py')) language = 'python';
    else if (className.includes('js') || className.includes('javascript')) language = 'javascript';
    else if (className.includes('ts') || className.includes('typescript')) language = 'javascript';
    else return; // Only JS and Python supported
    
    // Create run button
    const btn = document.createElement('button');
    btn.className = 'code-run-btn';
    btn.style.cssText = 'position: absolute; top: 8px; right: 8px; padding: 6px 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-size: 11px; font-weight: 600; cursor: pointer; opacity: 0; transition: opacity 0.2s;';
    btn.innerHTML = '▶ Run ' + language;
    btn.onclick = async () => {
      const code = block.textContent;
      
      if (language === 'python') {
        await window.loadPyodide();
      }
      
      btn.innerHTML = '⏳ Running...';
      btn.disabled = true;
      
      const result = await window.executeCodeBlock(code, language);
      
      btn.innerHTML = '▶ Run ' + language;
      btn.disabled = false;
      
      showCodeExecutionResult(result, pre);
    };
    
    pre.style.position = 'relative';
    pre.appendChild(btn);
    
    // Show button on hover
    pre.addEventListener('mouseenter', () => btn.style.opacity = '1');
    pre.addEventListener('mouseleave', () => btn.style.opacity = '0');
  }
  
  function showCodeExecutionResult(result, codeBlock) {
    // Remove existing output
    const existing = codeBlock.nextElementSibling;
    if (existing?.classList.contains('code-output')) {
      existing.remove();
    }
    
    // Create output element
    const output = document.createElement('div');
    output.className = 'code-output';
    output.style.cssText = 'margin-top: -8px; margin-bottom: 16px; background: var(--surface2); border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius-sm) var(--radius-sm); padding: 12px; font-family: var(--mono); font-size: 13px;';
    
    if (result.error) {
      output.innerHTML = `
        <div style="color: var(--red); margin-bottom: 8px;">❌ Error</div>
        <pre style="color: var(--red); margin: 0; white-space: pre-wrap;">${escapeHtml(result.error)}</pre>
      `;
    } else {
      output.innerHTML = `
        <div style="color: var(--green); margin-bottom: 8px;">✅ Output</div>
        <pre style="color: var(--text); margin: 0; white-space: pre-wrap;">${escapeHtml(result.output)}</pre>
      `;
    }
    
    codeBlock.parentNode.insertBefore(output, codeBlock.nextSibling);
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Add code execution to tools
  window.addCodeExecutionTool = function() {
    const containers = [
      document.querySelector('.d-tools'),
      document.querySelector('.m-tools-row')
    ];
    
    containers.forEach(container => {
      if (!container) return;
      
      const btn = document.createElement('div');
      btn.className = 'd-tool-pill';
      btn.id = 'code-exec-toggle';
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> Code Exec';
      btn.title = 'Enable code execution in chat';
      btn.onclick = function() {
        this.classList.toggle('active');
        const enabled = this.classList.contains('active');
        localStorage.setItem('nova_code_exec_enabled', enabled);
        showToast(enabled ? 'Code execution enabled' : 'Code execution disabled');
        
        if (enabled) {
          window.addCodeRunButtons();
        }
      };
      
      // Check if previously enabled
      if (localStorage.getItem('nova_code_exec_enabled') === 'true') {
        btn.classList.add('active');
        setTimeout(window.addCodeRunButtons, 1000);
      }
      
      container.appendChild(btn);
    });
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addCodeExecutionTool, 2000);
    });
  } else {
    setTimeout(window.addCodeExecutionTool, 2002);
  }
  
  console.log('[CodeExecution] Module loaded - Run Python/JS in chat');
})();
