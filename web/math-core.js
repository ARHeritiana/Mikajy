/* Mikajy mathematical core. No DOM, recognition, storage or Android dependencies.
 * Real-valued arithmetic and polynomial equations of degree at most two.
 * Exact rational arithmetic is retained only when mathematically justified.
 */
const MathCore = (() => {
  'use strict';
  const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'abs']);
  const INVERSE = {sin: 'asin', cos: 'acos', tan: 'atan'};
  const MAX_TOKENS = 160;
  const MAX_DEPTH = 48;
  class MathError extends Error {
    constructor(code) { super(code); this.name = 'MathError'; this.code = code; }
  }
  const fail = code => { throw new MathError(code); };
  const isNumber = t => typeof t === 'string' && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(t);
  const startsAtom = t => isNumber(t) || t === '(' || t === 'π' || t === 'e' || t === 'x' || t === '√' || FUNCTIONS.has(t);
  const MAX_BITS = 192;
  const abs = a => a < 0n ? -a : a;
  function gcd(a, b) { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a || 1n; }
  function rational(n, d = 1n) {
    if (d === 0n) fail('undefined');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d); n /= g; d /= g;
    if (abs(n).toString(2).length > MAX_BITS || d.toString(2).length > MAX_BITS) fail('unsupported');
    return {n, d};
  }
  const R0 = () => rational(0n);
  const R1 = () => rational(1n);
  const add = (a, b) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
  const neg = a => rational(-a.n, a.d);
  const sub = (a, b) => add(a, neg(b));
  const mul = (a, b) => rational(a.n * b.n, a.d * b.d);
  const div = (a, b) => rational(a.n * b.d, a.d * b.n);
  function pow(a, k) {
    if (!Number.isSafeInteger(k) || Math.abs(k) > 100) fail('unsupported');
    if (a.n === 0n && k <= 0) fail('undefined');
    return k >= 0 ? rational(a.n ** BigInt(k), a.d ** BigInt(k))
      : rational(a.d ** BigInt(-k), a.n ** BigInt(-k));
  }
  function literal(s) {
    const parts = s.split('.');
    const n = BigInt(parts.join(''));
    const d = parts.length === 2 ? 10n ** BigInt(parts[1].length) : 1n;
    return rational(n, d);
  }
  const value = r => Number(r.n) / Number(r.d);
  function finite(v) { if (!Number.isFinite(v)) fail('undefined'); return v; }
  const nodes = (type, data) => Object.assign({type}, data);

  function parse(tokens) {
    if (!Array.isArray(tokens) || !tokens.length || tokens.length > MAX_TOKENS) fail('unsupported');
    if (tokens.some(t => typeof t !== 'string' || t.length > 96 || ['Σ', '∫', 'lim', '∞', '→'].includes(t))) fail('unsupported');
    let i = 0, depth = 0;
    const peek = () => tokens[i];
    const next = () => tokens[i++];
    const enter = () => { if (++depth > MAX_DEPTH) fail('unsupported'); };
    const leave = () => { --depth; };
    const group = () => {
      if (next() !== '(') fail('syntax');
      enter(); const n = expression(); leave();
      if (next() !== ')') fail('syntax');
      return n;
    };
    const exponent = () => peek() === '(' ? group() : unary();
    const atom = () => {
      const t = peek();
      if (t === '(') return group();
      if (isNumber(t)) { next(); return nodes('number', {raw: t}); }
      if (t === 'π' || t === 'e' || t === 'x') { next(); return nodes('symbol', {name: t}); }
      if (t === '√') { next(); return nodes('function', {name: 'sqrt', arg: postfix()}); }
      if (FUNCTIONS.has(t)) {
        next();
        let fnExponent = null;
        if (peek() === '^') { next(); fnExponent = exponent(); }
        const arg = peek() === '(' ? group() : postfix();
        let name = t;
        if (fnExponent) {
          const p = exact(fnExponent);
          if (p && p.n === -p.d && INVERSE[name]) { name = INVERSE[name]; fnExponent = null; }
        }
        const fn = nodes('function', {name, arg});
        return fnExponent ? nodes('binary', {op: '^', left: fn, right: fnExponent}) : fn;
      }
      fail('syntax');
    };
    const postfix = () => {
      let n = atom();
      while (peek() === '!' || peek() === '%') n = nodes(peek() === '!' ? 'factorial' : 'percent', {arg: n, token: next()});
      return n;
    };
    const power = () => {
      let n = postfix();
      if (peek() === '^') { next(); n = nodes('binary', {op: '^', left: n, right: exponent()}); }
      return n;
    };
    const unary = () => {
      if (peek() === '+' || peek() === '-') { const op = next(); enter(); const arg = unary(); leave(); return op === '-' ? nodes('negate', {arg}) : arg; }
      return power();
    };
    const product = () => {
      let n = unary(), afterSlash = false;
      for (;;) {
        const t = peek();
        if (t === '*' || t === '/') {
          next(); enter(); const rhs = unary(); leave();
          n = nodes('binary', {op: t, left: n, right: rhs}); afterSlash = t === '/';
        } else if (startsAtom(t)) {
          // 2/3x is ambiguous; require (2/3)x or 2/(3x).
          if (afterSlash) fail('unsupported');
          enter(); const rhs = unary(); leave();
          n = nodes('binary', {op: '*', left: n, right: rhs});
        } else break;
      }
      return n;
    };
    const expression = () => {
      let n = product();
      while (peek() === '+' || peek() === '-') {
        const op = next(); enter(); const rhs = product(); leave();
        n = nodes('binary', {op, left: n, right: rhs});
      }
      return n;
    };
    const result = expression();
    if (i !== tokens.length) fail('syntax');
    return result;
  }

  function exact(n) {
    switch (n.type) {
      case 'number': return literal(n.raw);
      case 'negate': { const a = exact(n.arg); return a && neg(a); }
      case 'percent': { const a = exact(n.arg); return a && div(a, rational(100n)); }
      case 'factorial': {
        const a = exact(n.arg);
        if (!a || a.d !== 1n || a.n < 0n || a.n > 170n) return null;
        let x = 1n; for (let j = 2n; j <= a.n; j++) x *= j;
        return rational(x);
      }
      case 'binary': {
        const a = exact(n.left), b = exact(n.right);
        if (!a || !b) return null;
        if (n.op === '+') return n.right.type === 'percent' ? add(a, mul(a, b)) : add(a, b);
        if (n.op === '-') return n.right.type === 'percent' ? sub(a, mul(a, b)) : sub(a, b);
        if (n.op === '*') return mul(a, b);
        if (n.op === '/') return div(a, b);
        if (n.op === '^' && b.d === 1n && abs(b.n) <= 100n) return pow(a, Number(b.n));
        return null;
      }
      case 'function': {
        if (n.name === 'abs') { const a = exact(n.arg); return a && rational(abs(a.n), a.d); }
        if (n.name === 'sqrt') { const a = exact(n.arg); return a && a.n >= 0n ? exactRoot(a) : null; }
        return null;
      }
      default: return null;
    }
  }

  function evaluateAst(n, angle, x) {
    const k = angle === 'deg' ? Math.PI / 180 : 1;
    switch (n.type) {
      case 'number': return finite(value(literal(n.raw)));
      case 'symbol': return n.name === 'π' ? Math.PI : n.name === 'e' ? Math.E : x === undefined ? fail('unsupported') : finite(x);
      case 'negate': return -evaluateAst(n.arg, angle, x);
      case 'percent': return evaluateAst(n.arg, angle, x) / 100;
      case 'factorial': {
        const v = evaluateAst(n.arg, angle, x);
        if (!Number.isInteger(v) || v < 0 || v > 170) fail('undefined');
        let y = 1; for (let i = 2; i <= v; i++) y *= i;
        return finite(y);
      }
      case 'binary': {
        const a = evaluateAst(n.left, angle, x), b = evaluateAst(n.right, angle, x);
        switch (n.op) {
          case '+': return finite(a + (n.right.type === 'percent' ? a * b : b));
          case '-': return finite(a - (n.right.type === 'percent' ? a * b : b));
          case '*': return finite(a * b);
          case '/': if (b === 0) fail('undefined'); return finite(a / b);
          case '^': if ((a === 0 && b <= 0) || (a < 0 && !Number.isInteger(b))) fail('undefined'); return finite(Math.pow(a, b));
          default: fail('unsupported');
        }
      }
      case 'function': {
        const v = evaluateAst(n.arg, angle, x);
        const trig = ['sin', 'cos', 'tan'].includes(n.name);
        const a = trig ? v * k : v;
        if ((n.name === 'ln' || n.name === 'log') && v <= 0) fail('undefined');
        if ((n.name === 'asin' || n.name === 'acos') && Math.abs(v) > 1) fail('undefined');
        if (n.name === 'sqrt' && v < 0) fail('undefined');
        if (n.name === 'tan' && Math.abs(Math.cos(a)) < 1e-12) fail('undefined');
        const fn = {sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin,
          acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh,
          tanh: Math.tanh, ln: Math.log, log: Math.log10, abs: Math.abs, sqrt: Math.sqrt}[n.name];
        if (!fn) fail('unsupported');
        const v2 = fn(a);
        return finite(['asin', 'acos', 'atan'].includes(n.name) ? v2 / k : v2);
      }
      default: fail('unsupported');
    }
  }

  function polynomial(n) {
    const constant = a => [a];
    const z = R0;
    const combine = (a, b, operation) => {
      const length = Math.max(a.length, b.length), out = [];
      for (let i = 0; i < length; i++) out.push(operation(a[i] || z(), b[i] || z()));
      return out;
    };
    const multiply = (a, b) => {
      if (a.length + b.length > 4) fail('unsupported');
      const out = Array.from({length: a.length + b.length - 1}, z);
      for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] = add(out[i + j], mul(a[i], b[j]));
      return out;
    };
    switch (n.type) {
      case 'number': return constant(literal(n.raw));
      case 'symbol': return n.name === 'x' ? [z(), R1()] : fail('unsupported');
      case 'negate': return polynomial(n.arg).map(neg);
      case 'percent': return polynomial(n.arg).map(a => div(a, rational(100n)));
      case 'binary': {
        const a = polynomial(n.left), b = polynomial(n.right);
        if (n.op === '+') return n.right.type === 'percent' ? combine(a, multiply(a, b), add) : combine(a, b, add);
        if (n.op === '-') return n.right.type === 'percent' ? combine(a, multiply(a, b), sub) : combine(a, b, sub);
        if (n.op === '*') return multiply(a, b);
        if (n.op === '/') {
          if (b.length !== 1) fail('unsupported');
          return a.map(t => div(t, b[0]));
        }
        if (n.op === '^') {
          const exp = exact(n.right);
          if (!exp || exp.d !== 1n || exp.n < 0n || exp.n > 2n) fail('unsupported');
          // x^0 can be undefined at x=0, so do not assert it is an identity.
          if (exp.n === 0n && a.length > 1) fail('unsupported');
          if (exp.n === 0n && a.length === 1 && isZero(a[0])) fail('undefined');
          return exp.n === 0n ? [R1()] : exp.n === 1n ? a : multiply(a, a);
        }
        fail('unsupported');
      }
      default: fail('unsupported');
    }
  }
  const isZero = r => r.n === 0n;
  function squareRoot(n) {
    if (n < 0n) return null;
    if (n < 2n) return n;
    let x = n, y = (x + 1n) >> 1n;
    while (y < x) { x = y; y = (x + n / x) >> 1n; }
    return x * x === n ? x : null;
  }
  const exactRoot = d => {
    const a = squareRoot(d.n), b = squareRoot(d.d);
    return a !== null && b !== null ? rational(a, b) : null;
  };
  function solve(leftTokens, rightTokens) {
    const left = parse(leftTokens), right = parse(rightTokens);
    const hasVariable = n => n.type === 'symbol' ? n.name === 'x' :
      ['negate', 'percent', 'factorial', 'function'].includes(n.type) ? hasVariable(n.arg) :
        n.type === 'binary' ? hasVariable(n.left) || hasVariable(n.right) : false;
    if (!hasVariable(left) && !hasVariable(right)) fail('unsupported');
    const a = polynomial(nodes('binary', {op: '-', left, right}));
    while (a.length > 1 && isZero(a[a.length - 1])) a.pop();
    if (a.length === 1) return {kind: isZero(a[0]) ? 'identity' : 'none'};
    if (a.length > 3) fail('unsupported');
    if (a.length === 2) {
      const r = div(neg(a[0]), a[1]);
      return {kind: 'roots', roots: [{value: finite(value(r)), rational: r}]};
    }
    const [c, b, aa] = a;
    const D = sub(mul(b, b), mul(rational(4n), mul(aa, c)));
    if (D.n < 0n) return {kind: 'none'};
    const sd = exactRoot(D), den = mul(rational(2n), aa);
    if (sd) {
      const roots = [div(sub(neg(b), sd), den), div(add(neg(b), sd), den)];
      const unique = roots[0].n === roots[1].n && roots[0].d === roots[1].d ? roots.slice(0, 1) : roots;
      return {kind: 'roots', roots: unique.map(r => ({value: finite(value(r)), rational: r})).sort((x,y) => x.value-y.value)};
    }
    const bv = value(b), cv = value(c), av = value(aa), delta = value(D);
    const q = -0.5 * (bv + (bv >= 0 ? 1 : -1) * Math.sqrt(delta));
    const roots = q === 0 ? [-bv / (2 * av)] : [q / av, cv / q];
    return {kind: 'roots', roots: roots.map(v => ({value: finite(v), rational: null})).sort((x,y) => x.value-y.value)};
  }
  function evaluate(tokens, settings = {}) {
    const ast = parse(tokens);
    const angle = settings.angle === 'deg' ? 'deg' : 'rad';
    let rationalResult = null;
    try { rationalResult = exact(ast); }
    catch (error) { if (!(error instanceof MathError) || error.code !== 'unsupported') throw error; }
    return {value: finite(evaluateAst(ast, angle)), rational: rationalResult};
  }
  function terminating(r) {
    let d = r.d;
    while (d % 2n === 0n) d /= 2n;
    while (d % 5n === 0n) d /= 5n;
    return d === 1n;
  }
  function exactDecimal(r) {
    if (!r || !terminating(r)) return false;
    const v = value(r);
    if (!Number.isFinite(v) || Math.abs(v) > 1e10) return false;
    // The displayed 10 significant digits must represent the rational exactly.
    const displayed = v.toPrecision(10).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
    try { return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(displayed) &&
      (() => { const a = literal(displayed.replace(/^\+/, '')); return a.n === r.n && a.d === r.d; })(); }
    catch (_) { return false; }
  }
  return Object.freeze({parse, evaluate, solve, MathError, exactDecimal});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MathCore;
