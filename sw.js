const CACHE_NAME = 'qd-cache-v4';
const PRECACHE_URLS = [
  './index.html',
  './site.webmanifest',
  './android-chrome-192x192.png',
  './android-chrome-512x512.png',
  './apple-touch-icon.png',
  './favicon-16x16.png',
  './favicon-32x32.png',
  './favicon.ico'
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

  // Do NOT intercept non-GETs (e.g., Supabase auth POST, GA POST) or cross-origin requests
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNavigate = req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));

  if (isNavigate) {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
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
  // Avoid logging raw payloads in production; parse best-effort
  let raw = null;
  try { raw = event?.data || null; } catch { raw = null; }

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
  const type = pushData.type; // 'start_soon' | 'result' | custom
  const quizId = pushData.quizId;
  // Derive a sensible default URL if not provided
  let url = typeof pushData.url === 'string' ? pushData.url : undefined;
  if (!url && quizId && typeof quizId === 'string') {
    if (type === 'start_soon') url = `/quiz/${quizId}`;
    else if (type === 'result') url = `/results/${quizId}`;
  }

  // Per-quiz tag so we can replace/close start-soon when result arrives
  const baseTag = 'quiz-dangal';
  // Use distinct tags per type so start-soon and result can coexist
  const tag = quizId ? `${baseTag}-${quizId}-${type || 'general'}` : `${baseTag}-general`;

  // Keep important notifications visible until user interacts
  const requireInteraction = type === 'start_soon' || type === 'result';

  const options = {
    body: pushData.body || 'You have a new message.',
    // Use absolute paths to avoid scope/path issues across origins/scopes
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag,
    renotify: true,
    requireInteraction,
    actions: [
      { action: 'open', title: 'Open App' },
    ],
    data: { url, type, quizId },
  };

  // Show notification (no auto-closing other notices)
  const showPromise = (async () => {
    return self.registration.showNotification(title, options);
  })();

  event.waitUntil(showPromise);
});

// Focus app on notification click (and open if not already open)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlFromData = event?.notification?.data?.url;

  // Sanitize target URL to same-origin relative path
  function toSafePath(u) {
    try {
      if (!u || typeof u !== 'string') return '/#/';
      const absolute = new URL(u, self.location.origin);
      if (absolute.origin !== self.location.origin) return '/#/';
      // Return path + search + hash to keep in-app routing
      return absolute.pathname + absolute.search + absolute.hash;
    } catch {
      return '/#/';
    }
  }

  const targetUrl = toSafePath(urlFromData);
  const action = event.action;
  event.waitUntil((async () => {
    // If an action was provided (like 'open'), we can branch logic here in future.
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      // If app is already open, focus it and optionally navigate
      try {
        if ('focus' in client) await client.focus();
        // Only navigate if a distinct URL is provided and different
        if (targetUrl && client.url && !client.url.endsWith(targetUrl)) {
          client.navigate(targetUrl).catch(()=>{});
        }
        return;
      } catch {}
    }
    // Otherwise open a new window
    try { await clients.openWindow(targetUrl); } catch {}
  })());
});
