// More abilities: compose email/messages, Maps, Shortcuts with input, clipboard, files workspace,
// and a write → run → auto-fix loop. Every action here either stays on the device or opens a
// system screen where the user finishes the action (iPadOS never lets a web app send for you).
import { runJS, runPython } from './sandbox.js';
import { store } from './store.js';

const str = (v, max, name) => {
  if (typeof v !== 'string' || !v.trim()) return { ok: false, error: `${name} is empty` };
  if (v.length > max) return { ok: false, error: `${name} is too long (${v.length} > ${max} chars)` };
  return { ok: true, value: v };
};
export function openURL(url) { (window.__openURL || ((u) => { location.href = u; }))(url); }
const enc = encodeURIComponent;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;

// ---------- Files workspace (on-device) ----------
export const files = {
  all: () => store.files(),
  get: (name) => store.files().find((f) => f.name.toLowerCase() === name.toLowerCase()),
  put(name, content) {
    const list = store.files().filter((f) => f.name.toLowerCase() !== name.toLowerCase());
    list.push({ name, content, at: new Date().toISOString() });
    return store.saveFiles(list);
  },
  remove(name) {
    const list = store.files(); const keep = list.filter((f) => f.name.toLowerCase() !== name.toLowerCase());
    store.saveFiles(keep); return list.length - keep.length;
  },
};
const VALID_NAME = /^[\w][\w .\-]{0,80}\.[a-z0-9]{1,8}$/i;
export const langOf = (name) => (/\.py$/i.test(name) ? 'python' : /\.(m?js)$/i.test(name) ? 'javascript' : null);

