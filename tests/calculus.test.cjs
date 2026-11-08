'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Calculus = require('../web/calculus.js');
const Calculator = require('../web/calculator.js');
const MathCore = require('../web/math-core.js');
const T = s => s.split(' ');
const calc = (s, set = {}, eq = false) => Calculator.compute(T(s), {mode: 'instant', angle: 'rad', fmt: 'frac', domain: 'real', ...set}, eq);
const refuses = f => assert.throws(f, e => e instanceof MathCore.MathError);

test('derivatives are audited against finite differences', () => {
  assert.equal(Calculus.derivative(T('x ^ ( 3 ) * sin ( x )')).kind, 'derivative');
  assert.match(Calculus.derivative(T('x ^ ( 2 )')).text, /^2·x$/);
  assert.match(Calculus.derivative(T('e ^ ( x )')).text, /^e\^x$/);
});
test('antiderivatives must differentiate back to the integrand', () => {
  assert.equal(Calculus.antiderivative(T('x * e ^ ( x )')).text, 'e^x·(-1+x)+C');
  assert.match(Calculus.antiderivative(T('1 / ( 1 + x ^ ( 2 ) )')).text, /^atan\(x\)\+C$/);
  refuses(() => Calculus.antiderivative(T('x ^ ( x )')));          // the CAS leaves it unevaluated
});
test('definite integrals: exact where possible, singularities refused', () => {
  assert.equal(Calculus.definite(T('x ^ ( 2 )'), ['0'], ['3']).text, '9');
  assert.equal(Calculus.definite(T('sin ( x )'), ['0'], ['π']).value.toFixed(9), '2.000000000');
  refuses(() => Calculus.definite(T('1 / x'), ['-', '1'], ['1']));       // not integrable: the CAS would say ~0
  refuses(() => Calculus.definite(T('1 / x ^ ( 2 )'), ['-', '1'], ['1']));
});
test('limits must agree with the function approaching the point', () => {
  assert.equal(Calculus.limit(T('sin ( x ) / x'), ['0']).value, 1);
  assert.equal(Calculus.limit(T('1 / x'), 'inf').value, 0);
  refuses(() => Calculus.limit(T('abs ( x ) / x'), ['0']));          // one-sided limits differ; the CAS says 0
});
test('periodic equations are shown as families and verified by substitution', () => {
  assert.equal(calc('sin ( x ) = 0').text, 'x=nπ,  n∈ℤ');
  assert.equal(calc('2 * cos ( x ) = 1').text.includes('n∈ℤ'), true);
  assert.equal(calc('cos ( x ) = 2').text, '= unsupported');         // no real solution: never a made-up family
});
test('statements about constants are True or False', () => {
  assert.equal(calc('4 = 2').text, 'False');
  assert.equal(calc('4 = 4').text, 'True');
  assert.equal(calc('1 / 3 + 1 / 6 = 1 / 2').text, 'True');
  assert.equal(calc('√ ( 2 ) * √ ( 2 ) = 2').text, 'True');          // proved symbolically, not by rounding
  assert.equal(calc('0.1 + 0.2 = 0.3').text, 'True');
});
test('symbolic results come first (decimal is secondary)', () => {
  assert.equal(calc('√ ( 8 )').text, '=2√2 ≈2.828427125');
  assert.equal(calc('√ ( 8 )', {fmt: 'dec'}).text.startsWith('=≈2.8284'), true);   // decimals only when asked
  assert.match(calc('x ^ ( 2 ) = 2').text, /^x=-√2 ≈-1\.414213562, √2 ≈1\.414213562$/);
  assert.equal(calc('x ^ ( 5 ) + x = 1').text.includes('√'), false);              // no closed form: numeric only
});
