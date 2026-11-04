// Offline support: precaches the app shell and vendored engines (OCR, Python, model runtime).
// Model weights are cached separately by WebLLM; this worker never touches them.
const VERSION = '__VERSION__';
const CACHE = `pocket-agent-${VERSION}`;
const FILES = __FILES__;

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the HTTP cache, so a new version never stores stale files.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pocket-agent-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return; // dev server: always fresh files
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/models/')) return; // model files: WebLLM caches them itself
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request, { ignoreSearch: e.request.mode === 'navigate' });
    if (hit) return hit;
    try { return await fetch(e.request); }
    catch { return (e.request.mode === 'navigate' && await cache.match('./')) || Response.error(); }
  })());
});