// ---------- Tools ----------
export const ACTION_TOOLS = {
  compose_email: {
    desc: 'Open a pre-filled email in Mail. You review and tap Send yourself.',
    risk: 'safe', usage: 'email bob@example.com about lunch: see you at 12',
    validate: (i) => {
      const v = i.value || {};
      if (v.to && !v.to.split(/[,; ]+/).every((a) => EMAIL.test(a))) return { ok: false, error: `“${v.to}” isn't an email address` };
      if (!v.to && !v.subject && !v.body) return { ok: false, error: 'Nothing to put in the email' };
      return { ok: true, value: { to: v.to || '', subject: (v.subject || '').slice(0, 200), body: (v.body || '').slice(0, 5000) } };
    },
    run: async ({ to, subject, body }) => {
      openURL(`mailto:${to}?subject=${enc(subject)}&body=${enc(body)}`);
      return { ok: true, output: `Opened a draft email${to ? ` to ${to}` : ''}${subject ? ` — “${subject}”` : ''}. Review it and tap Send in Mail.${body ? `\n\n${body}` : ''}` };
    },
  },
  compose_message: {
    desc: 'Open a pre-filled iMessage/SMS. You pick the recipient if needed and tap Send.',
    risk: 'safe', usage: 'text 555-123-4567 saying running late',
    validate: (i) => {
      const v = i.value || {}; const to = (v.to || '').replace(/[^\d+]/g, '');
      if (v.to && to.length < 3) return { ok: false, error: `“${v.to}” isn't a phone number` };
      const b = str(v.body || '', 2000, 'Message'); if (!b.ok) return b;
      return { ok: true, value: { to, body: b.value.trim() } };
    },
    run: async ({ to, body }) => {
      openURL(`sms:${to}&body=${enc(body)}`);
      return { ok: true, output: `Opened Messages with “${body}”${to ? ` to ${to}` : ' — choose who to send it to'}. Tap Send to deliver it.` };
    },
  },
  maps: {
    desc: 'Open Apple Maps with directions to a place, or a search.',
    risk: 'safe', usage: 'directions to the nearest library',
    validate: (i) => { const v = i.value || {}; const s = str(v.place || '', 200, 'Place'); return s.ok ? { ok: true, value: { place: s.value.trim(), mode: v.mode === 'search' ? 'search' : 'directions' } } : s; },
    run: async ({ place, mode }) => {
      openURL(mode === 'search' ? `maps://?q=${enc(place)}` : `maps://?daddr=${enc(place)}`);
      return { ok: true, output: `Opened Maps ${mode === 'search' ? 'searching for' : 'with directions to'} “${place}”.` };
    },
  },
  run_shortcut_input: {
    desc: 'Run one of your Apple Shortcuts and pass it text. Shortcuts can add reminders, calendar events, send messages, control HomeKit and more.',
    risk: 'external', usage: 'run shortcut Add Reminder with buy milk',
    validate: (i) => {
      const v = i.value || {}; const n = str(v.name || '', 120, 'Shortcut name'); if (!n.ok) return n;
      if (/[\u0000-\u001f]/.test(v.name)) return { ok: false, error: 'Invalid characters in name' };
      return { ok: true, value: { name: v.name.trim(), text: (v.text || '').slice(0, 5000) } };
    },
    run: async ({ name, text }) => {
      openURL(`shortcuts://run-shortcut?name=${enc(name)}${text ? `&input=text&text=${enc(text)}` : ''}`);
      return { ok: true, output: `Asked iPadOS to run your Shortcut “${name}”${text ? ` with “${text.slice(0, 80)}”` : ''}. If it doesn't exist yet, create it in the Shortcuts app (make it accept text input).` };
    },
  },
  copy_text: {
    desc: 'Copy text (e.g. the last answer or code) to the clipboard.',
    risk: 'safe', usage: 'copy the last code',
    validate: (i) => str(i.value?.text || '', 100000, 'Text to copy'),
    run: async (text) => {
      try { await navigator.clipboard.writeText(text); return { ok: true, output: `Copied ${text.length} characters to the clipboard.` }; }
      catch { return { ok: true, output: 'iPadOS needs a tap to allow copying — tap the button below.', actions: [{ label: 'Copy', copy: text }] }; }
    },
  },
  save_file: {
    desc: 'Save text or code as a file in the on-device workspace, with a button to export it to the Files app.',
    risk: 'safe', usage: 'save that as hello.py',
    validate: (i) => {
      const v = i.value || {}; const name = (v.name || '').trim();
      if (!VALID_NAME.test(name)) return { ok: false, error: `“${name}” isn't a valid file name (use something like notes.txt or app.py)` };
      const c = str(v.content || '', 500000, 'File content'); return c.ok ? { ok: true, value: { name, content: c.value } } : c;
    },
    run: async ({ name, content }) => {
      if (!files.put(name, content)) return { ok: false, error: 'Storage is full or unavailable' };
      if (!files.get(name)) return { ok: false, error: 'File did not persist' };
      return { ok: true, output: `Saved ${name} (${content.length} characters) in your workspace. Say “show my files” to see all files.`, actions: [{ label: `Export ${name} to Files`, file: { name, content } }] };
    },
  },
  workspace: {
    desc: 'List, show or run files in the on-device workspace.',
    risk: 'safe', usage: 'show my files · show file app.py',
    validate: (i) => {
      const v = i.value || {};
      if (v.op === 'list') return { ok: true, value: v };
      const f = files.get(v.name || ''); if (!f) return { ok: false, error: `No file named “${v.name}”. Say “show my files” to list them` };
      return { ok: true, value: { ...v, file: f } };
    },
    run: async ({ op, file }) => {
      if (op === 'list') {
        const all = files.all();
        return { ok: true, output: all.length ? all.map((f) => `• ${f.name} — ${f.content.length} chars, ${f.at.slice(0, 10)}`).join('\n') : 'No files yet. Say “save that as app.py” after I write some code.' };
      }
      return { ok: true, output: file.content, actions: [{ label: `Export ${file.name} to Files`, file }], markdown: '```' + (langOf(file.name) || '') + '\n' + file.content + '\n```' };
    },
  },
  delete_file: {
    desc: 'Delete a file from the workspace.',
    risk: 'destructive', usage: '/rmfile app.py',
    validate: (i) => (files.get(i.input || '') ? { ok: true, value: i.input.trim() } : { ok: false, error: `No file named “${i.input}”` }),
    run: async (name) => ({ ok: true, output: `Deleted ${files.remove(name)} file named ${name}.` }),
  },
};

// ---------- Context helpers ----------
export function lastCode(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]; if (h.role !== 'assistant') continue;
    const m = [...h.content.matchAll(/```([\w+-]*)\n([\s\S]*?)```/g)];
    if (m.length) return { lang: m.at(-1)[1], code: m.at(-1)[2].replace(/\n$/, '') };
  }
  return null;
}
function lastAnswer(history) {
  for (let i = history.length - 1; i >= 0; i--) if (history[i].role === 'assistant') return history[i].content;
  return null;
}
const EXT = { python: 'py', py: 'py', javascript: 'js', js: 'js', html: 'html', css: 'css', json: 'json', sql: 'sql', swift: 'swift', bash: 'sh', sh: 'sh', typescript: 'ts', ts: 'ts' };

