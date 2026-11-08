/* Probability on the board: X ~ B(n, p) | N(m, s) | P(l) | G(p) | U(a, b) | E(l), then P(X = 2), P(X <= 9), P(a <= X <= b), E(X), V(X), and C(n, k).
 * Exact wherever the answer is exact: binomial and geometric answers are rationals (BigInt, never floats); Poisson and exponential answers are
 * q + c·e^(-l) with rational q, c, l; only the normal distribution is numeric, and it is always marked ≈ (the caller does that).
 * N(m, s) takes the mean and the standard deviation. Anything undeclared, out of range or too large throws ProbError('unsupported'|'undefined'). */
const ProbCore = (() => {
  'use strict';
  const Latex = typeof module !== 'undefined' && module.exports ? require('./latex-eval.js') : LatexEval;
  const MAX_BITS = 40000, MAX_N = 3000;
  class ProbError extends Error { constructor(code) { super(code); this.name = 'ProbError'; this.code = code; } }
  const fail = code => { throw new ProbError(code); };
  const abs = a => a < 0n ? -a : a;
  function gcd(a, b) { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a || 1n; }
  function Q(n, d = 1n) {
    if (d === 0n) fail('undefined');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d); n /= g; d /= g;
    if (abs(n).toString(2).length > MAX_BITS || d.toString(2).length > MAX_BITS) fail('unsupported');
    return {n, d};
  }
  const ZERO = Q(0n), ONE = Q(1n);
  const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d), sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
  const mul = (a, b) => Q(a.n * b.n, a.d * b.d), div = (a, b) => Q(a.n * b.d, a.d * b.n);
  const neg = a => Q(-a.n, a.d), isZero = a => a.n === 0n, cmp = (a, b) => { const x = a.n * b.d, y = b.n * a.d; return x < y ? -1 : x > y ? 1 : 0; };
  const num = a => Number(a.n) / Number(a.d);                      // only for display and for the normal distribution
  function pow(a, k) { let r = ONE; for (let i = 0; i < k; i++) r = mul(r, a); return r; }
  function binom(n, k) { if (k < 0 || k > n) return 0n; let r = 1n; for (let i = 1n; i <= BigInt(Math.min(k, n - k)); i++) r = r * (BigInt(n) - i + 1n) / i; return r; }
  const fact = k => { let r = 1n; for (let i = 2n; i <= BigInt(k); i++) r *= i; return r; };
  const floor = a => { const f = a.n / a.d; return a.n < 0n && a.n % a.d !== 0n ? f - 1n : f; };

  // ---- values: q + c·e^(-l) (exact), or a plain number (the normal distribution) ----
  const V = (q, c = ZERO, l = ZERO) => ({q, c, l});
  const approx = v => ({approx: v});
  const isApprox = v => v.approx !== undefined;
  const value = v => isApprox(v) ? v.approx : num(v.q) + (isZero(v.c) ? 0 : num(v.c) * Math.exp(-num(v.l)));
  function vsub(a, b) {
    if (isApprox(a) || isApprox(b)) return approx(value(a) - value(b));
    if (!isZero(a.c) && !isZero(b.c) && cmp(a.l, b.l) !== 0) fail('unsupported');
    return V(sub(a.q, b.q), sub(a.c, b.c), isZero(a.c) ? b.l : a.l);
  }
  const vone = V(ONE), vzero = V(ZERO);

  // erf / normal CDF to ~1e-15 (Abramowitz-Stegun is too coarse; use the series / continued fraction)
  function erfc(x) {
    const z = Math.abs(x);
    let r;
    if (z < 2.5) {                                                  // Taylor series of erf
      let sum = z, term = z; for (let n = 1; n < 200; n++) { term *= -z * z / n; const add_ = term / (2 * n + 1); sum += add_; if (Math.abs(add_) < 1e-17 * Math.abs(sum)) break; }
      r = 1 - 2 / Math.sqrt(Math.PI) * sum;
    } else {                                                        // continued fraction of erfc
      let f = 0; for (let n = 60; n >= 1; n--) f = n / 2 / (z + f);
      r = Math.exp(-z * z) / Math.sqrt(Math.PI) / (z + f);
    }
    return x >= 0 ? r : 2 - r;
  }
  const Phi = z => .5 * erfc(-z / Math.SQRT2);

  // ---- distributions: {discrete, pmf(k)->V, cdf(t)->V, mean, variance} ----
  function integerOf(q, what) { if (q.d !== 1n || q.n < 0n) fail('unsupported'); return Number(q.n); }
  function make(dist, a) {
    const p01 = p => { if (cmp(p, ZERO) < 0 || cmp(p, ONE) > 0) fail('undefined'); return p; };
    switch (dist) {
      case 'B': {
        if (a.length !== 2) fail('syntax');
        const n = integerOf(a[0]), p = p01(a[1]); if (n > MAX_N) fail('unsupported');
        const q1 = sub(ONE, p);
        const pmf = k => V(k < 0 || k > n ? ZERO : mul(Q(binom(n, k)), mul(pow(p, k), pow(q1, n - k))));
        return {discrete: true, pmf, cdf: t => { const k = Number(floor(t)); if (k < 0) return vzero; if (k >= n) return vone; let s = ZERO; for (let j = 0; j <= k; j++) s = add(s, pmf(j).q); return V(s); },
          mean: mul(Q(BigInt(n)), p), variance: mul(mul(Q(BigInt(n)), p), q1)};
      }
      case 'G': {
        if (a.length !== 1) fail('syntax');
        const p = p01(a[0]); if (isZero(p)) fail('undefined');
        const q1 = sub(ONE, p);
        return {discrete: true, pmf: k => V(k < 1 ? ZERO : mul(pow(q1, k - 1), p)), cdf: t => { const k = Number(floor(t)); return k < 1 ? vzero : V(sub(ONE, pow(q1, k))); },
          mean: div(ONE, p), variance: div(q1, mul(p, p))};
      }
      case 'P': {                                                    // Poisson(l)
        if (a.length !== 1) fail('syntax');
        const l = a[0]; if (cmp(l, ZERO) <= 0 || cmp(l, Q(500n)) > 0) fail('undefined');
        const term = k => div(pow(l, k), Q(fact(k)));
        return {discrete: true, pmf: k => k < 0 ? vzero : V(ZERO, term(k), l),
          cdf: t => { const k = Number(floor(t)); if (k < 0) return vzero; let s = ZERO; for (let j = 0; j <= k; j++) s = add(s, term(j)); return V(ZERO, s, l); },
          mean: l, variance: l};
      }
      case 'U': {
        if (a.length !== 2) fail('syntax');
        const [lo, hi] = a; if (cmp(hi, lo) <= 0) fail('undefined');
        return {discrete: false, pmf: () => vzero, cdf: t => V(cmp(t, lo) <= 0 ? ZERO : cmp(t, hi) >= 0 ? ONE : div(sub(t, lo), sub(hi, lo))),
          mean: div(add(lo, hi), Q(2n)), variance: div(mul(sub(hi, lo), sub(hi, lo)), Q(12n))};
      }
      case 'E': {                                                    // exponential(l)
        if (a.length !== 1) fail('syntax');
        const l = a[0]; if (cmp(l, ZERO) <= 0) fail('undefined');
        return {discrete: false, pmf: () => vzero, cdf: t => cmp(t, ZERO) <= 0 ? vzero : V(ONE, neg(ONE), mul(l, t)), mean: div(ONE, l), variance: div(ONE, mul(l, l))};
      }
      case 'N': {
        if (a.length !== 2) fail('syntax');
        const [m, s] = a; if (cmp(s, ZERO) <= 0) fail('undefined');
        return {discrete: false, pmf: () => vzero, cdf: t => approx(Phi((num(t) - num(m)) / num(s))), mean: m, variance: mul(s, s)};
      }
      default: return fail('unsupported');
    }
  }

  const RELS = {'=': 'eq', '<': 'lt', '\\le': 'le', '\\leq': 'le', '>': 'gt', '\\ge': 'ge', '\\geq': 'ge'};
  function scalar(tokens) {
    const r = Latex.evaluate(tokens);
    if (r.kind !== 'scalar') fail('unsupported');
    return Q(r.q.n, r.q.d);
  }

  /** P(X < k) and friends via the CDF (discrete variables step by whole numbers) */
  function leftOf(d, k, strict) {                                   // P(X < k) if strict else P(X <= k)
    if (!strict || !d.discrete) return d.cdf(k);
    const c = ceilQ(k); return d.cdf(Q(c - 1n));
  }
  const ceilQ = a => { const f = floor(a); return a.d === 1n ? f : f + 1n; };

  function condition(d, parts, rels) {
    if (parts.length === 2 && rels.length === 1) {                  // X rel k   or   k rel X
      let [l, r] = parts, rel = rels[0];
      const xFirst = l.length === 1 && BoardLike.isUpper(l[0]);
      const k = scalar(xFirst ? r : l);
      if (!xFirst) rel = {lt: 'gt', le: 'ge', gt: 'lt', ge: 'le', eq: 'eq'}[rel];
      switch (rel) {
        case 'eq': return d.discrete ? (k.d === 1n ? d.pmf(Number(k.n)) : vzero) : vzero;
        case 'le': return d.cdf(k);
        case 'lt': return leftOf(d, k, true);
        case 'gt': return vsub(vone, d.cdf(k));
        case 'ge': return vsub(vone, leftOf(d, k, true));
      }
    }
    if (parts.length === 3 && rels.length === 2 && (rels.every(r => r === 'le' || r === 'lt'))) {   // a rel X rel b
      const a = scalar(parts[0]), b = scalar(parts[2]);
      const upper = leftOf(d, b, rels[1] === 'lt');                  // X <= b  /  X < b
      const lower = rels[0] === 'le' ? leftOf(d, a, true) : d.cdf(a); // below a: X < a (a <= X)  /  X <= a (a < X)
      return vsub(upper, lower);
    }
    return fail('unsupported');
  }
  const BoardLike = {isUpper: t => typeof t === 'string' && /^[A-Z]$/.test(t)};

  const strip = tokens => { const t = tokens.filter(u => u !== '<nl>'); while (t.length && t[t.length - 1] === '=') t.pop(); return t; };
  function parenArgs(t, i) {                                         // [args-as-token-lists] of "( ... )" or "\left( ... \right)" starting at i, and the index after it
    let o = i; if (t[o] === '\\left') o++;
    if (t[o] !== '(') return null;
    let depth = 0, k = o;
    for (; k < t.length; k++) { if (t[k] === '(' || t[k] === '{') depth++; else if (t[k] === ')' || t[k] === '}') { depth--; if (depth === 0) break; } }
    if (k >= t.length) return null;
    let stop = k; if (t[stop - 1] === '\\right') stop--;
    return {inner: t.slice(o + 1, stop), end: k + 1};
  }
  function splitTop(tokens, seps) {
    const parts = [[]], marks = []; let depth = 0;
    for (const u of tokens) {
      if (u === '(' || u === '{') depth++; else if (u === ')' || u === '}') depth--;
      if (depth === 0 && seps(u)) { marks.push(u); parts.push([]); } else parts[parts.length - 1].push(u);
    }
    return {parts, marks};
  }

  /** is this reading a probability query (P(...), E(X), V(X), C(n, k)) ? */
  function applies(tokens) {
    const t = strip(tokens);
    return t.length >= 4 && ['P', 'E', 'V', 'C'].includes(t[0]) && !!parenArgs(t, 1) && parenArgs(t, 1).end === t.length;
  }

  /** -> {kind:'int', n:BigInt} | {kind:'q', q} | {kind:'val', v} ; throws ProbError */
  function evaluate(tokens, store) {
    const t = strip(tokens);
    if (!applies(t)) fail('syntax');
    const {inner} = parenArgs(t, 1), head = t[0];
    if (head === 'C') {
      const {parts} = splitTop(inner, u => u === ',' || u === ';');
      if (parts.length !== 2) fail('syntax');
      const n = scalar(parts[0]), k = scalar(parts[1]);
      if (n.d !== 1n || k.d !== 1n || n.n < 0n || k.n < 0n || n.n > 100000n) fail('unsupported');
      return {kind: 'int', n: binom(Number(n.n), Number(k.n))};
    }
    const name = inner.find(u => BoardLike.isUpper(u));
    const rv = name && store.rvs[name];
    if (!rv) fail('unsupported');                                    // X was never declared above
    const params = rv.args.map(scalar);
    const d = make(rv.dist, params);
    if (head === 'E') return {kind: 'q', q: d.mean};
    if (head === 'V') return {kind: 'q', q: d.variance};
    const {parts, marks} = splitTop(inner, u => RELS[u] !== undefined);
    return {kind: 'val', v: condition(d, parts, marks.map(m => RELS[m]))};
  }

  const valText = v => {
    const t = a => a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
    if (isApprox(v)) return '';
    const e = isZero(v.c) ? '' : `${isZero(v.q) ? '' : (v.c.n < 0n ? ' - ' : ' + ')}${isZero(v.q) ? (v.c.n < 0n ? '-' : '') : ''}${(abs(v.c.n) === 1n && v.c.d === 1n) ? '' : t(Q(abs(v.c.n), v.c.d)) + '·'}e^(-${t(v.l)})`;
    return `${isZero(v.q) && e ? '' : t(v.q)}${e}`;
  };
  return Object.freeze({applies, evaluate, value, valText, isApprox, ProbError, Phi, make, binom, Q});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ProbCore;
