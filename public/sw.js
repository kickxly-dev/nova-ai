/**
 * PWA Service Worker - Offline support
 */

const CACHE_NAME = 'nova-ai-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/changelog.css',
  '/plugins/plugins.css'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and API calls
  if (event.request.method !== 'GET' || 
      event.request.url.includes('/api/') ||
      event.request.url.includes('google') ||
      event.request.url.includes('github')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached or fetch from network
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache new responses
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'send-message') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  const pending = await getPendingMessages();
  for (const msg of pending) {
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });
      await removePendingMessage(msg.id);
    } catch (e) {
      console.error('Failed to sync message:', e);
    }
  }
}

// Helper functions for IndexedDB
function getPendingMessages() {
  return new Promise((resolve) => {
    const request = indexedDB.open('nova-offline', 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('pending', { keyPath: 'id' });
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('pending', 'readonly');
      const store = tx.objectStore('pending');
      const getAll = store.getAll();
      getAll.onsuccess = () => resolve(getAll.result);
    };
  });
}

function removePendingMessage(id) {
  return new Promise((resolve) => {
    const request = indexedDB.open('nova-offline', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('pending', 'readwrite');
      const store = tx.objectStore('pending');
      store.delete(id);
      tx.oncomplete = resolve;
    };
  });
}
