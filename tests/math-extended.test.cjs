'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const MathCore = require('../web/math-core.js');
const Calculator = require('../web/calculator.js');
const v = (tokens, settings) => MathCore.evaluate(tokens, settings).value;
const exact = tokens => MathCore.evaluate(tokens).rational;
const solve = (left, right, settings) => MathCore.solve(left, right, settings);
const within = (actual, expected, tolerance = 1e-11) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
const fails = (fn, code) => assert.throws(fn, e => e instanceof MathCore.MathError && e.code === code);
const T = s => s.split(' ');   // 'e ^ ( 2 )' -> tokens

test('exponentials and the exp function', () => {
  within(v(T('e ^ ( 2 )')), Math.exp(2));
  within(v(T('e ^ ( - 1 )')), Math.exp(-1));
  within(v(T('exp ( 3 )')), Math.exp(3));
  within(v(T('exp ( 0 )')), 1);
  within(v(T('2 e ^ ( 2 )')), 2 * Math.exp(2));
  within(v(T('ln ( e ^ ( 3 ) )')), 3);
  assert.equal(exact(T('e ^ ( 0 )')).n, 1n);
  assert.equal(exact(T('exp ( 0 )')).n, 1n);
  assert.equal(exact(T('ln ( e )')).n, 1n);
  assert.equal(exact(T('ln ( 1 )')).n, 0n);
  assert.equal(exact(T('log ( 10 )')).n, 1n);
  assert.equal(MathCore.evaluate(T('e ^ ( 1 )')).rational, null);   // never presented as exact
});

test('rational exponents are exact only when the root is rational', () => {
  assert.deepEqual([exact(T('4 ^ ( 1 / 2 )')).n, exact(T('4 ^ ( 1 / 2 )')).d], [2n, 1n]);
  assert.deepEqual([exact(T('8 ^ ( 2 / 3 )')).n, exact(T('8 ^ ( 2 / 3 )')).d], [4n, 1n]);
  assert.deepEqual([exact(T('( 1 / 4 ) ^ ( 1 / 2 )')).n, exact(T('( 1 / 4 ) ^ ( 1 / 2 )')).d], [1n, 2n]);
  assert.equal(exact(T('2 ^ ( 1 / 2 )')), null);
  within(v(T('2 ^ ( 1 / 2 )')), Math.SQRT2);
  fails(() => v(T('( - 8 ) ^ ( 1 / 3 )')), 'undefined');
});

test('reciprocal trigonometric functions and their singularities', () => {
  within(v(T('sec ( 60 )'), {angle: 'deg'}), 2);
  within(v(T('csc ( 30 )'), {angle: 'deg'}), 2);
  within(v(T('cot ( 45 )'), {angle: 'deg'}), 1);
  within(v(T('cot ( π / 4 )')), 1);
  fails(() => v(T('cot ( 180 )'), {angle: 'deg'}), 'undefined');
  fails(() => v(T('csc ( 0 )')), 'undefined');
  fails(() => v(T('sec ( 90 )'), {angle: 'deg'}), 'undefined');
  assert.equal(v(T('sec ( 0 )')), 1);
});

test('sqrt as a word and arguments written without brackets', () => {
  within(v(T('sqrt ( 9 )')), 3);
  within(v(T('sqrt 16')), 4);
  within(v(T('sin 2 π')), 0);
  within(v(T('sin 30 + 1'), {angle: 'deg'}), 1.5);
  within(v(T('cos 2 x'.replace('x', 'π'))), 1);
  within(v(T('2 sin 30'), {angle: 'deg'}), 1);
  within(v(T('sin 30 cos 60'), {angle: 'deg'}), 0.25);
  within(v(T('sin 2 e'), {}), Math.sin(2 * Math.E));
});

test('equations with one occurrence of x are solved by exact inversion', () => {
  const root = (l, r, s) => solve(T(l), T(r), s).roots;
  assert.deepEqual(root('2 ^ ( x )', '8').map(r => r.value), [3]);
  assert.equal(root('2 ^ ( x )', '8')[0].rational.n, 3n);
  assert.equal(root('2 ^ ( x )', '1 / 8')[0].rational.n, -3n);
  within(root('e ^ ( x )', '5')[0].value, Math.log(5));
  assert.equal(root('e ^ ( x )', '5')[0].rational, null);
  assert.equal(root('e ^ ( x )', '1')[0].rational.n, 0n);
  within(root('ln ( x )', '2')[0].value, Math.exp(2));
  assert.equal(root('ln ( x )', '0')[0].rational.n, 1n);
  assert.equal(root('sqrt ( x + 1 )', '3')[0].rational.n, 8n);
  assert.equal(root('5 / x', '2')[0].value, 2.5);
  assert.equal(root('3 e ^ ( 2 x - 1 )', '3')[0].value, 0.5);
  assert.equal(root('x ^ ( 3 )', '8')[0].rational.n, 2n);
  assert.equal(root('x ^ ( 3 )', '- 8')[0].rational.n, -2n);
  assert.equal(root('log ( x )', '3')[0].rational.n, 1000n);
  assert.equal(root('2 x + 1', '5')[0].value, 2);
  within(root('1 0 ^ ( x )'.replace('1 0', '10'), '1000')[0].value, 3);
});

test('inversion reports empty solution sets and refuses what has no finite answer', () => {
  assert.equal(solve(T('e ^ ( x )'), T('- 1')).kind, 'none');
  assert.equal(solve(T('sqrt ( x )'), T('- 2')).kind, 'none');
  assert.equal(solve(T('2 ^ ( x )'), T('0')).kind, 'none');
  assert.equal(solve(T('0 / x'), T('3')).kind, 'none');
  // periodic, or not solvable by undoing one operation at a time
  for (const [l, r] of [['sin ( x )', '0'], ['cos ( x )', '1'], ['1 ^ ( x )', '1'], ['x e ^ ( x )', '1'], ['x !', '120']]) {
    fails(() => solve(T(l), T(r)), 'unsupported');
  }
});

test('calculator displays inverted equations honestly', () => {
  const calc = (t, set = {}) => Calculator.compute(T(t), {mode: 'instant', angle: 'rad', fmt: 'dec', ...set}, true);
  assert.equal(calc('2 ^ ( x ) = 8').text, 'x=3');
  assert.equal(calc('e ^ ( x ) = 5').text.startsWith('x=≈1.609437'), true);
  assert.equal(calc('ln ( x ) = 1').text.startsWith('x=≈2.71828'), true);
  assert.equal(calc('sin ( x ) = 0').text, 'x=nπ,  n∈ℤ');   // periodic answers are shown, verified by substitution
  assert.equal(calc('4 ^ ( 1 / 2 )').text, '2');
});
