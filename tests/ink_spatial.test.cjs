'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../web/recognizer.js');

const dash = (x, y, w = 36) => [[x, y], [x + w, y]];
const stem = (x, y, h = 40) => [[x, y], [x, y + h]];
const dot = (x, y) => [[x, y], [x + 2, y + 2]];

test('two strokes of an equals sign group even with another character drawn in between', () => {
  const first = dash(20, 50), later = dash(20, 62), other = stem(160, 35);
  const groups = R.groupStrokes([first, other, later]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].s, [first, later]);
  assert.deepEqual(groups[1].s, [other]);
});

test('spatial grouping handles a plus and a dotted i independent of stroke order', () => {
  const horizontal = dash(20, 75), vertical = stem(38, 55), i = stem(120, 50);
  const point = dot(119, 35);
  const groups = R.groupStrokes([point, horizontal, i, vertical]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].s.length, 2);
  assert.equal(groups[1].s.length, 2);
});

test('division dots merge into the horizontal bar, including when the bar is drawn last', () => {
  const bar = dash(10, 55, 40), up = dot(29, 42), below = dot(29, 70);
  const groups = R.groupStrokes([up, below, bar]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].s.length, 3);
});

test('fraction bar does not absorb numerator and denominator', () => {
  const bar = dash(10, 100, 100), numerator = stem(60, 45, 40);
  const denominator = stem(60, 120, 40);
  assert.equal(R.groupStrokes([numerator, bar, denominator]).length, 3);
});

test('separate characters remain distinct and are sorted spatially, not chronologically', () => {
  const left = stem(12, 40), right = stem(152, 40), middle = stem(85, 40);
  const groups = R.groupStrokes([left, right, middle]);
  assert.deepEqual(groups.map(g => g.s[0]), [left, middle, right]);
});

test('a late stroke can reopen a recognized symbol using retained raw ink', () => {
  const top = dash(20, 50);
  const old = {c: [{c: '-', p: .99}], i: 0, raw: [top], b: R.extent(top)};
  assert.equal(R.reopenCandidate(dash(20, 62), [old]), old);
  assert.equal(R.reopenCandidate(dash(180, 62), [old]), null);
});

test('late character insertions are not swallowed by a neighboring recognized glyph', () => {
  const one = stem(20, 40), three = stem(130, 40);
  const glyphs = [one, three].map(s => ({raw: [s], b: R.extent(s)}));
  assert.equal(R.reopenCandidate(stem(80, 40), glyphs), null);
});

test('explicit user correction is never silently undone by stroke reopening', () => {
  const top = dash(20, 50), g = {raw: [top], b: R.extent(top), locked: true};
  assert.equal(R.reopenCandidate(dash(20, 62), [g]), null);
});

test('legacy glyphs without retained raw ink are not reopened or removed', () => {
  const g = {ink: null, b: R.extent(dash(20, 50))};
  assert.equal(R.reopenCandidate(dash(20, 62), [g]), null);
});
