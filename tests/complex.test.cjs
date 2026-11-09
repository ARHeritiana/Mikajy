'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Poly = require('../web/poly-core.js');
const MathCore = require('../web/math-core.js');
const Calculator = require('../web/calculator.js');
const T = s => s.split(' ');
const C = {domain: 'complex', mode: 'instant', angle: 'rad', fmt: 'dec'};
const calc = (t, set = {}) => Calculator.compute(T(t), {...C, ...set}, true);
const within = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('complex arithmetic is exact in the Gaussian rationals', () => {
  assert.equal(calc('( 1 + 2 i ) ( 3 - i )').text, '5+5i');
  assert.equal(calc('i ^ ( 2 )').text, '-1');
  assert.equal(calc('i ^ ( 7 )').text, '-i');
  assert.equal(calc('sqrt ( - 4 )').text, '2i');
  assert.equal(calc('( 3 + 4 i ) / ( 1 - 2 i )').text, '-1+2i');
  assert.equal(calc('1 / ( 1 + i )').text, '0.5-0.5i');
  assert.equal(calc('abs ( 3 + 4 i )').text, '5');
  assert.equal(calc('2 i ^ ( 2 ) + 3').text, '1');
  assert.equal(calc('( 1 + i ) ^ ( 8 )').text, '16');
});

test('transcendental and irrational complex results are marked approximate', () => {
  assert.equal(calc('sqrt ( - 2 )').text, '≈1.414213562i');
  assert.equal(calc('ln ( - 1 )').text, '≈3.141592654i');                            // principal branch: +pi i
  assert.equal(calc('( - 8 ) ^ ( 1 / 3 )').text.startsWith('≈1+1.732050808i'), true);
  const eipi = MathCore.evaluateComplex(T('e ^ ( i π )'), C);
  within(eipi.re, -1); within(eipi.im, 0, 1e-15); assert.ok(eipi.exact && eipi.exact.re.n === -1n && eipi.exact.im.n === 0n);   // exact: e^(iπ) = -1
  assert.equal(calc('e ^ ( i π )').text, '-1');
  const s = MathCore.evaluateComplex(T('sin ( i )'), C);
  within(s.im, Math.sinh(1)); within(s.re, 0);
});

test('real mode still refuses i and negative square roots', () => {
  const real = {...C, domain: 'real'};
  assert.equal(Calculator.compute(T('sqrt ( - 4 )'), real, true).text, '= undefined');
  assert.equal(Calculator.compute(T('i ^ ( 2 )'), real, true).text, '= unsupported');
  assert.equal(Calculator.compute(T('x ^ ( 2 ) + 1 = 0'), real, true).text, 'S=∅');
});

test('equations: every complex root, exact when the polynomial allows', () => {
  assert.equal(calc('x ^ ( 2 ) + 1 = 0').text, 'x=-i, i');
  assert.equal(calc('x ^ ( 2 ) + 4 x + 5 = 0').text, 'x=-2-i, -2+i');
  assert.equal(calc('x ^ ( 3 ) = 1').text.startsWith('x=≈-0.5-0.8660254038i, ≈-0.5+0.8660254038i, 1'), true);
  assert.equal(calc('x ^ ( 3 ) - 6 x ^ ( 2 ) + 11 x = 6').text, 'x=1, 2, 3');         // all-real roots print as before
  assert.equal(calc('( x ^ ( 2 ) + 1 ) / ( x - 1 ) = 0').text, 'x=-i, i');
  assert.equal(calc('( x ^ ( 2 ) + 1 ) / ( x ^ ( 2 ) + 1 ) = 0').text, 'S=∅');
  assert.equal(calc('x ^ ( 2 ) + 2 = 0').text, 'x=≈-1.414213562i, ≈1.414213562i');
  assert.equal(calc('x ^ ( 4 ) = - 1').text.split(', ').length, 4);
  assert.equal(calc('2 ^ ( x ) = 8').text, '= unsupported');                           // infinitely many complex solutions
});

test('property: complexRoots really are roots (residual) and conjugate-symmetric', () => {
  let seed = 99;
  const rnd = n => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
  for (let t = 0; t < 40; t++) {
    const deg = 2 + rnd(5), c = Array.from({length: deg + 1}, () => rnd(11) - 5);
    if (!c[deg]) c[deg] = 1;
    const roots = Poly.complexRoots(c.map(x => Poly.q(BigInt(x))));
    for (const r of roots) {
      let re = 0, im = 0, pr = 1, pi = 0;
      for (let i = 0; i <= deg; i++) { re += c[i] * pr; im += c[i] * pi; [pr, pi] = [pr * r.re - pi * r.im, pr * r.im + pi * r.re]; }
      assert.ok(Math.hypot(re, im) < 1e-7 * Math.max(1, ...c.map(Math.abs)) * Math.max(1, Math.hypot(r.re, r.im)) ** deg, `${c} root ${r.re}+${r.im}i`);
      if (r.im !== 0) assert.ok(roots.some(u => Math.abs(u.re - r.re) < 1e-9 && Math.abs(u.im + r.im) < 1e-9), 'conjugate missing');
    }
  }
});

test('conjugate, argument and e^(i q π)', () => {
  assert.equal(calc('conj ( 3 + 4 i )').text, '3-4i');                                  // exact
  assert.equal(calc('conj ( ( 1 + 2 i ) * ( 3 - i ) )').text, '5-5i');
  assert.equal(calc('e ^ ( i π / 2 )').text, 'i');
  assert.equal(calc('e ^ ( - i π / 2 )').text, '-i');
  assert.equal(calc('e ^ ( 3 i π )').text, '-1');
  assert.equal(calc('e ^ ( i π ) + 1').text, '0');
  assert.equal(calc('arg ( 1 + 2 i )').text, '≈1.107148718');                           // not a multiple of π: numeric, marked
  assert.equal(calc('arg ( - 1 )').text, 'π ≈3.141592654');
  assert.equal(calc('arg ( 1 + i )').text, 'π/4 ≈0.7853981634');
  assert.equal(calc('arg ( - 1 - i )').text, '-3π/4 ≈-2.35619449');
  assert.equal(calc('arg ( i )').text, 'π/2 ≈1.570796327');
  assert.throws(() => MathCore.evaluateComplex(T('arg ( 0 )'), C), e => e.code === 'undefined');
});
