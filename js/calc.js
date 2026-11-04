// Safe arithmetic evaluator. No eval/Function: tokenizes and parses a small grammar.
// Supports + - * / % ^, parentheses, unary minus, constants (pi, e) and math functions.

const FUNCS = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  ln: Math.log, log: Math.log10, log2: Math.log2, exp: Math.exp,
  min: Math.min, max: Math.max, pow: Math.pow,
};
const CONSTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

function tokenize(src) {
  const out = [];
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/,(?=\d{3}\b)/g, '');
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (num) { out.push({ t: 'num', v: parseFloat(num[0]) }); i += num[0].length; continue; }
    const id = /^[a-z_][a-z0-9_]*/i.exec(s.slice(i));
    if (id) { out.push({ t: 'id', v: id[0].toLowerCase() }); i += id[0].length; continue; }
    if ('+-*/%^(),'.includes(c)) { out.push({ t: c }); i++; continue; }
    throw new Error(`Unexpected character "${c}"`);
  }
  return out;
}

export function calculate(expr) {
  if (typeof expr !== 'string' || !expr.trim()) throw new Error('Empty expression');
  if (expr.length > 500) throw new Error('Expression too long');
  const toks = tokenize(expr);
  let p = 0;
  const peek = () => toks[p];
  const eat = (t) => { if (peek()?.t !== t) throw new Error(`Expected "${t}"`); p++; };

  function primary() {
    const tk = peek();
    if (!tk) throw new Error('Unexpected end of expression');
    if (tk.t === 'num') { p++; return tk.v; }
    if (tk.t === '(') { p++; const v = expr0(); eat(')'); return v; }
    if (tk.t === '-') { p++; return -power(); }
    if (tk.t === '+') { p++; return power(); }
    if (tk.t === 'id') {
      p++;
      if (tk.v in CONSTS) return CONSTS[tk.v];
      const fn = FUNCS[tk.v];
      if (!fn) throw new Error(`Unknown name "${tk.v}"`);
      eat('(');
      const args = [expr0()];
      while (peek()?.t === ',') { p++; args.push(expr0()); }
      eat(')');
      return fn(...args);
    }
    throw new Error(`Unexpected "${tk.t}"`);
  }
  function power() {
    const base = primary();
    if (peek()?.t === '^') { p++; return Math.pow(base, unary()); } // right-assoc
    return base;
  }
  function unary() {
    if (peek()?.t === '-') { p++; return -unary(); }
    if (peek()?.t === '+') { p++; return unary(); }
    return power();
  }
  function term() {
    let v = unary();
    while (['*', '/', '%'].includes(peek()?.t)) {
      const op = toks[p++].t; const r = unary();
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  }
  function expr0() {
    let v = term();
    while (['+', '-'].includes(peek()?.t)) {
      const op = toks[p++].t; const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const v = expr0();
  if (p !== toks.length) throw new Error('Unexpected trailing input');
  if (!Number.isFinite(v)) throw new Error('Result is not a finite number');
  return Math.round(v * 1e12) / 1e12;
}

// True when a string is plausibly a pure arithmetic expression.
export function looksLikeMath(s) {
  return /\d/.test(s) && /^[\d\s.+\-*/%^(),×÷a-z]*$/i.test(s) && /[+\-*/%^×÷]|\b(sqrt|sin|cos|tan|log|ln|abs|pow)\b/i.test(s)
    && (() => { try { calculate(s); return true; } catch { return false; } })();
}
