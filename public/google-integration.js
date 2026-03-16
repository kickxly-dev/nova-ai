// Google Integration - Sheets, Calendar, Drive
(function() {
  'use strict';
  
  window.GoogleIntegration = {
    accessToken: localStorage.getItem('nova_google_token'),
    
    // OAuth scopes for different services
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive.file'
    ].join(' '),
    
    setClientId(id) {
      localStorage.setItem('nova_google_client_id', id);
    },
    
    getClientId() {
      return localStorage.getItem('nova_google_client_id');
    },
    
    // Authenticate with Google
    async authenticate() {
      const clientId = this.getClientId();
      if (!clientId) {
        alert('Please set your Google Client ID first');
        return false;
      }
      
      const redirectUri = encodeURIComponent('https://nova-ai-yhow.onrender.com');
      const scope = encodeURIComponent(this.scopes);
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&prompt=consent&state=google_auth`;
      
      const popup = window.open(authUrl, 'google_auth', 'width=600,height=700');
      
      return new Promise((resolve) => {
        const checkToken = setInterval(() => {
          const token = localStorage.getItem('nova_google_token');
          if (token && token !== this.accessToken) {
            this.accessToken = token;
            clearInterval(checkToken);
            if (popup) popup.close();
            resolve(true);
          }
        }, 1000);
        
        setTimeout(() => {
          clearInterval(checkToken);
          resolve(false);
        }, 120000);
      });
    },
    
    // === GOOGLE SHEETS ===
    async appendToSheet(spreadsheetId, range, values) {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      });
      
      if (!res.ok) throw new Error('Sheets API error');
      return await res.json();
    },
    
    async createSheet(title) {
      const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ properties: { title } })
      });
      
      if (!res.ok) throw new Error('Failed to create sheet');
      return await res.json();
    },
    
    // Export chat to Google Sheets
    async exportChatToSheets(chatHistory) {
      const sheet = await this.createSheet(`NOVA Chat ${new Date().toLocaleDateString()}`);
      const id = sheet.spreadsheetId;
      
      // Add headers
      await this.appendToSheet(id, 'Sheet1', [['Role', 'Message', 'Timestamp']]);
      
      // Add data
      const rows = chatHistory.map(msg => [
        msg.role,
        msg.content.slice(0, 5000),
        new Date(msg.timestamp || Date.now()).toISOString()
      ]);
      
      await this.appendToSheet(id, 'Sheet1', rows);
      
      return { id, url: `https://docs.google.com/spreadsheets/d/${id}/edit` };
    },
    
    // === GOOGLE CALENDAR ===
    async createEvent(summary, description, startTime, endTime) {
      const event = {
        summary,
        description,
        start: { dateTime: startTime, timeZone: 'America/New_York' },
        end: { dateTime: endTime, timeZone: 'America/New_York' }
      };
      
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });
      
      if (!res.ok) throw new Error('Calendar API error');
      return await res.json();
    },
    
    // Create event from AI suggestion
    async createEventFromAI(suggestion) {
      // Parse natural language date/time from AI response
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Default to tomorrow same time if no specific time mentioned
      const startTime = tomorrow.toISOString();
      const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour
      
      return await this.createEvent(
        suggestion.slice(0, 50),
        suggestion,
        startTime,
        endTime
      );
    },
    
    // === GOOGLE DRIVE ===
    async uploadFile(name, content, mimeType = 'text/plain') {
      const metadata = { name, mimeType };
      
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([content], { type: mimeType }));
      
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: form
      });
      
      if (!res.ok) throw new Error('Drive API error');
      return await res.json();
    },
    
    async uploadChatAsDoc(chatHistory) {
      let content = 'NOVA AI Conversation\n\n';
      content += 'Date: ' + new Date().toLocaleString() + '\n\n';
      content += '='.repeat(50) + '\n\n';
      
      chatHistory.forEach(msg => {
        content += `${msg.role.toUpperCase()}:\n${msg.content}\n\n`;
      });
      
      return await this.uploadFile(
        `NOVA Chat ${new Date().toLocaleDateString()}.txt`,
        content,
        'text/plain'
      );
    }
  };
  
  // Handle OAuth callback
  if (window.location.hash.includes('access_token') && window.location.hash.includes('google_auth')) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get('access_token');
    if (token) {
      localStorage.setItem('nova_google_token', token);
      window.close();
    }
  }
  
  // Open Google integration modal
  window.openGoogleModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '600';
    modal.id = 'google-modal';
    
    const isConnected = !!GoogleIntegration.accessToken;
    
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
        <div class="modal-top"><h2>🔴 Google Integration</h2><button class="modal-close" onclick="closeGoogleModal()">&times;</button></div>
        <div class="modal-body">
          <p style="color: var(--muted); margin-bottom: 16px;">Connect Google Sheets, Calendar, and Drive to NOVA.</p>
          
          ${!isConnected ? `
          <div style="margin-bottom: 20px; padding: 16px; background: var(--surface2); border-radius: var(--radius);">
            <label style="display: block; margin-bottom: 8px; color: var(--text); font-weight: 500;">Google Client ID</label>
            <input type="text" id="google-client-id" placeholder="your-client-id.apps.googleusercontent.com" style="width: 100%; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); margin-bottom: 8px;">
            <p style="font-size: 11px; color: var(--muted);">Enable Sheets, Calendar, Drive APIs at <a href="https://console.cloud.google.com" target="_blank" style="color: var(--accent);">Google Cloud Console</a></p>
            <button onclick="saveGoogleClientId()" style="margin-top: 8px; padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer; font-size: 12px;">Connect Google</button>
          </div>
          ` : `
          <div style="margin-bottom: 20px; padding: 16px; background: var(--accent-glow); border-radius: var(--radius); border: 1px solid rgba(139, 92, 246, 0.2);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="color: #4ade80;">✓</span>
              <span style="color: var(--text); font-weight: 500;">Google connected!</span>
            </div>
            <button onclick="GoogleIntegration.accessToken=null;localStorage.removeItem('nova_google_token');closeGoogleModal();openGoogleModal();" style="padding: 6px 12px; background: var(--red); border: none; border-radius: var(--radius-sm); color: #fff; font-size: 11px; cursor: pointer;">Disconnect</button>
          </div>
          
          <div style="display: grid; gap: 12px;">
            <div style="padding: 16px; background: var(--surface2); border-radius: var(--radius); border: 1px solid var(--border);">
              <h4 style="margin-bottom: 12px; color: var(--text);">📊 Google Sheets</h4>
              <button onclick="exportToSheets()" style="width: 100%; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Export Chat to Sheets</button>
            </div>
            
            <div style="padding: 16px; background: var(--surface2); border-radius: var(--radius); border: 1px solid var(--border);">
              <h4 style="margin-bottom: 12px; color: var(--text);">📅 Google Calendar</h4>
              <input type="text" id="cal-summary" placeholder="Event title" style="width: 100%; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); margin-bottom: 8px; font-size: 13px;">
              <input type="datetime-local" id="cal-start" style="width: 100%; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); margin-bottom: 8px; font-size: 13px;">
              <button onclick="createCalendarEvent()" style="width: 100%; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Add to Calendar</button>
            </div>
            
            <div style="padding: 16px; background: var(--surface2); border-radius: var(--radius); border: 1px solid var(--border);">
              <h4 style="margin-bottom: 12px; color: var(--text);">📁 Google Drive</h4>
              <button onclick="uploadToDrive()" style="width: 100%; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Save Chat to Drive</button>
            </div>
          </div>
          `}
        </div>
      </div>
    `;
    
    modal.onclick = closeGoogleModal;
    document.body.appendChild(modal);
  };
  
  window.closeGoogleModal = function() {
    const modal = document.getElementById('google-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.saveGoogleClientId = async function() {
    const id = document.getElementById('google-client-id').value;
    if (!id) return;
    
    GoogleIntegration.setClientId(id);
    showToast('Connecting to Google...');
    
    const success = await GoogleIntegration.authenticate();
    if (success) {
      showToast('Google connected!');
      closeGoogleModal();
      openGoogleModal();
    }
  };
  
  window.exportToSheets = async function() {
    try {
      showToast('Exporting to Google Sheets...');
      const result = await GoogleIntegration.exportChatToSheets(state.history);
      showToast('Exported! Opening...');
      window.open(result.url, '_blank');
      closeGoogleModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  
  window.createCalendarEvent = async function() {
    const summary = document.getElementById('cal-summary').value || 'NOVA AI Event';
    const startInput = document.getElementById('cal-start').value;
    
    if (!startInput) {
      alert('Please select a date and time');
      return;
    }
    
    const startTime = new Date(startInput).toISOString();
    const endTime = new Date(new Date(startInput).getTime() + 60 * 60 * 1000).toISOString();
    
    try {
      showToast('Adding to calendar...');
      await GoogleIntegration.createEvent(summary, 'Created from NOVA AI', startTime, endTime);
      showToast('Event added!');
      closeGoogleModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  
  window.uploadToDrive = async function() {
    try {
      showToast('Uploading to Google Drive...');
      await GoogleIntegration.uploadChatAsDoc(state.history);
      showToast('Chat saved to Drive!');
      closeGoogleModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  
  // Add button
  window.addGoogleButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar) {
      const btn = document.createElement('button');
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg> Google';
      btn.onclick = openGoogleModal;
      btn.style.marginBottom = '8px';
      
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addGoogleButton, 2600);
    });
  } else {
    setTimeout(window.addGoogleButton, 2600);
  }
  
  console.log('[Google] Module loaded - Sheets, Calendar, Drive integration');
})();
