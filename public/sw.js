const CACHE_NAME = 'meditron-v1';
const urlsToCache = [
  '/',
  '/logo.png',
  '/manifest.json'
];

// Install event - cache assets
globalThis.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  globalThis.skipWaiting();
});

// Activate event - clean old caches
globalThis.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  globalThis.clients.claim();
});

// Fetch event - serve from cache, fallback to network
globalThis.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Background sync for timer
globalThis.addEventListener('sync', (event) => {
  if (event.tag === 'timer-sync') {
    event.waitUntil(syncTimer());
  }
});

// Handle messages from the main app
globalThis.addEventListener('message', (event) => {
  if (event.data?.type === 'TIMER_START') {
    // Store timer start time
    globalThis.timerData = {
      startTime: event.data.startTime,
      isRunning: true
    };
  }
  
  if (event.data?.type === 'TIMER_STOP') {
    globalThis.timerData = {
      isRunning: false
    };
  }

  if (event.data?.type === 'SKIP_WAITING') {
    globalThis.skipWaiting();
  }
});

// Periodic background sync (if supported)
globalThis.addEventListener('periodicsync', (event) => {
  if (event.tag === 'timer-update') {
    event.waitUntil(updateTimerInBackground());
  }
});

async function syncTimer() {
  // Sync timer data with server
  try {
    const response = await fetch('/api/timer');
    const data = await response.json();
    
    // Notify all clients about the update
    const clients = await globalThis.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'TIMER_SYNC',
        data: data
      });
    });
  } catch (error) {
    console.error('Error syncing timer:', error);
  }
}

async function updateTimerInBackground() {
  if (globalThis.timerData?.isRunning) {
    await syncTimer();
  }
}

// Keep alive mechanism
let keepAliveInterval;

globalThis.addEventListener('message', (event) => {
  if (event.data?.type === 'KEEP_ALIVE_START') {
    if (!keepAliveInterval) {
      keepAliveInterval = setInterval(() => {
        // Keep the service worker alive
        globalThis.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'KEEP_ALIVE_PING' });
          });
        });
      }, 20000); // Every 20 seconds
    }
  }
  
  if (event.data?.type === 'KEEP_ALIVE_STOP') {
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
  }
});
