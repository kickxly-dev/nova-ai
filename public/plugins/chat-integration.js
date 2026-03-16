// Plugin Chat Integration
// Handles function calling and tool execution for AI chat

(function() {
  'use strict';
  
  // Check if plugin system is available
  function waitForPluginSystem() {
    return new Promise((resolve) => {
      if (window.NovaPluginAPI) {
        resolve();
        return;
      }
      
      window.addEventListener('nova-plugins-ready', () => {
        resolve();
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        console.warn('[Plugin Chat] Plugin system not ready, continuing without plugins');
        resolve();
      }, 5000);
    });
  }
  
  // Format tools for OpenAI-compatible function calling
  function formatToolsForAI() {
    if (!window.NovaPluginAPI) return [];
    
    const tools = window.NovaPluginAPI.getTools();
    if (!tools || tools.length === 0) return [];
    
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || {
          type: 'object',
          properties: {}
        }
      }
    }));
  }
  
  // Check if message contains function call request
  function parseFunctionCall(text) {
    // Look for patterns like: <function>name({"arg": "value"})</function>
    // or: call_function("name", {"arg": "value"})
    // or in markdown code blocks
    
    const patterns = [
      /<function>(\w+)\s*\((\{[^}]*\})\)<\/function>/i,
      /<function>(\w+)\s*\((.*)\)<\/function>/is,
      /```(?:json)?\s*\{\s*"function":\s*"(\w+)"\s*,\s*"arguments":\s*(\{[^}]*\})\s*\}\s*```/i,
      /call_function\s*\(\s*"(\w+)"\s*,\s*(\{[^}]*\})\s*\)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          name: match[1],
          arguments: match[2] ? JSON.parse(match[2]) : {}
        };
      }
    }
    
    return null;
  }
  
  // Enhanced chat request with plugin support
  window.sendChatWithPlugins = async function(provider, model, messages, options = {}) {
    await waitForPluginSystem();
    
    const tools = formatToolsForAI();
    const hasTools = tools && tools.length > 0;
    
    if (hasTools) {
      console.log(`[Plugin Chat] ${tools.length} tools available for AI`);
    }
    
    // First request - let AI decide if it needs tools
    const requestBody = {
      provider: provider,
      model: model,
      messages: messages,
      max_tokens: options.max_tokens || 1500,
      temperature: options.temperature || 0.7,
      userToken: options.userToken
    };
    
    // Add tools if available and provider supports function calling
    if (hasTools && provider !== 'ollama') {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }
    
    try {
      let res, data, reply;
      
      // Check if it's Ollama (direct browser connection)
      if (provider === 'ollama') {
        const ollamaMessages = messages.map(m => ({ role: m.role, content: m.content }));
        
        // Add system message about tools if available
        if (hasTools) {
          const toolDescriptions = tools.map(t => 
            `- ${t.function.name}: ${t.function.description}`
          ).join('\n');
          
          ollamaMessages.unshift({
            role: 'system',
            content: `You have access to the following tools:\n${toolDescriptions}\n\nTo use a tool, respond with: <function>tool_name({"arg": "value"})</function>`
          });
        }
        
        res = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model || 'llama3.2',
            messages: ollamaMessages,
            stream: false
          })
        });
        
        if (!res.ok) throw new Error('Ollama not running at 127.0.0.1:11434');
        
        const ollamaData = await res.json();
        reply = ollamaData.message?.content || '';
        
        // Check if reply contains a function call
        const functionCall = parseFunctionCall(reply);
        if (functionCall) {
          console.log(`[Plugin Chat] Detected function call: ${functionCall.name}`);
          
          // Execute the tool
          const toolResult = await window.NovaPluginAPI.executeTool(
            functionCall.name,
            functionCall.arguments
          );
          
          // Send follow-up with tool result
          const followUpMessages = [
            ...messages,
            { role: 'assistant', content: reply },
            { role: 'user', content: `Tool result: ${JSON.stringify(toolResult)}` }
          ];
          
          return await window.sendChatWithPlugins(provider, model, followUpMessages, options);
        }
        
        return { content: reply, usedTools: false };
        
      } else {
        // Server-based providers with proper function calling
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        if (!res.ok) {
          const e = await res.json();
          throw new Error((e.error && e.error.message) || `HTTP ${res.status}`);
        }
        
        data = await res.json();
        
        // Check if AI requested a function call
        const toolCalls = data.choices[0].message?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          console.log(`[Plugin Chat] AI requested ${toolCalls.length} tool call(s)`);
          
          // Execute all requested tools
          const toolResults = [];
          for (const toolCall of toolCalls) {
            if (toolCall.function) {
              const name = toolCall.function.name;
              const args = JSON.parse(toolCall.function.arguments || '{}');
              
              console.log(`[Plugin Chat] Executing: ${name}`);
              const result = await window.NovaPluginAPI.executeTool(name, args);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: JSON.stringify(result)
              });
            }
          }
          
          // Send follow-up request with tool results
          const followUpMessages = [
            ...messages,
            data.choices[0].message,
            ...toolResults
          ];
          
          return await window.sendChatWithPlugins(provider, model, followUpMessages, options);
        }
        
        return { 
          content: data.choices[0].message.content,
          usedTools: false
        };
      }
      
    } catch (err) {
      console.error('[Plugin Chat] Error:', err);
      throw err;
    }
  };
  
  // Convenience function for simple chat
  window.chatWithPlugins = async function(messages, options = {}) {
    const provider = window.state?.provider || 'openrouter';
    const model = window.state?.model;
    
    return await window.sendChatWithPlugins(provider, model, messages, {
      userToken: window.userToken,
      ...options
    });
  };
  
  // Expose for debugging
  window._pluginChat = {
    formatTools: formatToolsForAI,
    parseFunctionCall: parseFunctionCall
  };
  
})();
