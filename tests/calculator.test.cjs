'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Calculator = require('../web/calculator.js');
const compute = (tokens, set = {}, eq = false) => Calculator.compute(tokens, {mode:'instant', angle:'rad', fmt:'dec', ...set}, eq);

test('exact vs approximate output is explicit', () => {
  assert.equal(compute(['2','+','3']).text,'=5');
  assert.equal(compute(['1','/','3']).text.startsWith('=≈0.333333'),true);
  assert.equal(compute(['1','/','3'],{fmt:'frac'}).text,'=1/3');
  assert.equal(compute(['7','/','4'],{fmt:'mixed'}).text,'=1 3/4');
  assert.equal(compute(['√','(','9',')']).text,'=3');
  assert.equal(compute(['π']), null); // see singleton/no-equals behavior below
});
test('deferred mode, setting changes and user-visible errors', () => {
  assert.equal(compute(['2','+','3'], {mode:'demand'}),null);
  assert.equal(compute(['2','+','3'], {mode:'demand'}, true).text,'5');
  assert.equal(compute(['1','/','0'], {}, true).text,'= undefined');
  assert.equal(compute(['1','/','0']),null);
  assert.equal(compute(['Σ','(','x',')'],{},true).text,'= unsupported');
  assert.equal(compute(['2','+','('],{},true),null);
  assert.equal(compute(['sin','(','30',')'], {angle:'deg'}).text,'=≈0.5');
});
test('equation rendering and no false exactness', () => {
  assert.equal(compute(['2','x','+','3','=','7']).text,'x=2');
  assert.equal(compute(['(','x','-','1',')','^','(','2',')','=','0']).text,'x=1');
  assert.equal(compute(['x','^','(','2',')','=','2']).text.includes('≈1.414'),true);
  assert.equal(compute(['x','-','x','=','0']).text,'x∈ℝ');
  assert.equal(compute(['x','^','(','2',')','+','1','=','0']).text,'S=∅');
  assert.equal(compute(['x','/','x','=','1']).text,'= unsupported');
});
