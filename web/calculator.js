/* UI-facing calculation adapter. Does not know about canvas or recognition. */
const Calculator = (() => {
  'use strict';
  const Core = typeof module !== 'undefined' && module.exports ? require('./math-core.js') : MathCore;
  const Calc = typeof module !== 'undefined' && module.exports ? require('./calculus.js') : Calculus;
  const Latex = typeof module !== 'undefined' && module.exports ? require('./latex-eval.js') : LatexEval;
  const Board = typeof module !== 'undefined' && module.exports ? require('./board-core.js') : BoardCore;
  const Prob = typeof module !== 'undefined' && module.exports ? require('./prob-core.js') : ProbCore;
  const Ode = typeof module !== 'undefined' && module.exports ? require('./ode-core.js') : OdeCore;
  const SeqC = typeof module !== 'undefined' && module.exports ? require('./seq-core.js') : SeqCore;
  const Linalg = typeof module !== 'undefined' && module.exports ? require('./linalg-core.js') : LinalgCore;
  const I18 = typeof module !== 'undefined' && module.exports ? require('./i18n.js') : I18n;
  const textPiece = s => ({s: String(s)});
  const textOf = pieces => pieces.map(p => p.m ? '[' + p.m.rows.map(row => row.map(cell => textOf(cell)).join(' ')).join('; ') + ']' : p.s === undefined ? p.f.join('/') : p.s).join('');
  const niceNumber = v => {
    if (!Number.isFinite(v)) return '?';
    if (Object.is(v, -0)) v = 0;
    return String(Number(v.toPrecision(10)));
  };
  function numberPieces(result, format) {
    const {value, rational} = result;
    if (rational && format !== 'dec' && rational.d !== 1n) {
      const n = rational.n, d = rational.d, sign = n < 0n ? [textPiece('-')] : [];
      const p = n < 0n ? -n : n;
      if (p.toString().length + d.toString().length <= 28) {
        if (format === 'mixed' && p > d) {
          const whole = p / d, remain = p % d;
          return remain === 0n ? [...sign, textPiece(whole)] : [...sign, textPiece(whole), textPiece(' '), {f: [String(remain), String(d)]}];
        }
        return [...sign, {f: [String(p), String(d)]}];
      }
    }
    const exactDisplay = rational && Core.exactDecimal(rational);
    // Never quietly turn a numeric approximation into an exact claim.
    const prefix = exactDisplay ? '' : '≈';
    return [textPiece(prefix + niceNumber(value))];
  }
  /** a+bi for a complex number {re, im, eRe, eIm} (eRe/eIm: exact rationals or null); one leading ≈ when anything is approximate. */
  function complexPieces(c, format) {
    const exactAll = !!(c.eRe && c.eIm);
    const tiny = (a, b) => Math.abs(a) < 1e-12 * Math.max(1, Math.abs(b));
    const real = exactAll ? c.eIm.n === 0n : tiny(c.im, c.re), pure = exactAll ? c.eRe.n === 0n : tiny(c.re, c.im);
    if (real) return numberPieces({value: c.re, rational: c.eRe}, format);
    const out = exactAll ? [] : [textPiece('≈')];
    const part = (v, r) => exactAll ? numberPieces({value: v, rational: r}, format) : [textPiece(niceNumber(v))];
    if (!pure) out.push(...part(c.re, c.eRe));
    const negative = c.im < 0;
    out.push(textPiece(pure ? (negative ? '-' : '') : (negative ? '-' : '+')));
    const unit = exactAll ? (c.eIm.n === 1n || c.eIm.n === -1n) && c.eIm.d === 1n : Math.abs(Math.abs(c.im) - 1) < 1e-12;
    if (!unit) out.push(...part(Math.abs(c.im), exactAll ? (c.eIm.n < 0n ? {n: -c.eIm.n, d: c.eIm.d} : c.eIm) : null));
    out.push(textPiece('i'));
    return out;
  }
  const asComplex = r => ({re: r.re, im: r.im, eRe: r.exact ? r.exact.re : r.exactRe || null, eIm: r.exact ? r.exact.im : r.exactIm || null});
  function asResponse(pieces, value) {
    return {pieces, text: textOf(pieces), val: value};
  }
  function compute(tokens, settings = {}, trailingEquals = false) {
    if (!tokens.length) return null;
    const W = key => I18.t(settings.lang, key);   // result words follow the interface language
    const eqIndex = tokens.indexOf('=');
    const explicit = trailingEquals || eqIndex >= 0;
    if (settings.mode === 'demand' && !explicit) return null;
    try {
      if (eqIndex >= 0) {
        if (tokens.indexOf('=', eqIndex + 1) >= 0) return null;
        const left = tokens.slice(0, eqIndex), right = tokens.slice(eqIndex + 1);
        // A statement about constants is True or False (4 = 2 -> False), decided exactly where possible.
        if (left.length && right.length && !tokens.includes('x')) {
          const verdict = Calc.compare(left, right, settings);
          if (verdict !== null) return asResponse([textPiece(W(verdict ? 'true' : 'false'))], undefined);
        }
        let result;
        try { result = Core.solve(left, right, settings); } catch (error) {
          // Trigonometric / periodic equations (sin x = 0 -> x = nπ, n ∈ ℤ): only answers that substitute back are shown.
          if (!(error instanceof Core.MathError) || error.code !== 'unsupported' || !tokens.includes('x') || settings.domain === 'complex') throw error;
          let periodic;
          try { periodic = Calc.solveEquation(left, right, settings); } catch (_) { throw error; }
          const pieces = [textPiece('x=')];
          periodic.solutions.forEach((t, i) => { if (i) pieces.push(textPiece(', ')); pieces.push(textPiece(t)); });
          if (periodic.periodic) pieces.push(textPiece(',  n∈ℤ'));
          return asResponse(pieces, undefined);
        }
        if (result.kind === 'croots') {
          const pieces = [textPiece('x=')];
          result.roots.forEach((r, i) => { if (i) pieces.push(textPiece(', ')); pieces.push(...complexPieces(asComplex(r), settings.fmt || 'dec')); });
          return asResponse(pieces, result.roots.length === 1 && Math.abs(result.roots[0].im) < 1e-12 ? result.roots[0].re : undefined);
        }
        if (result.kind === 'identity') return asResponse([textPiece('x∈ℝ')], undefined);
        if (result.kind === 'none') return asResponse([textPiece('S=∅')], undefined);
        const pieces = [textPiece('x=')];
        // Symbolic first: radicals / closed forms for the irrational roots, when they match the certified numeric roots.
        const closed = (settings.fmt || 'dec') !== 'dec' && result.roots.some(r => !r.rational)
          ? Calc.exactRoots(left, right, result.roots.map(r => r.value), settings) : [];
        result.roots.forEach((r, i) => {
          if (i) pieces.push(textPiece(', '));
          if (!r.rational && closed[i]) pieces.push(textPiece(closed[i] + ' ≈' + niceNumber(r.value)));
          else pieces.push(...numberPieces(r, settings.fmt || 'dec'));
        });
        return asResponse(pieces, result.roots[0]?.value);
      }
      if (tokens.includes('x') && !tokens.some(t => ['Σ', '∫', 'lim', '∞', '→'].includes(t))) return null;
      if (tokens.length === 1 && !trailingEquals) return null;
      if (settings.domain === 'complex') {
        const z = Core.evaluateComplex(tokens, settings), pieces = complexPieces(asComplex(z), settings.fmt || 'dec');
        return asResponse([...(!trailingEquals ? [textPiece('=')] : []), ...pieces], Math.abs(z.im) < 1e-12 ? z.re : undefined);
      }
      const result = Core.evaluate(tokens, settings);
      // Symbolic first: an irrational value gets its closed form (√8 -> 2√2) with the decimal as a secondary reading.
      if (!result.rational && (settings.fmt || 'dec') !== 'dec') {
        const closedForm = Calc.exactValue(tokens, result.value, settings);
        if (closedForm) return asResponse([...(!trailingEquals ? [textPiece('=')] : []), textPiece(/^-?\d+(\/\d+)?$/.test(closedForm) ? closedForm : closedForm + ' ≈' + niceNumber(result.value))], result.value);
      }
      return asResponse([...(!trailingEquals ? [textPiece('=')] : []), ...numberPieces(result, settings.fmt || 'dec')], result.value);
    } catch (error) {
      if (!(error instanceof Core.MathError)) throw error;
      if (error.code === 'syntax' || !explicit) return null;
      return asResponse([textPiece('= ' + W(error.code === 'undefined' ? 'undefined' : 'unsupported'))], undefined);
    }
  }

  /** What the recogniser's LaTeX means beyond plain arithmetic: user functions (f(x) = ..., f(3)), probability (X ~ B(n, p), P(X = 2)), differential
   *  equations (y' + 2y = e^x, y(0) = 1), matrices, modular arithmetic and congruences. `store` is the board's memory (board-core.js).
   *  Returns undefined when the reading is not for these engines (the token engine handles it), null when there is nothing to show, else a response. */
  function computeLatex(tokens, settings = {}, trailingEquals = false, store) {
    const st = store || Board.empty();
    const W = key => I18.t(settings.lang, key);
    const explicit = trailingEquals || tokens[tokens.length - 1] === '=';
    const fail = error => {
      const code = error && error.code;
      if (!code || code === 'syntax' || !explicit) return null;
      return asResponse([textPiece('= ' + W(code === 'undefined' ? 'undefined' : 'unsupported'))], undefined);
    };
    const eq = [...(!trailingEquals && tokens[tokens.length - 1] !== '=' ? [textPiece('=')] : [])];
    try {
      if (Board.parseStatement(tokens)) return null;                                   // f(x) = ... and X ~ B(...) only declare
      if (Ode.applies(tokens)) {
        if (settings.mode === 'demand' && !explicit) return null;
        return asResponse([textPiece(Ode.solve(tokens).text)], undefined);
      }
      if (Prob.applies(tokens)) {
        if (settings.mode === 'demand' && !explicit) return null;
        const r = Prob.evaluate(tokens, st), fmt = settings.fmt || 'dec';
        if (r.kind === 'int') return asResponse([...eq, textPiece(String(r.n))], Number(r.n));
        const asQ = q => numberPieces({value: Number(q.n) / Number(q.d), rational: {n: q.n, d: q.d}}, fmt);
        if (r.kind === 'q') return asResponse([...eq, ...asQ(r.q)], Number(r.q.n) / Number(r.q.d));
        const v = Prob.value(r.v);
        if (Prob.isApprox(r.v)) return asResponse([...eq, textPiece('≈' + niceNumber(v))], v);
        if (r.v.c.n === 0n) return asResponse([...eq, ...asQ(r.v.q)], v);
        return asResponse([...eq, textPiece(Prob.valText(r.v) + ' ≈' + niceNumber(v))], v);
      }
      if (Board.usesDefs(tokens, st)) {                                                // f(3), f(g(2)): expand, then the ordinary engines
        if (settings.mode === 'demand' && !explicit) return null;
        let math;
        try { math = SeqC.toMathTokens(Board.expand(tokens, st), {complex: settings.domain === 'complex'}); } catch (e) { return fail(e.unsupported ? {code: 'unsupported'} : e); }
        return compute(math, settings, trailingEquals);
      }
      if (!Latex.applies(tokens)) return undefined;
      if (settings.mode === 'demand' && !explicit) return null;
      const r = Latex.evaluate(tokens);
      const eq2 = !(explicit && trailingEquals) && !tokens.includes('\\equiv') ? [textPiece('=')] : [];
      switch (r.kind) {
        case 'scalar': return asResponse([...eq2, ...numberPieces({value: Number(r.q.n) / Number(r.q.d), rational: r.q}, settings.fmt || 'dec')], Number(r.q.n) / Number(r.q.d));
        case 'matrix': return asResponse([...eq2, {m: {br: '[', rows: r.rows.map(row => row.map(q => numberPieces({value: Number(q.n) / Number(q.d), rational: q}, settings.fmt || 'frac')))}}], undefined);
        case 'bool': return asResponse([textPiece(W(r.value ? 'true' : 'false'))], undefined);
        case 'congruence': return asResponse([textPiece(`x≡${r.r} (mod ${r.m})`)], undefined);
        case 'all': return asResponse([textPiece('x∈ℤ')], undefined);
        case 'none': return asResponse([textPiece('S=∅')], undefined);
        default: return null;
      }
    } catch (error) { return fail(error); }
  }
  return Object.freeze({compute, computeLatex, numberPieces});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Calculator;
