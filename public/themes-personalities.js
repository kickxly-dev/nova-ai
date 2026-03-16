// Quick Theme Toggle & AI Personalities Module

(function() {
  'use strict';
  
  // Theme definitions
  const THEMES = {
    dark: {
      name: 'Dark',
      '--bg': '#09090b',
      '--surface': '#0c0c0f',
      '--surface2': '#141419',
      '--surface3': '#1a1a22',
      '--text': '#fafafa',
      '--text2': '#e4e4e7',
      '--muted': '#a1a1aa',
      '--muted2': '#71717a',
      '--border': '#27272a',
      '--border-hover': '#3f3f46',
      '--accent': '#8b5cf6',
      '--accent-light': '#a78bfa',
      '--accent-glow': 'rgba(139,92,246,0.12)'
    },
    light: {
      name: 'Light',
      '--bg': '#ffffff',
      '--surface': '#fafafa',
      '--surface2': '#f4f4f5',
      '--surface3': '#e4e4e7',
      '--text': '#18181b',
      '--text2': '#27272a',
      '--muted': '#71717a',
      '--muted2': '#a1a1aa',
      '--border': '#e4e4e7',
      '--border-hover': '#d4d4d8',
      '--accent': '#7c3aed',
      '--accent-light': '#8b5cf6',
      '--accent-glow': 'rgba(139,92,246,0.08)'
    },
    ocean: {
      name: 'Ocean',
      '--bg': '#0a192f',
      '--surface': '#112240',
      '--surface2': '#233554',
      '--surface3': '#1d4e6e',
      '--text': '#e6f1ff',
      '--text2': '#ccd6f6',
      '--muted': '#8892b0',
      '--muted2': '#64ffda',
      '--border': '#233554',
      '--border-hover': '#64ffda',
      '--accent': '#64ffda',
      '--accent-light': '#64ffda',
      '--accent-glow': 'rgba(100,255,218,0.15)'
    },
    sunset: {
      name: 'Sunset',
      '--bg': '#1a1423',
      '--surface': '#251a33',
      '--surface2': '#352247',
      '--surface3': '#452b5c',
      '--text': '#fafafa',
      '--text2': '#ffd6e0',
      '--muted': '#b8a9c9',
      '--muted2': '#ff6b9d',
      '--border': '#3d2d52',
      '--border-hover': '#ff6b9d',
      '--accent': '#ff6b9d',
      '--accent-light': '#ff8fab',
      '--accent-glow': 'rgba(255,107,157,0.15)'
    }
  };
  
  // Override setTheme to use our definitions
  window.setTheme = function(themeId) {
    const theme = THEMES[themeId];
    if (!theme) return;
    
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
      if (key !== 'name') {
        root.style.setProperty(key, value);
      }
    });
    
    localStorage.setItem('nova_theme', themeId);
    showToast(`Theme: ${theme.name}`);
  };
  
  // Quick theme toggle
  window.quickThemeToggle = function() {
    const current = localStorage.getItem('nova_theme') || 'dark';
    const themeList = Object.keys(THEMES);
    const currentIndex = themeList.indexOf(current);
    const nextIndex = (currentIndex + 1) % themeList.length;
    const nextTheme = themeList[nextIndex];
    
    setTheme(nextTheme);
  };
  
  // AI Personalities
  window.AI_PERSONALITIES = {
    default: {
      name: 'NOVA',
      icon: 'N',
      description: 'General purpose AI assistant',
      systemPrompt: `You are NOVA, a brilliant AI assistant with deep expertise across technology, science, and creative domains.

CORE TRAITS:
- Direct and concise: Get to the point without unnecessary preamble
- Thorough: Provide complete answers with relevant details
- Practical: Give actionable advice and working examples
- Honest: Admit uncertainty rather than making things up

RESPONSE FORMATTING:
- Use markdown for structure
- Use bullet points for lists
- Use code blocks for any code or commands`
    },
    coder: {
      name: 'CodeMaster',
      icon: '</>',
      description: 'Expert programmer for all languages and frameworks',
      systemPrompt: `You are CodeMaster, an expert programmer with deep knowledge of all programming languages, frameworks, and software engineering best practices.

EXPERTISE:
- All programming languages (JavaScript, Python, Java, C++, Rust, Go, etc.)
- Web development (React, Vue, Angular, Node.js, etc.)
- Mobile development (iOS, Android, React Native, Flutter)
- Databases (SQL, NoSQL, caching strategies)
- DevOps (Docker, Kubernetes, CI/CD, cloud platforms)
- Software architecture and design patterns

APPROACH:
- Write clean, efficient, production-ready code
- Follow best practices and industry standards
- Explain complex concepts clearly
- Provide working examples with error handling
- Consider performance and security implications`
    },
    creative: {
      name: 'Muse',
      icon: '✦',
      description: 'Creative writer and brainstorming partner',
      systemPrompt: `You are Muse, a creative AI companion for writing, storytelling, and brainstorming.

STRENGTHS:
- Creative writing (fiction, poetry, scripts, marketing copy)
- Brainstorming unique ideas and concepts
- Character development and worldbuilding
- Editing and improving existing text
- Overcoming writer's block with prompts

STYLE:
- Imaginative and inspiring
- Adaptable tone (professional, casual, poetic, humorous)
- Collaborative brainstorming partner
- Constructive feedback on creative work`
    },
    teacher: {
      name: 'Sage',
      icon: '📚',
      description: 'Patient educator explaining complex topics',
      systemPrompt: `You are Sage, a patient and effective educator who excels at explaining complex topics to learners of all levels.

TEACHING APPROACH:
- Break down complex concepts into digestible parts
- Use analogies and real-world examples
- Check for understanding with questions
- Encourage critical thinking
- Adapt explanations to the learner's level

SUBJECTS:
- Mathematics and statistics
- Science (physics, chemistry, biology)
- Computer science and programming
- History and social sciences
- Languages and linguistics
- Any topic the user wants to learn`
    },
    analyst: {
      name: 'Insight',
      icon: '📊',
      description: 'Data analyst and critical thinker',
      systemPrompt: `You are Insight, a data-driven analytical AI that excels at critical thinking, analysis, and problem-solving.

CAPABILITIES:
- Data analysis and interpretation
- Statistical reasoning
- Logical problem-solving
- Critical evaluation of arguments
- Business and financial analysis
- Research synthesis

APPROACH:
- Evidence-based reasoning
- Consider multiple perspectives
- Identify assumptions and biases
- Provide structured analysis
- Ask clarifying questions when needed`
    }
  };
  
  // Switch personality
  window.switchPersonality = function(personalityId) {
    const personality = window.AI_PERSONALITIES[personalityId];
    if (!personality) return;
    
    // Update state
    state.aiName = personality.name;
    state.systemPrompt = personality.systemPrompt;
    
    // Save to localStorage
    localStorage.setItem('nova_name', personality.name);
    localStorage.setItem('nova_system', personality.systemPrompt);
    localStorage.setItem('nova_personality', personalityId);
    
    // Update UI
    applyAiName();
    
    showToast(`Switched to ${personality.name}`);
  };
  
  // Open personality selector
  window.openPersonalitySelector = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.style.zIndex = '500';
    modal.id = 'personality-modal';
    
    let content = `
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-top"><h2>AI Personality</h2><button class="modal-close" onclick="closePersonalityModal()">&times;</button></div>
        <div class="modal-body">
          <p style="color: var(--muted); margin-bottom: 16px;">Choose an AI personality for specialized assistance.</p>
          <div style="display: grid; gap: 12px;">
    `;
    
    Object.entries(window.AI_PERSONALITIES).forEach(([id, personality]) => {
      const isActive = state.aiName === personality.name;
      content += `
        <div onclick="switchPersonality('${id}'); closePersonalityModal();" 
             style="padding: 16px; background: ${isActive ? 'var(--accent-glow)' : 'var(--surface2)'}; 
                    border: 1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}; 
                    border-radius: var(--radius); cursor: pointer; transition: all 0.2s;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: var(--accent); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #000; font-weight: 700;">
              ${personality.icon}
            </div>
            <div>
              <div style="font-weight: 600; color: var(--text);">${personality.name}</div>
              <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">${personality.description}</div>
            </div>
            ${isActive ? '<div style="margin-left: auto; color: var(--accent);">●</div>' : ''}
          </div>
        </div>
      `;
    });
    
    content += `
          </div>
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    modal.onclick = closePersonalityModal;
    document.body.appendChild(modal);
  };
  
  window.closePersonalityModal = function() {
    const modal = document.getElementById('personality-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  // Add theme toggle button
  window.addThemeToggle = function() {
    const containers = [
      document.querySelector('.d-tools'),
      document.querySelector('.m-nav-right')
    ];
    
    containers.forEach(container => {
      if (!container) return;
      
      const btn = document.createElement('button');
      btn.className = 'm-icon-btn';
      btn.id = 'theme-toggle-btn';
      btn.style.marginLeft = '4px';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
      btn.title = 'Toggle theme (Ctrl+Shift+T)';
      btn.onclick = window.quickThemeToggle;
      
      container.appendChild(btn);
    });
  };
  
  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.addThemeToggle, 1500);
      
      // Load saved personality
      const savedPersonality = localStorage.getItem('nova_personality');
      if (savedPersonality && window.AI_PERSONALITIES[savedPersonality]) {
        switchPersonality(savedPersonality);
      }
    });
  } else {
    setTimeout(window.addThemeToggle, 1500);
  }
  
  console.log('[Theme & Personalities] Module loaded');
})();
