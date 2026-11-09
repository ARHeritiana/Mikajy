/* Ordinary differential equations on the board, solved symbolically and audited numerically:
 *   y' + p(x) y = q(x)   (first order linear; also y' = f(x) g(y) when it separates),
 *   a y'' + b y' + c y = f(x)   (second order, constant coefficients; the particular solution by variation of parameters),
 * with initial conditions written after the equation:  y' + 2y = e^x , y(0) = 1   or   y'' + y = 0 , y(0) = 1 , y'(0) = 0.
 * Notation read: y, y' (written y^{\prime}), y'', and dy/dx (\frac{dy}{dx}).
 * A solution is shown only after it has been substituted back into the original equation (and into the initial conditions) at several points;
 * integrals the bundled CAS cannot find, nonlinear forms, variable-coefficient second order: all refused ('unsupported'), never guessed. */
const OdeCore = (() => {
  'use strict';
  const CAS = typeof module !== 'undefined' && module.exports ? require('./vendor/nerdamer.js') : nerdamer;
  const Latex = typeof module !== 'undefined' && module.exports ? require('./latex-eval.js') : LatexEval;
  const Calc = typeof module !== 'undefined' && module.exports ? require('./calculus.js') : Calculus;
  class OdeError extends Error { constructor(code) { super(code); this.name = 'OdeError'; this.code = code; } }
  const fail = code => { throw new OdeError(code); };
  const MAX_TOKENS = 120;

  // ---------- LaTeX -> CAS text, with y, y', y'' as the symbols Y0, Y1, Y2 ----------
  const FUNCS = {sin: 'sin', cos: 'cos', tan: 'tan', ln: 'log', log: 'log10', exp: 'exp', sinh: 'sinh', cosh: 'cosh', tanh: 'tanh'};
  function prepare(tokens) {
    const t = tokens.slice(), out = [];
    for (let i = 0; i < t.length; i++) {
      // \frac { d y } { d x }  ->  Y1
      if (t[i] === '\\frac' && t.slice(i + 1, i + 12).join(' ') === '{ d y } { d x }') { out.push('Y1'); i += 11; continue; }
      // { y } ^ { \prime [\prime] }  or  y ^ { \prime [\prime] }  ->  Y1 / Y2
      let j = i, braced = false;
      if (t[j] === '{' && t[j + 1] === 'y' && t[j + 2] === '}') { j += 3; braced = true; } else if (t[j] === 'y') j += 1; else { out.push(t[i]); continue; }
      if (t[j] === '^' && t[j + 1] === '{' && t[j + 2] === '\\prime') {
        let k = j + 2, n = 0; while (t[k] === '\\prime') { n++; k++; }
        if (t[k] === '}' && n <= 2) { out.push('Y' + n); i = k; continue; }
      }
      out.push(braced ? '{' : 'y'); if (braced) out.push('y', '}'); i = braced ? i + 2 : i;
    }
    return out;
  }
  function toCas(tokens) {
    const t = prepare(tokens); let i = 0;
    const peek = (o = 0) => t[i + o], next = () => t[i++];
    const isDigit = u => typeof u === 'string' && /^[0-9.]$/.test(u);
    const starts = u => u !== undefined && (isDigit(u) || ['x', 'Y0', 'Y1', 'Y2', 'y', 'e', '\\pi', '{', '(', '\\left', '\\frac', '\\sqrt'].includes(u) || (u.startsWith('\\') && FUNCS[u.slice(1)]));
    function number() {
      let s = ''; while (isDigit(peek())) s += next();
      if (!/^\d+(\.\d+)?$/.test(s)) fail('syntax');
      const [a, b = ''] = s.split('.'); return b ? `(${a}${b}/1${'0'.repeat(b.length)})` : a;
    }
    function group() { if (next() !== '{') fail('syntax'); const e = expr(); if (next() !== '}') fail('syntax'); return `(${e})`; }
    function paren() { if (peek() === '\\left') i++; if (next() !== '(') fail('syntax'); const e = expr(); if (peek() === '\\right') i++; if (next() !== ')') fail('syntax'); return `(${e})`; }
    function atom() {
      const u = peek();
      if (isDigit(u)) return number();
      if (u === 'x') { i++; return 'x'; }
      if (u === 'Y0' || u === 'Y1' || u === 'Y2') { i++; return u; }
      if (u === 'y') { i++; return 'Y0'; }
      if (u === 'e') { i++; return 'e'; }
      if (u === '\\pi') { i++; return 'pi'; }
      if (u === '{') return group();
      if (u === '(' || u === '\\left') return paren();
      if (u === '\\frac') { i++; const a = group(), b = group(); return `(${a}/${b})`; }
      if (u === '\\sqrt') { i++; return `sqrt${group()}`; }
      if (u && u.startsWith('\\') && FUNCS[u.slice(1)]) {
        i++; let p = '';
        if (peek() === '^') { i++; p = `^${peek() === '{' ? group() : atom()}`; }
        const arg = peek() === '(' || peek() === '\\left' ? paren() : atomPow();
        return p ? `(${FUNCS[u.slice(1)]}${arg})${p}` : `${FUNCS[u.slice(1)]}${arg}`;
      }
      return fail('syntax');
    }
    function atomPow() { const a = atom(); if (peek() === '^') { i++; return `(${a}^${peek() === '{' ? group() : atom()})`; } return a; }
    function power() { let n = atom(); while (peek() === '^') { i++; n = `(${n}^${peek() === '{' ? group() : atom()})`; } return n; }
    function unary() { if (peek() === '-') { i++; return `(-${unary()})`; } if (peek() === '+') { i++; return unary(); } return power(); }
    function term() {
      let n = unary();
      for (;;) {
        const u = peek();
        if (u === '\\times' || u === '*') { i++; n = `(${n}*${unary()})`; }
        else if (u === '\\div' || u === '/') { i++; n = `(${n}/${unary()})`; }
        else if (starts(u)) n = `(${n}*${unary()})`;
        else return n;
      }
    }
    function expr() { let n = term(); while (peek() === '+' || peek() === '-') { const o = next(); n = `(${n}${o}${term()})`; } return n; }
    const e = expr(); if (i !== t.length) fail('syntax'); return e;
  }

  // ---------- statement ----------
  const strip = tokens => { const t = tokens.filter(u => u !== '<nl>'); while (t.length && t[t.length - 1] === '=') t.pop(); return t; };
  const mentionsY = t => t.includes('\\prime') && t.includes('y') || t.join(' ').includes('\\frac { d y } { d x }');
  /** is this reading a differential equation (with y' / y'' / dy/dx) ? */
  function applies(tokens) { const t = strip(tokens); return t.length > 3 && t.length <= MAX_TOKENS && mentionsY(t) && t.includes('='); }

  function splitTop(t, sep) { const parts = [[]]; let d = 0; for (const u of t) { if (u === '(' || u === '{') d++; else if (u === ')' || u === '}') d--; if (d === 0 && sep(u)) parts.push([]); else parts[parts.length - 1].push(u); } return parts; }
  const rational = tokens => { const r = Latex.evaluate(tokens); if (r.kind !== 'scalar') fail('unsupported'); return r.q.d === 1n ? `${r.q.n}` : `(${r.q.n}/${r.q.d})`; };

  function parse(tokens) {
    const t = strip(tokens);
    const parts = splitTop(t, u => u === ',' || u === ';').filter(p => p.length);
    const eq = splitTop(parts[0], u => u === '=');
    if (eq.length !== 2 || !eq[0].length || !eq[1].length) fail('syntax');
    const F = `(${toCas(eq[0])})-(${toCas(eq[1])})`;
    const ics = parts.slice(1).map(p => {                              // y ( a ) = v   |   y' ( a ) = v   |  y'' ( a ) = v
      const e = splitTop(p, u => u === '='); if (e.length !== 2) fail('syntax');
      const pre = prepare(e[0]); const head = pre[0];
      if (!['y', 'Y1', 'Y2'].includes(head) || pre[1] !== '(' && pre[1] !== '\\left') fail('syntax');
      const order = head === 'y' ? 0 : Number(head[1]);
      let o = pre[1] === '\\left' ? 2 : 1, end = pre.length - 1; if (pre[end] === ')' && pre[end - 1] === '\\right') end--; else if (pre[end] !== ')') fail('syntax');
      return {order, at: rational(pre.slice(o + 1, end)), value: rational(e[1])};
    });
    return {F, ics};
  }

  // ---------- CAS helpers ----------
  const S = s => { try { return CAS(s).toString(); } catch (_) { return fail('unsupported'); } };
  const simp = s => S(`expand(${s})`);
  const bad = s => /\b(integrate|diff|solve|sum|limit)\s*\(|NaN|Infinity|undefined/.test(s);
  const ok = s => { if (bad(s)) fail('unsupported'); return s; };
  const hasY = s => /Y[012]/.test(s);
  const isZero = s => { const v = Calc.casValue(s, {x: .713}); return Number.isFinite(v) && Math.abs(v) < 1e-12 && !/x/.test(s) || s === '0'; };
  const hasX = s => /\bx\b/.test(s);
  const sub = (s, vars) => { try { return CAS(s, vars).toString(); } catch (_) { return fail('unsupported'); } };

  /** F = a2 Y2 + a1 Y1 + a0 Y0 + g  or fail */
  function linearize(F) {
    const a = [0, 1, 2].map(k => ok(S(`diff(${F},Y${k})`)));
    if (a.some(hasY)) return null;
    const g = ok(simp(`${F}-(${a[2]})*Y2-(${a[1]})*Y1-(${a[0]})*Y0`));
    if (hasY(g)) return null;
    return {a0: a[0], a1: a[1], a2: a[2], g};
  }
  const nonzero = s => !(s === '0' || isZero(s));

  // ---------- solvers (return the general solution as a CAS string with constants C1, C2) ----------
  function firstOrderLinear(L) {
    const p = ok(S(`(${L.a0})/(${L.a1})`)), q = ok(S(`-(${L.g})/(${L.a1})`));
    const P = ok(S(`integrate(${p},x)`));
    const I = ok(S(`integrate((${q})*e^(${P}),x)`));
    return {y: ok(simp(`e^(-(${P}))*((${I})+C1)`)), consts: ['C1']};
  }
  function firstOrderSeparable(F) {
    const L1 = ok(S(`diff(${F},Y1)`)); if (hasY(L1)) fail('unsupported');
    const R = ok(simp(`-((${F})-(${L1})*Y1)/(${L1})`));                         // y' = R(x, y)
    const xs = [.37, .9, 1.4, 2.1], ys = [.6, 1.3, 2.2];
    const val = (x, y) => Calc.casValue(R, {x, Y0: y});
    const x0 = .9, y0 = 1.3, r00 = val(x0, y0);
    if (!Number.isFinite(r00) || Math.abs(r00) < 1e-9) fail('unsupported');
    for (const x of xs) for (const y of ys) {                                    // R(x,y) R(x0,y0) = R(x,y0) R(x0,y)  <=>  separable
      const a = val(x, y) * r00, b = val(x, y0) * val(x0, y);
      if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 1e-8 * (1 + Math.abs(a))) fail('unsupported');
    }
    const f = ok(simp(sub(R, {Y0: '(13/10)'}))), g = ok(simp(`(${sub(R, {x: '(9/10)'})})/(${r00 === 0 ? 1 : S(sub(R, {x: '(9/10)', Y0: '(13/10)'}))})`));
    const Gy = ok(S(`integrate(1/(${g}),Y0)`)), Fx = ok(S(`integrate(${f},x)`));
    let sols; try { sols = CAS.solve(`(${Gy})-(${Fx})-C1`, 'Y0').toString(); } catch (_) { fail('unsupported'); }
    const list = Calc.splitTopList(sols.replace(/^\{|\}$/g, ''));
    if (list.length !== 1) fail('unsupported');
    return {y: ok(simp(list[0])), consts: ['C1']};
  }
  function secondOrder(L) {
    const A = L.a2; if ([L.a2, L.a1, L.a0].some(hasX)) fail('unsupported');       // constant coefficients only
    const b = ok(S(`(${L.a1})/(${A})`)), c = ok(S(`(${L.a0})/(${A})`)), f = ok(S(`-(${L.g})/(${A})`));
    const D = Calc.casValue(`(${b})^2-4*(${c})`, {});
    if (!Number.isFinite(D)) fail('unsupported');
    let y1, y2;
    if (Math.abs(D) < 1e-12) { const r = ok(S(`-(${b})/2`)); y1 = `e^((${r})*x)`; y2 = `x*e^((${r})*x)`; }
    else if (D > 0) { const s = ok(S(`sqrt((${b})^2-4*(${c}))`)); const r1 = ok(S(`(-(${b})+${s})/2`)), r2 = ok(S(`(-(${b})-${s})/2`)); y1 = `e^((${r1})*x)`; y2 = `e^((${r2})*x)`; }
    else { const al = ok(S(`-(${b})/2`)), be = ok(S(`sqrt(4*(${c})-(${b})^2)/2`)); y1 = `e^((${al})*x)*cos((${be})*x)`; y2 = `e^((${al})*x)*sin((${be})*x)`; }
    let yp = '0';
    if (nonzero(f)) {
      const W = ok(simp(`(${y1})*(${S(`diff(${y2},x)`)})-(${S(`diff(${y1},x)`)})*(${y2})`));
      const I1 = ok(S(`integrate(simplify((${y2})*(${f})/(${W})),x)`)), I2 = ok(S(`integrate(simplify((${y1})*(${f})/(${W})),x)`));
      yp = `-(${y1})*(${I1})+(${y2})*(${I2})`;
    }
    return {y: ok(simp(`C1*(${y1})+C2*(${y2})+(${yp})`)), consts: ['C1', 'C2']};
  }

  /** fix the constants from the initial conditions (linear in C1, C2: solved here, exactly) */
  function applyConditions(sol, ics) {
    const n = sol.consts.length;
    if (!ics.length) return sol.y;
    if (ics.length !== n) fail('unsupported');
    const D = k => k === 0 ? sol.y : k === 1 ? S(`diff(${sol.y},x)`) : S(`diff(${S(`diff(${sol.y},x)`)},x)`);
    const rows = ics.map(c => {                                               // coefficient of each constant, and the rest, at x = a
      const e = D(c.order), at = c.at;
      const cs = sol.consts.map(k => ok(S(sub(`diff(${e},${k})`, {x: at}))));
      const rest = ok(S(sub(`(${e})-${sol.consts.map((k, i) => `(${S(`diff(${e},${k})`)})*${k}`).join('-')}`, {x: at})));
      return {cs, rhs: ok(S(`(${c.value})-(${rest})`))};
    });
    let vals;
    if (n === 1) vals = [S(`(${rows[0].rhs})/(${rows[0].cs[0]})`)];
    else {
      const [r1, r2] = rows, det = S(`(${r1.cs[0]})*(${r2.cs[1]})-(${r1.cs[1]})*(${r2.cs[0]})`);
      if (!nonzero(det)) fail('unsupported');
      vals = [S(`((${r1.rhs})*(${r2.cs[1]})-(${r1.cs[1]})*(${r2.rhs}))/(${det})`), S(`((${r1.cs[0]})*(${r2.rhs})-(${r1.rhs})*(${r2.cs[0]}))/(${det})`)];
    }
    vals.forEach(ok);
    const subs = {}; sol.consts.forEach((k, i) => { subs[k] = `(${vals[i]})`; });
    return ok(simp(sub(sol.y, subs)));
  }

  /** substitute the answer back: the equation at several x, the conditions at their points */
  function audit(F, ics, y, consts) {
    const trial = {}; consts.forEach((k, i) => { trial[k] = [1.3, -.7][i]; });
    const ys = ics.length ? y : sub(y, Object.fromEntries(consts.map(k => [k, `(${trial[k]})`])));
    const d1 = S(`diff(${ys},x)`), d2 = S(`diff(${d1},x)`);
    let good = 0;
    for (const x of [.31, .77, 1.2, 1.9, -.4, 2.6]) {
      const v0 = Calc.casValue(ys, {x}), v1 = Calc.casValue(d1, {x}), v2 = Calc.casValue(d2, {x});
      if (![v0, v1, v2].every(Number.isFinite)) continue;
      const r = Calc.casValue(F, {x, Y0: v0, Y1: v1, Y2: v2});
      const scale = 1 + Math.abs(v0) + Math.abs(v1) + Math.abs(v2);
      if (!Number.isFinite(r) || Math.abs(r) > 1e-7 * scale) fail('unsupported');
      good++;
    }
    if (good < 3) fail('unsupported');
    for (const c of ics) {
      const e = c.order === 0 ? ys : c.order === 1 ? d1 : d2;
      const v = Calc.casValue(e, {x: Calc.casValue(c.at, {})}), want = Calc.casValue(c.value, {});
      if (!Number.isFinite(v) || Math.abs(v - want) > 1e-8 * (1 + Math.abs(want))) fail('unsupported');
    }
  }

  /** -> {text: 'y=…', y, constants} ; throws OdeError */
  function solve(tokens) {
    const t = strip(tokens);
    if (!applies(t)) fail('syntax');
    const {F, ics} = parse(t);
    const L = linearize(F);
    let sol;
    if (L) {
      if (nonzero(L.a2)) sol = secondOrder(L);
      else if (nonzero(L.a1)) sol = firstOrderLinear(L);
      else fail('unsupported');
    } else if (!hasY(S(`diff(${F},Y2)`)) && !nonzero(S(`diff(${F},Y2)`))) sol = firstOrderSeparable(F);
    else fail('unsupported');
    const y = applyConditions(sol, ics);
    audit(F, ics, y, ics.length ? [] : sol.consts);
    return {text: 'y=' + Calc.prettyExact(y), y, constants: ics.length ? [] : sol.consts};
  }
  return Object.freeze({applies, solve, parse, toCas, OdeError});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = OdeCore;
