// Page-side controller for the code sandboxes: one worker per language, hard timeouts.

function runInWorker(url, code, timeoutMs, keep) {
  return new Promise((resolve) => {
    const w = keep.worker || new Worker(url, { type: 'module' });
    keep.worker = w;
    const timer = setTimeout(() => {
      w.terminate(); keep.worker = null;
      resolve({ ok: false, output: '', error: `Stopped after ${timeoutMs / 1000}s (timeout).` });
    }, timeoutMs);
    w.onmessage = ({ data }) => { if (data.warm) return; clearTimeout(timer); resolve(data); };
    w.onerror = (e) => { clearTimeout(timer); w.terminate(); keep.worker = null; resolve({ ok: false, output: '', error: e.message || 'Worker error' }); };
    w.postMessage({ code });
  });
}

const jsKeep = {}, pyKeep = {};
const JS_URL = new URL('./sandbox-js-worker.js', import.meta.url);
const PY_URL = new URL('./sandbox-py-worker.js', import.meta.url);

export function runJS(code, timeoutMs = 5000) {
  // Fresh worker each time for JS: no state leaks between runs.
  return runInWorker(JS_URL, code, timeoutMs, {});
}
export function runPython(code, timeoutMs = 30000) {
  // Python worker is reused (runtime load is the slow part) but each run gets a fresh namespace.
  return runInWorker(PY_URL, code, timeoutMs, pyKeep);
}
export function warmPython() {
  if (pyKeep.worker) return;
  pyKeep.worker = new Worker(PY_URL, { type: 'module' });
  pyKeep.worker.postMessage({ warm: true });
}
