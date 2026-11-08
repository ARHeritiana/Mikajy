'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Calculator = require('../web/calculator.js');
const Board = require('../web/board-core.js');
const T = s => s.replace(/\\left\(/g, '\\left (').replace(/\\right\)/g, '\\right )').replace(/([{}])/g, ' $1 ').replace(/\\(frac|sim|le|ge|ne|prime|sqrt|pi|sin|cos|times)\b/g, ' \\$1 ').replace(/\d/g, ' $& ').replace(/\s+/g, ' ').trim().split(' ');
const SET = {mode: 'instant', angle: 'rad', fmt: 'frac', domain: 'real'};
const run = (lines, last, set = {}, eq = false) => {                   // all lines above are "written" first, the last one is evaluated
  const st = lines.reduce((s, l) => Board.scan(T(l), s), Board.empty());
  const r = Calculator.computeLatex(T(last), {...SET, ...set}, eq, st);
  return r === undefined || r === null ? r : r.text;
};

test('a function definition only declares; calls evaluate through the ordinary engines', () => {
  const f = 'f \\left( x \\right) = { x } ^ { 2 } + 1';
  assert.equal(run([], f), null);
  assert.equal(run([f], 'f \\left( 3 \\right)'), '=10');
  assert.equal(run([f], 'f \\left( 3 \\right)', {}, true), '10');
  assert.equal(run([f], 'f \\left( \\frac{1}{2} \\right)'), '=5/4');
  assert.equal(run([f], 'f \\left( - 2 \\right) + f \\left( 1 \\right)'), '=7');
  assert.equal(run([f], 'f \\left( \\sqrt{2} \\right)'), '=3');                       // exact: (√2)² + 1
  assert.equal(run([f, 'g \\left( x \\right) = 2 x'], 'f \\left( g \\left( 2 \\right) \\right)'), '=17');
  assert.equal(run([f, 'f \\left( x \\right) = x + 1'], 'f \\left( 3 \\right)'), '=4');   // redefinition replaces
  assert.equal(run([], 'f \\left( 3 \\right)'), undefined);                            // f is not defined: not for this module
});
test('probability through the calculator: exact, symbolic and approximate answers', () => {
  const b = 'X \\sim B \\left( 10 , \\frac{1}{2} \\right)';
  assert.equal(run([b], 'P \\left( X = 5 \\right)'), '=63/256');
  assert.equal(run([b], 'P \\left( X = 5 \\right)', {fmt: 'dec'}), '=≈0.24609375'.replace('≈', '') .replace('=', '=') );
  assert.equal(run([b], 'E \\left( X \\right)'), '=5');
  assert.equal(run([b], 'V \\left( X \\right)'), '=5/2');
  assert.equal(run(['X \\sim P \\left( 3 \\right)'], 'P \\left( X = 2 \\right)'), '=9/2·e^(-3) ≈0.2240418077');
  assert.equal(run(['X \\sim N \\left( 100 , 15 \\right)'], 'P \\left( X \\le 115 \\right)'), '=≈0.8413447461');
  assert.equal(run([], 'C \\left( 10 , 3 \\right)'), '=120');
  assert.equal(run([], 'P \\left( X = 2 \\right)', {}, true), '= unsupported');       // X was never declared
  assert.equal(run([b], b), null);
});
test('differential equations through the calculator', () => {
  assert.equal(run([], '{ y } ^ { \\prime } = x y , y \\left( 0 \\right) = 2'), 'y=2·e^((1/2)x^2)');
  assert.equal(run([], '{ y } ^ { \\prime \\prime } + y = 0 , y \\left( 0 \\right) = 1 , { y } ^ { \\prime } \\left( 0 \\right) = 0'), 'y=cos(x)');
  assert.equal(run([], '{ y } ^ { \\prime } + y = \\sin x , y \\left( 0 \\right) = 1', {}, true), '= unsupported');
});
test('in on-demand mode nothing is computed until the line ends with =', () => {
  const f = 'f \\left( x \\right) = 2 x';
  assert.equal(run([f], 'f \\left( 3 \\right)', {mode: 'demand'}), null);
  assert.equal(run([f], 'f \\left( 3 \\right)', {mode: 'demand'}, true), '6');
});
