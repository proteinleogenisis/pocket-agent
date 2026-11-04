// Offline Python (Pyodide / CPython on WebAssembly). Standard library only.
import { loadPyodide } from '../vendor/pyodide/pyodide.mjs';

let pyReady = null;
function init() {
  if (!pyReady) {
    pyReady = loadPyodide({ indexURL: new URL('../vendor/pyodide/', import.meta.url).href }).then((py) => {
      // After the runtime is loaded, remove network access from the worker.
      for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts']) {
        try { Object.defineProperty(self, k, { value: undefined, configurable: false, writable: false }); } catch {}
      }
      // There's no browser window inside the sandbox; explain instead of crashing.
      py.runPython(`
import webbrowser
def _no_browser(url, *a, **k):
    print(f"[sandbox] Python can't open {url} here. Ask Pocket Agent: open {url}")
    return False
webbrowser.open = webbrowser.open_new = webbrowser.open_new_tab = _no_browser
`);
      return py;
    });
  }
  return pyReady;
}

self.onmessage = async ({ data }) => {
  if (data.warm) { try { await init(); self.postMessage({ warm: true, ok: true }); } catch (e) { self.postMessage({ warm: true, ok: false, error: String(e) }); } return; }
  const out = [];
  try {
    const py = await init();
    py.setStdout({ batched: (s) => out.push(s) });
    py.setStderr({ batched: (s) => out.push(s) });
    // Fresh namespace per run so runs don't leak state into each other.
    const ns = py.globals.get('dict')();
    const result = await py.runPythonAsync(data.code, { globals: ns });
    if (result !== undefined && result !== null) out.push('⇒ ' + String(result));
    ns.destroy?.();
    self.postMessage({ ok: true, output: out.join('\n') });
  } catch (e) {
    const msg = String(e?.message || e).split('\n').filter(Boolean).slice(-6).join('\n');
    self.postMessage({ ok: false, output: out.join('\n'), error: msg });
  }
};
