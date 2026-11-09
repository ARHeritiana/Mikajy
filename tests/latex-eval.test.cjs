'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Calculator = require('../web/calculator.js');
const LatexEval = require('../web/latex-eval.js');
const La = require('../web/linalg-core.js');
const Mo = require('../web/modular-core.js');
// the model emits one token per digit and "\left" apart from "("
const T = s => s.replace(/\\left\(/g, '\\left (').replace(/\\right\)/g, '\\right )').replace(/\d/g, ' $& ').trim().split(/\s+/);
const M = (rows, env = 'b m a t r i x') => `\\begin { ${env} } ${rows.map(r => r.join(' & ')).join(' \\\\ ')} \\end { ${env} }`;
const calc = (s, set = {}, eq = true) => Calculator.computeLatex(T(s), {mode: 'instant', angle: 'rad', fmt: 'frac', domain: 'real', ...set}, eq);

test('modular arithmetic is exact, including huge powers', () => {
  assert.equal(calc('47 \\bmod 5').text, '2');
  assert.equal(calc('{ 3 } ^ { 20 } \\bmod 7').text, '2');
  assert.equal(calc('{ 2 } ^ { 100 } \\bmod 13').text, '3');
  assert.equal(calc('{ 7 } ^ { 1000 } \\bmod 10').text, '1');
  assert.equal(calc('\\gcd \\left( 12 , 18 \\right)').text, '6');
  assert.equal(calc('\\lcm \\left( 4 , 6 \\right)').text, '12');
  assert.equal(Mo.inverse(3n, 7n), 5n);
  assert.throws(() => Mo.inverse(2n, 4n), e => e.code === 'undefined');
});
test('congruences: true/false, one solution class, several, none', () => {
  assert.equal(calc('8 \\equiv 3 \\left( \\bmod 5 \\right)').text, 'True');
  assert.equal(calc('8 \\equiv 4 \\left( \\bmod 5 \\right)').text, 'False');
  assert.equal(calc('3 x \\equiv 4 \\left( \\bmod 7 \\right)').text, 'x≡6 (mod 7)');
  assert.equal(calc('6 x \\equiv 4 \\left( \\bmod 8 \\right)').text, 'x≡2 (mod 4)');
  assert.equal(calc('2 x \\equiv 1 \\left( \\bmod 4 \\right)').text, 'S=∅');
  assert.equal(calc('0 x \\equiv 0 \\left( \\bmod 5 \\right)').text, 'True');
  assert.equal(calc('{ 2 } ^ { 5 } \\equiv 4 \\left( \\bmod 7 \\right)').text, 'True');
  assert.equal(calc('4 \\equiv 1 \\left( \\bmod 3 \\right)', {lang: 'fr'}).text, 'Vrai');
});
test('matrices: determinant, inverse, product, sum, transpose, powers, scalars', () => {
  const A = M([[1, 2], [3, 4]]), B = M([[0, 1], [1, 0]]);
  assert.equal(calc(`\\det ${A}`).text, '-2');
  assert.equal(calc(M([[1, 2], [3, 4]], 'v m a t r i x')).text, '-2');             // |A| = det A
  assert.equal(calc(`{ ${A} } ^ { - 1 }`).text, '=[-2 1; 3/2 -1/2]'.slice(1));
  assert.equal(calc(`${A} ${B}`).text, '[2 1; 4 3]');
  assert.equal(calc(`${A} + ${B}`).text, '[1 3; 4 4]');
  assert.equal(calc(`{ ${A} } ^ { T }`).text, '[1 3; 2 4]');
  assert.equal(calc(`{ ${A} } ^ { 2 }`).text, '[7 10; 15 22]');
  assert.equal(calc(`2 ${A}`).text, '[2 4; 6 8]');
  assert.equal(calc(`\\det ${M([[1, 2, 3], [0, 1, 4], [5, 6, 0]])}`).text, '1');
});
test('A · A⁻¹ is the identity, and singular or mismatched matrices are refused', () => {
  const A = M([[2, 1], [7, 4]]);
  assert.equal(calc(`${A} { ${A} } ^ { - 1 }`).text, '[1 0; 0 1]');
  assert.equal(calc(`{ ${M([[1, 2], [2, 4]])} } ^ { - 1 }`).text, '= undefined');        // singular
  assert.equal(calc(`${M([[1, 2, 3]])} ${M([[1, 2]])}`).text, '= unsupported');         // 1x3 · 1x2
  assert.equal(calc(`${M([[1, 2], [3, 4]])} + 1`).text, '= unsupported');              // matrix + scalar
  assert.equal(calc(`{ ${M([[1, 2], [3, 4]])} } ^ { 1000 }`).text, '= unsupported');   // size cap, never a guess
});
test('applies() only claims readings it can handle; others fall through to the token engine', () => {
  assert.equal(LatexEval.applies(T('1 + 2')), false);
  assert.equal(Calculator.computeLatex(T('1 + 2'), {mode: 'instant'}, true), undefined);
  assert.equal(LatexEval.applies(T('5 \\bmod 3')), true);
  assert.equal(calc('5 \\bmod', {mode: 'instant'}, false), null);                       // incomplete reading: nothing shown
});
test('rational matrices stay exact (no floats)', () => {
  const r = LatexEval.evaluate(T(`{ ${M([[3, 5], [7, 9]])} } ^ { - 1 }`));
  assert.equal(La.toTextM(r.rows), '-9/8 5/8; 7/8 -3/8');
  assert.equal(La.toText(La.det(r.rows)), '-1/8');
});
