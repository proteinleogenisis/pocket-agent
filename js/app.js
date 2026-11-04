import { llm, CANDIDATES, probeGPU, modelIdFor, modelRecord, isCached, deleteCached, diagnoseNetwork, isMirrored } from './llm.js';
import { handle, runTool, TOOLS, permissionFor, route, ROUTER_TESTS } from './agent.js';
import { analyzeImage, toContext, warmOCR } from './ocr.js';
import { warmPython } from './sandbox.js';
import { store } from './store.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

let settings = store.settings();
let history = store.history();          // [{role, content}] — never contains screen text
let screen = null;                      // { text, lines, ms } — memory only
let busy = false;

// ---------------- Rendering ----------------
function renderMarkdown(container, md) {
  container.replaceChildren();
  const parts = md.split(/```([\w+-]*)\n?([\s\S]*?)(?:```|$)/g);
  for (let i = 0; i < parts.length; i += 3) {
    const prose = parts[i];
    if (prose?.trim()) for (const para of prose.trim().split(/\n{2,}/)) {
      const p = el('p');
      for (const [j, seg] of para.split(/`([^`\n]+)`/g).entries()) {
        if (j % 2) p.append(el('code', null, seg));
        else seg.split('\n').forEach((ln, k) => { if (k) p.append(el('br')); p.append(ln.replace(/\*\*(.+?)\*\*/g, '$1')); });
      }
      container.append(p);
    }
    if (i + 2 < parts.length) container.append(codeBlock(parts[i + 1], parts[i + 2].replace(/\n$/, '')));
  }
}

function codeBlock(lang, code) {
  const wrap = el('div', 'codeblock');
  wrap.append(el('pre', null, code));
  const tools = el('div', 'tools');
  const copy = el('button', null, 'Copy');
  copy.onclick = async () => { try { await navigator.clipboard.writeText(code); copy.textContent = 'Copied'; } catch { copy.textContent = 'Copy failed'; } setTimeout(() => copy.textContent = 'Copy', 1200); };
  tools.append(copy);
  const l = lang.toLowerCase();
  const runTarget = ['js', 'javascript', 'mjs'].includes(l) ? 'run_javascript' : ['py', 'python', 'python3'].includes(l) ? 'run_python' : null;
  if (runTarget) {
    const run = el('button', null, '▶ Run');
    // A tap on Run is the user's explicit confirmation.
    run.onclick = () => runDirect({ tool: runTarget, input: code }, { preconfirmed: true });
    tools.append(run);
  }
  wrap.append(tools);
  return wrap;
}

function addMsg(kind, text, meta) {
  $('log').querySelector('.empty')?.remove();
  const m = el('div', `msg ${kind}`);
  if (kind === 'assistant') renderMarkdown(m, text); else m.textContent = text;
  if (meta) m.append(el('div', 'meta', meta));
  $('log').append(m);
  m.scrollIntoView({ block: 'end' });
  return m;
}

function renderEmpty() {
  const d = el('div', 'empty');
  d.innerHTML = `<p><b>Pocket Agent</b> — a private coding assistant that runs entirely on this iPad.</p>
  <p>Ask a question, paste a screenshot (<kbd>⌘V</kbd>) to ask about what's on screen, or try <code>/help</code>.</p>
  <p class="small"><kbd>⌘⇧Space</kbd> or <kbd>⌘K</kbd> focus · <kbd>Esc</kbd> stop/clear · <kbd>⌘⇧X</kbd> clear screen context</p>`;
  $('log').append(d);
}

function renderHistory() {
  $('log').replaceChildren();
  if (!history.length) return renderEmpty();
  for (const h of history) addMsg(h.role === 'user' ? 'user' : 'assistant', h.content);
}

function status(t) { $('status').hidden = !t; $('status').textContent = t || ''; }
function setBusy(b) { busy = b; $('sendBtn').classList.toggle('stop', b); $('sendBtn').textContent = b ? '■' : '↑'; $('sendBtn').setAttribute('aria-label', b ? 'Stop' : 'Send'); }

function fmtStats(s) {
  const x = s?.extra; if (!x) return '';
  return `${s.completion_tokens} tok · ${x.decode_tokens_per_s?.toFixed(1)} tok/s · first token ${x.time_to_first_token_s?.toFixed(1)}s`;
}

// ---------------- Confirm dialog ----------------
function confirmAction({ tool, input, fromModel }) {
  return new Promise((resolve) => {
    const d = $('confirmDlg');
    $('confirmTitle').textContent = `Run ${tool.replace(/_/g, ' ')}?`;
    $('confirmWhy').textContent = (fromModel ? 'The model chose this action. ' : '') + (screen ? 'Screen text is in context — check this was your request, not text on screen. ' : '') + TOOLS[tool].desc;
    $('confirmBody').textContent = input;
    d.returnValue = '';
    d.onclose = () => { resolve(d.returnValue === 'yes'); $('input').focus(); };
    d.showModal();
    $('confirmYes').focus();
  });
}

// ---------------- Sending ----------------
async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  $('input').value = ''; autosize(); store.saveDraft('');
  addMsg('user', text);
  setBusy(true);
  const usedScreen = !!screen;
  let live = null;
  try {
    const res = await handle({
      text, llm, settings, history, screen: screen?.text, ui: {
        status,
        token: (t) => { if (!live) live = addMsg('assistant', ''); renderMarkdown(live, t); live.scrollIntoView({ block: 'end' }); },
        confirm: confirmAction,
      },
    });
    if (res.kind === 'meta') { await meta(res.meta, res.input); return; }
    if (res.kind === 'answer') {
      if (!live) live = addMsg('assistant', res.text || '(empty answer)'); else renderMarkdown(live, res.text);
      const st = fmtStats(res.stats); if (st) live.append(el('div', 'meta', st + (usedScreen ? ' · used screen text' : '')));
      remember(text, res.text, usedScreen);
    } else if (res.kind === 'tool') {
      addMsg(`tool${res.ok ? '' : ' fail'}`, res.text, `${res.tool} · ${res.ok ? 'done' : 'not completed'}`);
      remember(text, `[${res.tool}] ${res.text}`, usedScreen);
    } else {
      addMsg('err', res.text);
    }
  } catch (e) {
    addMsg('err', `Error: ${e?.message || e}`);
  } finally {
    setBusy(false); status('');
    if (usedScreen && settings.autoClearScreen) clearScreen('Screen text cleared after use.');
  }
}

function remember(user, assistant, usedScreen) {
  history.push({ role: 'user', content: user }, { role: 'assistant', content: assistant });
  history = history.slice(-40);
  if (usedScreen && !settings.saveScreenTurns) return; // keep in memory for this session only
  store.saveHistory(history);
}

async function runDirect(call, { preconfirmed } = {}) {
  if (busy) return;
  setBusy(true);
  try {
    const s = preconfirmed ? { ...settings, permissions: { ...settings.permissions, [call.tool]: permissionFor(call.tool, settings) === 'off' ? 'off' : 'allow' } } : settings;
    const res = await runTool(call, { settings: s, screen: null, ui: { status, confirm: confirmAction } });
    addMsg(res.kind === 'error' ? 'err' : `tool${res.ok ? '' : ' fail'}`, res.text, res.tool ? `${res.tool} · ${res.ok ? 'done' : 'not completed'}` : '');
  } finally { setBusy(false); status(''); }
}

// ---------------- Meta commands ----------------
async function meta(cmd, input) {
  switch (cmd) {
    case 'help': {
      const lines = ['Commands (run instantly, no model needed):',
        ...Object.entries(TOOLS).map(([n, t]) => `  ${t.usage.padEnd(28)} ${n} — ${permissionFor(n, settings)}`),
        '  /m name                      run a saved macro',
        '  /screen                      show the OCR text currently in context',
        '  /clear                       new chat   ·   /forget  erase chat history',
        '', 'Transforms for /tx: ' + TOOLS.transform_text.desc.split(': ')[1],
        '', 'Without a slash, the local model answers — and may suggest a tool, which you confirm.'];
      addMsg('tool', lines.join('\n'), 'help'); break;
    }
    case 'clear': newChat(); break;
    case 'forget': history = []; store.saveHistory([]); renderHistory(); break;
    case 'screen': addMsg('tool', screen ? screen.text : 'No screen context. Paste (⌘V) or attach a screenshot.', 'screen text (memory only)'); break;
    case 'm': case 'macro': {
      const mac = store.macros().find(m => m.name === input.trim());
      if (!mac) { addMsg('err', `No macro named “${input.trim()}”.`); break; }
      setBusy(false);
      for (const line of mac.body.split('\n').map(s => s.trim()).filter(Boolean)) {
        if (!line.startsWith('/') || /^\/m(acro)?\b/.test(line)) { addMsg('err', `Macro line skipped (macros may only contain /commands): ${line}`); continue; }
        await send(line);
      }
      break;
    }
    default: addMsg('err', `Unknown command /${cmd}. Try /help.`);
  }
}

function newChat() { history = []; store.saveHistory([]); renderHistory(); llm.engine?.resetChat?.().catch(() => {}); $('input').focus(); }

// ---------------- Screen context ----------------
async function ingestImage(blob) {
  if (!blob?.type?.startsWith('image/')) return;
  if (busy) return;
  setBusy(true);
  try {
    status('Reading screenshot on-device…');
    const r = await analyzeImage(blob, { onProgress: (m) => { if (m.status === 'recognizing text') status(`Reading screenshot… ${Math.round(m.progress * 100)}%`); } });
    screen = { text: toContext(r), lines: r.lines.length, ms: r.ms };
    $('screenPill').hidden = false; $('screenCount').textContent = `· ${r.lines.length} lines`;
    addMsg('tool', `Read ${r.lines.length} text lines in ${(r.ms / 1000).toFixed(1)}s (${r.observations.join(', ')}). The image was discarded; only the text is kept in memory${settings.autoClearScreen ? ' until your next answer' : ''}.`, 'screen context ON');
  } catch (e) {
    addMsg('err', `Couldn't read the image: ${e?.message || e}`);
  } finally { setBusy(false); status(''); $('input').focus(); }
}