// ---------- Deterministic phrase parsing ----------
// Returns { tool, value } | { error } | null. The model is never asked to pick these.
export function parseAction(text, { history = [], attachment = null } = {}) {
  const t = text.trim().replace(/^please\s+/i, '');
  let m;

  // Email: "email bob@x.com about lunch: body" / "write an email to bob@x.com saying hi"
  if ((m = /^(?:(?:send|write|compose|draft)\s+(?:an?\s+)?e-?mail|e-?mail)\b\s*(?:to\s+)?([\s\S]*)$/i.exec(t))) {
    let rest = m[1]; const to = (rest.match(new RegExp(EMAIL.source + '(?:\\s*[,;]\\s*' + EMAIL.source + ')*')) || [''])[0];
    rest = rest.replace(to, '').trim();
    let subject = '', body = '';
    const colon = rest.indexOf(':');
    const head = colon >= 0 ? rest.slice(0, colon) : rest; body = colon >= 0 ? rest.slice(colon + 1).trim() : '';
    const sm = /(?:about|re|regarding|subject)\s+(.+)$/i.exec(head); if (sm) subject = sm[1].trim();
    const say = /(?:saying|that says|with the message)\s+([\s\S]+)$/i.exec(head); if (say) { body = say[1].trim(); subject = subject.replace(say[0], '').trim(); }
    return { tool: 'compose_email', value: { to, subject, body }, draft: !body && !!subject };
  }
  // Messages: "text 555 123 4567 saying hi", "send a message saying on my way"
  if ((m = /^(?:text|sms|imessage|message|send\s+(?:a\s+)?(?:text|message|imessage))\s+(?:to\s+)?([+\d][\d\s().-]{2,}\d)?\s*(?:saying|that says|that|:)?\s*([\s\S]+)$/i.exec(t)) && (m[1] || /^send/i.test(t))) {
    return { tool: 'compose_message', value: { to: m[1] || '', body: m[2] } };
  }
  // Maps
  if ((m = /^(?:directions|navigate|route|take me|how do i get|get directions)\s+(?:to\s+)?(.+)$/i.exec(t))) return { tool: 'maps', value: { place: m[1].replace(/[?.!]+$/, ''), mode: 'directions' } };
  if ((m = /^(?:find|show|search for)\s+(.+?)\s+(?:on|in)\s+(?:the\s+)?maps?$/i.exec(t)) || (m = /^where is\s+(.+?)\??$/i.exec(t))) return { tool: 'maps', value: { place: m[1], mode: 'search' } };
  // Shortcuts with input; reminders via a Shortcut the user creates once
  if ((m = /^run\s+(?:my\s+)?(?:shortcut\s+)?(?:called\s+|named\s+)?["“]?(.+?)["”]?(?:\s+shortcut)?\s+with\s+(?:input\s+|text\s+)?["“]?([\s\S]+?)["”]?$/i.exec(t))) return { tool: 'run_shortcut_input', value: { name: m[1], text: m[2] } };
  if ((m = /^remind me\s+(?:to\s+|about\s+)?([\s\S]+)$/i.exec(t))) return { tool: 'run_shortcut_input', value: { name: 'Pocket Reminder', text: m[1] } };
  // Clipboard
  if (/^copy\s+(that|this|it|the\s+(last\s+)?(answer|reply|response|result|output|code))\b/i.test(t)) {
    const wantCode = /code/i.test(t); const c = lastCode(history); const a = lastAnswer(history);
    const text2 = wantCode ? c?.code : (a || c?.code);
    return text2 ? { tool: 'copy_text', value: { text: text2 } } : { error: 'There is nothing to copy yet.' };
  }
  // Save as file: "save that as app.py", "save the code to utils.js"
  if ((m = /^save\s+(?:that|this|it|the\s+(?:last\s+)?(?:code|answer|file))?\s*(?:as|to|into)\s+(?:a\s+file\s+(?:called|named)\s+)?["“]?([\w][\w .\-]*?)["”]?$/i.exec(t))) {
    let name = m[1].trim(); const c = lastCode(history);
    if (attachment && !c) return { tool: 'save_file', value: { name: /\.\w+$/.test(name) ? name : name + '.txt', content: attachment.text } };
    if (!c && !lastAnswer(history)) return { error: 'There is nothing to save yet — ask me to write something first.' };
    if (!/\.\w+$/.test(name)) name += '.' + (EXT[c?.lang?.toLowerCase()] || 'txt');
    return { tool: 'save_file', value: { name, content: c ? c.code : lastAnswer(history) } };
  }
  // Workspace
  if (/^(show|list|open)\s+(me\s+)?(all\s+)?(my\s+)?(saved\s+)?(files|projects|workspace)\s*[?.!]*$/i.test(t)) return { tool: 'workspace', value: { op: 'list' } };
  if ((m = /^(?:show|open|view|cat)\s+(?:the\s+)?(?:file\s+)?([\w][\w .\-]*\.[a-z0-9]{1,8})$/i.exec(t)) && files.get(m[1])) return { tool: 'workspace', value: { op: 'show', name: m[1] } };
  if ((m = /^run\s+(?:the\s+)?(?:file\s+)?([\w][\w .\-]*\.(?:py|m?js))$/i.exec(t))) {
    const f = files.get(m[1]); if (!f) return { error: `No file named “${m[1]}”. Say “show my files” to list them.` };
    return { tool: langOf(f.name) === 'python' ? 'run_python' : 'run_javascript', input: f.content };
  }
  // Attached file: "run it" / "run this file"
  if (attachment && /^run\s+(it|this|the\s+file|this\s+file|that)\s*[.!]*$/i.test(t)) {
    const lang = langOf(attachment.name); if (!lang) return { error: `I can only run .py and .js files (this is ${attachment.name}).` };
    return { tool: lang === 'python' ? 'run_python' : 'run_javascript', input: attachment.text };
  }
  return null;
}

