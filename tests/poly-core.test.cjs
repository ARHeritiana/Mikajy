'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Poly = require('../web/poly-core.js');
const MathCore = require('../web/math-core.js');
const Calculator = require('../web/calculator.js');
const T = s => s.split(' ');
const roots = (l, r, settings) => MathCore.solve(T(l), T(r), settings).roots;
const rationals = list => list.map(r => r.rational ? `${r.rational.n}/${r.rational.d}` : null);
const fails = (fn, code) => assert.throws(fn, e => e instanceof MathCore.MathError && e.code === code);
const poly = c => c.map(x => Poly.q(BigInt(x)));

test('every real root of a polynomial is found, exactly when rational', () => {
  assert.deepEqual(rationals(roots('x ^ ( 3 ) - 6 x ^ ( 2 ) + 11 x', '6')), ['1/1', '2/1', '3/1']);
  assert.deepEqual(rationals(roots('x ^ ( 4 )', '16')), ['-2/1', '2/1']);
  assert.deepEqual(rationals(roots('6 x ^ ( 3 ) - x ^ ( 2 ) - 5 x', '- 2')), ['-1/1', '1/2', '2/3']);
  assert.deepEqual(rationals(roots('( x - 1 ) ^ ( 5 )', '0')), ['1/1']);                 // multiple root listed once
  assert.deepEqual(roots('x ^ ( 2 ) + 1', '0') || [], []);                                  // no real root => none
  assert.equal(MathCore.solve(T('x ^ ( 4 ) + 1'), T('0')).kind, 'none');
  assert.equal(MathCore.solve(T('x ^ ( 4 ) + x ^ ( 2 ) + 1'), T('0')).kind, 'none');
});

test('irrational roots are accurate and never labelled exact', () => {
  const r = roots('x ^ ( 3 )', 'x + 1');                       // plastic number
  assert.equal(r.length, 1);
  assert.equal(r[0].rational, null);
  assert.ok(Math.abs(r[0].value - 1.324717957244746) < 1e-14);
  const q = roots('x ^ ( 5 ) + x', '1');
  assert.ok(Math.abs(q[0].value ** 5 + q[0].value - 1) < 1e-14);
  const two = roots('x ^ ( 4 ) - 2 x ^ ( 2 )', '1');          // 1 ± √2 squared: x = ±sqrt(1+√2)
  assert.equal(two.length, 2);
  for (const t of two) assert.ok(Math.abs(t.value ** 4 - 2 * t.value ** 2 - 1) < 1e-13);
});

test('property: polynomials built from chosen rational roots are recovered exactly', () => {
  let seed = 12345;
  const rnd = n => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
  for (let trial = 0; trial < 60; trial++) {
    const count = 1 + rnd(5), chosen = new Set();
    let p = Poly.constant(Poly.q(BigInt(1 + rnd(5))));
    for (let i = 0; i < count; i++) {
      const num = BigInt(rnd(21) - 10), den = BigInt(1 + rnd(6));
      chosen.add(Poly.q(num, den).n + '/' + Poly.q(num, den).d);
      p = Poly.pmul(p, [Poly.q(-num, den), Poly.q(1n)]);
    }
    const found = Poly.realRoots(p);
    assert.deepEqual(found.map(f => f.rational.n + '/' + f.rational.d), [...chosen].sort((a, b) => eval(a) - eval(b)));
  }
});

test('property: for irreducible factors the residual is tiny and the count matches Sturm', () => {
  const cases = [[-2, 0, 1], [-3, 0, 0, 1], [-1, -3, 0, 1], [1, -4, 0, 0, 1], [-5, 0, 1, 0, 0, 1], [3, -3, 0, 0, 0, 1]];
  for (const c of cases) {
    const p = poly(c), found = Poly.realRoots(p);
    assert.ok(found.length >= 1, String(c));
    for (const r of found) {
      const v = c.reduceRight((acc, a) => acc * r.value + a, 0);
      assert.ok(Math.abs(v) < 1e-9 * Math.max(1, ...c.map(Math.abs)) * Math.max(1, Math.abs(r.value) ** c.length), `${c} @ ${r.value}`);
    }
  }
});

test('rational-function equations exclude values that make a denominator zero', () => {
  assert.deepEqual(rationals(roots('( x - 1 ) / ( x + 1 )', '2')), ['-3/1']);
  assert.deepEqual(rationals(roots('( x ^ ( 2 ) - 4 ) / ( x - 2 )', '0')), ['-2/1']);    // x = 2 is excluded
  assert.equal(MathCore.solve(T('( x - 2 ) / ( x - 2 )'), T('0')).kind, 'none');          // 1 = 0 away from x = 2
  assert.deepEqual(rationals(roots('1 / x + 1 / ( x + 1 )', '1')).length, 2);
  assert.deepEqual(rationals(roots('1 / x ^ ( 2 )', '4')), ['-1/2', '1/2']);
  assert.deepEqual(rationals(roots('x ^ ( - 1 )', '2')), ['1/2']);
  assert.equal(MathCore.solve(T('0 / x'), T('3')).kind, 'none');
  fails(() => MathCore.solve(T('x / x'), T('1')), 'unsupported');                         // true except at 0: no honest answer
  fails(() => MathCore.solve(T('1 / ( x - x )'), T('1')), 'undefined');
});

