// Google Docs: read the doc you're working in and write answers straight into it, through Google's
// own Docs API, signed in as you. The doc's text only travels between this iPad and Google (which already
// stores it). The access token stays in this device's storage and lasts an hour; after that it renews
// itself with a quick redirect if you're still signed in to Google here.
const SCOPES = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.metadata.readonly';
const TOKEN_KEY = 'pa.gToken', RETURN_KEY = 'pa.gReturn', UNDO_KEY = 'pa.gUndo', DOC_KEY = 'pa.gDoc';
export const HIGHLIGHT = { red: 1, green: 0.95, blue: 0.7 };            // light yellow behind AI text
const REDIRECT = () => location.origin + location.pathname;

const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

export const gdocs = {
  clientId: '',
  get signedIn() { const t = ls.get(TOKEN_KEY); return !!(t && t.exp > Date.now() + 60000); },
  get hadToken() { return !!ls.get(TOKEN_KEY); },
  signOut() { ls.set(TOKEN_KEY, null); ls.set(DOC_KEY, null); },

  // Full-page redirect to Google (pop-up windows don't work inside the Shortcuts panel). Whatever was in
  // the address (the screen text, the request) is saved and put back when Google sends you back here.
  signIn({ silent = false } = {}) {
    if (!this.clientId) throw new Error('No Google client ID yet — add it in ⚙︎ Settings → Google Docs.');
    const state = Math.random().toString(36).slice(2);
    ls.set(RETURN_KEY, { state, hash: location.hash, at: Date.now() });
    const p = new URLSearchParams({ client_id: this.clientId, redirect_uri: REDIRECT(), response_type: 'token', scope: SCOPES,
      include_granted_scopes: 'true', state, ...(silent ? { prompt: 'none' } : {}) });
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + p;
  },

  // Call on startup, before anything reads the hash. Returns null, or {ok, error} after a Google redirect.
  completeSignIn() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.has('access_token') && !(h.has('error') && h.has('state'))) return null;
    const saved = ls.get(RETURN_KEY); ls.set(RETURN_KEY, null);
    const ok = saved && saved.state === h.get('state') && h.has('access_token');
    if (ok) ls.set(TOKEN_KEY, { token: h.get('access_token'), exp: Date.now() + (+h.get('expires_in') || 3600) * 1000 });
    window.history.replaceState(null, '', location.pathname + (saved?.hash || ''));
    return { ok, error: ok ? null : (h.get('error') || 'state mismatch') };
  },

  async api(url, opts = {}) {
    const t = ls.get(TOKEN_KEY);
    if (!t || t.exp < Date.now() + 30000) throw Object.assign(new Error('Sign in to Google first'), { code: 'auth' });
    const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + t.token, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (r.status === 401) { ls.set(TOKEN_KEY, null); throw Object.assign(new Error('Google sign-in expired'), { code: 'auth' }); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = j?.error?.message || `HTTP ${r.status}`;
      // A school (Workspace) account whose admin blocks unapproved apps answers 403 here.
      throw Object.assign(new Error(msg), { code: r.status === 403 ? 'blocked' : 'http', status: r.status });
    }
    return j;
  },

  async recentDocs(n = 10) {
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.document' and trashed=false");
    const j = await this.api(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=viewedByMeTime%20desc&pageSize=${n}&fields=files(id,name,viewedByMeTime)`);
    return j.files || [];
  },

  // The doc on screen: the recent doc whose title appears in the screen text, else the one you picked,
  // else the most recently opened one.
  async pickDoc(screenText = '') {
    const docs = await this.recentDocs();
    if (!docs.length) throw new Error('No Google Docs found in this account.');
    const s = String(screenText).toLowerCase();
    const byTitle = docs.filter((d) => d.name && d.name.length > 2 && s.includes(d.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
    const chosen = ls.get(DOC_KEY);
    const doc = byTitle || (chosen && docs.find((d) => d.id === chosen.id)) || docs[0];
    return { doc, docs, how: byTitle ? 'title on screen' : chosen && doc.id === chosen.id ? 'your pick' : 'most recent' };
  },
  choose(doc) { ls.set(DOC_KEY, doc ? { id: doc.id, name: doc.name } : null); },

  async read(id) {
    const d = await this.api(`https://docs.googleapis.com/v1/documents/${id}?fields=documentId,title,revisionId,body(content(startIndex,endIndex,paragraph(elements(textRun(content,textStyle(backgroundColor))))))`);
    return { id: d.documentId, title: d.title, revisionId: d.revisionId, paragraphs: paragraphsOf(d) };
  },

  async batch(id, requests, revisionId) {
    return this.api(`https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, { method: 'POST',
      body: JSON.stringify({ requests, ...(revisionId ? { writeControl: { requiredRevisionId: revisionId } } : {}) }) });
  },

  // items: [{ after: paragraph, text }] → each answer becomes a new highlighted paragraph right under it.
  async insertAnswers(doc, items) {
    const sorted = [...items].sort((a, b) => b.after.end - a.after.end);       // bottom first: indexes stay valid
    const reqs = [];
    for (const it of sorted) {
      const at = it.after.end - 1;                                            // just before the paragraph's "\n"
      const text = '\n' + it.text;
      reqs.push({ insertText: { location: { index: at }, text } });
      const r = { startIndex: at + 1, endIndex: at + text.length };
      reqs.push({ updateParagraphStyle: { range: r, paragraphStyle: { namedStyleType: 'NORMAL_TEXT' }, fields: 'namedStyleType' } });
      reqs.push({ updateTextStyle: { range: r, textStyle: { bold: false, italic: false, backgroundColor: { color: { rgbColor: HIGHLIGHT } } }, fields: 'bold,italic,backgroundColor' } });
    }
    const res = await this.batch(doc.id, reqs, doc.revisionId);
    // Where each insert ended up, so Undo can take exactly those characters out again.
    const asc = [...items].sort((a, b) => a.after.end - b.after.end); let shift = 0; const ranges = [];
    for (const it of asc) { const len = it.text.length + 1; const s = it.after.end - 1 + shift; ranges.push({ start: s, end: s + len, text: '\n' + it.text }); shift += len; }
    ls.set(UNDO_KEY, { id: doc.id, revisionId: res?.writeControl?.requiredRevisionId, ops: ranges.map((r) => ({ type: 'insert', ...r })), at: Date.now() });
    return ranges.length;
  },

  // Replace one paragraph's text (keeps it as one paragraph), highlighted. Undo puts the old text back.
  async replaceParagraph(doc, p, text) {
    const s = p.start, e = p.end - 1;                                          // keep the trailing "\n"
    const reqs = [{ deleteContentRange: { range: { startIndex: s, endIndex: e } } }, { insertText: { location: { index: s }, text } },
      { updateTextStyle: { range: { startIndex: s, endIndex: s + text.length }, textStyle: { backgroundColor: { color: { rgbColor: HIGHLIGHT } } }, fields: 'backgroundColor' } }];
    const res = await this.batch(doc.id, reqs, doc.revisionId);
    ls.set(UNDO_KEY, { id: doc.id, revisionId: res?.writeControl?.requiredRevisionId, ops: [{ type: 'replace', start: s, end: s + text.length, text, old: p.text }], at: Date.now() });
  },

  get canUndo() { return !!ls.get(UNDO_KEY); },
  async undo() {
    const u = ls.get(UNDO_KEY); if (!u) return 'Nothing to undo.';
    const doc = await this.read(u.id);
    const full = docText(doc.paragraphs);
    const reqs = [];
    for (const op of [...u.ops].sort((a, b) => b.start - a.start)) {
      // If the doc changed since, find the inserted text again instead of trusting the old positions.
      let s = op.start;
      if (doc.revisionId !== u.revisionId && slice(doc.paragraphs, s, op.end) !== op.text) {
        const i = full.indexOf(op.text); if (i < 0) continue; s = i + 1;           // the doc body starts at index 1
      }
      reqs.push({ deleteContentRange: { range: { startIndex: s, endIndex: s + (op.end - op.start) } } });
      if (op.type === 'replace') reqs.push({ insertText: { location: { index: s }, text: op.old } });
    }
    if (!reqs.length) { ls.set(UNDO_KEY, null); return 'The inserted text is no longer in the doc — nothing undone.'; }
    await this.batch(u.id, reqs);
    ls.set(UNDO_KEY, null);
    return `Undone (${u.ops.length} ${u.ops.length === 1 ? 'change' : 'changes'} removed from “${doc.title}”).`;
  },
};

function paragraphsOf(d) {
  const out = [];
  for (const c of d.body?.content || []) {
    if (!c.paragraph) continue;
    const els = c.paragraph.elements || [];
    const text = els.map((e) => e.textRun?.content || '').join('');
    const ai = els.some((e) => { const b = e.textRun?.textStyle?.backgroundColor?.color?.rgbColor; return b && Math.abs((b.red ?? 0) - HIGHLIGHT.red) < 0.02 && Math.abs((b.green ?? 0) - HIGHLIGHT.green) < 0.02 && Math.abs((b.blue ?? 0) - HIGHLIGHT.blue) < 0.02; });
    out.push({ start: c.startIndex, end: c.endIndex, text: text.replace(/\n$/, ''), ai });
  }
  return out;
}
function docText(ps) { return ps.map((p) => p.text + '\n').join(''); }
function slice(ps, s, e) { return docText(ps).slice(s - 1, e - 1); }

// Questions in the doc: lines ending in "?" or starting like a task ("Explain…", "1. Solve…").
const Q_START = /^(?:what|who|whom|whose|where|when|why|how|which|write|solve|calculate|compute|find|explain|define|describe|name|list|give|convert|simplify|evaluate|translate|summarize|compare|discuss|analy[sz]e|identify|state|show|prove)\b/i;
export function docQuestions(doc) {
  const qs = [];
  doc.paragraphs.forEach((p, i) => {
    if (p.ai) return;
    const line = p.text.replace(/^\s*(?:q(?:uestion)?\s*)?\(?\d{1,2}[.):]\s*|^\s*[-•*]\s*/i, '').trim();
    if (line.length < 6 || line.length > 400) return;
    if (!(/\?\s*$/.test(line) || Q_START.test(line))) return;
    // Already answered by Pocket Agent (the next non-empty paragraph is highlighted AI text)?
    const next = doc.paragraphs.slice(i + 1).find((x) => x.text.trim());
    qs.push({ p, q: line, answered: !!next?.ai, n: qs.length + 1 });
  });
  return qs;
}

// The text around a question, as context for answering it (title + the paragraphs just before it).
export function contextFor(doc, p, max = 1800) {
  const idx = doc.paragraphs.indexOf(p);
  const before = doc.paragraphs.slice(0, idx).filter((x) => x.text.trim() && !x.ai).map((x) => x.text);
  let ctx = ''; for (let i = before.length - 1; i >= 0 && ctx.length + before[i].length < max; i--) ctx = before[i] + '\n' + ctx;
  return `${doc.title}\n${ctx}`.trim();
}

// What to write into the doc: plain text, no markdown, no stats line.
export function plainAnswer(t) {
  return String(t || '').replace(/```[a-z]*\n?([\s\S]*?)```/g, '$1').replace(/\n\n⚠️ Not verified[\s\S]*$/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\s)\*(\S.*?)\*/g, '$1$2').replace(/^#+\s*/gm, '').replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n').trim();
}

// "answer all" / "answer question 3" / "rewrite paragraph 2 …" / "undo" → what to do in the doc.
export function parseDocCommand(text) {
  const t = text.trim().toLowerCase().replace(/[.!]+$/, '');
  if (/^(undo|undo (that|it|the last (one|insert|change))|take (that|it) (back|out)|remove (that|it|the answers?))$/.test(t)) return { op: 'undo' };
  let m = /^(?:re-?write|rephrase|improve|fix|shorten|expand|simplify|reword)\s+(?:the\s+)?(?:paragraph|para|p)\s*(\d{1,3})\b(.*)$/.exec(t);
  if (m) return { op: 'rewrite', n: +m[1], how: `${t.split(/\s+/)[0]} this paragraph ${m[2].trim()}`.trim() };
  m = /^(?:re-?write|rephrase|improve|fix|reword|shorten|expand)\s+(?:my\s+|the\s+)?(?:answer|response)\s*(?:to\s+)?(?:question|q|#|number)?\s*(\d{1,2})\b(.*)$/.exec(t);
  if (m) return { op: 'rewriteAnswer', n: +m[1], how: `${t.split(/\s+/)[0]} this answer ${m[2].trim()}`.trim() };
  m = /\b(?:question|number|problem|no\.?|#|q)\s*(\d{1,2})\b/.exec(t);
  if (m && /\b(answer|solve|do|complete|finish|fill|write)\b/.test(t)) return { op: 'answer', n: +m[1] };
  if (/^(?:please\s+)?(?:answer|solve|do|complete|finish|fill in|fill out|respond to|work out)\b(?:\s+(?:all|all of|each of|every one of|the rest of))?(?:\s+(?:these|them|this|it|that|the|my|those))?(?:\s+(?:questions?|problems?|homework|worksheet|doc(?:ument)?|ones?|in (?:the|my|this) doc(?:ument)?))*\s*(?:again)?\s*(?:for me)?$/.test(t)) return { op: 'answer', all: true, redo: /\bagain\b/.test(t) };
  return null;
}
