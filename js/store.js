// Local-only persistence (localStorage). Nothing here ever leaves the device.
// Every access is wrapped: private mode or cleared site data must not break the app.

const PREFIX = 'pa.';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}

export const DEFAULT_SETTINGS = {
  modelId: '',               // chosen in UI; empty = recommended default
  contextWindow: 2048,       // smaller KV cache = less memory on a 4 GB iPad
  temperature: 0.2,
  autoClearScreen: true,     // drop OCR text right after the answer that used it
  saveScreenTurns: false,    // never persist turns that used screen context unless opted in
  autoTools: true,           // allow the model to pick tools
  preferences: '',           // explicitly saved user preferences, added to the system prompt
  permissions: {},           // toolName -> 'allow' | 'ask' | 'off'
};

export const store = {
  settings() { return { ...DEFAULT_SETTINGS, ...read('settings', {}) }; },
  saveSettings(s) { return write('settings', s); },

  history() { return read('history', []); },
  saveHistory(h) { return write('history', h.slice(-40)); },

  notes() { return read('notes', []); },
  saveNotes(n) { return write('notes', n); },

  macros() { return read('macros', []); },
  saveMacros(m) { return write('macros', m); },

  // Non-sensitive action log: tool name, outcome, timestamp. Never inputs/outputs.
  log() { return read('actionlog', []); },
  addLog(entry) { const l = read('actionlog', []); l.push({ ...entry, at: new Date().toISOString() }); write('actionlog', l.slice(-200)); },

  benchmarks() { return read('bench', []); },
  addBenchmark(b) { const l = read('bench', []); l.push(b); write('bench', l.slice(-30)); },

  draft() { return read('draft', ''); },
  saveDraft(d) { write('draft', d); },

  wipe() {
    try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)); } catch {}
  },
};
