/**
 * Auto-Summarize - Summarize old conversations automatically
 */

(function() {
  'use strict';

  const AutoSummarize = {
    // Settings
    maxMessagesBeforeSummarize: 50,
    minMessagesToKeep: 10,

    // Check if summarization needed
    shouldSummarize(chat) {
      if (!chat.history || chat.history.length < this.maxMessagesBeforeSummarize) {
        return false;
      }
      
      // Check if already summarized recently
      const lastSummarize = chat.lastSummarized || 0;
      const messagesSince = chat.history.length - (chat.summarizedUpTo || 0);
      
      return messagesSince >= this.maxMessagesBeforeSummarize;
    },

    // Generate summary of messages
    async generateSummary(messages) {
      // Build conversation text
      const conversationText = messages.map(m => {
        const role = m.role === 'user' ? 'User' : 'AI';
        return `${role}: ${m.content.slice(0, 500)}`;
      }).join('\n\n');

      // Create summary prompt
      const summaryPrompt = `Summarize this conversation concisely. Capture:
1. Main topics discussed
2. Key decisions or conclusions
3. Important information shared
4. Action items (if any)

Format as bullet points. Be brief but comprehensive.

Conversation:
${conversationText}`;

      // Try to get summary from AI
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'nova',
            model: 'auto',
            messages: [
              { role: 'system', content: 'You are a summarization assistant. Create concise summaries.' },
              { role: 'user', content: summaryPrompt }
            ],
            max_tokens: 500,
            temperature: 0.3
          })
        });

        if (!response.ok) throw new Error('API error');
        
        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'Summary unavailable';
      } catch (e) {
        // Fallback: simple extractive summary
        return this.fallbackSummary(messages);
      }
    },

    // Fallback simple summary
    fallbackSummary(messages) {
      const topics = new Set();
      const userMsgs = messages.filter(m => m.role === 'user');
      
      // Extract key sentences (first sentence of each user message)
      const keyPoints = userMsgs.slice(0, 5).map(m => {
        const firstSentence = m.content.split(/[.!?]/)[0];
        return firstSentence.length > 20 ? firstSentence : m.content.slice(0, 100);
      });

      return `**Conversation Summary**\n\n` +
        `Topics: ${userMsgs.length} exchanges\n` +
        `Key points:\n` +
        keyPoints.map(p => `• ${p}...`).join('\n');
    },

    // Summarize a chat
    async summarizeChat(chatId) {
      const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
      const chat = chats.find(c => c.id === chatId);
      
      if (!chat || !this.shouldSummarize(chat)) {
        return null;
      }

      showToast('Summarizing conversation...');

      // Get messages to summarize (older ones)
      const totalMessages = chat.history.length;
      const messagesToSummarize = chat.history.slice(0, totalMessages - this.minMessagesToKeep);
      const messagesToKeep = chat.history.slice(-this.minMessagesToKeep);

      // Generate summary
      const summary = await this.generateSummary(messagesToSummarize);

      // Create summary message
      const summaryMessage = {
        role: 'system',
        content: `[CONVERSATION SUMMARY]\n\n${summary}\n\n[${messagesToSummarize.length} messages summarized. Recent context preserved.]`,
        timestamp: Date.now(),
        isSummary: true
      };

      // Update chat
      chat.history = [summaryMessage, ...messagesToKeep];
      chat.lastSummarized = Date.now();
      chat.summarizedUpTo = totalMessages;
      chat.summaryCount = (chat.summaryCount || 0) + 1;

      // Save
      localStorage.setItem('nova_chats', JSON.stringify(chats));
      
      showToast(`Summarized ${messagesToSummarize.length} messages`);
      
      return summary;
    },

    // Auto-summarize all large chats
    async autoSummarizeAll() {
      const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
      let summarized = 0;

      for (const chat of chats) {
        if (this.shouldSummarize(chat)) {
          await this.summarizeChat(chat.id);
          summarized++;
          // Small delay to avoid rate limits
          await new Promise(r => setTimeout(r, 500));
        }
      }

      if (summarized > 0) {
        showToast(`Auto-summarized ${summarized} conversations`);
      }

      return summarized;
    },

    // Get summary stats
    getStats() {
      const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
      const stats = {
        totalChats: chats.length,
        summarizedChats: 0,
        totalSummaries: 0,
        spaceSaved: 0
      };

      for (const chat of chats) {
        if (chat.summaryCount) {
          stats.summarizedChats++;
          stats.totalSummaries += chat.summaryCount;
          if (chat.summarizedUpTo) {
            stats.spaceSaved += chat.summarizedUpTo * 0.8; // Estimate
          }
        }
      }

      return stats;
    },

    // Enable/disable auto-summarize
    setEnabled(enabled) {
      localStorage.setItem('nova_auto_summarize', enabled ? 'true' : 'false');
      if (enabled) {
        this.startAutoSummarize();
      }
    },

    isEnabled() {
      return localStorage.getItem('nova_auto_summarize') === 'true';
    },

    // Start auto-summarize interval
    startAutoSummarize() {
      // Check every 5 minutes
      setInterval(() => {
        if (this.isEnabled()) {
          this.autoSummarizeAll();
        }
      }, 5 * 60 * 1000);
    }
  };

  // Expose globally
  window.AutoSummarize = AutoSummarize;

  // UI
  window.openSummarizeModal = function() {
    const stats = AutoSummarize.getStats();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'summarize-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 450px;">
        <div class="modal-top"><h2>📝 Auto-Summarize</h2><button class="modal-close" onclick="closeSummarizeModal()">&times;</button></div>
        <div class="modal-body">
          <div style="padding: 16px; background: var(--surface2); border-radius: var(--radius); margin-bottom: 16px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; text-align: center;">
              <div>
                <div style="font-size: 24px; font-weight: 700; color: var(--accent);">${stats.summarizedChats}</div>
                <div style="font-size: 11px; color: var(--muted);">Chats Summarized</div>
              </div>
              <div>
                <div style="font-size: 24px; font-weight: 700; color: var(--accent);">${Math.round(stats.spaceSaved)}</div>
                <div style="font-size: 11px; color: var(--muted);">Messages Compressed</div>
              </div>
            </div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="auto-summarize-toggle" ${AutoSummarize.isEnabled() ? 'checked' : ''} 
                onchange="AutoSummarize.setEnabled(this.checked)" 
                style="width: 18px; height: 18px;">
              <span>Enable automatic summarization</span>
            </label>
          </div>
          
          <p style="font-size: 12px; color: var(--muted); line-height: 1.5;">
            Automatically summarizes conversations when they exceed 50 messages. 
            Keeps the last 10 messages for context. Saves storage space and improves performance.
          </p>
        </div>
        <div class="modal-footer" style="display: flex; justify-content: space-between; gap: 8px;">
          <button onclick="summarizeCurrentChat()" style="padding: 8px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Summarize Current</button>
          <button onclick="closeSummarizeModal()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeSummarizeModal = function() {
    const modal = document.getElementById('summarize-modal');
    if (modal) modal.remove();
  };

  window.summarizeCurrentChat = async function() {
    if (!window.state || !window.state.currentChatId) {
      alert('No active chat to summarize');
      return;
    }
    
    const summary = await AutoSummarize.summarizeChat(window.state.currentChatId);
    if (summary) {
      showToast('Chat summarized!');
      window.loadChat(window.state.currentChatId);
    } else {
      showToast('Chat too short to summarize');
    }
    closeSummarizeModal();
  };

  // Add to settings
  window.addSummarizeButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar && !document.getElementById('summarize-btn')) {
      const btn = document.createElement('button');
      btn.id = 'summarize-btn';
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '📝 Summarize';
      btn.onclick = openSummarizeModal;
      btn.style.marginBottom = '8px';
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };

  // Initialize
  setTimeout(() => {
    addSummarizeButton();
    if (AutoSummarize.isEnabled()) {
      AutoSummarize.startAutoSummarize();
    }
  }, 4000);

  console.log('[Auto-Summarize] Module loaded');
})();
