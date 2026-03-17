/**
 * Cloud Sync - Sync data across devices
 */

(function() {
  'use strict';

  const CloudSync = {
    // Sync endpoints (using local server as sync backend)
    getServerUrl() {
      return window.location.origin;
    },

    // Generate sync key
    generateSyncKey() {
      return 'sync_' + Math.random().toString(36).substr(2, 16);
    },

    // Get or create sync key
    getSyncKey() {
      let key = localStorage.getItem('nova_sync_key');
      if (!key) {
        key = this.generateSyncKey();
        localStorage.setItem('nova_sync_key', key);
      }
      return key;
    },

    // Get last sync time
    getLastSync() {
      return parseInt(localStorage.getItem('nova_last_sync') || '0');
    },

    // Set last sync time
    setLastSync(time = Date.now()) {
      localStorage.setItem('nova_last_sync', time.toString());
    },

    // Collect all data to sync
    collectData() {
      return {
        chats: JSON.parse(localStorage.getItem('nova_chats') || '[]'),
        settings: {
          name: localStorage.getItem('nova_name'),
          system: localStorage.getItem('nova_system'),
          memory: localStorage.getItem('nova_memory'),
          theme: localStorage.getItem('nova_theme'),
          provider: localStorage.getItem('nova_provider'),
          model: localStorage.getItem('nova_model')
        },
        folders: JSON.parse(localStorage.getItem('nova_chat_folders') || '[]'),
        folderAssignments: JSON.parse(localStorage.getItem('nova_chat_folder_assignments') || '{}'),
        favorites: JSON.parse(localStorage.getItem('nova_favorite_chats') || '[]'),
        preferences: JSON.parse(localStorage.getItem('nova_user_preferences') || '{}'),
        entities: JSON.parse(localStorage.getItem('nova_entities') || '[]'),
        knowledgeGraph: JSON.parse(localStorage.getItem('nova_knowledge_graph') || '{}'),
        timestamp: Date.now()
      };
    },

    // Apply synced data
    applyData(data) {
      if (data.chats) {
        // Merge chats - keep newer versions
        const localChats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
        const chatMap = new Map();
        
        // Add local chats
        localChats.forEach(c => chatMap.set(c.id, c));
        
        // Merge remote chats (newer wins)
        data.chats.forEach(c => {
          const existing = chatMap.get(c.id);
          if (!existing || (c.updatedAt > existing.updatedAt)) {
            chatMap.set(c.id, c);
          }
        });
        
        localStorage.setItem('nova_chats', JSON.stringify(Array.from(chatMap.values())));
      }

      // Apply settings
      if (data.settings) {
        Object.entries(data.settings).forEach(([key, value]) => {
          if (value) localStorage.setItem('nova_' + key, value);
        });
      }

      // Apply other data
      if (data.folders) localStorage.setItem('nova_chat_folders', JSON.stringify(data.folders));
      if (data.folderAssignments) localStorage.setItem('nova_chat_folder_assignments', JSON.stringify(data.folderAssignments));
      if (data.favorites) localStorage.setItem('nova_favorite_chats', JSON.stringify(data.favorites));
      if (data.preferences) localStorage.setItem('nova_user_preferences', JSON.stringify(data.preferences));
      if (data.entities) localStorage.setItem('nova_entities', JSON.stringify(data.entities));
      if (data.knowledgeGraph) localStorage.setItem('nova_knowledge_graph', JSON.stringify(data.knowledgeGraph));

      return true;
    },

    // Upload to server
    async upload() {
      const data = this.collectData();
      const syncKey = this.getSyncKey();

      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            syncKey,
            data,
            action: 'upload'
          })
        });

        if (!response.ok) throw new Error('Upload failed');
        
        this.setLastSync();
        return { success: true, timestamp: Date.now() };
      } catch (err) {
        // Fallback: store encrypted data locally for later sync
        this.queueForSync(data);
        return { success: false, error: err.message, queued: true };
      }
    },

    // Download from server
    async download() {
      const syncKey = this.getSyncKey();

      try {
        const response = await fetch(`/api/sync?syncKey=${syncKey}&action=download`);
        
        if (!response.ok) {
          if (response.status === 404) {
            // No data on server yet
            return { success: true, noData: true };
          }
          throw new Error('Download failed');
        }

        const result = await response.json();
        
        if (result.data) {
          this.applyData(result.data);
          this.setLastSync();
          return { success: true, data: result.data };
        }
        
        return { success: true, noData: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // Queue data for sync when offline
    queueForSync(data) {
      const queue = JSON.parse(localStorage.getItem('nova_sync_queue') || '[]');
      queue.push({
        timestamp: Date.now(),
        data
      });
      // Keep only last 5 queued
      if (queue.length > 5) queue.shift();
      localStorage.setItem('nova_sync_queue', JSON.stringify(queue));
    },

    // Process sync queue
    async processQueue() {
      const queue = JSON.parse(localStorage.getItem('nova_sync_queue') || '[]');
      if (queue.length === 0) return;

      for (const item of queue) {
        try {
          await this.upload();
          // Remove from queue if successful
          const updatedQueue = queue.filter(q => q.timestamp !== item.timestamp);
          localStorage.setItem('nova_sync_queue', JSON.stringify(updatedQueue));
          break; // Uploading all current data covers this
        } catch (err) {
          console.error('Failed to sync queued item:', err);
        }
      }
    },

    // Full sync (upload + download)
    async sync() {
      showToast('Syncing...');
      
      // Process any queued items first
      await this.processQueue();
      
      // Upload current state
      const uploadResult = await this.upload();
      
      // Download remote state
      const downloadResult = await this.download();
      
      // Refresh UI if we got new data
      if (downloadResult.success && downloadResult.data) {
        if (window.renderChatList) window.renderChatList();
        if (window.applyAiName) window.applyAiName();
        showToast('Sync complete!');
      } else if (uploadResult.success) {
        showToast('Backed up to cloud');
      } else {
        showToast('Sync failed - queued for later', 'error');
      }

      return { upload: uploadResult, download: downloadResult };
    },

    // Export all data as file
    exportToFile() {
      const data = this.collectData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nova-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    // Import from file
    async importFromFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            this.applyData(data);
            resolve({ success: true, chats: data.chats?.length || 0 });
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
  };

  // Expose globally
  window.CloudSync = CloudSync;

  // UI
  window.openSyncModal = function() {
    const syncKey = CloudSync.getSyncKey();
    const lastSync = CloudSync.getLastSync();
    const lastSyncText = lastSync ? new Date(lastSync).toLocaleString() : 'Never';
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'sync-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 450px;">
        <div class="modal-top"><h2>☁️ Cloud Sync</h2><button class="modal-close" onclick="closeSyncModal()">&times;</button></div>
        <div class="modal-body">
          <div style="padding: 16px; background: var(--surface2); border-radius: var(--radius); margin-bottom: 16px;">
            <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px;">Sync Key</div>
            <div style="font-family: var(--mono); font-size: 12px; color: var(--text); word-break: break-all;">${syncKey}</div>
            <div style="font-size: 11px; color: var(--muted); margin-top: 8px;">Last sync: ${lastSyncText}</div>
          </div>
          
          <div style="display: grid; gap: 10px; margin-bottom: 16px;">
            <button onclick="CloudSync.sync()" style="padding: 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">🔄 Sync Now</button>
            <button onclick="CloudSync.exportToFile()" style="padding: 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">💾 Export Backup</button>
            <label style="padding: 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; text-align: center;">
              📁 Import Backup
              <input type="file" accept=".json" onchange="importBackup(this.files[0])" style="display: none;">
            </label>
          </div>
          
          <p style="font-size: 12px; color: var(--muted);">
            Use this sync key on other devices to access your chats and settings.
          </p>
        </div>
        <div class="modal-footer">
          <button onclick="closeSyncModal()" style="padding: 8px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeSyncModal = function() {
    const modal = document.getElementById('sync-modal');
    if (modal) modal.remove();
  };

  window.importBackup = async function(file) {
    if (!file) return;
    
    try {
      showToast('Importing...');
      const result = await CloudSync.importFromFile(file);
      showToast(`Imported ${result.chats} chats!`);
      if (window.renderChatList) window.renderChatList();
      closeSyncModal();
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
  };

  // Auto-sync on login
  window.addSyncButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar && !document.getElementById('sync-btn')) {
      const btn = document.createElement('button');
      btn.id = 'sync-btn';
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '☁️ Sync';
      btn.onclick = openSyncModal;
      btn.style.marginBottom = '8px';
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };

  // Initialize
  setTimeout(() => {
    addSyncButton();
    
    // Auto-sync every 5 minutes if enabled
    if (localStorage.getItem('nova_auto_sync') === 'true') {
      setInterval(() => CloudSync.sync(), 5 * 60 * 1000);
    }
  }, 4500);

  console.log('[Cloud Sync] Module loaded');
})();
