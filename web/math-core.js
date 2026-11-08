/* Mikajy mathematical core. No DOM, recognition, storage or Android dependencies.
 * Real-valued arithmetic, polynomial and rational-function equations in one unknown (all real roots, certified
 * by poly-core.js), and equations solved by exact inversion. Exact rational arithmetic is retained only when
 * mathematically justified.
 */
const MathCore = (() => {
  'use strict';
  const Poly = typeof module !== 'undefined' && module.exports ? require('./poly-core.js') : PolyCore;
  const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
    'ln', 'log', 'exp', 'sqrt', 'abs', 'conj', 'arg']);
  const INVERSE = {sin: 'asin', cos: 'acos', tan: 'atan'};
  const MAX_TOKENS = 160;
  const MAX_DEPTH = 48;
  class MathError extends Error {
    constructor(code) { super(code); this.name = 'MathError'; this.code = code; }
  }
  const fail = code => { throw new MathError(code); };
  const isNumber = t => typeof t === 'string' && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(t);
  const startsAtom = t => isNumber(t) || t === '(' || t === 'π' || t === 'e' || t === 'x' || t === 'i' || t === '√' || FUNCTIONS.has(t);
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
      if (t === 'π' || t === 'e' || t === 'x' || t === 'i') { next(); return nodes('symbol', {name: t}); }
      if (t === '√') { next(); return nodes('function', {name: 'sqrt', arg: postfix()}); }
      if (FUNCTIONS.has(t)) {
        next();
        let fnExponent = null;
        if (peek() === '^') { next(); fnExponent = exponent(); }
        const arg = peek() === '(' ? group() : functionArgument();
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
    // sin2x and sin2π read as sin(2x) and sin(2π): a bare number or constant keeps absorbing the
    // variables/constants written right after it. Another function name always ends the argument.
    const functionArgument = () => {
      let n = postfix();
      if (n.type !== 'number' && n.type !== 'symbol') return n;
      while (peek() === 'π' || peek() === 'e' || peek() === 'x' || peek() === 'i' || peek() === '√') {
        enter(); const rhs = postfix(); leave();
        n = nodes('binary', {op: '*', left: n, right: rhs});
      }
      return n;
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

  function exact(n, angle = 'rad') {
    switch (n.type) {
      case 'number': return literal(n.raw);
      case 'negate': { const a = exact(n.arg, angle); return a && neg(a); }
      case 'percent': { const a = exact(n.arg, angle); return a && div(a, rational(100n)); }
      case 'factorial': {
        const a = exact(n.arg, angle);
        if (!a || a.d !== 1n || a.n < 0n || a.n > 170n) return null;
        let x = 1n; for (let j = 2n; j <= a.n; j++) x *= j;
        return rational(x);
      }
      case 'binary': {
        if (n.op === '^' && n.left.type === 'symbol' && n.left.name === 'e') { const b = exact(n.right, angle); return b && isZero(b) ? R1() : null; }
        const a = exact(n.left, angle), b = exact(n.right, angle);
        if (!a || !b) return null;
        if (n.op === '+') return n.right.type === 'percent' ? add(a, mul(a, b)) : add(a, b);
        if (n.op === '-') return n.right.type === 'percent' ? sub(a, mul(a, b)) : sub(a, b);
        if (n.op === '*') return mul(a, b);
        if (n.op === '/') return div(a, b);
        if (n.op === '^' && b.d === 1n && abs(b.n) <= 100n) return pow(a, Number(b.n));
        if (n.op === '^' && b.d <= 12n && abs(b.n) <= 100n && a.n >= 0n) {
          // 8^(2/3) = 4: exact only when the root is itself rational.
          const q = Number(b.d), rn = iroot(a.n, q), rd = iroot(a.d, q);
          if (rn ** BigInt(q) === a.n && rd ** BigInt(q) === a.d) return pow(rational(rn, rd), Number(b.n));
        }
        return null;
      }
      case 'function': {
        if (n.name === 'conj') return exact(n.arg, angle);
        if (n.name === 'arg') { const a = exact(n.arg, angle); return a && a.n > 0n ? R0() : null; }
        if (n.name === 'abs') { const a = exact(n.arg, angle); return a && rational(abs(a.n), a.d); }
        if (n.name === 'sqrt') { const a = exact(n.arg, angle); return a && a.n >= 0n ? exactRoot(a) : null; }
        return exactSpecial(n, angle);
      }
      default: return null;
    }
  }

  /** Values every real function takes at 0 / 1 / e / 10, independent of the angle unit. */
  function exactSpecial(n, angle) {
    const isE = n.arg.type === 'symbol' && n.arg.name === 'e';
    if (n.name === 'ln' && isE) return R1();
    const a = isE ? null : exact(n.arg, angle);
    if (!a) return exactTrigonometric(n, angle);
    const zero = isZero(a), one = a.n === 1n && a.d === 1n;
    if (zero && ['sin', 'tan', 'asin', 'atan', 'sinh', 'tanh'].includes(n.name)) return R0();
    if (zero && ['cos', 'cosh', 'sec', 'exp'].includes(n.name)) return R1();
    if (one && (n.name === 'ln' || n.name === 'log')) return R0();
    if (n.name === 'log' && a.n === 10n && a.d === 1n) return R1();
    return exactTrigonometric(n, angle);
  }

  /** The AST as q*pi for a rational q (angles in radians), or null. */
  function piMultiple(n) {
    switch (n.type) {
      case 'symbol': return n.name === 'π' ? R1() : null;
      case 'number': { const a = literal(n.raw); return isZero(a) ? a : null; }
      case 'negate': { const a = piMultiple(n.arg); return a && neg(a); }
      case 'binary': {
        if (n.op === '+' || n.op === '-') {
          const a = piMultiple(n.left), b = piMultiple(n.right);
          return a && b && (n.op === '+' ? add(a, b) : sub(a, b));
        }
        if (n.op === '*') {
          const a = piMultiple(n.left), b = piMultiple(n.right);
          if (a && !b) { const k = exactOrNull(n.right); return k && mul(a, k); }
          if (b && !a) { const k = exactOrNull(n.left); return k && mul(b, k); }
          return null;
        }
        if (n.op === '/') {
          const a = piMultiple(n.left), k = exactOrNull(n.right);
          return a && k && !isZero(k) ? div(a, k) : null;
        }
        return null;
      }
      default: return null;
    }
  }
  const HALF = () => rational(1n, 2n);
  /** sin(t*pi) for rational t when the value is rational (0, +-1/2, +-1), else null. */
  function sinPi(t) {
    const two = rational(2n);
    // t mod 2 in [0, 2)
    const whole = t.n / t.d - (t.n < 0n && t.n % t.d !== 0n ? 1n : 0n);
    const m = sub(t, mul(two, rational(whole / 2n - (whole % 2n < 0n ? 1n : 0n))));
    const key = m.n + '/' + m.d;
    return {'0/1': R0(), '1/1': R0(), '1/6': HALF(), '5/6': HALF(), '7/6': neg(HALF()), '11/6': neg(HALF()),
      '1/2': R1(), '3/2': neg(R1())}[key] || null;
  }
  /** Rational values of sin, cos, tan and their reciprocals at rational multiples of pi (30/45/60/90 degree angles). */
  function exactTrigonometric(n, angle) {
    if (!['sin', 'cos', 'tan', 'cot', 'sec', 'csc'].includes(n.name)) return null;
    let t;
    if (angle === 'deg') { const a = exactOrNull(n.arg); t = a && div(a, rational(180n)); }
    else t = piMultiple(n.arg);
    if (!t) return null;
    const s = sinPi(t), c = sinPi(add(t, HALF()));
    const recip = x => x && !isZero(x) ? div(R1(), x) : null;
    switch (n.name) {
      case 'sin': return s;
      case 'cos': return c;
      case 'sec': return recip(c);
      case 'csc': return recip(s);
      case 'tan': if (s && c && !isZero(c)) return div(s, c); break;
      default: if (s && c && !isZero(s)) return div(c, s);
    }
    // tan/cot at odd multiples of pi/4 are +-1 although sin and cos are irrational
    const q4 = mul(t, rational(4n));
    if (q4.d === 1n && abs(q4.n) % 2n === 1n) {
      const sameSign = ((q4.n % 4n) + 4n) % 4n === 1n;
      return sameSign ? R1() : neg(R1());
    }
    return null;
  }

  /** sin(pi), cos(pi/2)... are 0, not 1.2e-16: drop rounding noise of the argument reduction only. */
  function snap(v, a) { return Math.abs(a) >= 0.5 && Math.abs(v) < 4e-16 * Math.max(1, Math.abs(a)) ? 0 : v; }
  function trigonometric(name, a) {
    const s = snap(Math.sin(a), a), c = snap(Math.cos(a), a);
    switch (name) {
      case 'sin': return finite(s);
      case 'cos': return finite(c);
      case 'tan': case 'sec': if (Math.abs(c) < 1e-12) fail('undefined'); return finite(name === 'tan' ? s / c : 1 / c);
      default: if (Math.abs(s) < 1e-12) fail('undefined'); return finite(name === 'cot' ? c / s : 1 / s);
    }
  }

  function evaluateAst(n, angle, x) {
    const k = angle === 'deg' ? Math.PI / 180 : 1;
    switch (n.type) {
      case 'number': return finite(value(literal(n.raw)));
      case 'symbol': return n.name === 'π' ? Math.PI : n.name === 'e' ? Math.E : n.name === 'i' || x === undefined ? fail('unsupported') : finite(x);
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
        if (['sin', 'cos', 'tan', 'cot', 'sec', 'csc'].includes(n.name)) return trigonometric(n.name, v * k);
        if ((n.name === 'ln' || n.name === 'log') && v <= 0) fail('undefined');
        if ((n.name === 'asin' || n.name === 'acos') && Math.abs(v) > 1) fail('undefined');
        if (n.name === 'sqrt' && v < 0) fail('undefined');
        const fn = {asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh,
          tanh: Math.tanh, ln: Math.log, log: Math.log10, exp: Math.exp, abs: Math.abs, sqrt: Math.sqrt,
          conj: u => u, arg: u => { if (u === 0) fail('undefined'); return u > 0 ? 0 : Math.PI; }}[n.name];
        if (!fn) fail('unsupported');
        const v2 = fn(v);
        return finite(['asin', 'acos', 'atan'].includes(n.name) ? v2 / k : v2);
      }
      default: fail('unsupported');
    }
  }

  const toRational = r => rational(r.n, r.d);
  const fromRational = r => Poly.q(r.n, r.d);
  /** The AST as a rational function of x (see poly-core.js); anything else is 'unsupported'. */
  function rationalFunction(n) {
    switch (n.type) {
      case 'number': return Poly.rfConst(fromRational(literal(n.raw)));
      case 'symbol': return n.name === 'x' ? Poly.RF_X : fail('unsupported');
      case 'negate': return Poly.rfNeg(rationalFunction(n.arg));
      case 'percent': return Poly.rfDiv(rationalFunction(n.arg), Poly.rfConst(Poly.q(100n)));
      case 'binary': {
        const a = rationalFunction(n.left);
        if (n.op === '^') {
          const exp = exact(n.right);
          if (!exp || exp.d !== 1n || abs(exp.n) > BigInt(Poly.MAX_DEGREE)) fail('unsupported');
          return Poly.rfPow(a, Number(exp.n));
        }
        const b = rationalFunction(n.right), pct = n.right.type === 'percent';
        const one = Poly.rfConst(Poly.q(1n));
        if (n.op === '+') return pct ? Poly.rfMul(a, Poly.rfAdd(one, b)) : Poly.rfAdd(a, b);
        if (n.op === '-') return pct ? Poly.rfMul(a, Poly.rfSub(one, b)) : Poly.rfSub(a, b);
        if (n.op === '*') return Poly.rfMul(a, b);
        if (n.op === '/') return Poly.rfDiv(a, b);
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
  /** floor(n^(1/k)) for a nonnegative BigInt n. */
  function iroot(n, k) {
    if (n < 2n) return n;
    let lo = 0n, hi = 1n << BigInt(Math.ceil(n.toString(2).length / k) + 1);
    while (lo < hi) { const mid = (lo + hi + 1n) >> 1n; if (mid ** BigInt(k) <= n) lo = mid; else hi = mid - 1n; }
    return lo;
  }
  const exactRoot = d => {
    const a = squareRoot(d.n), b = squareRoot(d.d);
    return a !== null && b !== null ? rational(a, b) : null;
  };
  /** Every real root of left = right when both sides are rational functions of x (degree <= Poly.MAX_DEGREE). */
  function solveRational(left, right) {
    let found;
    try { found = Poly.solveEquation(rationalFunction(left), rationalFunction(right)); }
    catch (error) { if (error instanceof Poly.PolyError) fail(error.code); throw error; }
    if (found.kind !== 'roots') return {kind: found.kind};
    const roots = found.roots.map(r => {
      let rat = null;
      try { rat = r.rational && toRational(r.rational); } catch (error) { if (!(error instanceof MathError)) throw error; }
      return {value: finite(r.value), rational: rat};
    });
    return {kind: 'roots', roots};
  }
  const occurrences = n => n.type === 'symbol' ? (n.name === 'x' ? 1 : 0) :
    ['negate', 'percent', 'factorial', 'function'].includes(n.type) ? occurrences(n.arg) :
      n.type === 'binary' ? occurrences(n.left) + occurrences(n.right) : 0;
  const exactOrNull = n => { try { return exact(n); } catch (error) { if (error instanceof MathError && error.code === 'unsupported') return null; throw error; } };
  const NONE = Object.freeze({kind: 'none'});

  /**
   * Equations with a single occurrence of x (2^x=8, ln(x)=1, sqrt(x+1)=3, |x-1|=2, (x+1)^4=16...) are solved by
   * undoing one operation at a time. One-to-one operations continue on a single branch; |u| and even powers
   * split into their two branches. Periodic functions (sin, cos, tan...) have infinitely many solutions and are
   * refused, never answered with a single "principal" value.
   */
  const MAX_BRANCHES = 64;
  function solveInvertible(left, right, angle) {
    if (occurrences(left) + occurrences(right) !== 1) return null;
    const start = occurrences(left) ? left : right;
    const other = start === left ? right : left;
    let unsupported = false, count = 0;
    const out = [];
    const undo = (node, v, r) => {
      for (;;) {
        if (unsupported) return;
        if (node.type === 'symbol') {
          if (++count > MAX_BRANCHES) { unsupported = true; return; }
          out.push({value: v, rational: r}); return;
        }
        if (node.type === 'negate') { v = -v; r = r && neg(r); node = node.arg; continue; }
        if (node.type === 'function') {
          if (node.name === 'exp') { if (v <= 0) return; r = r && r.n === r.d ? R0() : null; v = Math.log(v); }
          else if (node.name === 'ln') { v = Math.exp(v); r = r && isZero(r) ? R1() : null; }
          else if (node.name === 'log') { r = r && r.d === 1n && abs(r.n) <= 60n ? pow(rational(10n), Number(r.n)) : null; v = Math.pow(10, v); }
          else if (node.name === 'sqrt') { if (v < 0) return; r = r && mul(r, r); v = v * v; }
          else if (node.name === 'abs') {
            if (v < 0) return;
            if (v === 0) { node = node.arg; r = R0(); continue; }
            undo(node.arg, v, r); undo(node.arg, -v, r && neg(r)); return;
          }
          else { unsupported = true; return; }
          finite(v); node = node.arg; continue;
        }
        if (node.type !== 'binary' || node.right.type === 'percent') { unsupported = true; return; }
        const onLeft = occurrences(node.left) > 0, operand = onLeft ? node.right : node.left;
        const c = finite(evaluateAst(operand, angle)), cr = exactOrNull(operand), both = r && cr;
        switch (node.op) {
          case '+': r = both && sub(r, cr); v = v - c; break;
          case '-': if (onLeft) { r = both && add(r, cr); v = v + c; } else { r = both && sub(cr, r); v = c - v; } break;
          case '*':
            if (c === 0) { if (v === 0) unsupported = true; return; }
            r = both && div(r, cr); v = v / c; break;
          case '/':
            if (onLeft) { if (c === 0) fail('undefined'); r = both && mul(r, cr); v = v * c; }
            else {
              if (c === 0) { if (v === 0) unsupported = true; return; }
              if (v === 0) return;
              r = both && div(cr, r); v = c / v;
            }
            break;
          case '^':
            if (onLeft) {
              // u^k = v with integer k: odd k is one-to-one, even k has the branches +-v^(1/k)
              if (!cr || cr.d !== 1n || cr.n === 0n || abs(cr.n) > 1000n) { unsupported = true; return; }
              const k = Number(cr.n), even = abs(cr.n) % 2n === 0n;
              if (v === 0) { if (k < 0) return; v = 0; r = R0(); break; }
              if (even && v < 0) return;
              const root = rootBranch(v, r, k);
              if (!even) { v = root.v; r = root.r; break; }
              undo(node.left, root.v, root.r); undo(node.left, -root.v, root.r && neg(root.r)); return;
            }
            if (!(c > 0) || c === 1) { unsupported = true; return; }
            if (v <= 0) return;
            {
              const u = Math.log(v) / Math.log(c);
              let ur = null;
              if (both && Math.abs(u) < 64 && Math.abs(u - Math.round(u)) < 1e-9) {
                const k = Math.round(u), p = pow(cr, k);
                if (p.n === r.n && p.d === r.d) ur = rational(BigInt(k));
              } else if (r && r.n === r.d) ur = R0();
              v = u; r = ur;
            }
            break;
          default: unsupported = true; return;
        }
        node = onLeft ? node.left : node.right;
      }
    };
    /** |v|^(1/|k|) (inverted for k<0), carrying the sign of v, with an exact rational when the root is rational. */
    const rootBranch = (v, r, k) => {
      let ur = null;
      if (r && abs(k) <= 1000) {
        const rn = iroot(abs(r.n), abs(k)), rd = iroot(r.d, abs(k)), q = BigInt(abs(k));
        if (rn ** q === abs(r.n) && rd ** q === r.d) { ur = rational(r.n < 0n ? -rn : rn, rd); if (k < 0) ur = div(R1(), ur); }
      }
      return {v: Math.sign(v) * Math.pow(Math.abs(v), 1 / k), r: ur};
    };
    undo(start, finite(evaluateAst(other, angle)), exactOrNull(other));
    if (unsupported) return null;
    if (!out.length) return NONE;
    out.sort((x, y) => x.value - y.value);
    const roots = out.filter((x, i) => !i || x.value !== out[i - 1].value);
    return {kind: 'roots', roots};
  }


  // ---------------- complex numbers (opt-in: settings.domain === 'complex') ----------------
  const cx = (re, im = 0) => ({re: re + 0, im: im + 0});            // + 0 turns -0 into 0, which would flip branch cuts
  const cAdd = (a, b) => cx(a.re + b.re, a.im + b.im);
  const cSub = (a, b) => cx(a.re - b.re, a.im - b.im);
  const cMul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const cAbs = a => Math.hypot(a.re, a.im);
  function cDiv(a, b) {
    const d = b.re * b.re + b.im * b.im;
    if (d === 0) fail('undefined');
    return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
  }
  const cExp = a => cx(Math.exp(a.re) * Math.cos(a.im), Math.exp(a.re) * Math.sin(a.im));
  function cLn(a) { if (a.re === 0 && a.im === 0) fail('undefined'); return cx(Math.log(cAbs(a)), Math.atan2(a.im, a.re)); }
  function cSqrt(a) { const m = cAbs(a); return cx(Math.sqrt((m + a.re) / 2), (a.im < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (m - a.re) / 2))); }
  function cPow(a, b) {
    if (a.re === 0 && a.im === 0) { if (b.re > 0 && b.im === 0) return cx(0); fail('undefined'); }
    if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 1000) {            // repeated multiplication keeps integer powers clean
      let r = cx(1), base = a, k = Math.abs(b.re);
      while (k) { if (k & 1) r = cMul(r, base); base = cMul(base, base); k = Math.floor(k / 2); }
      return b.re < 0 ? cDiv(cx(1), r) : r;
    }
    return cExp(cMul(b, cLn(a)));
  }
  const cSin = a => cx(Math.sin(a.re) * Math.cosh(a.im), Math.cos(a.re) * Math.sinh(a.im));
  const cCos = a => cx(Math.cos(a.re) * Math.cosh(a.im), -Math.sin(a.re) * Math.sinh(a.im));
  const cSinh = a => cx(Math.sinh(a.re) * Math.cos(a.im), Math.cosh(a.re) * Math.sin(a.im));
  const cCosh = a => cx(Math.cosh(a.re) * Math.cos(a.im), Math.sinh(a.re) * Math.sin(a.im));
  const cFinite = a => { finite(a.re); finite(a.im); return a; };

  function evaluateComplexAst(n, angle) {
    const k = angle === 'deg' ? Math.PI / 180 : 1, ev = m => evaluateComplexAst(m, angle);
    switch (n.type) {
      case 'number': return cx(finite(value(literal(n.raw))));
      case 'symbol': return n.name === 'i' ? cx(0, 1) : n.name === 'π' ? cx(Math.PI) : n.name === 'e' ? cx(Math.E) : fail('unsupported');
      case 'negate': { const a = ev(n.arg); return cx(-a.re, -a.im); }
      case 'percent': { const a = ev(n.arg); return cx(a.re / 100, a.im / 100); }
      case 'factorial': { const a = ev(n.arg); if (a.im !== 0) fail('unsupported'); return cx(evaluateAst({type: 'factorial', arg: {type: 'number', raw: String(a.re)}}, angle)); }
      case 'binary': {
        const a = ev(n.left), b = ev(n.right);
        switch (n.op) {
          case '+': return cFinite(cAdd(a, n.right.type === 'percent' ? cMul(a, b) : b));
          case '-': return cFinite(cSub(a, n.right.type === 'percent' ? cMul(a, b) : b));
          case '*': return cFinite(cMul(a, b));
          case '/': return cFinite(cDiv(a, b));
          case '^': return cFinite(cPow(a, b));
          default: fail('unsupported');
        }
      }
      case 'function': {
        const a = ev(n.arg);
        switch (n.name) {
          case 'sqrt': return cSqrt(a);
          case 'exp': return cFinite(cExp(a));
          case 'ln': return cFinite(cLn(a));
          case 'log': { const l = cLn(a); return cx(l.re / Math.LN10, l.im / Math.LN10); }
          case 'abs': return cx(cAbs(a));
          case 'conj': return cx(a.re, -a.im);
          case 'arg': if (a.re === 0 && a.im === 0) fail('undefined'); return cx(Math.atan2(a.im, a.re));
          case 'sin': case 'cos': case 'tan': case 'cot': case 'sec': case 'csc': {
            const z = cx(a.re * k, a.im * k), s = cSin(z), c = cCos(z);
            return cFinite(n.name === 'sin' ? s : n.name === 'cos' ? c : n.name === 'tan' ? cDiv(s, c) : n.name === 'cot' ? cDiv(c, s) : n.name === 'sec' ? cDiv(cx(1), c) : cDiv(cx(1), s));
          }
          case 'sinh': return cFinite(cSinh(a));
          case 'cosh': return cFinite(cCosh(a));
          case 'tanh': return cFinite(cDiv(cSinh(a), cCosh(a)));
          default: fail('unsupported');             // asin/acos/atan have branch cuts we do not claim
        }
      }
      default: fail('unsupported');
    }
  }

  /** Exact Gaussian rationals {re, im} (both rational) for expressions that stay in Q(i), else null. */
  const gAdd = (a, b) => ({re: add(a.re, b.re), im: add(a.im, b.im)});
  const gSub = (a, b) => ({re: sub(a.re, b.re), im: sub(a.im, b.im)});
  const gMul = (a, b) => ({re: sub(mul(a.re, b.re), mul(a.im, b.im)), im: add(mul(a.re, b.im), mul(a.im, b.re))});
  function gDiv(a, b) {
    const d = add(mul(b.re, b.re), mul(b.im, b.im));
    if (isZero(d)) fail('undefined');
    return {re: div(add(mul(a.re, b.re), mul(a.im, b.im)), d), im: div(sub(mul(a.im, b.re), mul(a.re, b.im)), d)};
  }
  /** n written as k + p·π with Gaussian-rational k, p (or null): used to recognise e^(i q π). */
  function affinePi(n) {
    const G = (re, im = R0()) => ({re, im}), Z = G(R0());
    switch (n.type) {
      case 'number': return {k: G(literal(n.raw)), p: Z};
      case 'symbol': return n.name === 'i' ? {k: G(R0(), R1()), p: Z} : n.name === 'π' ? {k: Z, p: G(R1())} : null;
      case 'negate': { const a = affinePi(n.arg); return a && {k: G(neg(a.k.re), neg(a.k.im)), p: G(neg(a.p.re), neg(a.p.im))}; }
      case 'binary': {
        const a = affinePi(n.left), b = affinePi(n.right); if (!a || !b) return null;
        if (n.op === '+') return {k: gAdd(a.k, b.k), p: gAdd(a.p, b.p)};
        if (n.op === '-') return {k: gSub(a.k, b.k), p: gSub(a.p, b.p)};
        const constOf = x => isZero(x.p.re) && isZero(x.p.im);
        if (n.op === '*') { if (constOf(a)) return {k: gMul(a.k, b.k), p: gMul(a.k, b.p)}; if (constOf(b)) return {k: gMul(a.k, b.k), p: gMul(a.p, b.k)}; return null; }
        if (n.op === '/' && constOf(b)) return {k: gDiv(a.k, b.k), p: gDiv(a.p, b.k)};
        return null;
      }
      default: return null;
    }
  }
  function exactComplex(n) {
    const G = (re, im = R0()) => ({re, im});
    switch (n.type) {
      case 'number': return G(literal(n.raw));
      case 'symbol': return n.name === 'i' ? G(R0(), R1()) : null;
      case 'negate': { const a = exactComplex(n.arg); return a && G(neg(a.re), neg(a.im)); }
      case 'percent': { const a = exactComplex(n.arg); return a && gDiv(a, G(rational(100n))); }
      case 'binary': {
        const a = exactComplex(n.left);
        if (n.op === '^' && n.left.type === 'symbol' && n.left.name === 'e') {          // e^(i q π) = i^(2q) when 2q is an integer
          const A = affinePi(n.right);
          if (A && isZero(A.k.re) && isZero(A.k.im) && isZero(A.p.re) && !isZero(A.p.im)) {
            const t2 = mul(A.p.im, rational(2n));
            if (t2.d === 1n) { const m = Number(((t2.n % 4n) + 4n) % 4n); return [G(R1()), G(R0(), R1()), G(neg(R1())), G(R0(), neg(R1()))][m]; }
          }
        }
        if (n.op === '^') {
          const e = exact(n.right);
          if (!a || !e || e.d !== 1n || abs(e.n) > 100n) return null;
          if (isZero(a.re) && isZero(a.im) && e.n <= 0n) fail('undefined');
          let r = G(R1()), base = a, k = abs(e.n);
          while (k) { if (k & 1n) r = gMul(r, base); base = gMul(base, base); k >>= 1n; }
          return e.n < 0n ? gDiv(G(R1()), r) : r;
        }
        const b = exactComplex(n.right);
        if (!a || !b) return null;
        const pct = n.right.type === 'percent';
        if (n.op === '+') return gAdd(a, pct ? gMul(a, b) : b);
        if (n.op === '-') return gSub(a, pct ? gMul(a, b) : b);
        if (n.op === '*') return gMul(a, b);
        if (n.op === '/') return gDiv(a, b);
        return null;
      }
      case 'function': {
        const a = exactComplex(n.arg);
        if (!a) return null;
        if (n.name === 'conj') return G(a.re, neg(a.im));
        if (n.name === 'abs') { const r = exactRoot(add(mul(a.re, a.re), mul(a.im, a.im))); return r && G(r); }
        if (n.name === 'sqrt' && isZero(a.im)) {
          if (a.re.n >= 0n) { const r = exactRoot(a.re); return r && G(r); }
          const r = exactRoot(neg(a.re)); return r && G(R0(), r);
        }
        return null;
      }
      default: return null;
    }
  }
  /** Value of an expression over the complex numbers: {re, im (doubles), exact: {re, im} | null}. */
  function evaluateComplex(tokens, settings = {}) {
    const ast = parse(tokens), angle = settings.angle === 'deg' ? 'deg' : 'rad';
    let ex = null;
    try { ex = exactComplex(ast); }
    catch (error) { if (!(error instanceof MathError) || error.code !== 'unsupported') throw error; }
    const approx = cFinite(evaluateComplexAst(ast, angle));
    return ex ? {re: value(ex.re), im: value(ex.im), exact: ex} : {re: approx.re, im: approx.im, exact: null};
  }
  /** All complex solutions of left = right (rational coefficients, one unknown). */
  function solveComplex(leftTokens, rightTokens) {
    const left = parse(leftTokens), right = parse(rightTokens);
    if (!occurrences(left) && !occurrences(right)) fail('unsupported');
    let found;
    try { found = Poly.solveEquationComplex(rationalFunction(left), rationalFunction(right)); }
    catch (error) { if (error instanceof Poly.PolyError) fail(error.code); throw error; }
    if (found.kind !== 'roots') return {kind: found.kind};
    const roots = found.roots.map(r => {
      const keep = q => { try { return q && toRational(q); } catch (error) { if (error instanceof MathError) return null; throw error; } };
      return {re: finite(r.re), im: finite(r.im), exactRe: keep(r.exactRe), exactIm: keep(r.exactIm)};
    });
    return {kind: 'croots', roots};
  }
  function solve(leftTokens, rightTokens, settings = {}) {
    if (settings.domain === 'complex') return solveComplex(leftTokens, rightTokens);
    const left = parse(leftTokens), right = parse(rightTokens);
    if (!occurrences(left) && !occurrences(right)) fail('unsupported');
    try { return solveRational(left, right); }
    catch (error) { if (!(error instanceof MathError) || error.code !== 'unsupported') throw error; }
    const found = solveInvertible(left, right, settings.angle === 'deg' ? 'deg' : 'rad');
    if (!found) fail('unsupported');
    return found;
  }
  function evaluate(tokens, settings = {}) {
    const ast = parse(tokens);
    const angle = settings.angle === 'deg' ? 'deg' : 'rad';
    let rationalResult = null;
    try { rationalResult = exact(ast, angle); }
    catch (error) { if (!(error instanceof MathError) || error.code !== 'unsupported') throw error; }
    const approx = finite(evaluateAst(ast, angle));
    return {value: rationalResult ? finite(value(rationalResult)) : approx, rational: rationalResult};
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
  return Object.freeze({parse, evaluate, evaluateComplex, solve, MathError, exactDecimal, evaluateAst});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MathCore;
