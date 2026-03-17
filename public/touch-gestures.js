/**
 * Touch Gestures & Mobile Enhancements
 */

(function() {
  'use strict';

  // Touch gesture handler
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let currentSwipeItem = null;

  // Initialize touch handlers
  function initTouchGestures() {
    // Mobile drawer swipe
    const chatArea = document.getElementById('m-chat-area');
    if (chatArea) {
      chatArea.addEventListener('touchstart', handleTouchStart, { passive: true });
      chatArea.addEventListener('touchmove', handleTouchMove, { passive: true });
      chatArea.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    // Chat item swipe to delete
    const chatList = document.getElementById('m-chat-list') || document.getElementById('d-chat-list');
    if (chatList) {
      chatList.addEventListener('touchstart', handleChatItemTouchStart, { passive: true });
      chatList.addEventListener('touchmove', handleChatItemTouchMove, { passive: true });
      chatList.addEventListener('touchend', handleChatItemTouchEnd, { passive: true });
    }

    // Pull to refresh
    const mainArea = document.querySelector('.d-main') || document.getElementById('mobile-app');
    if (mainArea) {
      let pullStartY = 0;
      let isPulling = false;
      
      mainArea.addEventListener('touchstart', (e) => {
        if (mainArea.scrollTop === 0) {
          pullStartY = e.touches[0].clientY;
          isPulling = true;
        }
      }, { passive: true });

      mainArea.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        const pullDistance = e.touches[0].clientY - pullStartY;
        if (pullDistance > 80) {
          showPullToRefresh();
        }
      }, { passive: true });

      mainArea.addEventListener('touchend', () => {
        if (isPulling) {
          isPulling = false;
          hidePullToRefresh();
        }
      }, { passive: true });
    }
  }

  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }

  function handleTouchMove(e) {
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchX - touchStartX;
    const deltaY = touchY - touchStartY;

    // Detect left edge swipe to open drawer
    if (touchStartX < 30 && deltaX > 50 && Math.abs(deltaY) < 50) {
      if (window.openDrawer) window.openDrawer();
    }
  }

  function handleTouchEnd(e) {
    const touchDuration = Date.now() - touchStartTime;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;

    // Quick swipe back to close drawer
    if (deltaX < -50 && touchDuration < 300) {
      if (window.closeDrawer) window.closeDrawer();
    }
  }

  function handleChatItemTouchStart(e) {
    const item = e.target.closest('.d-chat-item, .m-drawer-item');
    if (item) {
      touchStartX = e.touches[0].clientX;
      currentSwipeItem = item;
      item.style.transition = 'none';
    }
  }

  function handleChatItemTouchMove(e) {
    if (!currentSwipeItem) return;
    const deltaX = e.touches[0].clientX - touchStartX;
    
    // Limit swipe distance
    if (deltaX < -100) {
      currentSwipeItem.style.transform = `translateX(${deltaX}px)`;
      currentSwipeItem.style.background = 'var(--red)';
    } else if (deltaX > 0) {
      currentSwipeItem.style.transform = `translateX(${Math.min(deltaX, 50)}px)`;
    }
  }

  function handleChatItemTouchEnd(e) {
    if (!currentSwipeItem) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    
    currentSwipeItem.style.transition = 'transform 0.3s ease';
    
    if (deltaX < -100) {
      // Swiped far enough - delete
      const chatId = currentSwipeItem.dataset.chatId || currentSwipeItem.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
      if (chatId && confirm('Delete this chat?')) {
        deleteChatBySwipe(chatId);
      }
    }
    
    // Reset position
    currentSwipeItem.style.transform = 'translateX(0)';
    currentSwipeItem.style.background = '';
    currentSwipeItem = null;
  }

  function deleteChatBySwipe(chatId) {
    // Remove from state
    if (window.state && window.state.chats) {
      window.state.chats = window.state.chats.filter(c => c.id !== chatId);
      localStorage.setItem('nova_chats', JSON.stringify(window.state.chats));
      if (window.renderChatList) window.renderChatList();
      showToast('Chat deleted');
    }
  }

  function showPullToRefresh() {
    let indicator = document.getElementById('pull-refresh-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'pull-refresh-indicator';
      indicator.innerHTML = '↻ Pull to refresh';
      indicator.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 50px;
        background: var(--accent-glow);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--accent-light);
        font-size: 14px;
        z-index: 1000;
        transform: translateY(-100%);
        transition: transform 0.3s ease;
      `;
      document.body.appendChild(indicator);
    }
    indicator.style.transform = 'translateY(0)';
  }

  function hidePullToRefresh() {
    const indicator = document.getElementById('pull-refresh-indicator');
    if (indicator) {
      indicator.style.transform = 'translateY(-100%)';
      setTimeout(() => indicator.remove(), 300);
    }
  }

  // Long press for context menu
  let longPressTimer;
  function initLongPress() {
    const chatItems = document.querySelectorAll('.d-chat-item, .m-drawer-item');
    chatItems.forEach(item => {
      item.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
          showContextMenu(e, item);
        }, 500);
      }, { passive: true });
      
      item.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
      }, { passive: true });
      
      item.addEventListener('touchmove', () => {
        clearTimeout(longPressTimer);
      }, { passive: true });
    });
  }

  function showContextMenu(e, item) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = `
      position: fixed;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px 0;
      z-index: 1000;
      box-shadow: var(--shadow-lg);
    `;
    menu.innerHTML = `
      <div class="context-item" style="padding: 10px 16px; cursor: pointer;" onclick="renameChatFromMenu(this)">✏️ Rename</div>
      <div class="context-item" style="padding: 10px 16px; cursor: pointer;" onclick="deleteChatFromMenu(this)">🗑️ Delete</div>
      <div class="context-item" style="padding: 10px 16px; cursor: pointer;" onclick="favoriteChatFromMenu(this)">⭐ Favorite</div>
    `;
    
    const touch = e.touches[0];
    menu.style.left = touch.clientX + 'px';
    menu.style.top = touch.clientY + 'px';
    menu.dataset.chatId = item.dataset.chatId;
    
    document.body.appendChild(menu);
    
    // Close on tap elsewhere
    setTimeout(() => {
      document.addEventListener('touchstart', function closeMenu() {
        menu.remove();
        document.removeEventListener('touchstart', closeMenu);
      }, { once: true });
    }, 100);
  }

  // Double tap to edit message
  function initDoubleTap() {
    const chatArea = document.querySelector('.d-chat-area, .m-chat-area');
    if (!chatArea) return;
    
    let lastTap = 0;
    chatArea.addEventListener('click', (e) => {
      const bubble = e.target.closest('.d-bubble, .m-bubble');
      if (!bubble) return;
      
      const currentTime = Date.now();
      if (currentTime - lastTap < 300) {
        // Double tap detected
        const msgDiv = bubble.closest('.d-msg, .m-msg');
        if (msgDiv && !msgDiv.classList.contains('user')) {
          // Only allow editing AI messages
          enableMessageEdit(msgDiv);
        }
      }
      lastTap = currentTime;
    });
  }

  function enableMessageEdit(msgDiv) {
    const bubble = msgDiv.querySelector('.d-bubble, .m-bubble');
    const originalContent = bubble.innerHTML;
    
    bubble.contentEditable = true;
    bubble.focus();
    
    bubble.addEventListener('blur', () => {
      bubble.contentEditable = false;
      // Save to history if changed
      const newContent = bubble.innerText;
      if (newContent !== originalContent && window.state) {
        // Update in chat history
        const msgIndex = Array.from(msgDiv.parentNode.children).indexOf(msgDiv);
        if (window.state.history[msgIndex]) {
          window.state.history[msgIndex].content = newContent;
          window.saveCurrentChat();
        }
      }
    }, { once: true });
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initTouchGestures, 1000);
      setTimeout(initLongPress, 2000);
      setTimeout(initDoubleTap, 2000);
    });
  } else {
    setTimeout(initTouchGestures, 1000);
    setTimeout(initLongPress, 2000);
    setTimeout(initDoubleTap, 2000);
  }

  // Export for manual init
  window.initTouchGestures = initTouchGestures;
  console.log('[Touch Gestures] Module loaded - Swipe, long press, pull to refresh');
})();
