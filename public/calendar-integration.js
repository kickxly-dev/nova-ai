/**
 * Google Calendar Integration - Schedule events via AI
 */

(function() {
  'use strict';

  const CalendarIntegration = {
    apiBase: 'https://www.googleapis.com/calendar/v3',
    
    getToken() {
      return localStorage.getItem('nova_calendar_token') || '';
    },

    setToken(token) {
      localStorage.setItem('nova_calendar_token', token);
    },

    isAuthenticated() {
      return !!this.getToken();
    },

    async apiRequest(endpoint, options = {}) {
      const token = this.getToken();
      if (!token) throw new Error('Calendar token not configured');

      const response = await fetch(`${this.apiBase}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(`Calendar API error: ${error.error?.message || response.statusText}`);
      }

      return response.json();
    },

    // List calendars
    async listCalendars() {
      const data = await this.apiRequest('/users/me/calendarList');
      return data.items || [];
    },

    // Get primary calendar events
    async getEvents(calendarId = 'primary', timeMin = null, timeMax = null, maxResults = 10) {
      const now = new Date();
      const params = new URLSearchParams({
        maxResults: maxResults.toString(),
        orderBy: 'startTime',
        singleEvents: 'true'
      });
      
      if (timeMin) params.append('timeMin', new Date(timeMin).toISOString());
      else params.append('timeMin', now.toISOString());
      
      if (timeMax) params.append('timeMax', new Date(timeMax).toISOString());

      const data = await this.apiRequest(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
      return data.items || [];
    },

    // Create event
    async createEvent(summary, description = '', startTime, endTime, attendees = [], calendarId = 'primary') {
      const event = {
        summary,
        description,
        start: {
          dateTime: new Date(startTime).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: new Date(endTime).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      if (attendees.length > 0) {
        event.attendees = attendees.map(email => ({ email }));
      }

      return this.apiRequest(`/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        body: JSON.stringify(event)
      });
    },

    // Delete event
    async deleteEvent(eventId, calendarId = 'primary') {
      return this.apiRequest(`/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
        method: 'DELETE'
      });
    },

    // Quick add event (natural language)
    async quickAdd(text, calendarId = 'primary') {
      return this.apiRequest(`/calendars/${encodeURIComponent(calendarId)}/events/quickAdd?text=${encodeURIComponent(text)}`, {
        method: 'POST'
      });
    },

    // Format for AI
    formatForAI(events, type = 'list') {
      if (type === 'list') {
        return events.map(e => {
          const start = new Date(e.start.dateTime || e.start.date);
          const time = start.toLocaleString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          return `• ${time}: ${e.summary}${e.description ? ` - ${e.description.slice(0, 50)}...` : ''}`;
        }).join('\n');
      }

      const e = events;
      const start = new Date(e.start.dateTime || e.start.date);
      const end = new Date(e.end.dateTime || e.end.date);
      
      return `\n\n=== CALENDAR EVENT ===\n` +
        `Title: ${e.summary}\n` +
        `When: ${start.toLocaleString()} - ${end.toLocaleString()}\n` +
        `Description: ${e.description || 'None'}\n` +
        `Location: ${e.location || 'None'}\n` +
        `Link: ${e.htmlLink || 'None'}\n` +
        `=== END EVENT ===`;
    }
  };

  window.CalendarIntegration = CalendarIntegration;

  window.handleCalendarCommand = async function(command, args) {
    try {
      switch(command) {
        case 'calendar_list':
          const events = await CalendarIntegration.getEvents('primary', null, null, parseInt(args) || 10);
          return {
            success: true,
            data: events,
            formatted: events.length > 0 
              ? `**Upcoming Events:**\n\n${CalendarIntegration.formatForAI(events)}`
              : 'No upcoming events found.'
          };
        
        case 'calendar_today':
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const todayEvents = await CalendarIntegration.getEvents('primary', today.toISOString(), tomorrow.toISOString(), 20);
          return {
            success: true,
            data: todayEvents,
            formatted: todayEvents.length > 0
              ? `**Today's Schedule:**\n\n${CalendarIntegration.formatForAI(todayEvents)}`
              : 'No events scheduled for today.'
          };
        
        case 'calendar_create':
          // Format: title|start|end|description
          const [title, start, end, ...descParts] = args.split('|');
          const desc = descParts.join('|');
          const created = await CalendarIntegration.createEvent(title, desc, start, end);
          return {
            success: true,
            data: created,
            formatted: `✅ Event created: "${title}" on ${new Date(start).toLocaleString()}`
          };
        
        case 'calendar_quick':
          const quick = await CalendarIntegration.quickAdd(args);
          return {
            success: true,
            data: quick,
            formatted: `✅ Quick event added: "${quick.summary}"`
          };
        
        default:
          return { error: 'Unknown calendar command' };
      }
    } catch(err) {
      return { error: err.message };
    }
  };

  // UI
  window.openCalendarModal = function() {
    const hasToken = CalendarIntegration.isAuthenticated();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'calendar-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 450px;">
        <div class="modal-top"><h2>📅 Calendar</h2><button class="modal-close" onclick="closeCalendarModal()">&times;</button></div>
        <div class="modal-body">
          ${!hasToken ? `
          <div style="padding: 20px; text-align: center;">
            <p style="margin-bottom: 16px;">Connect Google Calendar to schedule and view events.</p>
            <input type="text" id="calendar-token" placeholder="OAuth 2.0 token..." style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
          </div>
          ` : `
          <div style="display: grid; gap: 10px;">
            <button onclick="quickCalendarAction('today')" style="padding: 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; text-align: left;">📅 Today's Schedule</button>
            <button onclick="quickCalendarAction('list')" style="padding: 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; text-align: left;">📋 Upcoming Events</button>
            <button onclick="quickCalendarAction('quick')" style="padding: 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; text-align: left;">⚡ Quick Add (natural language)</button>
            <button onclick="quickCalendarAction('create')" style="padding: 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; text-align: left;">➕ Create Event</button>
          </div>
          `}
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px;">
          <button onclick="closeCalendarModal()" style="padding: 8px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Close</button>
          ${!hasToken ? `<button onclick="saveCalendarToken()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">Connect</button>` : ''}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeCalendarModal = function() {
    const modal = document.getElementById('calendar-modal');
    if (modal) modal.remove();
  };

  window.saveCalendarToken = function() {
    const token = document.getElementById('calendar-token').value.trim();
    if (token) {
      CalendarIntegration.setToken(token);
      showToast('Calendar connected!');
      closeCalendarModal();
      setTimeout(openCalendarModal, 300);
    }
  };

  window.quickCalendarAction = async function(action) {
    switch(action) {
      case 'today':
        const todayResult = await handleCalendarCommand('calendar_today', '');
        if (todayResult.success) appendMessage('ai', todayResult.formatted);
        break;
      case 'list':
        const listResult = await handleCalendarCommand('calendar_list', '10');
        if (listResult.success) appendMessage('ai', listResult.formatted);
        break;
      case 'quick':
        const text = prompt('Describe the event (e.g., "Lunch with John tomorrow at 1pm"):');
        if (text) {
          const quickResult = await handleCalendarCommand('calendar_quick', text);
          if (quickResult.success) appendMessage('ai', quickResult.formatted);
        }
        break;
      case 'create':
        const title = prompt('Event title:');
        if (title) {
          const start = prompt('Start time (e.g., 2024-12-25T14:00):');
          if (start) {
            const end = prompt('End time (e.g., 2024-12-25T15:00):');
            if (end) {
              const desc = prompt('Description (optional):') || '';
              const createResult = await handleCalendarCommand('calendar_create', `${title}|${start}|${end}|${desc}`);
              if (createResult.success) appendMessage('ai', createResult.formatted);
            }
          }
        }
        break;
    }
    closeCalendarModal();
  };

  // Add button
  window.addCalendarButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar && !document.getElementById('calendar-btn')) {
      const btn = document.createElement('button');
      btn.id = 'calendar-btn';
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '📅 Calendar';
      btn.onclick = openCalendarModal;
      btn.style.marginBottom = '8px';
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };

  setTimeout(addCalendarButton, 3000);
  console.log('[Calendar] Module loaded');
})();
