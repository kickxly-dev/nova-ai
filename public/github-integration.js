// GitHub Integration - Analyze repos, create PRs, manage issues
(function() {
  'use strict';
  
  window.GitHubIntegration = {
    token: localStorage.getItem('nova_github_token'),
    
    // Set GitHub token
    setToken(token) {
      this.token = token;
      localStorage.setItem('nova_github_token', token);
    },
    
    // Make authenticated GitHub API request
    async api(endpoint, options = {}) {
      if (!this.token) {
        throw new Error('GitHub token not set');
      }
      
      const res = await fetch(`https://api.github.com${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `GitHub API error: ${res.status}`);
      }
      
      return await res.json();
    },
    
    // Get repository information
    async getRepo(owner, repo) {
      return await this.api(`/repos/${owner}/${repo}`);
    },
    
    // Get repository contents
    async getContents(owner, repo, path = '') {
      return await this.api(`/repos/${owner}/${repo}/contents/${path}`);
    },
    
    // Get file content
    async getFile(owner, repo, path) {
      const data = await this.api(`/repos/${owner}/${repo}/contents/${path}`);
      if (data.content) {
        return atob(data.content.replace(/\n/g, ''));
      }
      return null;
    },
    
    // Search code in repository
    async searchCode(owner, repo, query) {
      return await this.api(`/search/code?q=${encodeURIComponent(query)}+repo:${owner}/${repo}`);
    },
    
    // Get issues
    async getIssues(owner, repo, state = 'open') {
      return await this.api(`/repos/${owner}/${repo}/issues?state=${state}`);
    },
    
    // Create issue
    async createIssue(owner, repo, title, body, labels = []) {
      return await this.api(`/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        body: JSON.stringify({ title, body, labels })
      });
    },
    
    // Create pull request
    async createPR(owner, repo, title, body, head, base = 'main') {
      return await this.api(`/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        body: JSON.stringify({ title, body, head, base })
      });
    },
    
    // Analyze repository for AI
    async analyzeRepo(owner, repo) {
      showToast(`Analyzing ${owner}/${repo}...`);
      
      try {
        // Get repo info
        const repoInfo = await this.getRepo(owner, repo);
        
        // Get root contents
        const rootContents = await this.getContents(owner, repo);
        
        // Find README
        const readme = rootContents.find(f => f.name.toLowerCase().includes('readme'));
        let readmeContent = '';
        if (readme) {
          readmeContent = await this.getFile(owner, repo, readme.path);
        }
        
        // Get key files (package.json, requirements.txt, etc.)
        const keyFiles = {};
        for (const file of rootContents.slice(0, 10)) {
          if (file.type === 'file' && file.size < 100000) {
            try {
              const content = await this.getFile(owner, repo, file.path);
              keyFiles[file.name] = content.slice(0, 5000);
            } catch (e) {
              // Skip files that can't be read
            }
          }
        }
        
        // Build analysis
        const analysis = {
          repository: {
            name: repoInfo.full_name,
            description: repoInfo.description,
            stars: repoInfo.stargazers_count,
            forks: repoInfo.forks_count,
            language: repoInfo.language,
            url: repoInfo.html_url,
            topics: repoInfo.topics
          },
          readme: readmeContent,
          structure: rootContents.map(f => f.name).join(', '),
          keyFiles: keyFiles
        };
        
        // Format for AI
        let context = `## GitHub Repository Analysis: ${owner}/${repo}\n\n`;
        context += `**Description:** ${analysis.repository.description || 'N/A'}\n`;
        context += `**Language:** ${analysis.repository.language || 'N/A'}\n`;
        context += `**Stars:** ${analysis.repository.stars} | **Forks:** ${analysis.repository.forks}\n`;
        context += `**Topics:** ${analysis.repository.topics?.join(', ') || 'N/A'}\n\n`;
        context += `**Files:** ${analysis.structure}\n\n`;
        
        if (analysis.readme) {
          context += `**README Preview:**\n${analysis.readme.slice(0, 1000)}...\n\n`;
        }
        
        if (Object.keys(keyFiles).length > 0) {
          context += `**Key Files:**\n`;
          Object.entries(keyFiles).forEach(([name, content]) => {
            context += `\n--- ${name} ---\n${content.slice(0, 500)}\n`;
          });
        }
        
        showToast('Repository analyzed!');
        
        return {
          analysis,
          context,
          raw: repoInfo
        };
        
      } catch (err) {
        showToast('Failed to analyze repo: ' + err.message, 'error');
        throw err;
      }
    }
  };
  
  // Open GitHub integration modal
  window.openGitHubModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '600';
    modal.id = 'github-modal';
    
    const hasToken = !!GitHubIntegration.token;
    
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
        <div class="modal-top"><h2>🔗 GitHub Integration</h2><button class="modal-close" onclick="closeGitHubModal()">&times;</button></div>
        <div class="modal-body">
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text); font-weight: 500;">GitHub Personal Access Token</label>
            <input type="password" id="github-token" value="${GitHubIntegration.token || ''}" placeholder="ghp_..." style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
            <p style="font-size: 12px; color: var(--muted); margin-top: 4px;">Create token at github.com/settings/tokens (needs repo, issues, pull_requests scopes)</p>
          </div>
          
          ${hasToken ? `
          <div style="margin-bottom: 20px; padding: 12px; background: var(--accent-glow); border-radius: var(--radius); border: 1px solid rgba(139, 92, 246, 0.2);">
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
              <input type="text" id="gh-owner" placeholder="Owner (e.g., facebook)" style="flex: 1; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
              <input type="text" id="gh-repo" placeholder="Repo (e.g., react)" style="flex: 1; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
            </div>
            <button onclick="analyzeGitHubRepo()" style="width: 100%; padding: 10px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">🔍 Analyze Repository</button>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button onclick="quickGitHubAction('issues')" style="padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">📋 View Issues</button>
            <button onclick="quickGitHubAction('create-issue')" style="padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">➕ Create Issue</button>
            <button onclick="quickGitHubAction('create-pr')" style="padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">🔀 Create PR</button>
            <button onclick="quickGitHubAction('search')" style="padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">🔎 Search Code</button>
          </div>
          ` : `
          <div style="padding: 20px; text-align: center; color: var(--muted);">
            <p>Enter your GitHub token to unlock repository analysis, issue management, and PR creation.</p>
          </div>
          `}
        </div>
        <div class="modal-footer" style="padding: 16px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px;">
          <button onclick="closeGitHubModal()" style="padding: 8px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Close</button>
          <button onclick="saveGitHubToken()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">Save Token</button>
        </div>
      </div>
    `;
    
    modal.onclick = closeGitHubModal;
    document.body.appendChild(modal);
  };
  
  window.closeGitHubModal = function() {
    const modal = document.getElementById('github-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.saveGitHubToken = function() {
    const token = document.getElementById('github-token').value;
    if (token) {
      GitHubIntegration.setToken(token);
      showToast('GitHub token saved');
      closeGitHubModal();
      openGitHubModal();
    }
  };
  
  window.analyzeGitHubRepo = async function() {
    const owner = document.getElementById('gh-owner').value;
    const repo = document.getElementById('gh-repo').value;
    
    if (!owner || !repo) {
      alert('Please enter owner and repository name');
      return;
    }
    
    try {
      const result = await GitHubIntegration.analyzeRepo(owner, repo);
      
      // Add to chat context
      window.pendingGitHubContext = result.context;
      
      // Show in chat
      appendMessage('ai', result.context.slice(0, 2000) + '\n\n*Repository loaded into context. Ask me anything about this codebase!*');
      
      closeGitHubModal();
      
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  
  window.quickGitHubAction = async function(action) {
    const owner = document.getElementById('gh-owner')?.value;
    const repo = document.getElementById('gh-repo')?.value;
    
    if (!owner || !repo) {
      alert('Please enter owner and repository name first');
      return;
    }
    
    switch (action) {
      case 'issues':
        try {
          const issues = await GitHubIntegration.getIssues(owner, repo);
          const summary = issues.slice(0, 10).map(i => `- #${i.number}: ${i.title} (${i.state})`).join('\n');
          appendMessage('ai', `**Issues in ${owner}/${repo}:**\n\n${summary || 'No issues found'}`);
          closeGitHubModal();
        } catch (err) {
          showToast(err.message, 'error');
        }
        break;
        
      case 'create-issue':
        const title = prompt('Issue title:');
        if (title) {
          const body = prompt('Issue body (optional):') || '';
          try {
            const issue = await GitHubIntegration.createIssue(owner, repo, title, body);
            showToast(`Issue #${issue.number} created!`);
            closeGitHubModal();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
        break;
        
      case 'create-pr':
        const prTitle = prompt('PR title:');
        if (prTitle) {
          const prBody = prompt('PR body (optional):') || '';
          const head = prompt('Branch name:');
          if (head) {
            try {
              const pr = await GitHubIntegration.createPR(owner, repo, prTitle, prBody, head);
              showToast(`PR #${pr.number} created!`);
              closeGitHubModal();
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        }
        break;
        
      case 'search':
        const query = prompt('Search query:');
        if (query) {
          try {
            const results = await GitHubIntegration.searchCode(owner, repo, query);
            const summary = results.items?.slice(0, 5).map(i => `- ${i.path}: ${i.text_matches?.[0]?.fragment?.slice(0, 100)}...`).join('\n');
            appendMessage('ai', `**Search results for "${query}":**\n\n${summary || 'No results'}`);
            closeGitHubModal();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
        break;
    }
  };
  
  // Add to tools menu
  window.addGitHubButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar) {
      const btn = document.createElement('button');
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg> GitHub';
      btn.onclick = openGitHubModal;
      btn.style.marginBottom = '8px';
      
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addGitHubButton, 2000);
    });
  } else {
    setTimeout(window.addGitHubButton, 2000);
  }
  
  console.log('[GitHub] Module loaded - Repository analysis and management');
})();
