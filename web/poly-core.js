/* Mikajy polynomial core: exact polynomials and rational functions over the rationals, and certified
 * real-root finding (Sturm sequences). No DOM, recognition or storage dependencies.
 *
 * Every root returned is a real root of the polynomial: roots are isolated with exact Sturm counts,
 * refined by exact bisection, and reported as rationals only when the exact check p(r)=0 passes.
 * Anything that exceeds the size limits throws PolyError('unsupported') instead of guessing.
 */
const PolyCore = (() => {
  'use strict';
  const MAX_BITS = 8192;
  const MAX_DEGREE = 32;
  class PolyError extends Error {
    constructor(code) { super(code); this.name = 'PolyError'; this.code = code; }
  }
  const fail = code => { throw new PolyError(code); };
  const abs = a => a < 0n ? -a : a;
  const bits = a => abs(a).toString(2).length;
  function gcd(a, b) { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a || 1n; }

  // ---- rationals {n, d}, d > 0, lowest terms ----
  function q(n, d = 1n) {
    if (d === 0n) fail('undefined');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d); n /= g; d /= g;
    if (bits(n) > MAX_BITS || bits(d) > MAX_BITS) fail('unsupported');
    return {n, d};
  }
  const ZERO = q(0n), ONE = q(1n);
  const qadd = (a, b) => q(a.n * b.d + b.n * a.d, a.d * b.d);
  const qsub = (a, b) => q(a.n * b.d - b.n * a.d, a.d * b.d);
  const qmul = (a, b) => q(a.n * b.n, a.d * b.d);
  const qdiv = (a, b) => q(a.n * b.d, a.d * b.n);
  const qneg = a => q(-a.n, a.d);
  const qsign = a => a.n > 0n ? 1 : a.n < 0n ? -1 : 0;
  const qcmp = (a, b) => qsign(qsub(a, b));
  function toNumber(r) {
    let {n, d} = r;
    const shift = Math.max(bits(n), bits(d)) - 1000;
    if (shift > 0) { n >>= BigInt(shift); d >>= BigInt(shift); }
    if (d === 0n) return n < 0n ? -Infinity : Infinity;
    return Number(n) / Number(d);
  }

  // ---- polynomials: arrays of rationals, lowest degree first, no trailing zeros; zero polynomial = [] ----
  const trim = p => { while (p.length && p[p.length - 1].n === 0n) p.pop(); return p; };
  const degree = p => p.length - 1;
  const isConstant = p => p.length <= 1;
  const checkDegree = p => { if (degree(p) > MAX_DEGREE) fail('unsupported'); return p; };
  const constant = r => trim([r]);
  const X = [ZERO, ONE];
  const padd = (a, b) => trim(Array.from({length: Math.max(a.length, b.length)}, (_, i) => qadd(a[i] || ZERO, b[i] || ZERO)));
  const psub = (a, b) => trim(Array.from({length: Math.max(a.length, b.length)}, (_, i) => qsub(a[i] || ZERO, b[i] || ZERO)));
  const pscale = (a, c) => trim(a.map(t => qmul(t, c)));
  function pmul(a, b) {
    if (!a.length || !b.length) return [];
    if (degree(a) + degree(b) > MAX_DEGREE) fail('unsupported');
    const out = Array.from({length: a.length + b.length - 1}, () => ZERO);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] = qadd(out[i + j], qmul(a[i], b[j]));
    return trim(out);
  }
  function pdivmod(a, b) {
    if (!b.length) fail('undefined');
    const r = a.slice(), quotient = Array.from({length: Math.max(0, a.length - b.length + 1)}, () => ZERO);
    const lead = b[b.length - 1];
    while (r.length >= b.length) {
      const k = r.length - b.length, c = qdiv(r[r.length - 1], lead);
      quotient[k] = c;
      for (let i = 0; i < b.length; i++) r[i + k] = qsub(r[i + k], qmul(c, b[i]));
      r.pop(); trim(r);
    }
    return [trim(quotient), r];
  }
  const monic = p => p.length ? pscale(p, qdiv(ONE, p[p.length - 1])) : p;
  function pgcd(a, b) {
    while (b.length) [a, b] = [b, pdivmod(a, b)[1]];
    return monic(a);
  }
  const pderiv = p => trim(p.slice(1).map((t, i) => qmul(t, q(BigInt(i + 1)))));
  function peval(p, x) {
    let acc = ZERO;
    for (let i = p.length - 1; i >= 0; i--) acc = qadd(qmul(acc, x), p[i]);
    return acc;
  }
  /** Same polynomial with integer coefficients, positive leading coefficient and no common factor. */
  function integerize(p) {
    let lcm = 1n;
    for (const t of p) lcm = lcm / gcd(lcm, t.d) * t.d;
    const ints = p.map(t => t.n * (lcm / t.d));
    let g = 0n;
    for (const t of ints) g = gcd(g, t);
    return ints.map(t => t / g * (ints[ints.length - 1] < 0n ? -1n : 1n));
  }

  // ---- rational functions {n, d} (numerator and denominator polynomials, deliberately NOT cancelled so that
  // every denominator that appeared stays excluded from the solution set) ----
  const rfConst = r => ({n: constant(r), d: [ONE]});
  const RF_X = {n: X, d: [ONE]};
  const rfCheck = f => { checkDegree(f.n); checkDegree(f.d); return f; };
  const rfAdd = (a, b) => rfCheck({n: padd(pmul(a.n, b.d), pmul(b.n, a.d)), d: pmul(a.d, b.d)});
  const rfSub = (a, b) => rfCheck({n: psub(pmul(a.n, b.d), pmul(b.n, a.d)), d: pmul(a.d, b.d)});
  const rfMul = (a, b) => rfCheck({n: pmul(a.n, b.n), d: pmul(a.d, b.d)});
  const rfNeg = a => ({n: pscale(a.n, qneg(ONE)), d: a.d});
  function rfDiv(a, b) {
    if (!b.n.length) fail('undefined');
    return rfCheck({n: pmul(a.n, b.d), d: pmul(a.d, b.n)});
  }
  function rfPow(a, k) {
    if (!Number.isSafeInteger(k) || Math.abs(k) > MAX_DEGREE) fail('unsupported');
    if (k === 0) {
      if (!a.n.length) fail('undefined');
      // x^0 is 1 only away from the zeros of the base, which we do not track as an identity.
      if (!isConstant(a.n)) fail('unsupported');
      return rfConst(ONE);
    }
    if (k < 0) return rfPow(rfDiv(rfConst(ONE), a), -k);
    let out = rfConst(ONE);
    for (let i = 0; i < k; i++) out = rfMul(out, a);
    return out;
  }

  // ---- Sturm sequences and real roots ----
  function sturmChain(s) {
    const chain = [s, pderiv(s)];
    for (;;) {
      const r = pdivmod(chain[chain.length - 2], chain[chain.length - 1])[1];
      if (!r.length) return chain;
      chain.push(pscale(r, qneg(ONE)));
      if (chain.length > MAX_DEGREE + 3) fail('unsupported');
    }
  }
  function variations(chain, x) {
    let count = 0, last = 0;
    for (const p of chain) {
      const sg = qsign(peval(p, x));
      if (sg && last && sg !== last) count++;
      if (sg) last = sg;
    }
    return count;
  }
  const half = q(1n, 2n);
  const floorDiv = (n, d) => n >= 0n ? n / d : -((-n + d - 1n) / d);
  /**
   * All distinct real roots of the nonzero, non-constant polynomial p, ascending, as
   * {value: double, rational: {n,d} | null}. A rational is attached only when p(rational) = 0 exactly.
   */
  function realRoots(p) {
    if (!p.length || isConstant(p)) return [];
    const g = pgcd(p, pderiv(p));
    const s = isConstant(g) ? p : pdivmod(p, g)[0];
    const ints = integerize(s), lead = ints[ints.length - 1];
    const sumAbs = ints.slice(0, -1).reduce((a, t) => a + abs(t), 0n);
    const bound = q(1n + (sumAbs + lead - 1n) / lead + 1n);
    const chain = sturmChain(s);
    const roots = [];
    const work = [];
    const lo = qneg(bound), vlo = variations(chain, lo), vhi = variations(chain, bound);
    work.push([lo, bound, vlo, vhi]);
    const tolerance = q(1n, 4n * lead);
    while (work.length) {
      let [a, b, va, vb] = work.pop();
      const count = va - vb;
      if (count <= 0) continue;
      if (count > 1) {
        const m = qmul(qadd(a, b), half), vm = variations(chain, m);
        work.push([a, m, va, vm], [m, b, vm, vb]);
        continue;
      }
      // exactly one root in (a, b]: bisect until the double is accurate and a rational candidate is decisive
      for (;;) {
        const width = qsub(b, a), big = qcmp(a, ONE) > 0 || qcmp(b, ONE) > 0 || qcmp(a, qneg(ONE)) < 0 || qcmp(b, qneg(ONE)) < 0;
        const scale = big ? q(abs(a.n) * b.d > abs(b.n) * a.d ? abs(a.n) : abs(b.n), abs(a.n) * b.d > abs(b.n) * a.d ? a.d : b.d) : ONE;
        if (qcmp(qmul(width, q(1n << 64n)), scale) <= 0 && qcmp(width, tolerance) <= 0) break;
        const m = qmul(qadd(a, b), half), vm = variations(chain, m);
        if (va - vm === 1) { b = m; vb = vm; } else { a = m; va = vm; }
      }
      const mid = qmul(qadd(a, b), half);
      // candidate k/lead: the only rationals that can be roots have a denominator dividing the leading coefficient
      const scaled = qmul(mid, q(lead)), k = floorDiv(scaled.n * 2n + scaled.d, 2n * scaled.d);
      const candidate = q(k, lead);
      const exactRoot = qsign(peval(s, candidate)) === 0 && qcmp(candidate, a) > 0 && qcmp(candidate, b) <= 0;
      roots.push({value: toNumber(exactRoot ? candidate : mid), rational: exactRoot ? candidate : null});
    }
    return roots.sort((x, y) => x.value - y.value);
  }

  /**
   * Solve left = right for rational functions of x. Returns {kind: 'identity'|'none'|'roots', roots}.
   * Roots that make a denominator zero are excluded; an equation true everywhere except at such points
   * is refused ('unsupported') because it has no honest one-line answer.
   */
  function solveEquation(left, right) {
    let numerator = psub(pmul(left.n, right.d), pmul(right.n, left.d));
    const denominator = pmul(left.d, right.d);
    if (!numerator.length) {
      if (isConstant(denominator)) return {kind: 'identity'};
      fail('unsupported');
    }
    for (;;) {
      const common = pgcd(numerator, denominator);
      if (isConstant(common)) break;
      numerator = pdivmod(numerator, common)[0];
    }
    if (isConstant(numerator)) return {kind: 'none'};
    const roots = realRoots(numerator);
    return roots.length ? {kind: 'roots', roots} : {kind: 'none'};
  }

  return Object.freeze({PolyError, MAX_DEGREE, q, qadd, qsub, qmul, qdiv, qneg, toNumber, constant, X, padd, psub, pmul, pdivmod, pgcd,
    pderiv, peval, realRoots, rfConst, RF_X, rfAdd, rfSub, rfMul, rfDiv, rfNeg, rfPow, solveEquation});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PolyCore;