function clearScreen(msg) {
  if (!screen) return;
  screen = null;
  $('screenPill').hidden = true;
  if (msg) addMsg('tool', msg, 'screen context OFF');
}

// ---------------- Model management ----------------
let gpu = null;
async function initModelUI() {
  gpu = await probeGPU();
  $('gpuInfo').textContent = gpu.ok
    ? `WebGPU ready${gpu.f16 ? ' (f16)' : ' (no f16 — using f32 weights)'} · max buffer ${(gpu.maxBuffer / 2 ** 20).toFixed(0)} MB`
    : `⚠︎ ${gpu.reason} The model can't run here, but /commands, OCR and code tools still work.`;
  const sel = $('modelSelect'); sel.replaceChildren();
  for (const c of CANDIDATES) {
    const id = modelIdFor(c.base, gpu.f16 !== false);
    if (!id) continue;
    const rec = modelRecord(id);
    const cached = await isCached(id);
    const o = el('option', null, `${cached ? '✓ ' : ''}${c.label} — ${c.note} (${Math.round(rec.vram_required_MB)} MB @4k)`);
    o.value = id; sel.append(o);
  }
  sel.value = settings.modelId || sel.options[0]?.value || '';
  $('loadModelBtn').disabled = !gpu.ok;
  if (gpu.ok && settings.autoLoad && settings.modelId && await isCached(settings.modelId)) loadModel(settings.modelId);
}

