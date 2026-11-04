// Sandboxed JavaScript runner. Runs in its own worker, killed by the page on timeout.
// Network and storage APIs are removed before user code runs.
for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'navigator', 'BroadcastChannel', 'Worker']) {
  try { Object.defineProperty(self, k, { value: undefined, configurable: false, writable: false }); } catch {}
}

const fmt = (v) => {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, 2) ?? String(v); } catch { return String(v); }
};

self.onmessage = async ({ data }) => {
  const out = [];
  const log = (...a) => { out.push(a.map(fmt).join(' ')); if (out.length > 500) throw new Error('Too much output'); };
  const sandboxConsole = { log, info: log, warn: log, error: log, debug: log, table: log };
  try {
    const fn = new Function('console', `"use strict";\nreturn (async () => {\n${data.code}\n})();`);
    const result = await fn(sandboxConsole);
    if (result !== undefined) out.push('⇒ ' + fmt(result));
    self.postMessage({ ok: true, output: out.join('\n') });
  } catch (e) {
    self.postMessage({ ok: false, output: out.join('\n'), error: `${e?.name || 'Error'}: ${e?.message || e}` });
  }
};
