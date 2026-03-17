/**
 * Chat Ratings - Rate and favorite conversations
 */

(function() {
  'use strict';

  const ChatRatings = {
    // Get favorites
    getFavorites() {
      return JSON.parse(localStorage.getItem('nova_favorite_chats') || '[]');
    },

    // Save favorites
    saveFavorites(favs) {
      localStorage.setItem('nova_favorite_chats', JSON.stringify(favs));
    },

    // Toggle favorite
    toggleFavorite(chatId) {
      const favs = this.getFavorites();
      const idx = favs.indexOf(chatId);
      
      if (idx > -1) {
        favs.splice(idx, 1);
        this.saveFavorites(favs);
        return false; // Now unfavorited
      } else {
        favs.push(chatId);
        this.saveFavorites(favs);
        return true; // Now favorited
      }
    },

    // Check if favorited
    isFavorite(chatId) {
      return this.getFavorites().includes(chatId);
    },

    // Get ratings
    getRatings() {
      return JSON.parse(localStorage.getItem('nova_chat_ratings') || '{}');
    },

    // Save rating
    rate(chatId, rating) {
      const ratings = this.getRatings();
      ratings[chatId] = { rating, ratedAt: Date.now() };
      localStorage.setItem('nova_chat_ratings', JSON.stringify(ratings));
    },

    // Get rating
    getRating(chatId) {
      return this.getRatings()[chatId]?.rating || 0;
    },

    // Get top rated chats
    getTopRated(limit = 10) {
      const ratings = this.getRatings();
      const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
      
      return chats
        .filter(c => ratings[c.id])
        .sort((a, b) => ratings[b.id].rating - ratings[a.id].rating)
        .slice(0, limit);
    }
  };

  window.ChatRatings = ChatRatings;

  // Add favorite button to chat items
  window.addFavoriteButtons = function() {
    document.querySelectorAll('.d-chat-item, .m-drawer-item').forEach(item => {
      if (item.querySelector('.favorite-btn')) return;
      
      const chatId = item.dataset.chatId || item.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
      if (!chatId) return;

      const isFav = ChatRatings.isFavorite(chatId);
      
      const btn = document.createElement('button');
      btn.className = 'favorite-btn';
      btn.innerHTML = isFav ? '★' : '☆';
      btn.style.cssText = `
        margin-left: 8px;
        background: none;
        border: none;
        color: ${isFav ? 'var(--accent)' : 'var(--muted)'};
        cursor: pointer;
        font-size: 14px;
        padding: 0 4px;
      `;
      btn.onclick = (e) => {
        e.stopPropagation();
        const nowFav = ChatRatings.toggleFavorite(chatId);
        btn.innerHTML = nowFav ? '★' : '☆';
        btn.style.color = nowFav ? 'var(--accent)' : 'var(--muted)';
        showToast(nowFav ? 'Added to favorites' : 'Removed from favorites');
      };
      
      item.appendChild(btn);
    });
  };

  // UI for favorites
  window.openFavoritesModal = function() {
    const favs = ChatRatings.getFavorites();
    const chats = JSON.parse(localStorage.getItem('nova_chats') || '[]');
    const favChats = chats.filter(c => favs.includes(c.id));

    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'favorites-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 450px;">
        <div class="modal-top"><h2>⭐ Favorites</h2><button class="modal-close" onclick="closeFavoritesModal()">&times;</button></div>
        <div class="modal-body">
          ${favChats.length === 0 ? '<div style="color: var(--muted); text-align: center; padding: 40px;">No favorites yet. Star chats to add them here.</div>' : `
          <div style="display: grid; gap: 8px;">
            ${favChats.map(c => `
              <div onclick="loadChat('${c.id}'); closeFavoritesModal();" style="padding: 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text);">${c.title}</span>
                <span style="color: var(--accent);">★</span>
              </div>
            `).join('')}
          </div>
          `}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeFavoritesModal = function() {
    const modal = document.getElementById('favorites-modal');
    if (modal) modal.remove();
  };

  // Add favorites button
  window.addFavoritesButton = function() {
    const sidebar = document.querySelector('.d-sidebar-bot');
    if (sidebar && !document.getElementById('favorites-btn')) {
      const btn = document.createElement('button');
      btn.id = 'favorites-btn';
      btn.className = 'd-plugins-btn';
      btn.innerHTML = '⭐ Favorites';
      btn.onclick = openFavoritesModal;
      btn.style.marginBottom = '8px';
      sidebar.insertBefore(btn, sidebar.firstChild);
    }
  };

  setTimeout(() => {
    addFavoritesButton();
    // Add favorite buttons to existing chats
    setInterval(addFavoriteButtons, 2000);
  }, 6000);

  console.log('[Chat Ratings] Module loaded');
})();
