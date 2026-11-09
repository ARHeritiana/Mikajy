/* Symbolic calculus through the bundled Nerdamer CAS (web/vendor/nerdamer.js, Apache-2.0), behind a numeric audit.
 * Nothing the CAS says is shown unless an independent numeric check of the *original* expression agrees:
 *   derivative -> central finite differences      antiderivative -> derivative of the answer equals the integrand
 *   definite integral -> Gauss-Legendre quadrature (+ divergence guard)      limit -> values approaching the point
 *   trigonometric / periodic equations -> substitute the answer back (several values of the integer parameter n)
 * Anything unverified, unevaluated or non-real is refused ('unsupported'), never guessed.
 * Radians only. Input is token arrays from the recogniser; they are parsed by MathCore, never by the CAS. */
const Calculus = (() => {
  'use strict';
  const Core = typeof module !== 'undefined' && module.exports ? require('./math-core.js') : MathCore;
  const CAS = typeof module !== 'undefined' && module.exports ? require('./vendor/nerdamer.js') : nerdamer;
  const {MathError} = Core;
  const fail = code => { throw new MathError(code); };
  const MAX_TOKENS = 80;
  const TRIG = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc']);
  const NAME = {ln: 'log', log: 'log10'};
  const SAMPLES = [-3.1371, -2.2093, -1.5137, -0.9013, -0.4127, -0.1371, 0.0931, 0.2713, 0.5231, 0.7619, 1.1317, 1.4973, 1.9037, 2.4613, 3.2931, 4.1079];

  function toCas(n) {
    switch (n.type) {
      case 'number': {
        const [a, b = ''] = n.raw.split('.');
        return b ? `(${a}${b}/1${'0'.repeat(b.length)})` : a;
      }
      case 'symbol':
        if (n.name === 'π') return 'pi';
        if (n.name === 'e' || n.name === 'x') return n.name;
        return fail('unsupported');
      case 'negate': return `(-${toCas(n.arg)})`;
      case 'binary':
        if (n.right.type === 'percent') fail('unsupported');
        return `(${toCas(n.left)}${n.op}${toCas(n.right)})`;
      case 'function': return `${NAME[n.name] || n.name}(${toCas(n.arg)})`;
      default: return fail('unsupported');   // factorial, percent
    }
  }

  function hasTrig(n) {
    if (!n || typeof n !== 'object') return false;
    if (n.type === 'function' && TRIG.has(n.name)) return true;
    return [n.arg, n.left, n.right].some(hasTrig);
  }

  function parseExpr(tokens, settings) {
    if (!Array.isArray(tokens) || !tokens.length || tokens.length > MAX_TOKENS) fail('unsupported');
    const ast = Core.parse(tokens);
    if (settings && settings.angle === 'deg' && hasTrig(ast)) fail('unsupported');   // calculus is done in radians
    return ast;
  }
  const numeric = ast => x => { try { return Core.evaluateAst(ast, 'rad', x); } catch (_) { return NaN; } };

  /** Number from a CAS expression at x (and optional extra variables); NaN if it is not a finite real. */
  function casValue(text, vars) {
    try {
      const s = CAS(text).evaluate(vars || {}).text('decimals');
      if (!/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(s)) return NaN;   // complex, symbolic or non-numeric
      const v = Number(s);
      return Number.isFinite(v) ? v : NaN;
    } catch (_) { return NaN; }
  }
  const close = (a, b, rel) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= rel * (1 + Math.max(Math.abs(a), Math.abs(b)));
  const unevaluated = s => /\b(integrate|defint|diff|limit|solve|sum|product)\s*\(/.test(s) || /\b(undefined|NaN|Infinity)\b/.test(s);

  function run(source) {
    let r;
    try { r = CAS(source); } catch (_) { return fail('unsupported'); }
    const text = r.toString();
    if (unevaluated(text)) fail('unsupported');
    return {text, expr: r};
  }

  /** Display form: π, ·, ln, n for the integer parameter. */
  function pretty(s) {
    return s.replace(/log10\(/g, '\u0001(').replace(/log\(/g, 'ln(').replace(/\u0001\(/g, 'log(')
      .replace(/_n/g, 'n').replace(/\bpi\b/g, 'π').replace(/\*/g, '·').replace(/·π/g, 'π').replace(/sqrt\(/g, '√(').replace(/ /g, '');
  }

  function derivative(tokens, settings) {
    const ast = parseExpr(tokens, settings), f = numeric(ast);
    const out = run(`diff(${toCas(ast)},x)`);
    let ok = 0;
    for (const x of SAMPLES) {
      const h = 1e-5 * Math.max(1, Math.abs(x)), a = f(x - h), b = f(x + h);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const want = (b - a) / (2 * h), got = casValue(out.text, {x});
      if (!Number.isFinite(got)) continue;
      if (!close(got, want, 1e-4)) fail('unsupported');
      ok++;
    }
    if (ok < 4) fail('unsupported');
    return {kind: 'derivative', text: pretty(out.text)};
  }

  function antiderivative(tokens, settings) {
    const ast = parseExpr(tokens, settings), f = numeric(ast);
    const out = run(`integrate(${toCas(ast)},x)`);
    let ok = 0;
    for (const x of SAMPLES) {
      const h = 1e-5 * Math.max(1, Math.abs(x)), want = f(x);
      const a = casValue(out.text, {x: x - h}), b = casValue(out.text, {x: x + h});
      if (!Number.isFinite(want) || !Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (!close((b - a) / (2 * h), want, 1e-4)) fail('unsupported');
      ok++;
    }
    if (ok < 4) fail('unsupported');
    return {kind: 'integral', text: pretty(out.text) + '+C'};
  }

  // 16-point Gauss-Legendre nodes/weights on [-1, 1] (positive half; the rule is symmetric).
  const GL = [[0.0950125098376374, 0.1894506104550685], [0.2816035507792589, 0.1826034150449236], [0.4580167776572274, 0.1691565193950025],
    [0.6178762444026438, 0.1495959888165767], [0.7554044083550030, 0.1246289712555339], [0.8656312023878318, 0.0951585116824928],
    [0.9445750230732326, 0.0622535239386479], [0.9894009349916499, 0.0271524594117541]];
  function quad(f, a, b, panels, fabs) {
    let s = 0, abs = 0; const w = (b - a) / panels;
    for (let p = 0; p < panels; p++) {
      const m = a + (p + 0.5) * w, hw = w / 2;
      for (const [t, wt] of GL) for (const sgn of [-1, 1]) {
        const y = f(m + sgn * t * hw);
        if (!Number.isFinite(y)) return {v: NaN, abs: NaN};
        s += wt * hw * y; abs += wt * hw * Math.abs(y);
      }
    }
    return {v: s, abs: fabs ? abs : 0};
  }

  function definite(tokens, loTokens, hiTokens, settings) {
    const ast = parseExpr(tokens, settings), f = numeric(ast);
    const lo = parseExpr(loTokens, settings), hi = parseExpr(hiTokens, settings);
    const a = Core.evaluateAst(lo, 'rad'), b = Core.evaluateAst(hi, 'rad');
    if (!(b > a) || b - a > 1e6) fail('unsupported');
    const out = run(`defint(${toCas(ast)},x,${toCas(lo)},${toCas(hi)})`);
    const got = casValue(out.text);
    const q1 = quad(f, a, b, 64, true), q2 = quad(f, a, b, 512, true);
    // f undefined or infinite inside the interval, or a non-integrable singularity (1/x on [-1,1]): the CAS value means nothing.
    if (!Number.isFinite(q1.v) || !Number.isFinite(q2.v) || q2.abs - q1.abs > 0.05 * (1 + q1.abs)) fail('undefined');
    if (!close(q1.v, q2.v, 1e-8) || !close(got, q2.v, 1e-7)) fail('unsupported');
    return {kind: 'definite', text: pretty(out.text), value: got};
  }

  /** at: tokens of the point, or the strings 'inf' / '-inf'. */
  function limit(tokens, at, settings) {
    const ast = parseExpr(tokens, settings), f = numeric(ast);
    const inf = at === 'inf' || at === '-inf';
    const point = inf ? (at === 'inf' ? Infinity : -Infinity) : Core.evaluateAst(parseExpr(at, settings), 'rad');
    const target = inf ? at === 'inf' ? 'Infinity' : '-Infinity' : toCas(parseExpr(at, settings));
    const out = run(`limit(${toCas(ast)},x,${target})`);
    const got = casValue(out.text);
    const seq = side => (inf ? [1e3, 1e4, 1e5, 1e6].map(m => (side < 0 ? -m : m)) : [1e-3, 1e-4, 1e-5, 1e-6].map(h => point + side * h)).map(f);
    const sides = inf ? [seq(at === 'inf' ? 1 : -1)] : [seq(-1), seq(1)];
    if (!sides.every(v => v.slice(-2).every(Number.isFinite))) fail('unsupported');
    const ends = sides.map(v => v[v.length - 1]);
    // Both sides must settle (last two samples agree) on the CAS value; |x|/x at 0 has two different one-sided limits.
    if (!sides.every(v => close(v[2], v[3], 1e-3)) || !ends.every(e => close(e, got, 1e-3))) fail('undefined');
    return {kind: 'limit', text: pretty(out.text), value: got};
  }

  /** left = right solved for x with trigonometric / periodic answers (x = a + k·n, n ∈ ℤ). */
  function solveEquation(leftTokens, rightTokens, settings) {
    const L = parseExpr(leftTokens, settings), R = parseExpr(rightTokens, settings), fL = numeric(L), fR = numeric(R);
    let sols;
    try { sols = CAS.solve(`${toCas(L)}-${toCas(R)}`, 'x').toString(); } catch (_) { return fail('unsupported'); }
    if (unevaluated(sols) || !/^\{.*\}$/.test(sols)) fail('unsupported');
    const list = splitTop(sols.slice(1, -1));
    if (!list.length) fail('unsupported');
    const periodic = [];
    for (const s of list) {
      if (/\bi\b/.test(s)) fail('unsupported');   // complex answers belong to the ℂ mode
      const ns = /_n/.test(s) ? [-2, -1, 0, 1, 2] : [0];
      for (const n of ns) {
        const x = casValue(s, {_n: n});
        const err = Math.abs(fL(x) - fR(x));
        if (!Number.isFinite(x) || !(err <= 1e-8 * (1 + Math.abs(fL(x)) + Math.abs(fR(x))))) fail('unsupported');
      }
      periodic.push(/_n/.test(s));
    }
    return {kind: 'equation', solutions: list.map(pretty), periodic: periodic.some(Boolean)};
  }
  function splitTop(s) {
    const out = []; let depth = 0, cur = '';
    for (const c of s) {
      if (c === '(') depth++; else if (c === ')') depth--;
      if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  // ---- exact (symbolic) forms: shown first, and only when they agree with the certified numeric value ----
  const prettyExact = s => pretty(s).replace(/([A-Za-z0-9]+|\([^()]*\))\^\(1\/2\)/g, '√$1').replace(/√\(([A-Za-z0-9]+)\)/g, '√$1').replace(/·√/g, '√').replace(/^\(1\/(\d+)\)(√?[A-Za-z0-9]+)$/, '$2/$1');
  const looksNumeric = s => /^-?\d+\.\d+(e[+-]?\d+)?$/i.test(s) || /\d\.\d{3,}/.test(s);   // a bare decimal / float noise is not a closed form

  /** Closed form of a constant expression (√8 -> 2√2, sin(π/4) -> √2/2), or null. `value` is the numeric result the form must reproduce. */
  function exactValue(tokens, value, settings) {
    try {
      const ast = parseExpr(tokens, settings);
      if (Core.parse(tokens) && JSON.stringify(ast).includes('"x"')) return null;
      const r = CAS(toCas(ast)), text = r.toString();
      if (unevaluated(text) || looksNumeric(text) || /\bi\b/.test(text)) return null;
      if (!close(casValue(text), value, 1e-12)) return null;
      return prettyExact(text);
    } catch (_) { return null; }
  }

  /** Constant statement a = b: true / false when it can be decided (exactly or symbolically), else null. */
  function compare(leftTokens, rightTokens, settings) {
    const L = parseExpr(leftTokens, settings), R = parseExpr(rightTokens, settings);
    const mark = JSON.stringify([L, R]);
    if (mark.includes('"x"')) return null;
    try {
      const a = Core.evaluate(leftTokens, settings), b = Core.evaluate(rightTokens, settings);
      if (a.rational && b.rational) return a.rational.n * b.rational.d === b.rational.n * a.rational.d;
      const diff = CAS(`(${toCas(L)})-(${toCas(R)})`).toString();
      if (diff === '0') return true;
      if (!unevaluated(diff) && !close(a.value, b.value, 1e-9)) return false;
    } catch (e) { if (!(e instanceof MathError)) return null; throw e; }
    return null;
  }

  /** Radicals / closed forms for the real roots Core already found. Returns an array parallel to `roots` (null where no closed form). */
  function exactRoots(leftTokens, rightTokens, roots, settings) {
    const none = roots.map(() => null);
    try {
      const L = parseExpr(leftTokens, settings), R = parseExpr(rightTokens, settings);
      const sols = CAS.solve(`${toCas(L)}-${toCas(R)}`, 'x').toString();
      if (unevaluated(sols) || /_n/.test(sols) || !/^\{.*\}$/.test(sols)) return none;
      const cands = splitTop(sols.slice(1, -1)).map(t => ({t, v: casValue(t)})).filter(c => Number.isFinite(c.v) && !looksNumeric(c.t) && c.t.length <= 48);
      const simplified = t => { try { const e = CAS(`expand(${t})`).toString(); return unevaluated(e) || !close(casValue(e), casValue(t), 1e-12) ? t : e; } catch (_) { return t; } };
      return roots.map(r => { const m = cands.find(c => close(c.v, r, 1e-9)); return m ? prettyExact(simplified(m.t)) : null; });
    } catch (_) { return none; }
  }

  return Object.freeze({derivative, antiderivative, definite, limit, solveEquation, exactValue, compare, exactRoots, casValue, splitTopList: splitTop, prettyExact});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Calculus;
