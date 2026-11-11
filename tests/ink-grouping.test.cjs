'use strict';
// Grouping strokes into symbols must not depend on the order the strokes were drawn in (web/recognizer.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../web/recognizer.js');

const dash = (x, y, w = 36) => [[x, y], [x + w / 2, y], [x + w, y]];
const stem = (x, y, h = 40) => [[x, y], [x, y + h / 2], [x, y + h]];
const dot = (x, y) => [[x, y], [x + 2, y + 2]];
const sets = G => G.map(g => g.s);

test('the two bars of = form one symbol even when another character is drawn between them', () => {
  const first = dash(20, 50), other = stem(160, 35), later = dash(20, 62);
  const G = R.groupStrokes([first, other, later]);
  assert.equal(G.length, 2);
  assert.deepEqual(sets(G), [[first, later], [other]]);
});

test('2 = 3 written bar, digit, bar, digit groups the same as in drawing order', () => {
  const two = stem(0, 40), top = dash(30, 55), three = stem(100, 40), bottom = dash(30, 67);
  const G = R.groupStrokes([two, top, three, bottom]);
  assert.deepEqual(sets(G), [[two], [top, bottom], [three]]);
});

test('a plus and a dotted i group whatever the stroke order', () => {
  const across = dash(20, 75), down = stem(38, 55), i = stem(120, 50), point = dot(119, 38);
  for (const order of [[point, across, i, down], [down, i, across, point], [i, point, down, across]]) {
    const G = R.groupStrokes(order);
    assert.equal(G.length, 2, `order ${order.indexOf(point)}`);
    assert.ok(G.every(g => g.s.length === 2));
  }
});

test('the dots of ÷ join their bar, including when the bar is drawn last', () => {
  const bar = dash(10, 55, 40), above = dot(29, 42), below = dot(29, 68);
  for (const order of [[above, below, bar], [bar, above, below], [above, bar, below]]) {
    const G = R.groupStrokes(order);
    assert.equal(G.length, 1);
    assert.equal(G[0].s.length, 3);
  }
});

test('separate characters stay separate, and each symbol keeps its strokes in drawing order', () => {
  const left = stem(12, 40), right = stem(152, 40), middle = stem(85, 40);
  assert.deepEqual(sets(R.groupStrokes([left, right, middle])), [[left], [right], [middle]]);
  const a = dash(20, 50), b = dash(20, 62);
  assert.deepEqual(sets(R.groupStrokes([b, a])), [[b, a]]);
});

test('a radicand that only sits next to a root sign is not merged into it', () => {
  const sign = [[0, 60], [10, 55], [25, 100], [45, 20]];
  sign.vin = {x0: 45, x1: 140};
  const four = stem(70, 40, 50);
  assert.equal(R.groupStrokes([sign, four]).length, 2);
  assert.equal(R.groupStrokes([four, sign]).length, 2);
});

test('the tiny flag is computed for the whole symbol', () => {
  const G = R.groupStrokes([stem(0, 0, 80), dot(200, 40)]);
  assert.deepEqual(G.map(g => g.tiny), [false, true]);
});
