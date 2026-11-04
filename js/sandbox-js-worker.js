// Sandboxed JavaScript runner. Runs in its own worker, killed by the page on timeout.
// Network and storage APIs are removed before user code runs.
for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'navigator', 'BroadcastChannel', 'Worker']) {
  try { Object.defineProperty(self, k, { value: undefined, configurable: false, writable: false }); } catch {}
}

const fmt = (v) => {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (typeof v === 'function') return `[function ${v.name || 'anonymous'}]`;
  try { return JSON.stringify(v, null, 2) ?? String(v); } catch { return String(v); }
};

// There is no web page in the sandbox. Model-written code often assumes one, so:
// `window` works as an alias of the global scope, alert/confirm/prompt print,
// and touching `document` explains why instead of crashing with a ReferenceError.
const noPage = (what) => new Proxy(function () {}, {
  get(_, prop) {
    if (prop === Symbol.toPrimitive || prop === 'toString') return () => `[${what} — not available]`;
    throw new Error(`${what}.${String(prop)} isn't available: code runs in a sandbox with no web page. Use console.log() to show results.`);
  },
  apply() { throw new Error(`${what} isn't available in the sandbox.`); },
});

self.onmessage = async ({ data }) => {
  const out = [];
  const log = (...a) => { out.push(a.map(fmt).join(' ')); if (out.length > 500) throw new Error('Too much output'); };
  const sandboxConsole = { log, info: log, warn: (...a) => log('⚠︎', ...a), error: (...a) => log('✖', ...a), debug: log, table: log, dir: log };

  // Track timers so output from setTimeout/promises after the main body still shows up.
  let pending = 0;
  const timeouts = new Set(), intervals = new Set();
  const setT = (fn, ms, ...args) => { pending++; const id = setTimeout(() => { pending--; timeouts.delete(id); try { typeof fn === 'function' && fn(...args); } catch (e) { log('✖', e); } }, ms); timeouts.add(id); return id; };
  const clearT = (id) => { if (timeouts.delete(id)) { pending--; clearTimeout(id); } };
  const setI = (fn, ms, ...args) => { const id = setInterval(() => { try { fn(...args); } catch (e) { log('✖', e); } }, ms); intervals.add(id); return id; };
  const clearI = (id) => { intervals.delete(id); clearInterval(id); };

  const shims = {
    console: sandboxConsole,
    window: self, globalThis: self,
    alert: (m) => log(String(m)),
    confirm: (m) => { log(`${m} → (sandbox answers yes)`); return true; },
    prompt: (m, d = '') => { log(`${m} → (sandbox answers "${d}")`); return d; },
    document: noPage('document'), localStorage: noPage('localStorage'), sessionStorage: noPage('sessionStorage'),
    require: (name) => { throw new Error(`require('${name}') isn't available: no Node.js or npm packages in the sandbox.`); },
    module: { exports: {} }, exports: {},
    setTimeout: setT, clearTimeout: clearT, setInterval: setI, clearInterval: clearI,
  };

  try {
    const names = Object.keys(shims);
    const fn = new Function(...names, `"use strict";\nreturn (async () => {\n${data.code}\n})();`);
    const result = await fn(...names.map((n) => shims[n]));
    // Let short timers finish (up to ~3 s), then stop intervals.
    const until = Date.now() + 3000;
    while ((pending > 0 || intervals.size) && Date.now() < until) await new Promise((r) => setTimeout(r, 25));
    if (intervals.size) { intervals.forEach(clearInterval); out.push('(stopped a setInterval after 3 s)'); }
    if (result !== undefined) out.push('⇒ ' + fmt(result));
    if (!out.length) out.push('(ran without output — the code only defines things. Add a console.log(...) call to see a result.)');
    self.postMessage({ ok: true, output: out.join('\n') });
  } catch (e) {
    self.postMessage({ ok: false, output: out.join('\n'), error: `${e?.name || 'Error'}: ${e?.message || e}` });
  }
};
