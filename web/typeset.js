/* Typesets the algebra engine's text answers ("(1/2)·(2-2·√6)", "e^(-2·x)", "√2/2", "x=nπ") like paper or a chalkboard:
 * fractions stacked, roots with the bar over the whole radicand, powers raised, implicit multiplication, a rational coefficient folded into the fraction.
 * Output is the LaTeX token list the board already draws for readings (\frac { } { }, \sqrt { }, ^ { }), so answers and readings look the same.
 * Pure; returns null for anything it cannot parse (the caller then falls back to plain text). */
const Typeset = (() => {
  'use strict';
  const FUNCS = {sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', sec: '\\sec', csc: '\\csc', ln: '\\ln', log: '\\log', exp: '\\exp', sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan', arg: '\\arg', conj: '\\overline'};

  function lex(s) {
    const out = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      let m;
      if ((m = /^\d+(\.\d+)?/.exec(s.slice(i)))) { out.push({t: 'num', v: m[0]}); i += m[0].length; continue; }
      if ((m = /^[A-Za-z][A-Za-z0-9_]*/.exec(s.slice(i)))) { out.push({t: 'id', v: m[0]}); i += m[0].length; continue; }
      if (c === 'π') { out.push({t: 'id', v: 'pi'}); i++; continue; }
      if (c === '√') { out.push({t: 'id', v: 'sqrt'}); i++; continue; }
      if ('+-−'.includes(c)) { out.push({t: 'op', v: c === '−' ? '-' : c}); i++; continue; }
      if ('*·×'.includes(c)) { out.push({t: 'op', v: '*'}); i++; continue; }
      if ('/⁄'.includes(c)) { out.push({t: 'op', v: '/'}); i++; continue; }
      if ('^()'.includes(c)) { out.push({t: 'op', v: c}); i++; continue; }
      if (c === ',') { out.push({t: 'op', v: ','}); i++; continue; }
      return null;
    }
    return out;
  }

  function parse(tokens) {
    let i = 0;
    const peek = () => tokens[i], eat = v => peek() && peek().t === 'op' && peek().v === v ? (i++, true) : false;
    const startsAtom = t => t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '('));
    function expr() {
      let n = term();
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) { const o = tokens[i++].v; n = {k: 'bin', o, a: n, b: term()}; }
      return n;
    }
    function term() {
      let n = unary();
      for (;;) {
        const t = peek();
        if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) { i++; n = {k: 'bin', o: t.v, a: n, b: unary()}; }
        else if (startsAtom(t)) n = {k: 'bin', o: '*', a: n, b: unary(), implicit: true};
        else return n;
      }
    }
    function unary() { if (eat('-')) return {k: 'neg', a: unary()}; if (eat('+')) return unary(); return power(); }
    function power() { const b = atom(); if (eat('^')) return {k: 'bin', o: '^', a: b, b: eat('-') ? {k: 'neg', a: powerOperand()} : powerOperand()}; return b; }
    function powerOperand() { const a = atom(); return eat('^') ? {k: 'bin', o: '^', a, b: powerOperand()} : a; }
    function atom() {
      const t = tokens[i++];
      if (!t) throw new Error('eof');
      if (t.t === 'num') return {k: 'num', v: t.v};
      if (t.t === 'op' && t.v === '(') { const e = expr(); if (!eat(')')) throw new Error('paren'); return {k: 'group', a: e}; }
      if (t.t === 'id') {
        if (t.v === 'sqrt' || FUNCS[t.v] || t.v === 'abs') {
          if (eat('(')) { const args = [expr()]; while (eat(',')) args.push(expr()); if (!eat(')')) throw new Error('call'); return {k: 'call', f: t.v, args}; }
          if (t.v === 'sqrt') return {k: 'call', f: 'sqrt', args: [atom()]};          // "√6", "√2/2": the root of the next atom only
        }
        return {k: 'id', v: t.v};
      }
      throw new Error('atom');
    }
    const n = expr();
    if (i !== tokens.length) throw new Error('rest');
    return n;
  }

  const digits = s => [...s];                                                    // the board draws one glyph per character
  const strip = n => n.k === 'group' ? strip(n.a) : n;
  const isRatConst = n => { n = strip(n); return n.k === 'num' || (n.k === 'bin' && n.o === '/' && strip(n.a).k === 'num' && strip(n.b).k === 'num'); };

  function tex(n, prec = 0) {                                                    // prec: 0 sum, 1 product, 2 power base
    n = n.k === 'group' ? n.a : n;
    switch (n.k) {
      case 'num': return digits(n.v);
      case 'id': return n.v === 'pi' ? ['\\pi'] : n.v === 'e' ? ['e'] : n.v === 'i' ? ['i'] : [...n.v.replace(/_/g, '')];
      case 'neg': { const inner = tex(n.a, 1); return prec > 0 ? ['(', '-', ...inner, ')'] : ['-', ...inner]; }
      case 'call': {
        if (n.f === 'sqrt') return ['\\sqrt', '{', ...tex(n.args[0], 0), '}'];
        if (n.f === 'abs') return ['|', ...tex(n.args[0], 0), '|'];
        if (n.f === 'conj') return ['\\overline', '{', ...tex(n.args[0], 0), '}'];
        return [FUNCS[n.f], '(', ...n.args.flatMap((a, k) => (k ? [','] : []).concat(tex(a, 0))), ')'];
      }
      case 'bin': {
        if (n.o === '+' || n.o === '-') {
          // a sum: constants first (1 - √6, not -√6 + 1), signs carried by the operators rather than bracketed
          const terms = [];
          (function flat(m, sign) {
            m = m.k === 'group' && m.a.k === 'bin' && (m.a.o === '+' || m.a.o === '-') ? m.a : m;
            if (m.k === 'bin' && (m.o === '+' || m.o === '-')) { flat(m.a, sign); flat(m.b, m.o === '-' ? -sign : sign); } else terms.push({sign, node: m});
          })(n, 1);
          const rank = t => isRatConst(t.node) || (strip(t.node).k === 'neg' && isRatConst(strip(t.node).a)) ? 0 : 1;
          const numeric = m => m.k === 'num' || (m.k === 'id' && ['pi', 'e', 'i'].includes(m.v)) || m.k === 'group' && numeric(m.a) || m.k === 'neg' && numeric(m.a)
            || m.k === 'call' && m.args.every(numeric) || m.k === 'bin' && numeric(m.a) && numeric(m.b);
          if (terms.every(t => numeric(t.node))) terms.sort((p, q) => rank(p) - rank(q));          // only for numbers: 1 - √6; polynomials keep their order
          const out = [];
          terms.forEach((t, k) => {
            let body = tex(t.node, 0), sign = t.sign;
            if (body[0] === '-') { body = body.slice(1); sign = -sign; }
            if (k === 0) out.push(...(sign < 0 ? ['-'] : []), ...body); else out.push(sign < 0 ? '-' : '+', ...body);
          });
          return prec > 0 ? ['(', ...out, ')'] : out;
        }
        if (n.o === '^') return power(n, prec);
        return product(n, prec);
      }
      default: throw new Error('node');
    }
  }

  function power(n, prec) {
    const b = strip(n.a), e = strip(n.b);
    const half = e.k === 'bin' && e.o === '/' && strip(e.a).k === 'num' && strip(e.b).k === 'num';
    if (half && strip(e.b).v === '2') {                                          // x^(1/2) = √x, x^(3/2) = (√x)^3
      const p = strip(e.a).v, root = ['\\sqrt', '{', ...tex(b, 0), '}'];
      return p === '1' ? root : ['(', ...root, ')', '^', '{', ...digits(p), '}'];
    }
    const base = tex(b, 2), needParen = !(b.k === 'num' || b.k === 'id' || b.k === 'call' || (b.k === 'group' && false));
    const wrapped = needParen && !(b.k === 'call' && b.f !== 'abs') ? ['(', ...tex(b, 0), ')'] : base;
    return ['{', ...wrapped, '}', '^', '{', ...tex(e, 0), '}'];
  }

  /** a product / quotient: collect the factors above and below the line, fold rational coefficients, write \frac when there is a denominator */
  function product(n, prec) {
    const num = [], den = [];
    (function walk(m, inDen) {
      m = m.k === 'group' && m.a.k === 'bin' && (m.a.o === '*' || m.a.o === '/') ? m.a : m;
      if (m.k === 'bin' && m.o === '*') { walk(m.a, inDen); walk(m.b, inDen); }
      else if (m.k === 'bin' && m.o === '/') { walk(m.a, inDen); walk(m.b, !inDen); }
      else (inDen ? den : num).push(m);
    })(n, false);
    // numeric factors multiply, so (1/2)·(2-2√6) is one fraction over 2
    let minus = false;                                                          // -2x, -3π/4: the sign goes in front, not in brackets
    if (num.length && strip(num[0]).k === 'neg') { minus = true; num[0] = strip(num[0]).a; }
    const ones = f => strip(f).k === 'num' && strip(f).v === '1';
    const nn = num.filter(f => !ones(f)), dd = den.filter(f => !ones(f));
    const join = fs => fs.reduce((acc, f, k) => {
      const t = tex(f, 1);
      if (k === 0) return t;
      const prevNum = strip(fs[k - 1]).k === 'num', thisNum = strip(f).k === 'num';
      return [...acc, ...(prevNum && thisNum ? ['\\times'] : []), ...t];
    }, []);
    const signed = out => { const o = [...(minus ? ['-'] : []), ...out]; return prec > 1 || (minus && prec > 0) ? ['(', ...o, ')'] : o; };
    if (!dd.length) return signed(nn.length ? join(nn) : ['1']);
    // a lone sum in the numerator needs no brackets once it sits over a bar
    const top = nn.length ? (nn.length === 1 ? tex(nn[0], 0) : join(nn)) : ['1'];
    const bottom = dd.length === 1 ? tex(dd[0], 0) : join(dd);
    return signed(['\\frac', '{', ...top, '}', '{', ...bottom, '}']);
  }

  /** answer text -> LaTeX tokens (or null) */
  function tokens(str) {
    try {
      const lx = lex(String(str)); if (!lx || !lx.length) return null;
      return tex(parse(lx), 0);
    } catch (_) { return null; }
  }
  /** a list "a, b, c" at top level -> tokens joined with commas, each typeset */
  function list(str) { const parts = String(str).split(/,\s*(?![^()]*\))/); const out = []; for (const p of parts) { const t = tokens(p); if (!t) return null; if (out.length) out.push(','); out.push(...t); } return out; }
  return Object.freeze({tokens, list});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Typeset;
