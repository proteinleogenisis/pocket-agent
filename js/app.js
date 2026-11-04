import { llm, CANDIDATES, probeGPU, modelIdFor, modelRecord, isCached, deleteCached, diagnoseNetwork, isMirrored, NATIVE } from './llm.js';
import { handle, runTool, TOOLS, permissionFor, route, ROUTER_TESTS, FREEDOM } from './agent.js';
import { analyzeImage, toContext, warmOCR } from './ocr.js';
import { warmPython } from './sandbox.js';
import { store } from './store.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

let settings = store.settings();
let history = store.history();          // [{role, content}] — never contains screen text
let screen = null;                      // { text, lines, ms } — memory only
let attachment = null;                  // { name, text } — memory only
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
        else seg.split('\n').forEach((ln, k) => { if (k) p.append(el('br')); appendInline(p, ln); });
      }
      container.append(p);
    }
    if (i + 2 < parts.length) container.append(codeBlock(parts[i + 1], parts[i + 2].replace(/\n$/, '')));
  }
}

// Inline text with **bold** and safe https links (opened outside the app).
function appendInline(p, line) {
  const parts = line.split(/(\[[^\]]+\]\(https:\/\/[^)\s]+\)|\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    const link = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/.exec(part);
    if (link) { const a = el('a', null, link[1]); a.href = link[2]; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.append(a); continue; }
    const b = /^\*\*([^*]+)\*\*$/.exec(part); if (b) { p.append(el('b', null, b[1])); continue; }
    p.append(part);
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
    // Settle from whichever happens first: a button, Esc, or the dialog closing.
    // (Don't rely on the 'close' event alone — it isn't always delivered.)
    let settled = false;
    const obs = new MutationObserver(() => { if (!d.open) settle(false); });
    const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); settle(document.activeElement !== $('confirmNo')); } };
    function settle(v) {
      if (settled) return; settled = true;
      obs.disconnect(); d.removeEventListener('keydown', onKey);
      $('confirmYes').onclick = $('confirmNo').onclick = d.oncancel = d.onclose = null;
      if (d.open) d.close();
      resolve(v); $('input').focus();
    }
    $('confirmYes').onclick = () => settle(true);
    $('confirmNo').onclick = () => settle(false);
    d.oncancel = (e) => { e.preventDefault(); settle(false); };
    d.onclose = () => settle(false);
    d.addEventListener('keydown', onKey);
    d.showModal();
    obs.observe(d, { attributes: true, attributeFilter: ['open'] });
    $('confirmYes').focus();
  });
}

// ---------------- Sending ----------------
async function send(text) {
  if (/^(stop|cancel)( that| it)?$/i.test(text.trim()) && store.pending().length) { store.setPending([]); addMsg('tool', 'Cancelled the remaining steps.', 'steps'); return; }
  text = text.trim();
  if (!text || busy) return;
  $('input').value = ''; autosize(); store.saveDraft('');
  addMsg('user', text);
  setBusy(true);
  try { localStorage.setItem('pa.generating', String(Date.now())); } catch {}
  const usedScreen = !!screen;
  let live = null;
  try {
    const res = await handle({
      text, llm, settings, history, screen: screen?.text, attachment, ui: {
        status,
        token: (t) => { if (!live) live = addMsg('assistant', ''); renderMarkdown(live, t); live.scrollIntoView({ block: 'end' }); },
        confirm: confirmAction,
      },
    });
    if (res.kind === 'meta') { await meta(res.meta, res.input); return; }
    if (res.kind === 'answer') {
      if (!live) live = addMsg('assistant', res.text || '(empty answer)'); else renderMarkdown(live, res.text);
      const st = [fmtStats(res.stats), usedScreen && 'used screen text', res.online && `🌐 ${res.online.join(', ')}`].filter(Boolean).join(' · ');
      if (st) live.append(el('div', 'meta', st));
      remember(text, res.text, usedScreen);
    } else if (res.kind === 'tool') {
      showToolResult(res);
      remember(text, res.text, usedScreen, true);
    } else {
      addMsg('err', res.text);
    }
  } catch (e) {
    addMsg('err', `Error: ${e?.message || e}`);
  } finally {
    setBusy(false); status('');
    try { localStorage.removeItem('pa.generating'); } catch {}
    if (usedScreen && settings.autoClearScreen) clearScreen('Screen text cleared after use.');
  }
}

function remember(user, assistant, usedScreen, tool = false) {
  history.push({ role: 'user', content: user, ...(tool && { tool }) }, { role: 'assistant', content: assistant, ...(tool && { tool }) });
  history = history.slice(-40);
  if (usedScreen && !settings.saveScreenTurns) return; // keep in memory for this session only
  store.saveHistory(history);
}