async function loadModel(id) {
  if (!id) return;
  $('modelDot').className = 'dot loading'; $('modelLabel').textContent = 'Loading…';
  $('loadProgress').hidden = false; $('loadModelBtn').disabled = true;
  try {
    await llm.load(id, {
      contextWindow: settings.contextWindow,
      onProgress: (r) => { $('loadProgress').firstElementChild.style.width = `${Math.round(r.progress * 100)}%`; $('loadText').textContent = r.text; status(r.text.slice(0, 90)); },
    });
    settings.modelId = id; store.saveSettings(settings);
    $('modelDot').className = 'dot ready';
    $('modelLabel').textContent = id.replace(/-q4f(16|32)_1-MLC$/, '');
    $('loadText').textContent = `Loaded in ${llm.loadSeconds.toFixed(1)}s. Runs offline from now on.`;
    requestPersist();
  } catch (e) {
    $('modelDot').className = 'dot'; $('modelLabel').textContent = 'Model not loaded';
    await llm.unload();
    const msg = String(e?.message || e);
    const lastStep = $('loadText').textContent;
    let why;
    if (/load failed|network|fetch|failed to fetch|NetworkError|timed out/i.test(msg)) {
      $('loadText').textContent = 'Download failed — checking which server is unreachable…';
      const net = await diagnoseNetwork(id);
      const blocked = net.filter(n => !n.ok).map(n => new URL(n.origin).host);
      why = !navigator.onLine ? 'This iPad is offline. Connect to the internet once to download the model.'
        : blocked.length ? `Can't reach ${blocked.join(' and ')} — this network (or a content filter) is blocking it.${isMirrored(id) ? '' : ' Try “Qwen2.5-Coder 0.5B”, which downloads from this app\'s own site.'}`
        : 'The connection dropped during the download. Tap “Download & load” again — finished parts are kept.';
    } else if (/quota|storage/i.test(msg)) {
      why = 'Not enough storage space for the model. Free up space on the iPad, or pick a smaller model.';
    } else if (/memory|device (was )?lost|OOM|allocation|buffer/i.test(msg)) {
      why = 'The iPad ran out of memory. Choose a 1k context window or a smaller model, and close other apps.';
    } else {
      why = 'Unexpected error.';
    }
    $('loadText').textContent = `${why}\nDetails: ${msg.slice(0, 300)}\nLast step: ${lastStep.slice(0, 160)}`;
    $('loadText').style.whiteSpace = 'pre-wrap';
    status('');
  } finally { $('loadProgress').hidden = true; $('loadModelBtn').disabled = !gpu?.ok; status(''); }
}

