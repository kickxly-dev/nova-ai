/**
 * Team Workspaces - Collaborative team features
 */

(function() {
  'use strict';

  const TeamWorkspaces = {
    // Get current workspace
    getCurrent() {
      return localStorage.getItem('nova_team_workspace') || null;
    },

    // Set workspace
    setWorkspace(id) {
      localStorage.setItem('nova_team_workspace', id);
    },

    // Get workspace data
    getWorkspace(id) {
      const workspaces = JSON.parse(localStorage.getItem('nova_workspaces') || '[]');
      return workspaces.find(w => w.id === id);
    },

    // Create workspace
    create(name) {
      const workspaces = JSON.parse(localStorage.getItem('nova_workspaces') || '[]');
      const workspace = {
        id: 'ws_' + Date.now(),
        name,
        members: [this.getUserId()],
        created: Date.now(),
        chats: [],
        settings: {}
      };
      workspaces.push(workspace);
      localStorage.setItem('nova_workspaces', JSON.stringify(workspaces));
      this.setWorkspace(workspace.id);
      return workspace;
    },

    // Get user ID
    getUserId() {
      return localStorage.getItem('nova_user_id') || 'user_' + Math.random().toString(36).substr(2, 9);
    },

    // Invite member
    invite(workspaceId, email) {
      const ws = this.getWorkspace(workspaceId);
      if (!ws) return false;
      
      ws.invites = ws.invites || [];
      ws.invites.push({ email, invitedAt: Date.now() });
      
      const workspaces = JSON.parse(localStorage.getItem('nova_workspaces') || '[]');
      const idx = workspaces.findIndex(w => w.id === workspaceId);
      workspaces[idx] = ws;
      localStorage.setItem('nova_workspaces', JSON.stringify(workspaces));
      return true;
    },

    // Share chat to workspace
    shareChat(chatId, workspaceId) {
      const ws = this.getWorkspace(workspaceId);
      if (!ws) return false;
      
      ws.chats = ws.chats || [];
      if (!ws.chats.includes(chatId)) {
        ws.chats.push(chatId);
      }
      
      const workspaces = JSON.parse(localStorage.getItem('nova_workspaces') || '[]');
      const idx = workspaces.findIndex(w => w.id === workspaceId);
      workspaces[idx] = ws;
      localStorage.setItem('nova_workspaces', JSON.stringify(workspaces));
      return true;
    }
  };

  window.TeamWorkspaces = TeamWorkspaces;

  // UI
  window.openWorkspacesModal = function() {
    const current = TeamWorkspaces.getCurrent();
    const workspaces = JSON.parse(localStorage.getItem('nova_workspaces') || '[]');
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'workspaces-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 450px;">
        <div class="modal-top"><h2>👥 Team Workspaces</h2><button class="modal-close" onclick="closeWorkspacesModal()">&times;</button></div>
        <div class="modal-body">
          <div style="margin-bottom: 16px;">
            <button onclick="createWorkspace()" style="width: 100%; padding: 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">+ Create Workspace</button>
          </div>
          
          ${workspaces.length === 0 ? '<div style="color: var(--muted);">No workspaces. Create one to collaborate with your team.</div>' : `
          <div style="display: grid; gap: 8px;">
            ${workspaces.map(w => `
              <div style="padding: 12px; background: var(--surface2); border: 1px solid ${current === w.id ? 'var(--accent)' : 'var(--border)'}; border-radius: var(--radius); cursor: pointer;"
                onclick="switchWorkspace('${w.id}')">
                <div style="font-weight: 600; color: var(--text);">${w.name}</div>
                <div style="font-size: 11px; color: var(--muted);">${w.members.length} members • ${w.chats?.length || 0} shared chats</div>
              </div>
            `).join('')}
          </div>
          `}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeWorkspacesModal = function() {
    const modal = document.getElementById('workspaces-modal');
    if (modal) modal.remove();
  };

  window.createWorkspace = function() {
    const name = prompt('Workspace name:');
    if (name) {
      TeamWorkspaces.create(name);
      showToast('Workspace created!');
      closeWorkspacesModal();
      setTimeout(openWorkspacesModal, 300);
    }
  };

  window.switchWorkspace = function(id) {
    TeamWorkspaces.setWorkspace(id);
    showToast('Switched workspace');
    closeWorkspacesModal();
  };

  // Add button
  window.addWorkspacesButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar && !document.getElementById('workspaces-btn')) {
      const btn = document.createElement('button');
      btn.id = 'workspaces-btn';
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '👥 Workspace';
      btn.onclick = openWorkspacesModal;
      btn.style.marginBottom = '8px';
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };

  setTimeout(addWorkspacesButton, 6500);
  console.log('[Team Workspaces] Module loaded');
})();