// Tool results can carry buttons: copy text, or export a file to the Files app (needs a tap on iPadOS).
function showToolResult(res) {
  const m = res.markdown ? addMsg('assistant', res.markdown) : addMsg(`tool${res.ok ? '' : ' fail'}`, res.text);
  if (res.markdown) m.classList.add('tool');
  if (res.actions?.length) {
    const bar = el('div', 'row wrap');
    for (const a of res.actions) {
      const b = el('button', 'btn', a.label);
      b.onclick = async () => {
        try {
          if (a.copy != null) { await navigator.clipboard.writeText(a.copy); b.textContent = 'Copied ✓'; }
          if (a.file) await exportFile(a.file.name, a.file.content);
        } catch (e) { if (e?.name !== 'AbortError') b.textContent = 'Failed: ' + (e?.message || e); }
      };
      bar.append(b);
    }
    m.append(bar);
  }
  m.append(el('div', 'meta', `${res.tool} · ${res.ok ? 'done' : 'not completed'}`));
}
async function exportFile(name, content) {
  const file = new File([content], name, { type: 'text/plain' });
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file] }); // Share sheet → Save to Files
  const a = el('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function runDirect(call, { preconfirmed } = {}) {
  if (busy) return;
  setBusy(true);
  try {
    const s = preconfirmed ? { ...settings, permissions: { ...settings.permissions, [call.tool]: permissionFor(call.tool, settings) === 'off' ? 'off' : 'allow' } } : settings;
    const res = await runTool(call, { settings: s, screen: null, ui: { status, confirm: confirmAction } });
    if (res.kind === 'error') addMsg('err', res.text); else showToolResult(res);
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

// ---------------- Attached files (memory only) ----------------
const TEXT_EXT = /\.(txt|md|py|js|mjs|ts|tsx|jsx|json|csv|html?|css|swift|kt|java|c|cc|cpp|h|hpp|rs|go|rb|php|sh|sql|ya?ml|toml|xml|ini|log)$/i;
async function ingestFile(file) {
  if (!file) return;
  if (file.type.startsWith('image/')) return ingestImage(file);
  if (!(file.type.startsWith('text/') || TEXT_EXT.test(file.name) || file.type === 'application/json')) {
    addMsg('err', `I can read text and code files (and screenshots). “${file.name}” isn't one of those.`); return;
  }
  if (file.size > 300 * 1024) { addMsg('err', `“${file.name}” is too large (${Math.round(file.size / 1024)} KB). The limit is 300 KB.`); return; }
  attachment = { name: file.name, text: await file.text() };
  $('filePill').hidden = false; $('fileName').textContent = file.name;
  const lines = attachment.text.split('\n').length;
  addMsg('tool', `Attached ${file.name} (${lines} lines). Ask about it${/\.(py|m?js)$/i.test(file.name) ? ', say “run it”' : ''}, or “save that as ${file.name}” to keep it in your workspace. It stays in memory only.`, 'file attached');
  $('input').focus();
}
function clearAttachment() { attachment = null; $('filePill').hidden = true; }

// ---------------- Screen context ----------------
async function ingestImage(blob) {
  if (!blob?.type?.startsWith('image/')) return;
  if (busy) return;
  setBusy(true);
  try {
    status('Reading screenshot on-device…');
    const r = await analyzeImage(blob, { onProgress: (m) => { if (m.status === 'recognizing text') status(`Reading screenshot… ${Math.round(m.progress * 100)}%`); } });
    screen = { text: toContext(r, settings.contextWindow <= 1024 ? 800 : 2400), lines: r.lines.length, ms: r.ms };
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
  if (NATIVE) return initNativeModel();
  gpu = await probeGPU();
  // A small max buffer means a low-memory device (a 4 GB iPad reports ~683 MB).
  const lowMem = gpu.ok && gpu.maxBuffer < 1024 * 2 ** 20;
  if (lowMem && !settings.lowMemTuned) {
    // One-time switch to settings measured stable on a 4 GB iPad.
    settings.lowMemTuned = true;
    if (settings.contextWindow > 1024) settings.contextWindow = 1024;
    if (/^Qwen3|1\.5B|Llama/.test(settings.modelId || '')) settings.modelId = modelIdFor('Qwen2.5-Coder-0.5B-Instruct', gpu.f16 !== false);
    store.saveSettings(settings);
  }
  // Brain: use the smartest model that fits (1.5B, tested on a 4 GB iPad). If loading it ever
  // crashed the tab, fall back to 0.5B for good and say so.
  const crashed = localStorage.getItem('pa.loadingModel');
  if (crashed) {
    localStorage.removeItem('pa.loadingModel');
    if (/1\.5B/.test(crashed)) {
      settings.brainFallback = true; settings.modelId = modelIdFor('Qwen2.5-Coder-0.5B-Instruct', gpu.f16 !== false); store.saveSettings(settings);
      addMsg('err', 'The 1.5B brain ran out of memory on this iPad, so I switched to the 0.5B brain.');
    }
  }
  if (gpu.ok && !settings.brainBest && !settings.brainFallback) {
    settings.brainBest = true; settings.contextWindow = 1024;
    settings.modelId = modelIdFor('Qwen2.5-Coder-1.5B-Instruct', gpu.f16 !== false); store.saveSettings(settings);
  }
  $('gpuInfo').textContent = gpu.ok
    ? `Runs on this iPad's GPU. ${settings.brainFallback ? 'Using 0.5B (1.5B ran out of memory).' : 'Qwen2.5-Coder 1.5B is the smartest that fits.'}`
    : `⚠︎ ${gpu.reason} The model can't run here, but /commands, OCR and code tools still work.`;
  const sel = $('modelSelect'); sel.replaceChildren();
  for (const c of CANDIDATES) {
    const id = modelIdFor(c.base, gpu.f16 !== false);
    if (!id) continue;
    const rec = modelRecord(id);
    const cached = await isCached(id);
    const heavy = lowMem && rec.vram_required_MB > 1100;
    const o = el('option', null, `${cached ? '✓ ' : ''}${c.label} — ${heavy ? 'may run out of memory on this iPad' : c.note} (${Math.round(rec.vram_required_MB)} MB @4k)`);
    o.value = id; sel.append(o);
  }
  sel.value = settings.modelId || sel.options[0]?.value || '';
  $('loadModelBtn').disabled = !gpu.ok;
  // Always load a downloaded model on open — no setting needed.
  if (gpu.ok && settings.modelId && await isCached(settings.modelId)) loadModel(settings.modelId);
}

// Native iPad app: the 1.5B model runs in llama.cpp (Metal) and loads automatically.
async function initNativeModel() {
  $('webModelBox').hidden = true; $('shortcutSection').hidden = true;
  gpu = { ok: true };
  const st = await llm.status();
  $('gpuInfo').textContent = st.hasModel
    ? 'On-device brain: Qwen2.5-Coder 1.5B (llama.cpp + Metal on the iPad GPU). Private, free, works offline.'
    : '⚠︎ The model file isn\'t on this iPad yet. Connect it to the Mac so it can be copied over.';
  if (st.hasModel) loadModel('native');
}

async function loadModel(id) {
  if (!id) return;
  $('modelDot').className = 'dot loading'; $('modelLabel').textContent = 'Loading…';
  $('loadProgress').hidden = false; $('loadModelBtn').disabled = true;
  try { localStorage.setItem('pa.loadingModel', id); } catch {}
  try {
    await llm.load(id, {
      contextWindow: settings.contextWindow,
      onProgress: (r) => { $('loadProgress').firstElementChild.style.width = `${Math.round(r.progress * 100)}%`; $('loadText').textContent = r.text; status(r.text.slice(0, 90)); },
    });
    if (!NATIVE) { settings.modelId = id; store.saveSettings(settings); }
    $('modelDot').className = 'dot ready';
    $('modelLabel').textContent = NATIVE ? 'Qwen2.5-Coder 1.5B' : id.replace(/-q4f(16|32)_1-MLC$/, '');
    $('loadText').textContent = `Loaded in ${llm.loadSeconds.toFixed(1)}s. Runs offline from now on.`;
    requestPersist();
    try { localStorage.removeItem('pa.loadingModel'); } catch {}
  } catch (e) {
    try { localStorage.removeItem('pa.loadingModel'); } catch {}
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
  $('autoClear').checked = settings.autoClearScreen;
  $('saveScreen').checked = settings.saveScreenTurns;
  $('autoTools').checked = settings.autoTools;
  $('internetToggle').checked = settings.internet !== false;
  $('groundingToggle').checked = settings.grounding !== false;
  renderShortcuts();
  const fr = $('freedomSelect'); fr.replaceChildren(...Object.entries(FREEDOM).map(([k, d]) => { const o = el('option', null, d); o.value = k; return o; }));
  fr.value = settings.freedom || 'balanced';
  $('prefs').value = settings.preferences;
  const tp = $('toolPerms'); tp.replaceChildren();
  for (const [name, t] of Object.entries(TOOLS)) {
    const row = el('div', 'toolrow');
    row.append(el('b', null, name));
    const s = el('select'); for (const v of ['allow', 'ask', 'off']) { const o = el('option', null, v); o.value = v; s.append(o); }
    s.value = permissionFor(name, settings);
    if (t.risk === 'destructive') { s.querySelector('[value=allow]').disabled = true; }
    s.onchange = () => { settings.permissions = { ...settings.permissions, [name]: s.value }; store.saveSettings(settings); };
    row.append(s, el('div', 'd', t.desc + (t.risk === 'destructive' ? ' Always asks first.' : '')));
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
  settings.autoClearScreen = $('autoClear').checked;
  settings.saveScreenTurns = $('saveScreen').checked;
  settings.autoTools = $('autoTools').checked;
  settings.internet = $('internetToggle').checked;
  settings.grounding = $('groundingToggle').checked;
  if (settings.freedom !== $('freedomSelect').value) { settings.freedom = $('freedomSelect').value; settings.permissions = {}; } // a new level resets per-tool overrides
  settings.preferences = $('prefs').value.slice(0, 600);
  store.saveSettings(settings);
}
async function renderShortcuts() {
  const box = $('shortcutList');
  let list = [];
  try { list = await (await fetch('shortcuts/manifest.json')).json(); } catch { box.textContent = 'Shortcut list unavailable offline — open Settings once while online.'; return; }
  box.replaceChildren();
  for (const sc of list) {
    const row = el('div', 'note'); const d = el('div');
    const got = (settings.installedShortcuts || []).includes(sc.name);
    d.append(el('b', null, sc.name), el('div', 'muted', sc.desc + (got ? ' · installed' : '')));
    const a = el('a', 'btn', got ? 'Reinstall' : 'Install'); a.href = sc.file; a.setAttribute('download', sc.download || decodeURIComponent(sc.file.split('/').pop()));
    a.onclick = () => { settings.installedShortcuts = [...new Set([...(settings.installedShortcuts || []), sc.name])]; store.saveSettings(settings); setTimeout(renderShortcuts, 500); };
    row.append(d, a); box.append(row);
  }
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
  $('fileInput').onchange = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) ingestFile(f); };
  $('filePill').onclick = () => { clearAttachment(); addMsg('tool', 'File removed from context.', 'file detached'); };
  document.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); ingestImage(item.getAsFile()); }
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) ingestFile(f); });
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

  // Continue a multi-step request after another app (e.g. Shortcuts) handed control back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || busy) return;
    const pending = store.pending(); if (!pending.length) return;
    store.setPending(pending.slice(1));
    setTimeout(() => send(pending[0]), 600);
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
  // If the last answer never finished, iPadOS most likely ran out of memory and reloaded the app.
  try {
    if (localStorage.getItem('pa.generating')) {
      localStorage.removeItem('pa.generating');
      addMsg('err', 'The iPad ran out of memory during the last answer and reloaded Pocket Agent. Tip: in ⚙︎ Settings use Qwen2.5-Coder 0.5B with a 1k context window, and close other heavy apps.');
    }
  } catch {}
  $('input').focus();
  // One-time switch to max control (requested): sandboxed code, device actions and Shortcuts run without asking.
  if (!settings.maxControl) { settings.maxControl = true; settings.freedom = 'free'; settings.permissions = {}; store.saveSettings(settings); }
  // "Ask Pocket Agent" (Spotlight, Siri, ⌘⇧Space, pocketagent://ask?q=…) lands here.
  window.__paAsk = (q) => { $('settingsDlg').open && $('settingsDlg').close(); const i = $('input'); i.focus(); if (q && q.trim()) send(q); };
  if ('serviceWorker' in navigator && !NATIVE) {
    // When an update finishes installing, switch to it right away (once), instead of on the next launch.
    const hadController = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return; reloaded = true;
      const go = () => (busy ? setTimeout(go, 1000) : location.reload());
      go();
    });
    navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {});
  }
  await initModelUI();
  // Warm the lightweight engines in the background on idle.
  setTimeout(() => warmOCR(), 3000);

  // Automated benchmark hook for development: ?bench=<model-id>
  const q = new URLSearchParams(location.search);
  if (q.get('bench')) { settings.contextWindow = +(q.get('ctx') || settings.contextWindow); await loadModel(q.get('bench')); await benchmark(); }
  // End-to-end task suite (development / on-device verification): ?bench=<model>&tasks=1
  // "Ask Pocket Agent" Shortcut / links: ?q=<request> runs it as soon as the brain is ready.
  if (q.get('q')) {
    const ask = q.get('q').slice(0, 2000);
    window.history.replaceState(null, '', location.pathname);
    const t0 = Date.now();
    while (!llm.ready && $('modelDot').className.includes('loading') && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 300));
    window.__paAsk(ask);
  }
  if (q.get('tasks')) { const { runTasks } = await import('../tests/tasks.js'); const r = await runTasks(); addMsg('tool', `${r.tasks} tasks passed in ${r.total_s}s\n` + r.results.join('\n'), 'task suite'); }
}
boot();

// Exposed for in-browser tests only.
window.__pa = { send, ingestImage, ingestFile, clearScreen, get attachment() { return attachment; }, confirm: confirmAction, get screen() { return screen; }, warmPython };
