const CACHE_NAME = 'meditron-v3';
const STATIC_CACHE = 'meditron-static-v1';

// Assets estáticos que se cachean durante instalación
const urlsToCache = [
  '/manifest.json',
  '/logo.png'
];

// Install event - cache minimal assets
globalThis.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  globalThis.skipWaiting();
});

// Activate event - clean ALL old caches immediately
globalThis.addEventListener('activate', (event) => {
  const cacheWhitelist = new Set([CACHE_NAME, STATIC_CACHE]);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.has(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  globalThis.clients.claim();
});

// Fetch event - estrategia inteligente según tipo de recurso
globalThis.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip API calls - always network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Cache-first para assets estáticos (imágenes, fuentes)
  if (event.request.destination === 'image' || 
      event.request.destination === 'font' ||
      url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }
  
  // Network-first para Next.js y HTML
  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(() => caches.match(event.request))
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
