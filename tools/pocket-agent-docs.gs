/**
 * Pocket Agent ↔ Google Docs bridge. Runs in YOUR Google account (script.google.com), so no Google Cloud
 * setup or client ID is needed. Deploy: Deploy → New deployment → Web app → Execute as: Me,
 * Who has access: Anyone → Deploy → Authorize → copy the Web app URL into Pocket Agent.
 * Keep that URL private: it is the key to your docs (like a password).
 */
var HL = '#fff2b3';   // the highlight behind text Pocket Agent wrote

function doGet() { return out({ ok: true, app: 'pocket-agent-docs', v: 1 }); }

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
  var it = DriveApp.searchFiles('mimeType = "application/vnd.google-apps.document" and trashed = false'), a = [];
  while (it.hasNext() && a.length < 40) { var f = it.next(); a.push({ id: f.getId(), name: f.getName(), t: f.getLastUpdated().getTime() }); }
  a.sort(function (x, y) { return y.t - x.t; });
  return a.slice(0, 10);
}

function textual(c) { var t = c.getType(); return t == DocumentApp.ElementType.PARAGRAPH || t == DocumentApp.ElementType.LIST_ITEM; }
function isAI(c) { var s = c.asText ? c.editAsText() : null; return !!(s && s.getText().length && s.getBackgroundColor(0) == HL); }

function read(r) {
  var d = DocumentApp.openById(r.id), b = d.getBody(), ps = [];
  for (var i = 0; i < b.getNumChildren(); i++) {
    var c = b.getChild(i);
    if (!textual(c)) { ps.push({ i: i, text: '', ai: false }); continue; }
    ps.push({ i: i, text: c.asText().getText(), ai: isAI(c) });
  }
  return { id: r.id, title: d.getName(), paragraphs: ps };
}

// items: [{ i, text }] → each text becomes highlighted normal paragraph(s) right after child i.
function insert(r) {
  var b = DocumentApp.openById(r.id).getBody();
  var items = r.items.slice().sort(function (x, y) { return y.i - x.i; });   // bottom first: indexes stay valid
  items.forEach(function (it) {
    var lines = String(it.text).split(/\n+/).filter(function (l) { return l.trim(); });
    for (var k = lines.length - 1; k >= 0; k--) {
      var p = b.insertParagraph(it.i + 1, lines[k]);
      p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
      p.editAsText().setBold(false).setItalic(false).setBackgroundColor(HL);
    }
  });
  return items.length;
}

function replace(r) {
  var c = DocumentApp.openById(r.id).getBody().getChild(r.i);
  var old = c.asText().getText();
  if (r.expect != null && old != r.expect) throw new Error('The doc changed — ask again');
  c.asText().setText(r.text); c.editAsText().setBackgroundColor(HL);
  return old;
}

// Undo an insert: remove highlighted paragraphs whose text is one of r.texts.
function remove(r) {
  var b = DocumentApp.openById(r.id).getBody(), want = {}, n = 0;
  r.texts.forEach(function (t) { want[t] = (want[t] || 0) + 1; });
  for (var i = b.getNumChildren() - 1; i >= 0; i--) {
    var c = b.getChild(i);
    if (!textual(c) || !isAI(c)) continue;
    var t = c.asText().getText();
    if (want[t]) { want[t]--; if (i == b.getNumChildren() - 1) c.asText().setText(''); else b.removeChild(c); n++; }
  }
  return n;
}

// Undo a rewrite: put the old text back (without the highlight).
function restore(r) {
  var b = DocumentApp.openById(r.id).getBody();
  for (var i = 0; i < b.getNumChildren(); i++) {
    var c = b.getChild(i);
    if (textual(c) && isAI(c) && c.asText().getText() == r.text) { c.asText().setText(r.old); c.editAsText().setBackgroundColor(null); return 1; }
  }
  return 0;
}
