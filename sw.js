// Offline support: precaches the app shell and vendored engines (OCR, Python, model runtime).
// Model weights are cached separately by WebLLM; this worker never touches them.
const VERSION = '6ce29cc70fd0';
const CACHE = `pocket-agent-${VERSION}`;
const FILES = [
  "./",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "index.html",
  "js/actions.js",
  "js/agent.js",
  "js/app.js",
  "js/calc.js",
  "js/llm-worker.js",
  "js/llm.js",
  "js/net.js",
  "js/ocr.js",
  "js/sandbox-js-worker.js",
  "js/sandbox-py-worker.js",
  "js/sandbox.js",
  "js/store.js",
  "js/web.js",
  "manifest.webmanifest",
  "styles.css",
  "vendor/pyodide/pyodide-lock.json",
  "vendor/pyodide/pyodide.asm.mjs",
  "vendor/pyodide/pyodide.asm.wasm",
  "vendor/pyodide/pyodide.mjs",
  "vendor/pyodide/python_stdlib.zip",
  "vendor/tesseract/core/tesseract-core-lstm.wasm.js",
  "vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js",
  "vendor/tesseract/lang/eng.traineddata.gz",
  "vendor/tesseract/tesseract.min.js",
  "vendor/tesseract/worker.min.js",
  "vendor/web-llm/index.js"
];

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
