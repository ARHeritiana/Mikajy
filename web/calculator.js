/* UI-facing calculation adapter. Does not know about canvas or recognition. */
const Calculator = (() => {
  'use strict';
  const Core = typeof module !== 'undefined' && module.exports ? require('./math-core.js') : MathCore;
  const textPiece = s => ({s: String(s)});
  const textOf = pieces => pieces.map(p => p.s === undefined ? p.f.join('/') : p.s).join('');
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
  function asResponse(pieces, value) {
    return {pieces, text: textOf(pieces), val: value};
  }
  function compute(tokens, settings = {}, trailingEquals = false) {
    if (!tokens.length) return null;
    const eqIndex = tokens.indexOf('=');
    const explicit = trailingEquals || eqIndex >= 0;
    if (settings.mode === 'demand' && !explicit) return null;
    try {
      if (eqIndex >= 0) {
        if (tokens.indexOf('=', eqIndex + 1) >= 0) return null;
        const left = tokens.slice(0, eqIndex), right = tokens.slice(eqIndex + 1);
        const result = Core.solve(left, right);
        if (result.kind === 'identity') return asResponse([textPiece('x∈ℝ')], undefined);
        if (result.kind === 'none') return asResponse([textPiece('S=∅')], undefined);
        const pieces = [textPiece('x=')];
        result.roots.forEach((r, i) => {
          if (i) pieces.push(textPiece(', '));
          pieces.push(...numberPieces(r, settings.fmt || 'dec'));
        });
        return asResponse(pieces, result.roots[0]?.value);
      }
      if (tokens.includes('x') && !tokens.some(t => ['Σ', '∫', 'lim', '∞', '→'].includes(t))) return null;
      if (tokens.length === 1 && !trailingEquals) return null;
      const result = Core.evaluate(tokens, settings);
      return asResponse([...(!trailingEquals ? [textPiece('=')] : []), ...numberPieces(result, settings.fmt || 'dec')], result.value);
    } catch (error) {
      if (!(error instanceof Core.MathError)) throw error;
      if (error.code === 'syntax' || !explicit) return null;
      return asResponse([textPiece('= ' + (error.code === 'undefined' ? 'undefined' : 'unsupported'))], undefined);
    }
  }
  return Object.freeze({compute, numberPieces});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Calculator;