// "write/make a program that … and run it" → the build loop
export function parseBuild(text) {
  const t = text.trim().replace(/^please\s+/i, '');
  const m = /^(?:\/build\s+)?(?:(write|make|create|build|code)\b[\s\S]*?\b(?:and|then)\s+(?:also\s+)?(run|test|execute)\b(?:\s+it)?|\/build\b)/i.exec(t);
  if (!m) return null;
  const lang = /\b(javascript|js|node)\b/i.test(t) ? 'javascript' : 'python';
  return { task: t.replace(/^\/build\s+/i, ''), lang };
}

function extractCode(text) {
  const m = [...text.matchAll(/```[\w+-]*\n([\s\S]*?)(```|$)/g)];
  if (m.length) return m.map((x) => x[1]).join('\n').trim();
  return /^(def |import |from |print\(|function |const |let |console\.)/m.test(text) ? text.trim() : '';
}

// Write → run → read the error → fix → run again (up to `maxAttempts`).
// `runCode(lang, code)` goes through the normal permission/confirmation path.
export async function buildAndRun({ task, lang, llm, ui, maxTokens = 384, maxAttempts = 3, runCode }) {
  const L = lang === 'javascript' ? 'JavaScript' : 'Python';
  const sys = `You write complete, runnable ${L} programs. Print the results${lang === 'javascript' ? ' with console.log' : ' with print'}. Use only the standard library — no network, files, or user input. Reply with exactly one fenced code block and nothing else.`;
  let msgs = [{ role: 'system', content: sys }, { role: 'user', content: task }];
  let code = '', res = null, attempt = 0;
  for (attempt = 1; attempt <= maxAttempts; attempt++) {
    ui.status(attempt === 1 ? `Writing ${L}…` : `Fixing the error (attempt ${attempt} of ${maxAttempts})…`);
    const { text } = await llm.stream(msgs, { maxTokens, temperature: attempt === 1 ? 0.2 : 0.4 });
    const next = extractCode(text);
    if (!next) { res = { ok: false, text: 'The model did not produce code.' }; continue; }
    code = next;
    ui.status(`Running (attempt ${attempt})…`);
    res = await runCode(lang, code);
    if (res.declined) break;
    if (res.ok) break;
    msgs = [{ role: 'system', content: sys }, { role: 'user', content: `${task}\n\nThis attempt failed:\n\`\`\`${lang}\n${code}\n\`\`\`\nError:\n${String(res.text).slice(-500)}\nWrite the corrected program in one fenced code block.` }];
  }
  const tries = Math.min(attempt, maxAttempts);
  const verdict = res?.declined ? 'Not run — you cancelled it.'
    : res?.ok ? `✓ Ran successfully${tries > 1 ? ` after fixing ${tries - 1} error${tries > 2 ? 's' : ''}` : ''}.`
    : `✗ Still failing after ${tries} attempts — the last error is shown above.`;
  const md = (code ? '```' + lang + '\n' + code + '\n```\n' : '') + (res && !res.declined ? '**Output**\n```\n' + String(res.text || '(no output)').slice(0, 3000) + '\n```\n' : '') + verdict;
  return { kind: 'answer', text: md, ok: !!res?.ok, attempts: tries };
}
