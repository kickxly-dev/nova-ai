/**
 * Community Prompts - Share and discover prompts from community
 */

(function() {
  'use strict';

  const CommunityPrompts = {
    // Get community prompts (simulated - would fetch from server)
    getPrompts() {
      const prompts = JSON.parse(localStorage.getItem('nova_community_prompts') || '[]');
      return prompts.length > 0 ? prompts : this.getDefaultPrompts();
    },

    getDefaultPrompts() {
      return [
        { id: 1, title: 'Creative Writing', prompt: 'Write a creative story about: ', author: 'NOVA Team', likes: 245, category: 'Writing' },
        { id: 2, title: 'Code Explainer', prompt: 'Explain this code like I\'m 5: ', author: 'DevHelper', likes: 189, category: 'Development' },
        { id: 3, title: 'Interview Prep', prompt: 'Help me prepare for a job interview for: ', author: 'CareerCoach', likes: 156, category: 'Career' },
        { id: 4, title: 'Recipe Creator', prompt: 'Create a recipe using these ingredients: ', author: 'ChefAI', likes: 134, category: 'Cooking' },
        { id: 5, title: 'Workout Plan', prompt: 'Design a workout plan for: ', author: 'FitnessPro', likes: 122, category: 'Health' }
      ];
    },

    // Submit a prompt
    submit(title, prompt, category) {
      const prompts = this.getPrompts();
      prompts.unshift({
        id: Date.now(),
        title,
        prompt,
        category,
        author: 'You',
        likes: 0,
        created: Date.now()
      });
      localStorage.setItem('nova_community_prompts', JSON.stringify(prompts.slice(0, 100)));
      return true;
    },

    // Like a prompt
    like(id) {
      const liked = JSON.parse(localStorage.getItem('nova_liked_prompts') || '[]');
      if (liked.includes(id)) return false;
      
      liked.push(id);
      localStorage.setItem('nova_liked_prompts', JSON.stringify(liked));
      return true;
    }
  };

  window.CommunityPrompts = CommunityPrompts;

  window.openCommunityModal = function() {
    const prompts = CommunityPrompts.getPrompts();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'community-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 600px;">
        <div class="modal-top"><h2>🌟 Community Prompts</h2><button class="modal-close" onclick="closeCommunityModal()">&times;</button></div>
        <div class="modal-body">
          <div style="margin-bottom: 16px; display: flex; gap: 8px;">
            <input type="text" id="community-search" placeholder="Search community prompts..." style="flex: 1; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
            <button onclick="openSubmitPrompt()" style="padding: 10px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">Share</button>
          </div>
          
          <div style="display: grid; gap: 10px;">
            ${prompts.map(p => `
              <div style="padding: 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text);">${p.title}</div>
                    <div style="font-size: 11px; color: var(--accent-light);">${p.category} • by ${p.author}</div>
                    <div style="font-size: 12px; color: var(--muted); margin-top: 4px; font-style: italic;">"${p.prompt}"</div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <button onclick="useCommunityPrompt('${p.id}')" style="padding: 6px 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-size: 12px; cursor: pointer;">Use</button>
                    <button onclick="likeCommunityPrompt('${p.id}')" style="padding: 6px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; cursor: pointer;">❤️ ${p.likes}</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeCommunityModal = function() {
    const modal = document.getElementById('community-modal');
    if (modal) modal.remove();
  };

  window.useCommunityPrompt = function(id) {
    const prompt = CommunityPrompts.getPrompts().find(p => p.id == id);
    if (!prompt) return;

    const input = prompt(prompt.prompt);
    if (!input) return;

    const fullPrompt = prompt.prompt + input;
    const activeInput = document.querySelector('textarea[id$="-msg-input"]:not([style*="display: none"])');
    if (activeInput) {
      activeInput.value = fullPrompt;
      autoResize(activeInput);
    }
    closeCommunityModal();
  };

  window.likeCommunityPrompt = function(id) {
    CommunityPrompts.like(id);
    showToast('Liked!');
  };

  window.openSubmitPrompt = function() {
    const title = prompt('Prompt title:');
    if (!title) return;
    const promptText = prompt('Prompt template (use {{input}} for user content):');
    if (!promptText) return;
    const category = prompt('Category:') || 'General';
    
    CommunityPrompts.submit(title, promptText, category);
    showToast('Prompt shared!');
    closeCommunityModal();
    setTimeout(openCommunityModal, 300);
  };

  console.log('[Community Prompts] Module loaded');
})();
