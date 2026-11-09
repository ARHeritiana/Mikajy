/* Exact modular arithmetic on BigInt: floor mod, gcd / lcm, modular powers and inverses, congruences. */
const ModularCore = (() => {
  'use strict';
  const MAX_BITS = 4096;
  class ModularError extends Error { constructor(code) { super(code); this.name = 'ModularError'; this.code = code; } }
  const fail = code => { throw new ModularError(code); };
  const abs = a => a < 0n ? -a : a;
  const bits = a => abs(a).toString(2).length;
  const guard = (...xs) => { if (xs.some(x => bits(x) > MAX_BITS)) fail('unsupported'); };
  const mod = (a, m) => { if (m <= 0n) fail('undefined'); guard(a, m); const r = a % m; return r < 0n ? r + m : r; };
  function gcd(a, b) { guard(a, b); a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; }
  function lcm(a, b) { if (a === 0n || b === 0n) return 0n; const g = gcd(a, b); return abs(a / g * b); }
  /** a^e mod m by square and multiply (e >= 0; a negative e needs the inverse of a) */
  function powmod(a, e, m) {
    if (m <= 0n) fail('undefined');
    guard(a, e, m);
    if (e < 0n) { a = inverse(a, m); e = -e; }
    let r = 1n % m, b = mod(a, m);
    while (e > 0n) { if (e & 1n) r = r * b % m; e >>= 1n; if (e) b = b * b % m; }
    return r;
  }
  /** extended Euclid: [g, x, y] with a x + b y = g */
  function egcd(a, b) {
    let [r0, r1, s0, s1, t0, t1] = [a, b, 1n, 0n, 0n, 1n];
    while (r1 !== 0n) { const k = r0 / r1; [r0, r1] = [r1, r0 - k * r1]; [s0, s1] = [s1, s0 - k * s1]; [t0, t1] = [t1, t0 - k * t1]; }
    return r0 < 0n ? [-r0, -s0, -t0] : [r0, s0, t0];
  }
  function inverse(a, m) {
    if (m <= 0n) fail('undefined');
    guard(a, m);
    const [g, x] = egcd(mod(a, m), m);
    if (g !== 1n) fail('undefined');                 // no inverse unless gcd(a, m) = 1
    return mod(x, m);
  }
  /** a x ≡ b (mod m): {r, m'} meaning x ≡ r (mod m'), or null when there is no solution */
  function solveLinear(a, b, m) {
    if (m <= 0n) fail('undefined');
    guard(a, b, m);
    a = mod(a, m); b = mod(b, m);
    const g = gcd(a, m);
    if (a === 0n) return b === 0n ? {r: 0n, m: 1n} : null;   // 0 x ≡ b: everything or nothing
    if (b % g !== 0n) return null;
    const m2 = m / g;
    return {r: mod((b / g) * inverse(a / g, m2), m2), m: m2};
  }
  const congruent = (a, b, m) => mod(a, m) === mod(b, m);
  return Object.freeze({ModularError, mod, gcd, lcm, powmod, inverse, egcd, solveLinear, congruent});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ModularCore;
