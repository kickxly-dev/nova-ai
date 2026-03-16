// Enhanced Memory Module
// AI automatically extracts and remembers important facts about the user

(function() {
  'use strict';
  
  // Memory storage with categories
  const MemoryStore = {
    get: function() {
      return JSON.parse(localStorage.getItem('nova_enhanced_memory') || '{}');
    },
    set: function(data) {
      localStorage.setItem('nova_enhanced_memory', JSON.stringify(data));
    },
    addFact: function(category, fact, confidence = 'medium') {
      const memory = this.get();
      if (!memory[category]) memory[category] = [];
      
      // Check if similar fact already exists
      const exists = memory[category].some(f => 
        f.text.toLowerCase() === fact.toLowerCase()
      );
      
      if (!exists) {
        memory[category].push({
          text: fact,
          confidence: confidence,
          timestamp: Date.now(),
          sources: []
        });
        this.set(memory);
        return true;
      }
      return false;
    }
  };
  
  // Extract facts from conversation
  window.extractMemoryFacts = function(userMsg, aiMsg) {
    const text = (userMsg + ' ' + aiMsg).toLowerCase();
    const facts = [];
    
    // Personal facts
    const namePattern = /my name is (\w+)/i;
    const nameMatch = userMsg.match(namePattern);
    if (nameMatch) {
      facts.push({ category: 'personal', fact: `User's name is ${nameMatch[1]}`, confidence: 'high' });
    }
    
    // Location
    const locationPatterns = [
      /i live in ([^.,]+)/i,
      /i'm from ([^.,]+)/i,
      /i'm based in ([^.,]+)/i
    ];
    for (const pattern of locationPatterns) {
      const match = userMsg.match(pattern);
      if (match) {
        facts.push({ category: 'location', fact: `User lives in ${match[1]}`, confidence: 'high' });
        break;
      }
    }
    
    // Profession
    const jobPatterns = [
      /i (?:am|work as) a[n]? (\w+(?:\s+\w+){0,3})/i,
      /i'm a[n]? (\w+(?:\s+\w+){0,3})/i,
      /my job is (\w+(?:\s+\w+){0,3})/i
    ];
    for (const pattern of jobPatterns) {
      const match = userMsg.match(pattern);
      if (match) {
        facts.push({ category: 'professional', fact: `User is a ${match[1]}`, confidence: 'high' });
        break;
      }
    }
    
    // Interests
    const interestPatterns = [
      /i (?:love|enjoy|like) (\w+(?:\s+\w+){0,3})/i,
      /my (?:hobby|hobbies) (?:is|are) ([^.,]+)/i,
      /i'm interested in ([^.,]+)/i
    ];
    for (const pattern of interestPatterns) {
      const match = userMsg.match(pattern);
      if (match) {
        facts.push({ category: 'interests', fact: `User is interested in ${match[1]}`, confidence: 'medium' });
      }
    }
    
    // Preferences
    const prefPatterns = [
      /i prefer ([^.,]+)/i,
      /i like ([^.,]+) better/i,
      /my favorite ([^.,]+) is ([^.,]+)/i
    ];
    for (const pattern of prefPatterns) {
      const match = userMsg.match(pattern);
      if (match) {
        const pref = match[2] || match[1];
        facts.push({ category: 'preferences', fact: `User preference: ${pref}`, confidence: 'medium' });
      }
    }
    
    // Technologies/Skills
    const techPattern = /\b(javascript|python|react|vue|angular|node\.?js|typescript|rust|go|java|c\+\+|swift|kotlin|php|ruby|docker|kubernetes|aws|gcp|azure|firebase|mongodb|postgresql|mysql|redis|graphql|rest|api)\b/gi;
    let techMatch;
    while ((techMatch = techPattern.exec(userMsg)) !== null) {
      facts.push({ category: 'technologies', fact: `User knows ${techMatch[1]}`, confidence: 'medium' });
    }
    
    // Store extracted facts
    facts.forEach(({ category, fact, confidence }) => {
      if (MemoryStore.addFact(category, fact, confidence)) {
        console.log('[Memory] Learned:', fact);
      }
    });
    
    // Update system prompt with new facts
    updateMemoryContext();
    
    return facts;
  };
  
  // Generate memory context for AI
  function updateMemoryContext() {
    const memory = MemoryStore.get();
    let context = '';
    
    Object.entries(memory).forEach(([category, facts]) => {
      if (facts.length > 0) {
        context += `\n[${category.toUpperCase()}]: `;
        context += facts.slice(-5).map(f => f.text).join('; ');
      }
    });
    
    if (context) {
      localStorage.setItem('nova_memory_context', context);
    }
  }
  
  // Get memory summary for system prompt
  window.getMemorySummary = function() {
    const memory = MemoryStore.get();
    const parts = [];
    
    Object.entries(memory).forEach(([category, facts]) => {
      if (facts.length > 0) {
        parts.push(`${category}: ${facts.slice(-3).map(f => f.text).join(', ')}`);
      }
    });
    
    return parts.length > 0 ? '\n\nABOUT THE USER:\n' + parts.join('\n') : '';
  };
  
  // View memory UI
  window.viewMemory = function() {
    const memory = MemoryStore.get();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '400';
    modal.id = 'memory-view-modal';
    
    let content = '<div class="modal" onclick="event.stopPropagation()"><div class="modal-top"><h2>AI Memory</h2><button class="modal-close" onclick="closeMemoryView()">&times;</button></div><div class="modal-body">';
    
    if (Object.keys(memory).length === 0) {
      content += '<p style="color: var(--muted);">No memories stored yet. The AI learns from your conversations automatically.</p>';
    } else {
      Object.entries(memory).forEach(([category, facts]) => {
        if (facts.length > 0) {
          content += `<div style="margin-bottom: 16px;"><h4 style="color: var(--accent); margin-bottom: 8px; text-transform: capitalize;">${category}</h4>`;
          facts.forEach(fact => {
            content += `<div style="padding: 8px; background: var(--surface2); border-radius: var(--radius-sm); margin-bottom: 6px; font-size: 13px;">${fact.text}</div>`;
          });
          content += '</div>';
        }
      });
    }
    
    content += '</div><div class="modal-footer" style="padding: 16px; border-top: 1px solid var(--border);"><button onclick="clearMemory()" style="padding: 8px 16px; background: var(--red); border: none; border-radius: var(--radius-sm); color: #fff; cursor: pointer; font-size: 12px;">Clear All Memory</button></div></div>';
    
    modal.innerHTML = content;
    modal.onclick = closeMemoryView;
    document.body.appendChild(modal);
  };
  
  window.closeMemoryView = function() {
    const modal = document.getElementById('memory-view-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  window.clearMemory = function() {
    if (confirm('Clear all AI memory? This cannot be undone.')) {
      localStorage.removeItem('nova_enhanced_memory');
      localStorage.removeItem('nova_memory_context');
      closeMemoryView();
      showToast('Memory cleared');
    }
  };
  
  // Override learnFromConversation to include enhanced memory
  const originalLearn = window.learnFromConversation;
  window.learnFromConversation = function(userMsg, aiMsg) {
    // Call original
    if (originalLearn) originalLearn(userMsg, aiMsg);
    
    // Extract enhanced memory
    window.extractMemoryFacts(userMsg, aiMsg);
  };
  
  console.log('[Memory] Enhanced memory module loaded');
})();
