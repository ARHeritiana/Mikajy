const test = require('node:test'), assert = require('node:assert');
const T = require('../web/typeset.js');
const j = s => (T.tokens(s) || []).join(' ');
test('fractions stack', () => assert.equal(j('√2/2'), '\\frac { \\sqrt { 2 } } { 2 }'));
test('rational coefficient folds', () => assert.equal(j('(1/2)·(2-2·√6)'), '\\frac { 2 - 2 \\sqrt { 6 } } { 2 }'));
test('constants first, root bar over radicand', () => assert.equal(j('-√6+1'), '1 - \\sqrt { 6 }'));
test('powers raise', () => assert.equal(j('e^(-2·x)'), '{ e } ^ { - 2 x }'));
test('half powers become roots', () => assert.equal(j('x^(1/2)'), '\\sqrt { x }'));
test('unparsable gives null', () => assert.equal(T.tokens('@@'), null));
