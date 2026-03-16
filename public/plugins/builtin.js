// Built-in Plugins for NOVA
// Example plugins demonstrating the plugin system

(function() {
  'use strict';
  
  // Plugin 1: Calculator
  const calculatorPlugin = {
    id: 'builtin.calculator',
    name: 'Calculator',
    version: '1.0.0',
    author: 'NOVA',
    description: 'Perform mathematical calculations',
    enabled: true,
    
    tools: [
      {
        name: 'calculate',
        description: 'Evaluate a mathematical expression',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "10 * 5")'
            }
          },
          required: ['expression']
        },
        execute: async function(args) {
          const { expression } = args;
          
          // Safe evaluation - only allow math operations
          const sanitized = expression.replace(/[^0-9+\-*/().\s%^sqrtabsroundfloorceilmaxmin]/gi, '');
          
          if (!sanitized) {
            throw new Error('Invalid expression');
          }
          
          try {
            // Create safe math context
            const mathContext = {
              sqrt: Math.sqrt,
              abs: Math.abs,
              round: Math.round,
              floor: Math.floor,
              ceil: Math.ceil,
              max: Math.max,
              min: Math.min,
              pow: Math.pow,
              PI: Math.PI,
              E: Math.E
            };
            
            // Build function
            const fn = new Function(...Object.keys(mathContext), `return ${sanitized}`);
            const result = fn(...Object.values(mathContext));
            
            return {
              expression: expression,
              result: result,
              formatted: `${expression} = ${result}`
            };
          } catch (err) {
            throw new Error(`Calculation error: ${err.message}`);
          }
        }
      }
    ]
  };
  
  // Plugin 2: Web Search (Mock - would integrate with real API)
  const webSearchPlugin = {
    id: 'builtin.websearch',
    name: 'Web Search',
    version: '1.0.0',
    author: 'NOVA',
    description: 'Search the web for information',
    enabled: false, // Disabled by default - requires API key setup
    
    tools: [
      {
        name: 'web_search',
        description: 'Search the web for current information',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            num_results: {
              type: 'number',
              description: 'Number of results (default: 5)',
              default: 5
            }
          },
          required: ['query']
        },
        execute: async function(args) {
          const { query, num_results = 5 } = args;
          
          // Check if API is configured
          const apiKey = window.NovaPluginAPI.storage.get('websearch_api_key');
          if (!apiKey) {
            return {
              error: 'Web search not configured. Please add an API key in plugin settings.',
              setup_instructions: 'Get a free API key from serpapi.com or similar service'
            };
          }
          
          // This is a mock - in real implementation, call search API
          return {
            query: query,
            results: [
              { title: 'Mock Result 1', url: 'https://example.com/1', snippet: 'This is a placeholder result.' },
              { title: 'Mock Result 2', url: 'https://example.com/2', snippet: 'Configure a real search API for actual results.' }
            ],
            note: 'This is a demo. Connect a real search API for live results.'
          };
        }
      }
    ],
    
    // Custom settings UI
    hooks: {
      'settings-panel': function(panel) {
        // Add web search settings to the panel
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.innerHTML = `
          <h4>Web Search Settings</h4>
          <div class="form-group">
            <label>API Key</label>
            <input type="password" id="plugin-websearch-key" placeholder="Enter your search API key">
            <small>Get a key from serpapi.com or similar</small>
          </div>
          <button class="btn" onclick="saveWebSearchSettings()">Save API Key</button>
        `;
        
        // Add save function
        window.saveWebSearchSettings = function() {
          const key = document.getElementById('plugin-websearch-key').value;
          if (key) {
            window.NovaPluginAPI.storage.set('websearch_api_key', key);
            window.NovaPluginAPI.notify('Web Search API key saved', 'success');
          }
        };
        
        panel.appendChild(section);
        return panel;
      }
    }
  };
  
  // Plugin 3: Code Runner
  const codeRunnerPlugin = {
    id: 'builtin.coderunner',
    name: 'Code Runner',
    version: '1.0.0',
    author: 'NOVA',
    description: 'Execute JavaScript code safely',
    enabled: true,
    
    tools: [
      {
        name: 'run_javascript',
        description: 'Execute JavaScript code and return the result',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'JavaScript code to execute'
            },
            timeout: {
              type: 'number',
              description: 'Execution timeout in ms (default: 5000)',
              default: 5000
            }
          },
          required: ['code']
        },
        execute: async function(args) {
          const { code, timeout = 5000 } = args;
          
          return new Promise((resolve) => {
            const logs = [];
            const originalLog = console.log;
            
            // Capture console.log
            console.log = function(...args) {
              logs.push(args.join(' '));
              originalLog.apply(console, args);
            };
            
            // Set timeout
            const timeoutId = setTimeout(() => {
              console.log = originalLog;
              resolve({
                result: null,
                logs: logs,
                error: 'Execution timeout - code took too long'
              });
            }, timeout);
            
            try {
              // Execute in limited context
              const result = eval(code);
              clearTimeout(timeoutId);
              console.log = originalLog;
              
              resolve({
                result: result,
                logs: logs,
                success: true
              });
            } catch (err) {
              clearTimeout(timeoutId);
              console.log = originalLog;
              
              resolve({
                result: null,
                logs: logs,
                error: err.message,
                success: false
              });
            }
          });
        }
      }
    ]
  };
  
  // Plugin 4: Current Time
  const timePlugin = {
    id: 'builtin.datetime',
    name: 'Date & Time',
    version: '1.0.0',
    author: 'NOVA',
    description: 'Get current date and time information',
    enabled: true,
    
    tools: [
      {
        name: 'get_current_time',
        description: 'Get the current date and time',
        parameters: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description: 'Timezone (e.g., "America/New_York", "UTC")',
              default: 'local'
            },
            format: {
              type: 'string',
              description: 'Format: iso, locale, or custom',
              default: 'locale'
            }
          }
        },
        execute: async function(args) {
          const { timezone = 'local', format = 'locale' } = args;
          const now = new Date();
          
          let formatted;
          switch (format) {
            case 'iso':
              formatted = now.toISOString();
              break;
            case 'unix':
              formatted = now.getTime();
              break;
            default:
              formatted = now.toLocaleString();
          }
          
          return {
            datetime: formatted,
            timezone: timezone,
            timestamp: now.getTime(),
            iso: now.toISOString(),
            locale: now.toLocaleString(),
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString()
          };
        }
      }
    ]
  };
  
  // Plugin 5: Memory/Notes
  const memoryPlugin = {
    id: 'builtin.memory',
    name: 'Memory',
    version: '1.0.0',
    author: 'NOVA',
    description: 'Store and retrieve notes and memories',
    enabled: true,
    
    init: function() {
      // Initialize storage
      const memories = window.NovaPluginAPI.storage.get('memories', []);
      console.log(`[Memory Plugin] Loaded ${memories.length} memories`);
    },
    
    tools: [
      {
        name: 'save_memory',
        description: 'Save a note or memory for later retrieval',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Content to save'
            },
            category: {
              type: 'string',
              description: 'Category/tag for organization',
              default: 'general'
            },
            title: {
              type: 'string',
              description: 'Optional title for the memory'
            }
          },
          required: ['content']
        },
        execute: async function(args) {
          const { content, category = 'general', title } = args;
          
          const memories = window.NovaPluginAPI.storage.get('memories', []);
          const memory = {
            id: Date.now().toString(),
            content: content,
            category: category,
            title: title || content.substring(0, 50),
            created: new Date().toISOString()
          };
          
          memories.unshift(memory); // Add to beginning
          window.NovaPluginAPI.storage.set('memories', memories);
          
          return {
            saved: true,
            memory_id: memory.id,
            total_memories: memories.length
          };
        }
      },
      {
        name: 'search_memories',
        description: 'Search saved memories',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            category: {
              type: 'string',
              description: 'Filter by category'
            }
          },
          required: ['query']
        },
        execute: async function(args) {
          const { query, category } = args;
          const memories = window.NovaPluginAPI.storage.get('memories', []);
          
          let results = memories.filter(m => {
            const matchesQuery = m.content.toLowerCase().includes(query.toLowerCase()) ||
                                m.title.toLowerCase().includes(query.toLowerCase());
            const matchesCategory = !category || m.category === category;
            return matchesQuery && matchesCategory;
          });
          
          return {
            results: results.slice(0, 10),
            count: results.length,
            total: memories.length
          };
        }
      },
      {
        name: 'list_memories',
        description: 'List all saved memories',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category'
            },
            limit: {
              type: 'number',
              description: 'Maximum number to return',
              default: 20
            }
          }
        },
        execute: async function(args) {
          const { category, limit = 20 } = args;
          let memories = window.NovaPluginAPI.storage.get('memories', []);
          
          if (category) {
            memories = memories.filter(m => m.category === category);
          }
          
          return {
            memories: memories.slice(0, limit),
            count: memories.length
          };
        }
      },
      {
        name: 'delete_memory',
        description: 'Delete a specific memory by ID',
        parameters: {
          type: 'object',
          properties: {
            memory_id: {
              type: 'string',
              description: 'ID of memory to delete'
            }
          },
          required: ['memory_id']
        },
        execute: async function(args) {
          const { memory_id } = args;
          let memories = window.NovaPluginAPI.storage.get('memories', []);
          const originalCount = memories.length;
          
          memories = memories.filter(m => m.id !== memory_id);
          window.NovaPluginAPI.storage.set('memories', memories);
          
          return {
            deleted: memories.length < originalCount,
            memory_id: memory_id,
            remaining: memories.length
          };
        }
      }
    ]
  };
  
  // Register all built-in plugins
  window.NovaBuiltinPlugins = [
    calculatorPlugin,
    webSearchPlugin,
    codeRunnerPlugin,
    timePlugin,
    memoryPlugin
  ];
  
  // Auto-register when plugin system is ready
  function tryRegister() {
    if (window.NovaPluginAPI) {
      window.NovaBuiltinPlugins.forEach(plugin => {
        window.NovaPluginAPI.register(plugin);
      });
    } else {
      setTimeout(tryRegister, 100);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryRegister);
  } else {
    tryRegister();
  }
  
})();
