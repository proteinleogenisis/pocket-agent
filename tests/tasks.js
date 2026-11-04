// End-to-end task suite: plain-English requests → agent → tool/answer → result is checked.
// Run with ?bench=<model>&tasks=1. Confirmation dialogs are auto-accepted in this mode only.
import { runJS, runPython } from '../js/sandbox.js';

const lastMsg = () => [...document.querySelectorAll('#log .msg')].at(-1);
const lastText = () => lastMsg()?.innerText || '';
const codeBlocks = () => [...(replyEl || lastMsg()).querySelectorAll('.codeblock pre')].map((p) => p.textContent);

// The reply is the first message after the user's message (later ones are notices).
let replyEl = null;
async function ask(q) {
  const before = document.querySelectorAll('#log .msg').length;
  await window.__pa.send(q);
  replyEl = document.querySelectorAll('#log .msg')[before + 1] || lastMsg();
  return replyEl?.innerText || '';
}

// Code from the answer must actually run and produce the right value.
async function codeWorks(lang, call, expect) {
  const blocks = codeBlocks();
  if (!blocks.length) return `no code block`;
  const code = blocks.join('\n');
  const fn = lang === 'py' ? /^\s*def\s+(\w+)\s*\(/m.exec(code)?.[1] : (/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/m.exec(code) || /^\s*(?:const|let|var)\s+(\w+)\s*=/m.exec(code))?.[1];
  if (!fn) return 'no function found';
  const r = lang === 'py' ? await runPython(`${code}\nprint(${fn}(${call}))`) : await runJS(`${code}\nconsole.log(${fn}(${call}))`);
  return r.ok && r.output.trim().split('\n').at(-1).trim() === expect ? true : `ran ${fn}(${call}) → ${(r.output || r.error || '').slice(-80)}`;
}

const has = (...words) => (t) => words.every((w) => t.toLowerCase().includes(String(w).toLowerCase())) || `missing ${words.join(', ')}`;

export const TASKS = [
  ['what is 15% of 240', has('36')],
  ['calculate (17 * 23) + 4', has('395')],
  ["what's 2 to the power of 16", has('65536')],
  ['run this python: print(sum(i*i for i in range(10)))', has('285')],
  ["execute javascript: console.log([3,1,2].sort().join(','))", has('1,2,3')],
  ['uppercase this text: hello world', has('HELLO WORLD')],
  ['convert to snake case: myVariableName', has('my_variable_name')],
  ['base64 encode the text hello', has('aGVsbG8=')],
  ['count the words in: the quick brown fox jumps', has('5 words')],
  ['save a note: Shopping list - eggs and milk', has('saved')],
  ['remember that the wifi password is on the fridge', has('saved')],
  ['search my notes for eggs', has('eggs')],
  ['write a JavaScript function that returns the factorial of n', () => codeWorks('js', 5, '120')],
  ['write a python function that checks if a number is prime', () => codeWorks('py', 7, 'True')],
  ['write a javascript function that reverses a string', () => codeWorks('js', '"abc"', 'cba')],
  ['write a python function that returns the nth fibonacci number', () => codeWorks('py', 10, '55')],
  ['screen:What does this error mean and what is the fix?', has('undefined')],
  ['hello', (t) => !/```|print\(|console\.log/.test(t) && !(replyEl?.querySelector('.codeblock')) || 'replied with code to a greeting'],
  ['what can you do', has('Code', 'Screen', 'open')],
  ['open safari', () => opened.at(-1)?.startsWith('x-safari-https://') || `opened ${opened.at(-1)}`],
  ['open notes', () => opened.at(-1) === 'mobilenotes://' || `opened ${opened.at(-1)}`],
  ['search the web for webgpu ipad', () => /google\.com\/search\?q=webgpu%20ipad/.test(opened.at(-1) || '') || `opened ${opened.at(-1)}`],
  ['run this python: import webbrowser; webbrowser.open("https://example.com")', has("can't open")],
  ['write a python program that prints the squares of 1 to 10 and run it', has('100', 'Ran successfully')],
  ['save that as squares.py', has('Saved squares.py')],
  ['run squares.py', has('100')],
  ['email test@example.com about the meeting tomorrow', () => (/^mailto:test@example\.com\?subject=the%20meeting%20tomorrow&body=.{20,}/.test(opened.at(-1) || '') || `opened ${(opened.at(-1) || '').slice(0, 80)}`)],
  ['directions to the eiffel tower', () => opened.at(-1) === 'maps://?daddr=the%20eiffel%20tower' || `opened ${opened.at(-1)}`],
];

function errorScreenshot() {
  const c = document.createElement('canvas'); c.width = 1400; c.height = 500; const g = c.getContext('2d');
  g.fillStyle = '#1e1e1e'; g.fillRect(0, 0, 1400, 500); g.fillStyle = '#ddd'; g.font = '30px Menlo, monospace';
  g.fillText('const user = getUser(42);', 40, 90); g.fillText('console.log(user.name);', 40, 140);
  g.fillStyle = '#ff6b6b'; g.fillText("TypeError: Cannot read properties of undefined (reading 'name')", 40, 300);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

const opened = [];
export async function runTasks() {
  window.__openURL = (u) => opened.push(u);   // don't actually leave the app during tests
  // Auto-accept confirmations in test mode.
  const dlg = document.getElementById('confirmDlg');
  new MutationObserver(() => { if (dlg.open) setTimeout(() => document.getElementById('confirmYes').click(), 30); }).observe(dlg, { attributes: true, attributeFilter: ['open'] });
  const results = []; let pass = 0; const t0 = performance.now();
  for (const [q0, check] of TASKS) {
    let q = q0;
    if (q.startsWith('screen:')) { q = q.slice(7); await window.__pa.ingestImage(await errorScreenshot()); }
    const s = performance.now();
    let verdict;
    try { const text = await ask(q); verdict = await check(text); } catch (e) { verdict = 'threw ' + e.message; }
    const ok = verdict === true; if (ok) pass++;
    results.push(`${ok ? '✓' : '✗'} ${q0.replace('screen:', '[screenshot] ')} (${((performance.now() - s) / 1000).toFixed(1)}s)${ok ? '' : ' — ' + verdict}`);
  }
  const summary = { tasks: `${pass}/${TASKS.length}`, total_s: +((performance.now() - t0) / 1000).toFixed(1), results };
  window.__tasks = summary;
  return summary;
}
