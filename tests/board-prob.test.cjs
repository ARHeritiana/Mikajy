'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Board = require('../web/board-core.js');
const Prob = require('../web/prob-core.js');
// the model emits one token per digit, and "\left" apart from "("
const T = s => s.replace(/\\left\(/g, '\\left (').replace(/\\right\)/g, '\\right )').replace(/([{}])/g, ' $1 ').replace(/\\(frac|sim|le|ge|ne)\b/g, ' \\$1 ').replace(/\d/g, ' $& ').replace(/\s+/g, ' ').trim().split(' ');
const store = (...lines) => lines.reduce((st, l) => Board.scan(T(l), st), Board.empty());
const q = (st, line) => { const r = Prob.evaluate(T(line), st); return r.kind === 'q' ? `${r.q.n}/${r.q.d}` : r.kind === 'int' ? String(r.n) : r.v; };
const frac = (st, line) => { const v = q(st, line).q; return `${v.n}/${v.d}`; };

test('functions: definitions, calls, composition, redefinition', () => {
  const st = store('f \\left( x \\right) = { x } ^ { 2 } + 1', 'g \\left( x \\right) = 2 x');
  assert.equal(Board.expand(T('f \\left( 3 \\right)'), st).join(' '), '\\left ( { \\left ( 3 \\right ) } ^ { 2 } + 1 \\right )');
  assert.equal(Board.expand(T('f \\left( g \\left( 2 \\right) \\right)'), st).join(' '),
    '\\left ( { \\left ( \\left ( 2 \\left ( 2 \\right ) \\right ) \\right ) } ^ { 2 } + 1 \\right )'.replace('2 \\left ( 2 \\right )', '2 \\left ( 2 \\right )'));
});
test('expansion keeps everything else and refuses self-reference', () => {
  const st = store('f \\left( x \\right) = f \\left( x \\right) + 1');
  assert.throws(() => Board.expand(T('f \\left( 2 \\right)'), st), e => e.code === 'unsupported');
  assert.deepEqual(Board.expand(T('1 + 2'), Board.empty()), T('1 + 2'));
  assert.equal(Board.usesDefs(T('f \\left( 2 \\right)'), store('f \\left( x \\right) = x')), true);
  assert.equal(Board.usesDefs(T('f \\left( 2 \\right)'), Board.empty()), false);
});
test('binomial: exact rationals', () => {
  const st = store('X \\sim B \\left( 10 , \\frac{1}{2} \\right)');
  assert.equal(frac(st, 'P \\left( X = 5 \\right)'), '63/256');
  assert.equal(frac(st, 'P \\left( X \\le 1 \\right)'), '11/1024');
  assert.equal(frac(st, 'P \\left( X \\ge 9 \\right)'), '11/1024');
  assert.equal(frac(st, 'P \\left( X < 3 \\right)'), '7/128');
  assert.equal(frac(st, 'P \\left( 3 \\le X \\le 5 \\right)'), '291/512');
  assert.equal(frac(st, 'P \\left( 3 < X \\le 5 \\right)'), '231/512');
  assert.equal(q(st, 'E \\left( X \\right)'), '5/1');
  assert.equal(q(st, 'V \\left( X \\right)'), '5/2');
  assert.equal(frac(store('X \\sim B \\left( 3 , \\frac{1}{3} \\right)'), 'P \\left( X = 2 \\right) ='), '2/9');
  assert.equal(frac(store('X \\sim B \\left( 4 , 0 . 5 \\right)'), 'P \\left( X > 4 \\right)'), '0/1');     // impossible event
});
test('geometric, uniform, exponential, Poisson: exact forms', () => {
  assert.equal(frac(store('X \\sim G \\left( \\frac{1}{4} \\right)'), 'P \\left( X = 3 \\right)'), '9/64');
  assert.equal(frac(store('X \\sim G \\left( \\frac{1}{4} \\right)'), 'P \\left( X \\le 3 \\right)'), '37/64');
  const u = store('X \\sim U \\left( 0 , 10 \\right)');
  assert.equal(frac(u, 'P \\left( X \\le 4 \\right)'), '2/5');
  assert.equal(frac(u, 'P \\left( 2 \\le X \\le 7 \\right)'), '1/2');
  const e = q(store('X \\sim E \\left( 2 \\right)'), 'P \\left( X \\le 1 \\right)');         // 1 - e^-2
  assert.equal(Prob.valText(e), '1 - e^(-2)'); assert.ok(Math.abs(Prob.value(e) - (1 - Math.exp(-2))) < 1e-15);
  const p = q(store('X \\sim P \\left( 3 \\right)'), 'P \\left( X = 2 \\right)');            // 9/2 e^-3
  assert.equal(Prob.valText(p), '9/2·e^(-3)'); assert.ok(Math.abs(Prob.value(p) - 4.5 * Math.exp(-3)) < 1e-15);
  assert.equal(Prob.valText(q(store('X \\sim P \\left( 3 \\right)'), 'P \\left( X \\le 1 \\right)')), '4·e^(-3)');
});
test('normal: numeric, accurate', () => {
  const n = store('X \\sim N \\left( 100 , 15 \\right)');
  assert.ok(Math.abs(Prob.value(q(n, 'P \\left( X \\le 100 \\right)')) - .5) < 1e-14);
  assert.ok(Math.abs(Prob.value(q(n, 'P \\left( X \\le 115 \\right)')) - 0.8413447460685429) < 1e-12);
  assert.ok(Math.abs(Prob.value(q(n, 'P \\left( 85 \\le X \\le 115 \\right)')) - 0.6826894921370859) < 1e-12);
  assert.ok(Prob.isApprox(q(n, 'P \\left( X > 130 \\right)')));
  assert.equal(q(n, 'E \\left( X \\right)'), '100/1'); assert.equal(q(n, 'V \\left( X \\right)'), '225/1');
  assert.ok(Math.abs(Prob.value(q(n, 'P \\left( X > 160 \\right)')) - 3.167124183311992e-5) < 1e-14);   // far tail: continued fraction
});
test('C(n,k) and refusals', () => {
  assert.equal(q(Board.empty(), 'C \\left( 10 , 3 \\right)'), '120');
  assert.equal(q(Board.empty(), 'C \\left( 52 , 5 \\right) ='), '2598960');
  assert.throws(() => q(Board.empty(), 'P \\left( X = 2 \\right)'), e => e.code === 'unsupported');                 // X never declared
  assert.throws(() => q(store('X \\sim B \\left( 10 , 3 \\right)'), 'P \\left( X = 2 \\right)'), e => e.code === 'undefined');   // p = 3
  assert.throws(() => q(store('X \\sim B \\left( 10 , \\frac{1}{2} \\right)'), 'P \\left( X \\ne 2 \\right)'), () => true);
  assert.equal(Prob.applies(T('P \\left( X = 2 \\right)')), true); assert.equal(Prob.applies(T('1 + 2')), false);
});
test('redefinition replaces; a later line sees only what is above', () => {
  const a = store('X \\sim B \\left( 2 , \\frac{1}{2} \\right)', 'X \\sim B \\left( 4 , \\frac{1}{2} \\right)');
  assert.equal(frac(a, 'P \\left( X = 4 \\right)'), '1/16');
});
