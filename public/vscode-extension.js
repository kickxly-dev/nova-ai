// VS Code Extension Support - Use NOVA in your editor
(function() {
  'use strict';
  
  window.VSCodeIntegration = {
    // Extension manifest for VS Code
    getExtensionManifest() {
      return {
        name: "nova-ai-vscode",
        displayName: "NOVA AI",
        description: "Use NOVA AI directly in VS Code",
        version: "1.0.0",
        publisher: "nova-ai",
        engines: {
          vscode: "^1.74.0"
        },
        categories: ["AI", "Chat", "Machine Learning"],
        keywords: ["ai", "chatgpt", "claude", "nova", "assistant"],
        activationEvents: ["onStartupFinished"],
        main: "./out/extension.js",
        contributes: {
          commands: [
            {
              command: "nova.openChat",
              title: "Open NOVA Chat",
              icon: "$(comment-discussion)"
            },
            {
              command: "nova.explainCode",
              title: "Explain Selected Code"
            },
            {
              command: "nova.refactorCode",
              title: "Refactor Selected Code"
            },
            {
              command: "nova.generateTests",
              title: "Generate Tests for Selected Code"
            },
            {
              command: "nova.documentCode",
              title: "Add Documentation"
            }
          ],
          menus: {
            "editor/context": [
              {
                command: "nova.explainCode",
                group: "9_cutcopypaste@5",
                when: "editorHasSelection"
              },
              {
                command: "nova.refactorCode",
                group: "9_cutcopypaste@6",
                when: "editorHasSelection"
              }
            ]
          },
          configuration: {
            title: "NOVA AI",
            properties: {
              "nova.serverUrl": {
                type: "string",
                default: "http://localhost:3000",
                description: "NOVA AI server URL"
              },
              "nova.apiKey": {
                type: "string",
                default: "",
                description: "Your NOVA API key"
              }
            }
          },
          views: {
            "explorer": [
              {
                id: "novaChat",
                name: "NOVA AI",
                when: "nova.enabled"
              }
            ]
          }
        },
        scripts: {
          "vscode:prepublish": "npm run compile",
          compile: "tsc -p ./",
          watch: "tsc -watch -p ./"
        },
        devDependencies: {
          "@types/vscode": "^1.74.0",
          "@types/node": "16.x",
          typescript: "^4.9.4"
        }
      };
    },
    
    // Generate extension code
    getExtensionCode() {
      return `
import * as vscode from 'vscode';
import fetch from 'node-fetch';

let chatPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('nova.openChat', openChat),
    vscode.commands.registerCommand('nova.explainCode', explainCode),
    vscode.commands.registerCommand('nova.refactorCode', refactorCode),
    vscode.commands.registerCommand('nova.generateTests', generateTests),
    vscode.commands.registerCommand('nova.documentCode', documentCode)
  );
}

function openChat() {
  if (chatPanel) {
    chatPanel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  chatPanel = vscode.window.createWebviewPanel(
    'novaChat',
    'NOVA AI',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  const config = vscode.workspace.getConfiguration('nova');
  const serverUrl = config.get('serverUrl') || 'http://localhost:3000';

  chatPanel.webview.html = getWebviewContent(serverUrl);
  
  chatPanel.onDidDispose(() => {
    chatPanel = undefined;
  });
}

async function explainCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showWarningMessage('No code selected');
    return;
  }

  await sendToNova('Explain this code:\n\n' + selection);
}

async function refactorCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.document.getText(editor.selection);
  if (!selection) return;

  await sendToNova('Refactor this code to improve it:\n\n' + selection);
}

async function generateTests() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.document.getText(editor.selection);
  if (!selection) return;

  await sendToNova('Generate unit tests for this code:\n\n' + selection);
}

async function documentCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.document.getText(editor.selection);
  if (!selection) return;

  await sendToNova('Add documentation/comments to this code:\n\n' + selection);
}

async function sendToNova(prompt: string) {
  if (!chatPanel) {
    openChat();
  }

  // Send message to webview
  chatPanel?.webview.postMessage({
    command: 'sendMessage',
    text: prompt
  });
}

function getWebviewContent(serverUrl: string): string {
  return \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; height: 100vh; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe src="\${serverUrl}?vscode=true" sandbox="allow-scripts allow-same-origin"></iframe>
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'sendMessage') {
        // Forward to iframe
        document.querySelector('iframe').contentWindow.postMessage({
          type: 'vscode-prompt',
          text: message.text
        }, '*');
      }
    });
  </script>
</body>
</html>
  \`;
}

export function deactivate() {}
      `;
    },
    
    // Download extension files
    downloadExtension() {
      const files = [
        {
          name: 'package.json',
          content: JSON.stringify(this.getExtensionManifest(), null, 2)
        },
        {
          name: 'src/extension.ts',
          content: this.getExtensionCode()
        },
        {
          name: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              module: "commonjs",
              target: "ES2020",
              lib: ["ES2020"],
              outDir: "out",
              rootDir: "src",
              sourceMap: true,
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              forceConsistentCasingInFileNames: true
            },
            exclude: ["node_modules", ".vscode-test"]
          }, null, 2)
        }
      ];
      
      // Create and download zip
      this.downloadZip(files, 'nova-vscode-extension.zip');
    },
    
    downloadZip(files, filename) {
      // Simple implementation - in real use, use JSZip library
      let content = 'VS Code Extension Files:\n\n';
      files.forEach(f => {
        content += `=== ${f.name} ===\n${f.content}\n\n`;
      });
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace('.zip', '.txt');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };
  
  // Open VS Code extension modal
  window.openVSCodeModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '600';
    modal.id = 'vscode-modal';
    
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
        <div class="modal-top"><h2>💻 VS Code Extension</h2><button class="modal-close" onclick="closeVSCodeModal()">&times;</button></div>
        <div class="modal-body">
          <p style="color: var(--muted); margin-bottom: 16px;">Use NOVA AI directly in Visual Studio Code</p>
          
          <div style="display: grid; gap: 12px; margin-bottom: 20px;">
            <div style="padding: 16px; background: var(--surface2); border-radius: var(--radius); border: 1px solid var(--border);">
              <div style="font-weight: 600; color: var(--text); margin-bottom: 8px;">🚀 Features</div>
              <ul style="margin: 0; padding-left: 20px; color: var(--text2); font-size: 14px; line-height: 1.8;">
                <li>Chat sidebar in VS Code</li>
                <li>Right-click to explain code</li>
                <li>Refactor selected code</li>
                <li>Generate unit tests</li>
                <li>Add documentation</li>
              </ul>
            </div>
            
            <div style="padding: 16px; background: var(--surface2); border-radius: var(--radius); border: 1px solid var(--border);">
              <div style="font-weight: 600; color: var(--text); margin-bottom: 8px;">⚙️ Installation</div>
              <ol style="margin: 0; padding-left: 20px; color: var(--text2); font-size: 14px; line-height: 1.8;">
                <li>Download extension files</li>
                <li>Run <code>npm install</code></li>
                <li>Press F5 to launch</li>
                <li>Or package with <code>vsce package</code></li>
              </ol>
            </div>
          </div>
          
          <div style="display: flex; gap: 8px;">
            <button onclick="VSCodeIntegration.downloadExtension()" style="flex: 1; padding: 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">📥 Download Extension</button>
            <button onclick="copyVSCodeCommand()" style="padding: 12px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">📋 Copy Command ID</button>
          </div>
          
          <div style="margin-top: 16px; padding: 12px; background: var(--accent-glow); border-radius: var(--radius); border: 1px solid rgba(139, 92, 246, 0.2);">
            <p style="margin: 0; font-size: 12px; color: var(--text2);">
              <strong>Note:</strong> The extension connects to your running NOVA server. Make sure NOVA is running locally or deployed.
            </p>
          </div>
        </div>
      </div>
    `;
    
    modal.onclick = closeVSCodeModal;
    document.body.appendChild(modal);
  };
  
  window.closeVSCodeModal = function() {
    const modal = document.getElementById('vscode-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.copyVSCodeCommand = function() {
    navigator.clipboard.writeText('nova.openChat');
    showToast('Command ID copied!');
  };
  
  // Check if running in VS Code webview
  window.isVSCodeWebview = function() {
    return window.location.search.includes('vscode=true') || 
           (window.parent !== window && window.name === 'webview');
  };
  
  // Handle messages from VS Code
  if (window.isVSCodeWebview()) {
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'vscode-prompt') {
        // Auto-fill the prompt
        const input = document.querySelector('#d-msg-input, #m-msg-input');
        if (input) {
          input.value = event.data.text;
          input.dispatchEvent(new Event('input'));
          input.focus();
        }
      }
    });
  }
  
  // Add button to UI
  window.addVSCodeButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar) {
      const btn = document.createElement('button');
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> VS Code Ext';
      btn.onclick = openVSCodeModal;
      btn.style.marginBottom = '8px';
      
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addVSCodeButton, 2000);
    });
  } else {
    setTimeout(window.addVSCodeButton, 2000);
  }
  
  console.log('[VSCode] Module loaded - Extension support for VS Code');
})();
