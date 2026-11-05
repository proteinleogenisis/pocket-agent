/**
 * Pocket Agent ↔ Google Docs & Slides bridge. Runs in YOUR Google account (script.google.com), so no
 * Google Cloud setup or client ID is needed. Deploy: Deploy → New deployment → Web app → Execute as: Me,
 * Who has access: Anyone → Deploy → Authorize → copy the Web app URL into Pocket Agent.
 * Keep that URL private: it is the key to your docs (like a password).
 */
var HL = '#fff2b3';   // the highlight behind text Pocket Agent wrote
var DOC = 'application/vnd.google-apps.document', SLIDES = 'application/vnd.google-apps.presentation';

function doGet() { return out({ ok: true, app: 'pocket-agent-docs', v: 2, slides: true }); }

function doPost(e) {
  try {
    var r = JSON.parse(e.postData.contents || '{}');
    var f = { recent: recent, read: read, insert: insert, replace: replace, remove: remove, restore: restore }[r.op];
    if (!f) return out({ error: 'unknown op' });
    return out({ ok: true, result: f(r) });
  } catch (err) { return out({ error: String(err && err.message || err) }); }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function recent() {
  var it = DriveApp.searchFiles('(mimeType = "' + DOC + '" or mimeType = "' + SLIDES + '") and trashed = false'), a = [];
  while (it.hasNext() && a.length < 60) { var f = it.next(); a.push({ id: f.getId(), name: f.getName(), kind: f.getMimeType() == SLIDES ? 'slides' : 'doc', t: f.getLastUpdated().getTime() }); }
  a.sort(function (x, y) { return y.t - x.t; });
  return a.slice(0, 12);
}

// ---------- One flat list of paragraphs for either kind of file ----------
// Docs: each body paragraph / list item. Slides: each paragraph of each text box, with a "Slide N" header.
function flat(id) {
  if (DriveApp.getFileById(id).getMimeType() == SLIDES) return flatSlides(id);
  var d = DocumentApp.openById(id), b = d.getBody(), ps = [];
  for (var i = 0; i < b.getNumChildren(); i++) {
    var c = b.getChild(i), t = c.getType();
    var ok = t == DocumentApp.ElementType.PARAGRAPH || t == DocumentApp.ElementType.LIST_ITEM;
    ps.push({ text: ok ? c.asText().getText() : '', ai: ok && docAI(c), doc: { el: c, i: i, body: b } });
  }
  return { title: d.getName(), kind: 'doc', ps: ps };
}
function docAI(c) { var s = c.editAsText(); return !!(s.getText().length && s.getBackgroundColor(0) == HL); }

function flatSlides(id) {
  var p = SlidesApp.openById(id), ps = [];
  p.getSlides().forEach(function (slide, si) {
    ps.push({ text: 'Slide ' + (si + 1), hdr: true });
    slide.getPageElements().forEach(function (pe) {
      if (pe.getPageElementType() != SlidesApp.PageElementType.SHAPE) return;
      var tr; try { tr = pe.asShape().getText(); } catch (e) { return; }
      var full = tr.asString();
      if (!full.trim()) return;
      tr.getParagraphs().forEach(function (para) {
        var s = para.getRange().getStartIndex(), nl = full.indexOf('\n', s); if (nl < 0) nl = full.length;
        ps.push({ text: full.slice(s, nl), ai: slideAI(tr, s, nl), sl: { tr: tr, s: s, nl: nl } });
      });
    });
  });
  return { title: p.getName(), kind: 'slides', ps: ps };
}
function slideAI(tr, s, nl) {
  if (nl <= s) return false;
  try { var c = tr.getRange(s, s + 1).getTextStyle().getBackgroundColor(); return !!c && c.asRgbColor().asHexString().toLowerCase() == HL; } catch (e) { return false; }
}

function read(r) {
  var f = flat(r.id);
  return { id: r.id, title: f.title, kind: f.kind, paragraphs: f.ps.map(function (p, i) { return { i: i, text: p.text, ai: !!p.ai, hdr: !!p.hdr }; }) };
}

// items: [{ i, text, expect }] → each text goes in right after paragraph i, highlighted.
function insert(r) {
  var f = flat(r.id);
  var items = r.items.slice().sort(function (x, y) { return y.i - x.i; });   // bottom first: positions stay valid
  items.forEach(function (it) {
    var p = f.ps[it.i];
    if (!p || (it.expect != null && p.text != it.expect)) throw new Error('The file changed — ask again');
    var lines = String(it.text).split(/\n+/).filter(function (l) { return l.trim(); });
    if (p.doc) {
      for (var k = lines.length - 1; k >= 0; k--) {
        var np = p.doc.body.insertParagraph(p.doc.i + 1, lines[k]);
        np.setHeading(DocumentApp.ParagraphHeading.NORMAL);
        np.editAsText().setBold(false).setItalic(false).setBackgroundColor(HL);
      }
    } else if (p.sl) {
      var text = lines.join('\n');
      p.sl.tr.insertText(p.sl.nl, '\n' + text);
      p.sl.tr.getRange(p.sl.nl + 1, p.sl.nl + 1 + text.length).getTextStyle().setBackgroundColor(HL).setBold(false).setItalic(false);
    }
  });
  return items.length;
}

function replace(r) {
  var p = flat(r.id).ps[r.i];
  if (!p || (r.expect != null && p.text != r.expect)) throw new Error('The file changed — ask again');
  if (p.doc) { p.doc.el.asText().setText(r.text); p.doc.el.editAsText().setBackgroundColor(HL); }
  else if (p.sl) { var rg = p.sl.tr.getRange(p.sl.s, p.sl.nl); rg.setText(r.text); p.sl.tr.getRange(p.sl.s, p.sl.s + r.text.length).getTextStyle().setBackgroundColor(HL); }
  return p.text;
}

// Undo an insert: remove highlighted paragraphs whose text is one of r.texts (bottom first).
function remove(r) {
  var f = flat(r.id), want = {}, n = 0;
  r.texts.forEach(function (t) { want[t] = (want[t] || 0) + 1; });
  for (var i = f.ps.length - 1; i >= 0; i--) {
    var p = f.ps[i];
    if (!p.ai || !want[p.text]) continue;
    want[p.text]--; n++;
    if (p.doc) {
      // A doc must end with a paragraph: if the answer is last, empty it and merge it into the line above.
      if (p.doc.i == p.doc.body.getNumChildren() - 1) { p.doc.el.asText().setText(''); try { p.doc.el.merge(); } catch (e) {} }
      else p.doc.body.removeChild(p.doc.el);
    }
    else if (p.sl) { if (p.sl.s > 0) p.sl.tr.getRange(p.sl.s - 1, p.sl.nl).clear(); else p.sl.tr.getRange(p.sl.s, p.sl.nl).clear(); }
  }
  return n;
}

// Undo a rewrite: put the old text back (without the highlight).
function restore(r) {
  var f = flat(r.id);
  for (var i = 0; i < f.ps.length; i++) {
    var p = f.ps[i];
    if (!p.ai || p.text != r.text) continue;
    if (p.doc) { p.doc.el.asText().setText(r.old); p.doc.el.editAsText().setBackgroundColor(null); }
    else { p.sl.tr.getRange(p.sl.s, p.sl.nl).setText(r.old); if (r.old.length) p.sl.tr.getRange(p.sl.s, p.sl.s + r.old.length).getTextStyle().setBackgroundColorTransparent(); }
    return 1;
  }
  return 0;
}