async function requestPersist() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch {}
  showStorage();
}
async function showStorage() {
  try {
    const e = await navigator.storage.estimate();
    const p = await navigator.storage.persisted?.();
    $('storageInfo').textContent = `Using ${(e.usage / 2 ** 30).toFixed(2)} GB of ${(e.quota / 2 ** 30).toFixed(1)} GB · ${p ? 'protected from eviction' : 'may be evicted if storage runs low'}`;
  } catch { $('storageInfo').textContent = ''; }
}

// ---------------- Benchmark ----------------
async function benchmark() {
  if (!llm.ready && !llm.recoverable) { $('benchOut').textContent = 'Load a model first.'; return; }
  if (busy) return;
  setBusy(true);
  const out = $('benchOut'); out.textContent = 'Running…';
  const r = { model: llm.modelId, ctx: settings.contextWindow, load_s: +llm.loadSeconds.toFixed(1), ua: navigator.userAgent.replace(/^.*?\(|\).*$/g, ''), at: new Date().toISOString() };
  try {
    const t0 = performance.now();
    const a = await llm.stream([{ role: 'user', content: 'Write a JavaScript function isPrime(n). Code only.' }], { maxTokens: 160, temperature: 0 });
    r.gen_s = +((performance.now() - t0) / 1000).toFixed(1);
    r.decode_tok_s = +a.stats?.extra?.decode_tokens_per_s?.toFixed(1);
    r.prefill_tok_s = +a.stats?.extra?.prefill_tokens_per_s?.toFixed(1);
    r.first_token_s = +a.stats?.extra?.time_to_first_token_s?.toFixed(2);
    out.textContent = JSON.stringify(r, null, 1) + '\nRouting tests…';
    let correct = 0; const misses = []; const t1 = performance.now();
    for (const [q, want] of ROUTER_TESTS) {
      try { const g = await route(llm, q); if (g.tool === want) correct++; else misses.push(`${want}→${g.tool}`); }
      catch (e) { misses.push(`${want}→error`); }
    }
    r.routing = `${correct}/${ROUTER_TESTS.length}`;
    r.routing_avg_s = +((performance.now() - t1) / 1000 / ROUTER_TESTS.length).toFixed(2);
    if (misses.length) r.routing_misses = misses.join(', ');
    try { const m = performance.memory; if (m) r.js_heap_mb = Math.round(m.usedJSHeapSize / 2 ** 20); } catch {}
    store.addBenchmark(r);
    out.textContent = JSON.stringify(r, null, 1);
    window.__bench = r;
  } catch (e) { out.textContent = `Benchmark failed: ${e?.message || e}`; window.__bench = { error: String(e) }; }
  finally { setBusy(false); }
}

