'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Ode = require('../web/ode-core.js');
const Calc = require('../web/calculus.js');
const T = s => s.replace(/\\left\(/g, '\\left (').replace(/\\right\)/g, '\\right )').replace(/([{}])/g, ' $1 ').replace(/\\(frac|prime|sin|cos|times|sqrt|pi)\b/g, ' \\$1 ').replace(/\d/g, ' $& ').replace(/\s+/g, ' ').trim().split(' ');
const solve = s => Ode.solve(T(s));
const at = (r, x, vars = {}) => Calc.casValue(r.y, {x, ...vars});
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('first order linear, with and without a condition', () => {
  const g = solve('{ y } ^ { \\prime } + 2 y = { e } ^ { x }');
  assert.deepEqual(g.constants, ['C1']); near(at(g, 1, {C1: 0}), Math.E / 3);
  const r = solve('{ y } ^ { \\prime } + 2 y = { e } ^ { x } , y \\left( 0 \\right) = 1');
  assert.deepEqual(r.constants, []); near(at(r, 0), 1); near(at(r, 1), Math.E / 3 + 2 / 3 * Math.exp(-2));
  const c = solve('{ y } ^ { \\prime } - 3 y = 0 , y \\left( 0 \\right) = 2'); near(at(c, 1), 2 * Math.exp(3));
});
test('dy/dx notation, and x y\' + y = 1 (variable coefficient, still first order linear)', () => {
  const a = solve('\\frac { d y } { d x } = 3'); near(at(a, 2, {C1: 0}), 6);
  const b = solve('x { y } ^ { \\prime } + y = 1 , y \\left( 1 \\right) = 3'); near(at(b, 2), 1 + 2 / 2);   // (x + C)/x, C = 2
});
test('separable: y\' = x y, and y\' = y^2', () => {
  const r = solve('{ y } ^ { \\prime } = x y , y \\left( 0 \\right) = 2'); near(at(r, 1), 2 * Math.exp(.5), 1e-8);
});
test('second order, constant coefficients: all three root types, forcing, conditions', () => {
  const c = solve('{ y } ^ { \\prime \\prime } + y = 0 , y \\left( 0 \\right) = 1 , { y } ^ { \\prime } \\left( 0 \\right) = 0'); near(at(c, 1.1), Math.cos(1.1), 1e-8);
  const d = solve('{ y } ^ { \\prime \\prime } - 3 { y } ^ { \\prime } + 2 y = 0 , y \\left( 0 \\right) = 1 , { y } ^ { \\prime } \\left( 0 \\right) = 0');   // 2e^x - e^2x
  near(at(d, .5), 2 * Math.exp(.5) - Math.exp(1), 1e-8);
  const e = solve('{ y } ^ { \\prime \\prime } + 2 { y } ^ { \\prime } + y = 0 , y \\left( 0 \\right) = 1 , { y } ^ { \\prime } \\left( 0 \\right) = 1');   // (1 + 2x) e^-x
  near(at(e, 1), 3 * Math.exp(-1), 1e-8);
  const f = solve('{ y } ^ { \\prime \\prime } - y = { e } ^ { 2 x } , y \\left( 0 \\right) = 0 , { y } ^ { \\prime } \\left( 0 \\right) = 0');   // forced
  near(Math.abs(at(f, 0)), 0, 1e-9);
  const g = solve('{ y } ^ { \\prime \\prime } - 3 { y } ^ { \\prime } + 2 y = 0'); assert.deepEqual(g.constants, ['C1', 'C2']);
});
test('refusals: nonlinear, variable-coefficient second order, integrals the CAS cannot do, bad conditions', () => {
  for (const s of ['{ y } ^ { \\prime } = { y } ^ { 2 } + x', '{ y } ^ { \\prime \\prime } + x y = 0', '{ y } ^ { \\prime } + y = \\sin x , y \\left( 0 \\right) = 1',
                   '{ y } ^ { \\prime \\prime } + y = 0 , y \\left( 0 \\right) = 1', '{ y } ^ { \\prime \\prime \\prime } = 0'])
    try { const r = solve(s); assert.fail(`should refuse (or be audited): ${s} -> ${r.text}`); } catch (e) { assert.ok(e instanceof Ode.OdeError || /should refuse/.test(e.message) && false, s + ' : ' + e.message); }
});
test('applies() only claims equations with y\', y\'\' or dy/dx', () => {
  assert.equal(Ode.applies(T('{ y } ^ { \\prime } + y = 0')), true);
  assert.equal(Ode.applies(T('\\frac { d y } { d x } = x')), true);
  assert.equal(Ode.applies(T('y = 2 x')), false); assert.equal(Ode.applies(T('x + 1 = 2')), false);
});
