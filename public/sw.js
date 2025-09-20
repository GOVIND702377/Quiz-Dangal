const CACHE_NAME = 'qd-cache-v3';
const PRECACHE_URLS = [
  '/index.html',
  '/site.webmanifest',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((name) => name !== CACHE_NAME && caches.delete(name))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const isNavigate = req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));

  if (isNavigate) {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For app assets like CSS/JS/Fonts, prefer network-first so new deployments reflect immediately.
  const dest = req.destination;
  if (dest === 'style' || dest === 'script' || dest === 'font') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          // Optionally update cache for offline support
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Default: cache-first for icons/images and other GETs
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push Notification Event Listener
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  let raw = null;
  try { raw = event?.data || null; } catch { raw = null; }
  if (raw) {
    try { console.log(`[Service Worker] Push had this data: "${raw.text()}"`); } catch {}
  }

  let pushData;
  try {
    pushData = raw ? raw.json() : null;
  } catch (e) {
    pushData = null;
  }
  if (!pushData) {
    pushData = {
      title: 'Quiz Dangal',
      body: raw ? (()=>{ try { return raw.text(); } catch { return 'You have a new message.'; } })() : 'You have a new message.',
    };
  }

  const title = pushData.title || 'New Notification';
  const options = {
    body: pushData.body || 'You have a new message.',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
