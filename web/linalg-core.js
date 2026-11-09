/* Exact rational linear algebra (BigInt): determinant, inverse, transpose, products, powers, rank. No floats anywhere.
 * Values are {n, d} with d > 0 and gcd(n, d) = 1. Anything that grows past MAX_BITS or exceeds MAX_DIM throws LinalgError('unsupported'). */
const LinalgCore = (() => {
  'use strict';
  const MAX_BITS = 512, MAX_DIM = 6;
  class LinalgError extends Error { constructor(code) { super(code); this.name = 'LinalgError'; this.code = code; } }
  const fail = code => { throw new LinalgError(code); };
  const abs = a => a < 0n ? -a : a;
  function gcd(a, b) { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a || 1n; }
  function q(n, d = 1n) {
    if (d === 0n) fail('undefined');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d); n /= g; d /= g;
    if (abs(n).toString(2).length > MAX_BITS || d.toString(2).length > MAX_BITS) fail('unsupported');
    return {n, d};
  }
  const ZERO = q(0n), ONE = q(1n);
  const add = (a, b) => q(a.n * b.d + b.n * a.d, a.d * b.d);
  const neg = a => q(-a.n, a.d);
  const sub = (a, b) => add(a, neg(b));
  const mul = (a, b) => q(a.n * b.n, a.d * b.d);
  const div = (a, b) => q(a.n * b.d, a.d * b.n);   // b = 0 -> 'undefined'
  const isZero = a => a.n === 0n;
  const eq = (a, b) => a.n === b.n && a.d === b.d;
  /** "12", "0.25" -> {n, d}; anything else -> null */
  function parse(s) {
    const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
    if (!m) return null;
    return m[2] ? q(BigInt(m[1] + m[2]), 10n ** BigInt(m[2].length)) : q(BigInt(m[1]));
  }
  function toText(a) { return a.d === 1n ? String(a.n) : `${a.n}/${a.d}`; }

  function check(M) {
    if (!Array.isArray(M) || !M.length || M.length > MAX_DIM || !Array.isArray(M[0]) || M[0].length > MAX_DIM) fail('unsupported');
    const w = M[0].length;
    if (!w || M.some(r => !Array.isArray(r) || r.length !== w)) fail('syntax');
    return [M.length, w];
  }
  const square = M => { const [r, c] = check(M); if (r !== c) fail('unsupported'); return r; };
  const transpose = M => { const [r, c] = check(M); return Array.from({length: c}, (_, j) => Array.from({length: r}, (_, i) => M[i][j])); };
  const addM = (A, B, sign = 1) => {
    const [r, c] = check(A), [r2, c2] = check(B);
    if (r !== r2 || c !== c2) fail('unsupported');
    return A.map((row, i) => row.map((x, j) => sign === 1 ? add(x, B[i][j]) : sub(x, B[i][j])));
  };
  const scale = (k, M) => { check(M); return M.map(row => row.map(x => mul(k, x))); };
  function mulM(A, B) {
    const [r, c] = check(A), [r2, c2] = check(B);
    if (c !== r2) fail('unsupported');
    return Array.from({length: r}, (_, i) => Array.from({length: c2}, (_, j) => {
      let s = ZERO; for (let k = 0; k < c; k++) s = add(s, mul(A[i][k], B[k][j])); return s;
    }));
  }
  /** Gauss-Jordan on [M | I]; returns {det, inverse|null, rank} */
  function reduce(M) {
    const n = square(M);
    const a = M.map((row, i) => [...row, ...Array.from({length: n}, (_, j) => i === j ? ONE : ZERO)]);
    let det = ONE, rank = 0;
    for (let col = 0, row = 0; col < n && row < n; col++) {
      let p = row; while (p < n && isZero(a[p][col])) p++;
      if (p === n) { det = ZERO; continue; }
      if (p !== row) { [a[p], a[row]] = [a[row], a[p]]; det = neg(det); }
      det = mul(det, a[row][col]);
      const pivot = a[row][col]; a[row] = a[row].map(x => div(x, pivot));
      for (let i = 0; i < n; i++) if (i !== row && !isZero(a[i][col])) { const f = a[i][col]; a[i] = a[i].map((x, j) => sub(x, mul(f, a[row][j]))); }
      row++; rank++;
    }
    return {det: rank === n ? det : ZERO, rank, inverse: rank === n ? a.map(r => r.slice(n)) : null};
  }
  const det = M => reduce(M).det;
  function inverse(M) { const r = reduce(M); if (!r.inverse) fail('undefined'); return r.inverse; }   // singular matrix
  function pow(M, k) {
    const n = square(M);
    if (!Number.isSafeInteger(k) || Math.abs(k) > 64) fail('unsupported');
    let base = k < 0 ? inverse(M) : M, e = Math.abs(k);
    let out = Array.from({length: n}, (_, i) => Array.from({length: n}, (_, j) => i === j ? ONE : ZERO));
    while (e > 0) { if (e & 1) out = mulM(out, base); e >>= 1; if (e) base = mulM(base, base); }
    return out;
  }
  const toTextM = M => M.map(row => row.map(toText).join(' ')).join('; ');
  return Object.freeze({LinalgError, q, ZERO, ONE, add, sub, mul, div, neg, eq, isZero, parse, toText, transpose, addM, scale, mulM, det, inverse, pow, reduce, toTextM, MAX_DIM});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LinalgCore;