// ---------------- Settings dialog ----------------
function openSettings() {
  $('ctxSelect').value = String(settings.contextWindow);
  $('autoLoad').checked = !!settings.autoLoad;
  $('autoClear').checked = settings.autoClearScreen;
  $('saveScreen').checked = settings.saveScreenTurns;
  $('autoTools').checked = settings.autoTools;
  $('prefs').value = settings.preferences;
  const tp = $('toolPerms'); tp.replaceChildren();
  for (const [name, t] of Object.entries(TOOLS)) {
    const row = el('div', 'toolrow');
    row.append(el('b', null, name));
    const s = el('select'); for (const v of ['allow', 'ask', 'off']) { const o = el('option', null, v); o.value = v; s.append(o); }
    s.value = permissionFor(name, settings);
    if (t.destructive || t.sensitive) { s.querySelector('[value=allow]').disabled = true; }
    s.onchange = () => { settings.permissions = { ...settings.permissions, [name]: s.value }; store.saveSettings(settings); };
    row.append(s, el('div', 'd', t.desc + (t.destructive || t.sensitive ? ' Always asks first.' : '')));
    tp.append(row);
  }
  renderMacros(); renderNotes();
  $('actionLog').textContent = store.log().slice(-30).reverse().map(l => `${l.at.slice(5, 16).replace('T', ' ')}  ${l.tool.padEnd(16)} ${l.outcome}`).join('\n') || '(empty)';
  const b = store.benchmarks(); if (b.length && !$('benchOut').textContent) $('benchOut').textContent = 'Previous runs:\n' + b.slice(-5).map(x => `${x.model} ctx${x.ctx}: ${x.decode_tok_s} tok/s, routing ${x.routing}, load ${x.load_s}s`).join('\n');
  showStorage();
  $('settingsDlg').showModal();
}
function saveSettingsFromUI() {
  settings.contextWindow = +$('ctxSelect').value;
  settings.autoLoad = $('autoLoad').checked;
  settings.autoClearScreen = $('autoClear').checked;
  settings.saveScreenTurns = $('saveScreen').checked;
  settings.autoTools = $('autoTools').checked;
  settings.preferences = $('prefs').value.slice(0, 600);
  store.saveSettings(settings);
}
function renderMacros() {
  const l = $('macroList'); l.replaceChildren();
  for (const m of store.macros()) {
    const r = el('div', 'note'); const d = el('div'); d.append(el('b', null, m.name), el('div', 'muted small', m.body.replace(/\n/g, ' · ')));
    const x = el('button', 'btn small danger', 'Delete'); x.onclick = () => { store.saveMacros(store.macros().filter(z => z.name !== m.name)); renderMacros(); };
    r.append(d, x); l.append(r);
  }
}
function renderNotes() {
  const l = $('notesList'); l.replaceChildren();
  const notes = store.notes();
  if (!notes.length) { l.textContent = 'No notes yet. Save one with /note Title\\nBody.'; return; }
  for (const n of notes.slice().reverse()) {
    const r = el('div', 'note'); const d = el('div'); d.append(el('b', null, n.title), el('div', 'muted', n.body.slice(0, 200)));
    const x = el('button', 'btn small danger', 'Delete');
    x.onclick = () => { if (confirm(`Delete note “${n.title}”?`)) { store.saveNotes(store.notes().filter(z => z.id !== n.id)); renderNotes(); } };
    r.append(d, x); l.append(r);
  }
}

// ---------------- Input & keyboard ----------------
function autosize() { const t = $('input'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, innerHeight * 0.4) + 'px'; }