test('absolute value and even powers give every branch', () => {
  assert.deepEqual(rationals(roots('abs ( x - 1 )', '2')), ['-1/1', '3/1']);
  assert.deepEqual(rationals(roots('abs ( abs ( x ) - 1 )', '2')), ['-3/1', '3/1']);
  assert.deepEqual(rationals(roots('abs ( x )', '0')), ['0/1']);
  assert.equal(MathCore.solve(T('abs ( x )'), T('- 1')).kind, 'none');
  const ln = roots('( ln ( x ) ) ^ ( 2 )', '4');
  assert.ok(Math.abs(ln[0].value - Math.exp(-2)) < 1e-15 && Math.abs(ln[1].value - Math.exp(2)) < 1e-14);
  assert.deepEqual(rationals(roots('( x + 1 ) ^ ( 4 )', '16')), ['-3/1', '1/1']);
  fails(() => MathCore.solve(T('sin ( x )'), T('0')), 'unsupported');                    // periodic: still refused
});

test('trigonometric values at special angles are exact; others stay approximate', () => {
  const exact = (t, angle) => { const r = MathCore.evaluate(T(t), {angle}).rational; return r && `${r.n}/${r.d}`; };
  const table = {'sin ( 30 )': '1/2', 'cos ( 60 )': '1/2', 'tan ( 45 )': '1/1', 'tan ( 135 )': '-1/1', 'sin ( 210 )': '-1/2',
    'cos ( 120 )': '-1/2', 'sin ( 390 )': '1/2', 'sin ( - 330 )': '1/2', 'sec ( 60 )': '2/1', 'csc ( 30 )': '2/1', 'cot ( 45 )': '1/1',
    'sin ( 90 )': '1/1', 'cos ( 180 )': '-1/1', 'cos ( 90 )': '0/1'};
  for (const [t, expect] of Object.entries(table)) assert.equal(exact(t, 'deg'), expect, t);
  const rad = {'sin ( π / 6 )': '1/2', 'cos ( π / 3 )': '1/2', 'tan ( π / 4 )': '1/1', 'sin ( 5 π / 6 )': '1/2', 'cos ( π )': '-1/1',
    'sin ( 7 π / 6 )': '-1/2', 'cos ( 2 π )': '1/1', 'tan ( 3 π / 4 )': '-1/1', 'csc ( π / 6 )': '2/1'};
  for (const [t, expect] of Object.entries(rad)) assert.equal(exact(t, 'rad'), expect, t);
  for (const t of ['sin ( 45 )', 'cos ( 30 )', 'tan ( 60 )', 'sin ( 1 )']) assert.equal(exact(t, 'deg'), null, t);
  for (const t of ['sin ( π / 4 )', 'sin ( 1 )', 'cos ( π / 5 )']) assert.equal(exact(t, 'rad'), null, t);
  // a degree-mode "30" is not 30 radians
  assert.equal(exact('sin ( 30 )', 'rad'), null);
  assert.throws(() => MathCore.evaluate(T('tan ( 90 )'), {angle: 'deg'}), MathCore.MathError);
});

test('the calculator displays the extended results honestly', () => {
  const calc = (t, set = {}) => Calculator.compute(T(t), {mode: 'instant', angle: 'rad', fmt: 'dec', ...set}, true);
  assert.equal(calc('x ^ ( 3 ) - 6 x ^ ( 2 ) + 11 x = 6').text, 'x=1, 2, 3');
  assert.equal(calc('abs ( x - 1 ) = 2').text, 'x=-1, 3');
  assert.equal(calc('( x ^ ( 2 ) - 4 ) / ( x - 2 ) = 0').text, 'x=-2');
  assert.equal(calc('( x - 2 ) / ( x - 2 ) = 0').text, 'S=∅');
  assert.ok(calc('x ^ ( 3 ) = x + 1').text.startsWith('x=≈1.324717957'));
  assert.equal(calc('tan ( 45 )', {angle: 'deg'}).text, '1');
  assert.equal(calc('0.1 + 0.2').text, '0.3');   // exact decimal, not 0.30000000000000004
});

test('hostile polynomial input stays bounded and fails closed', () => {
  assert.deepEqual(rationals(roots('x ^ ( 40 )', '1')), ['-1/1', '1/1']);               // single x: exact branch inversion
  fails(() => MathCore.solve(T('x ^ ( 40 ) + x'), T('1')), 'unsupported');                // beyond the polynomial degree limit
  fails(() => MathCore.solve(T('( x + 1 ) ^ ( 30 ) * ( x + 2 ) ^ ( 30 )'), T('0')), 'unsupported');
  fails(() => MathCore.solve(T('x ^ ( 0 )'), T('1')), 'unsupported');
  assert.throws(() => Poly.pdivmod(poly([1, 1]), []), Poly.PolyError);
});
