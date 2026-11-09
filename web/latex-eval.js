/* Evaluates the LaTeX the stroke-sequence recogniser reads, for what the token engine (math-core.js) cannot: matrices (sum, product, det,
 * inverse, transpose, powers), modular arithmetic (a mod m, a^b mod m, gcd / lcm), and congruences (a ≡ b (mod m), a x ≡ b (mod m)).
 * Everything is exact (BigInt rationals); a result is returned only when it is certain, otherwise it throws 'unsupported' / 'undefined'.
 * Input: LaTeX token arrays as emitted by the model, e.g. ['\\begin','{','b','m','a','t','r','i','x','}','1','&','2','\\\\','3','&','4','\\end',...]. */
const LatexEval = (() => {
  'use strict';
  const La = typeof module !== 'undefined' && module.exports ? require('./linalg-core.js') : LinalgCore;
  const Mo = typeof module !== 'undefined' && module.exports ? require('./modular-core.js') : ModularCore;
  const MAX_TOKENS = 400;
  class LatexError extends Error { constructor(code) { super(code); this.name = 'LatexError'; this.code = code; } }
  const fail = code => { throw new LatexError(code); };
  const TRIGGERS = new Set(['\\begin', '\\bmod', '\\mod', '\\pmod', '\\equiv', '\\det', '\\gcd', '\\lcm']);
  /** true when this reading is for this module rather than for the token engine */
  const applies = tokens => Array.isArray(tokens) && tokens.some(t => TRIGGERS.has(t));

  // ---- values: lin = a·x + b (rational); mat = rows of rationals ----
  const lin = (a, b) => ({k: 'lin', a, b});
  const cst = q => lin(La.ZERO, q);
  const isConst = v => v.k === 'lin' && La.isZero(v.a);
  const needConst = v => { if (v.k !== 'lin' || !isConst(v)) fail('unsupported'); return v.b; };
  const asInt = q => { if (q.d !== 1n) fail('unsupported'); return q.n; };

  function parse(tokens) {
    let i = 0;
    const peek = (o = 0) => tokens[i + o], next = () => tokens[i++];
    const eat = t => { if (peek() !== t) fail('syntax'); i++; };
    const isDigit = t => typeof t === 'string' && /^[0-9.]$/.test(t);
    // a "(" / "\\left(" that opens the modulus of a congruence, "( mod m )", is not a factor
    const opensModulus = () => (peek() === '\\left' ? peek(1) === '(' && (peek(2) === '\\bmod' || peek(2) === '\\mod') : peek() === '(' && (peek(1) === '\\bmod' || peek(1) === '\\mod'));
    const startsAtom = t => t !== undefined && (isDigit(t) || t === 'x' || t === '{' || t === '\\begin' || t === '\\det' || t === '\\gcd' || t === '\\lcm' || t === '\\frac' || ((t === '(' || t === '\\left') && !opensModulus()));

    function number() {
      let s = ''; while (isDigit(peek())) s += next();
      const q = La.parse(s); if (!q) fail('syntax');
      return {t: 'num', v: q};
    }
    function group() { eat('{'); const e = expr(); eat('}'); return e; }
    function openParen() { if (peek() === '\\left') i++; if (peek() !== '(') fail('syntax'); i++; }
    function closeParen() { if (peek() === '\\right') i++; if (peek() !== ')') fail('syntax'); i++; }
    function matrix() {
      eat('\\begin'); eat('{'); let name = ''; while (peek() !== '}' && peek() !== undefined) name += next(); eat('}');
      if (!['bmatrix', 'pmatrix', 'vmatrix', 'matrix'].includes(name)) fail('unsupported');
      const rows = [[]];
      for (;;) {
        rows[rows.length - 1].push(expr());
        const t = next();
        if (t === '&') continue;
        if (t === '\\\\') { rows.push([]); continue; }
        if (t === '\\end') break;
        fail('syntax');
      }
      eat('{'); let end = ''; while (peek() !== '}' && peek() !== undefined) end += next(); eat('}');
      if (end !== name) fail('syntax');
      if (!rows[rows.length - 1].length) rows.pop();
      return {t: 'mat', rows, det: name === 'vmatrix'};
    }
    function atom() {
      const t = peek();
      if (isDigit(t)) return number();
      if (t === 'x') { i++; return {t: 'var'}; }
      if (t === '{') return group();
      if (t === '(' || t === '\\left') { openParen(); const e = expr(); closeParen(); return e; }
      if (t === '\\begin') return matrix();
      if (t === '\\det') { i++; return {t: 'det', a: unaryNoScript()}; }
      if (t === '\\gcd' || t === '\\lcm') {
        i++; openParen(); const a = expr(); eat(','); const b = expr(); closeParen();
        return {t: t.slice(1), a, b};
      }
      if (t === '\\frac') { i++; const n = group(), d = group(); return {t: 'bin', op: '/', l: n, r: d}; }
      return fail('syntax');
    }
    const unaryNoScript = () => atom();
    function postfix() {
      let n = atom();
      while (peek() === '^') {
        i++;
        if (peek() === '{' && peek(1) === 'T' && peek(2) === '}') { i += 3; n = {t: 'T', a: n}; continue; }
        const e = peek() === '{' ? group() : atom();
        n = {t: 'pow', a: n, e};
      }
      return n;
    }
    function unary() {
      if (peek() === '-') { i++; return {t: 'neg', a: unary()}; }
      if (peek() === '+') { i++; return unary(); }
      return postfix();
    }
    function product() {
      let n = unary();
      for (;;) {
        const t = peek();
        if (t === '\\times' || t === '*') { i++; n = {t: 'bin', op: '*', l: n, r: unary()}; }
        else if (t === '\\div' || t === '/') { i++; n = {t: 'bin', op: '/', l: n, r: unary()}; }
        else if (startsAtom(t)) n = {t: 'bin', op: '*', l: n, r: unary()};   // implicit: 3x, A B
        else return n;
      }
    }
    function sum() {
      let n = product();
      while (peek() === '+' || peek() === '-') { const op = next(); n = {t: 'bin', op, l: n, r: product()}; }
      return n;
    }
    function expr() {                       // a mod m binds loosest: 47 mod 5, 3^20 mod 7
      let n = sum();
      while (peek() === '\\bmod' || peek() === '\\mod') { i++; n = {t: 'mod', a: n, m: sum()}; }
      return n;
    }
    function statement() {
      const left = expr();
      if (peek() === '\\equiv') {
        i++; const right = expr();
        let m;
        if (peek() === '\\pmod') { i++; m = group(); }
        else { openParen(); if (peek() === '\\bmod' || peek() === '\\mod') i++; else fail('syntax'); m = sum(); closeParen(); }
        if (i !== tokens.length) fail('syntax');
        return {t: 'cong', l: left, r: right, m};
      }
      if (i !== tokens.length) fail('syntax');
      return left;
    }
    return statement();
  }

  // ---- evaluation ----
  function evalNode(n) {
    switch (n.t) {
      case 'num': return cst(n.v);
      case 'var': return lin(La.ONE, La.ZERO);
      case 'neg': { const v = evalNode(n.a); return v.k === 'mat' ? {k: 'mat', rows: La.scale(La.q(-1n), v.rows)} : lin(La.neg(v.a), La.neg(v.b)); }
      case 'mat': {
        const rows = n.rows.map(r => r.map(e => needConst(evalNode(e))));
        if (n.det) return cst(La.det(rows));
        La.transpose(rows);   // validates the shape (rectangular, at most MAX_DIM)
        return {k: 'mat', rows};
      }
      case 'det': { const v = evalNode(n.a); if (v.k !== 'mat') fail('unsupported'); return cst(La.det(v.rows)); }
      case 'T': { const v = evalNode(n.a); if (v.k !== 'mat') fail('unsupported'); return {k: 'mat', rows: La.transpose(v.rows)}; }
      case 'gcd': return cst(La.q(Mo.gcd(asInt(needConst(evalNode(n.a))), asInt(needConst(evalNode(n.b))))));
      case 'lcm': return cst(La.q(Mo.lcm(asInt(needConst(evalNode(n.a))), asInt(needConst(evalNode(n.b))))));
      case 'mod': {
        const m = asInt(needConst(evalNode(n.m)));
        if (n.a.t === 'pow') {                                   // a^b mod m without ever forming a^b
          const a = evalNode(n.a.a), b = evalNode(n.a.e);
          if (a.k === 'lin' && b.k === 'lin' && isConst(a) && isConst(b) && a.b.d === 1n && b.b.d === 1n) return cst(La.q(Mo.powmod(a.b.n, b.b.n, m)));
        }
        return cst(La.q(Mo.mod(asInt(needConst(evalNode(n.a))), m)));
      }
      case 'pow': {
        const a = evalNode(n.a), e = needConst(evalNode(n.e));
        if (e.d !== 1n || e.n > 64n || e.n < -64n) fail('unsupported');
        const k = Number(e.n);
        if (a.k === 'mat') return {k: 'mat', rows: La.pow(a.rows, k)};
        const base = needConst(a);
        if (k >= 0) { let r = La.ONE; for (let j = 0; j < k; j++) r = La.mul(r, base); return cst(r); }
        let r = La.ONE; for (let j = 0; j < -k; j++) r = La.mul(r, base); return cst(La.div(La.ONE, r));
      }
      case 'bin': return binary(n.op, evalNode(n.l), evalNode(n.r));
      default: return fail('unsupported');
    }
  }
  function binary(op, a, b) {
    if (a.k === 'mat' || b.k === 'mat') {
      if (op === '+' || op === '-') { if (a.k !== b.k) fail('unsupported'); return {k: 'mat', rows: La.addM(a.rows, b.rows, op === '+' ? 1 : -1)}; }
      if (op === '*') {
        if (a.k === 'mat' && b.k === 'mat') return {k: 'mat', rows: La.mulM(a.rows, b.rows)};
        return a.k === 'mat' ? {k: 'mat', rows: La.scale(needConst(b), a.rows)} : {k: 'mat', rows: La.scale(needConst(a), b.rows)};
      }
      if (op === '/' && a.k === 'mat' && b.k === 'lin') return {k: 'mat', rows: La.scale(La.div(La.ONE, needConst(b)), a.rows)};
      return fail('unsupported');
    }
    switch (op) {
      case '+': return lin(La.add(a.a, b.a), La.add(a.b, b.b));
      case '-': return lin(La.sub(a.a, b.a), La.sub(a.b, b.b));
      case '*':
        if (isConst(a)) return lin(La.mul(a.b, b.a), La.mul(a.b, b.b));
        if (isConst(b)) return lin(La.mul(b.b, a.a), La.mul(b.b, a.b));
        return fail('unsupported');                      // x·x is not linear
      case '/': { const d = needConst(b); return lin(La.div(a.a, d), La.div(a.b, d)); }
      default: return fail('unsupported');
    }
  }

  /** -> {kind:'scalar', q} | {kind:'matrix', rows} | {kind:'bool', value} | {kind:'congruence', r, m} | {kind:'none'} | {kind:'all'} ; throws LatexError / LinalgError / ModularError */
  function evaluate(tokens) {
    if (!Array.isArray(tokens) || !tokens.length || tokens.length > MAX_TOKENS || tokens.some(t => typeof t !== 'string')) fail('unsupported');
    const toks = tokens.slice(); while (toks.length && toks[toks.length - 1] === '=') toks.pop();
    const ast = parse(toks);
    if (ast.t === 'cong') {
      const m = asInt(needConst(evalNode(ast.m)));
      if (m <= 0n) fail('undefined');
      const l = evalNode(ast.l), r = evalNode(ast.r);
      if (l.k !== 'lin' || r.k !== 'lin') fail('unsupported');
      const a = La.sub(l.a, r.a), b = La.sub(r.b, l.b);          // a x ≡ b
      if (La.isZero(a)) return {kind: 'bool', value: Mo.congruent(asInt(l.b), asInt(r.b), m)};
      const sol = Mo.solveLinear(asInt(a), asInt(b), m);
      if (!sol) return {kind: 'none'};
      return sol.m === 1n ? {kind: 'all'} : {kind: 'congruence', r: sol.r, m: sol.m};
    }
    const v = evalNode(ast);
    if (v.k === 'mat') return {kind: 'matrix', rows: v.rows};
    return {kind: 'scalar', q: needConst(v)};
  }
  return Object.freeze({applies, evaluate, LatexError});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LatexEval;