function bind() {
  const input = $('input');
  input.value = store.draft(); autosize();
  input.addEventListener('input', () => { autosize(); store.saveDraft(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
  });
  $('composer').addEventListener('submit', (e) => { e.preventDefault(); busy ? stop() : send(input.value); });
  $('attachBtn').onclick = () => $('fileInput').click();
  $('fileInput').onchange = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) ingestImage(f); };
  document.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); ingestImage(item.getAsFile()); }
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => { e.preventDefault(); const f = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/')); if (f) ingestImage(f); });
  $('screenPill').onclick = () => clearScreen('Screen context cleared.');
  $('newChatBtn').onclick = newChat;
  $('settingsBtn').onclick = openSettings;
  $('closeSettings').onclick = () => $('settingsDlg').close();
  $('settingsDlg').addEventListener('close', () => { saveSettingsFromUI(); input.focus(); });
  $('settingsDlg').addEventListener('change', saveSettingsFromUI);
  $('loadModelBtn').onclick = () => loadModel($('modelSelect').value);
  $('unloadModelBtn').onclick = async () => { llm.lastLoad = null; await llm.unload(); $('modelDot').className = 'dot'; $('modelLabel').textContent = 'No model'; $('loadText').textContent = 'Unloaded (still downloaded).'; };
  $('deleteModelBtn').onclick = async () => {
    const id = $('modelSelect').value;
    if (!confirm(`Delete the downloaded files for ${id}? You'd need internet to download it again.`)) return;
    if (llm.lastLoad?.id === id) { llm.lastLoad = null; await llm.unload(); }
    await deleteCached(id); $('loadText').textContent = 'Deleted.'; initModelUI(); showStorage();
  };
  $('benchBtn').onclick = benchmark;
  $('showScreenBtn').onclick = () => { $('settingsDlg').close(); meta('screen'); };
  $('macroAdd').onclick = () => {
    const name = $('macroName').value.trim().replace(/\s+/g, '-'); const body = $('macroBody').value.trim();
    if (!name || !body) return;
    store.saveMacros([...store.macros().filter(m => m.name !== name), { name, body }]);
    $('macroName').value = ''; $('macroBody').value = ''; renderMacros();
  };
  $('exportBtn').onclick = () => {
    const data = { exported: new Date().toISOString(), notes: store.notes(), macros: store.macros(), settings: store.settings() };
    const a = el('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'pocket-agent-export.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('wipeBtn').onclick = () => {
    if (!confirm('Erase chats, notes, macros, settings and the action log on this device? Downloaded models are kept.')) return;
    store.wipe(); settings = store.settings(); history = []; renderHistory(); $('settingsDlg').close();
  };

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.shiftKey && (e.code === 'Space')) { e.preventDefault(); document.activeElement === input ? input.blur() : input.focus(); return; }
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'x') { e.preventDefault(); clearScreen('Screen context cleared.'); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); newChat(); return; }
    if (mod && e.key === '.') { e.preventDefault(); stop(); return; }
    if (e.key === 'Escape' && !$('confirmDlg').open && !$('settingsDlg').open) {
      if (busy) stop(); else if (input.value) { input.value = ''; autosize(); store.saveDraft(''); } else input.blur();
    }
  });

  const net = () => { $('netPill').hidden = navigator.onLine; };
  addEventListener('online', net); addEventListener('offline', net); net();
}

function stop() { if (busy) { llm.interrupt(); status('Stopping…'); } }

// The iPad can reclaim the GPU while the app is in the background; the engine rebuilds itself.
llm.onRecover = (phase) => {
  if (phase === 'start') { $('modelDot').className = 'dot loading'; status('The iPad released the GPU — reloading the model from this device…'); }
  if (phase === 'done') { $('modelDot').className = 'dot ready'; status('Model reloaded. Continuing…'); }
  if (phase === 'failed') { $('modelDot').className = 'dot'; $('modelLabel').textContent = 'Model not loaded'; status(''); }
};

// ---------------- Boot ----------------
async function boot() {
  bind();
  renderHistory();
  $('input').focus();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  await initModelUI();
  // Warm the lightweight engines in the background on idle.
  setTimeout(() => warmOCR(), 3000);

  // Automated benchmark hook for development: ?bench=<model-id>
  const q = new URLSearchParams(location.search);
  if (q.get('bench')) { settings.contextWindow = +(q.get('ctx') || settings.contextWindow); await loadModel(q.get('bench')); await benchmark(); }
}
boot();

// Exposed for in-browser tests only.
window.__pa = { send, ingestImage, clearScreen, get screen() { return screen; }, warmPython };
