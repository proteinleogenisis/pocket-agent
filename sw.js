// Offline support: precaches the app shell and vendored engines (OCR, Python, model runtime).
// Model weights are cached separately by WebLLM; this worker never touches them.
const VERSION = '6db4823b06aa';
const CACHE = `pocket-agent-${VERSION}`;
const FILES = [
  "./",
  "callback.html",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "index.html",
  "js/actions.js",
  "js/agent.js",
  "js/app.js",
  "js/calc.js",
  "js/device.js",
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
  "shortcuts/manifest.json",
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

// Big models live on a GitHub branch (served by raw.githubusercontent.com, which school networks allow).
// The page asks for ./models/remote/<model>/resolve/main/<file>; this worker fetches it from there and
// joins files that were split in two to fit GitHub's 100 MB limit.
const REMOTE = {
  'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC': {
    base: 'https://raw.githubusercontent.com/proteinleogenisis/pocket-agent/models-1.5b/',
    split: { 'params_shard_0.bin': ['params_shard_0.bin.partaa', 'params_shard_0.bin.partab'] },
  },
};
async function remoteFile(id, file) {
  const m = REMOTE[id]; if (!m) return new Response('unknown model', { status: 404 });
  const parts = m.split[file];
  if (!parts) {
    const r = await fetch(m.base + file, { cache: 'no-store' });
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': file.endsWith('.json') ? 'application/json' : 'application/octet-stream', ...(r.headers.get('content-length') && { 'Content-Length': r.headers.get('content-length') }) } });
  }
  const rs = await Promise.all(parts.map((p) => fetch(m.base + p, { cache: 'no-store' })));
  if (rs.some((r) => !r.ok)) return new Response('part missing', { status: 502 });
  const total = rs.reduce((n, r) => n + Number(r.headers.get('content-length') || 0), 0);
  let i = 0, reader = rs[0].body.getReader();
  const body = new ReadableStream({
    async pull(ctl) {
      for (;;) {
        const { done, value } = await reader.read();
        if (!done) { ctl.enqueue(value); return; }
        if (++i >= rs.length) { ctl.close(); return; }
        reader = rs[i].body.getReader();
      }
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/octet-stream', ...(total && { 'Content-Length': String(total) }) } });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const rm = url.origin === location.origin && /\/models\/remote\/([^/]+)\/resolve\/main\/(.+)$/.exec(url.pathname);
  if (rm && e.request.method === 'GET') { e.respondWith(remoteFile(decodeURIComponent(rm[1]), decodeURIComponent(rm[2]))); return; }
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return; // dev server: always fresh files
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/models/')) return; // model files: WebLLM caches them itself
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request, { ignoreSearch: e.request.mode === 'navigate' });
    if (hit) return hit;
    try { return await fetch(e.request); }
    catch { return (e.request.mode === 'navigate' && await cache.match('./')) || Response.error(); }
  })());
});
