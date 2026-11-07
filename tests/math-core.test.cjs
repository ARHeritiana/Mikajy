'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const MathCore = require('../web/math-core.js');
const v = (tokens, settings) => MathCore.evaluate(tokens, settings).value;
const solve = (left, right) => MathCore.solve(left, right);
const within = (actual, expected, tolerance = 1e-11) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
const fails = (fn, code) => assert.throws(fn, e => e instanceof MathCore.MathError && e.code === code);

test('operator precedence, right associativity, and unary minus', () => {
  assert.equal(v(['2','+','3','*','4']),14);
  assert.equal(v(['-','2','^','(','2',')']),-4);
  assert.equal(v(['(','-','2',')','^','(','2',')']),4);
  assert.equal(v(['2','^','(','3','^','(','2',')',')']),512);
  assert.equal(v(['2','^','(','0',')']),1); // exponent 0 is NOT a degree sign
  assert.equal(v(['-','2','^','(','-','2',')']),-.25);
  assert.equal(v(['2','(','3','+','4',')']),14);
  assert.equal(v(['5','!']),120);
  assert.equal(v(['50','+','10','%']),55); // documented percentage-increase convention
});
test('rational exactness, decimal mode, and angle settings', () => {
  const r = MathCore.evaluate(['1','/','3']);
  assert.equal(r.rational.n,1n); assert.equal(r.rational.d,3n);
  assert.equal(MathCore.exactDecimal(r.rational),false);
  assert.equal(MathCore.exactDecimal(MathCore.evaluate(['3','/','4']).rational),true);
  within(v(['sin','(','30',')'],{angle:'deg'}),.5);
  within(v(['sin','(','30',')'],{angle:'rad'}),Math.sin(30));
  within(v(['asin','(','.5',')'],{angle:'deg'}),30);
  within(v(['sin','^','(','-','1',')','(','.5',')'],{angle:'deg'}),30);
  within(v(['√','(','9',')']),3);
});
test('domain checks and input validation', () => {
  for(const tokens of [['1','/','0'], ['0','^','(','0',')'], ['0','^','(','-','1',')'],
    ['√','(','-','1',')'], ['ln','(','0',')'], ['log','(','-','2',')'],
    ['asin','(','2',')'], ['(','-','1',')','^','(','.5',')'],
    ['tan','(','90',')']]) {
    fails(()=>v(tokens,{angle:'deg'}),'undefined');
  }
  fails(()=>v(['2','/','3','x']),'unsupported');
  fails(()=>v(['1','+','(','2']),'syntax');
  fails(()=>v(['1','+','+']),'syntax');
  fails(()=>v(['1','/','(','2','-','2',')']),'undefined');
  fails(()=>v(['1','.','2']),'syntax');
  fails(()=>v(['Σ','(','x',')']),'unsupported');
});
test('verified polynomial roots including repeated roots and irrational roots', () => {
  const r1 = solve(['2','x','+','3'],['7']);
  assert.deepEqual(r1.roots.map(x=>x.value),[2]);
  const r2 = solve(['(','x','-','1',')','^','(','2',')'],['0']);
  assert.equal(r2.kind,'roots'); assert.deepEqual(r2.roots.map(x=>x.value),[1]);
  const r3 = solve(['x','^','(','2',')'],['2']);
  within(r3.roots[0].value,-Math.SQRT2); within(r3.roots[1].value,Math.SQRT2);
  assert.equal(r3.roots[0].rational,null);
  assert.equal(solve(['x','^','(','2',')','+','1'],['0']).kind,'none');
  assert.equal(solve(['x','-','x'],['0']).kind,'identity');
  assert.equal(solve(['0','x'],['1']).kind,'none');
});
test('never identify identities by numerical sampling or cross singularities', () => {
  fails(()=>solve(['sin','(','π','x',')'],['0']),'unsupported');
  fails(()=>solve(['x','/','x'],['1']),'unsupported');
  // x²/(x−1)=0 has the single solution x=0 (x=1 is excluded by the denominator)
  assert.deepEqual(solve(['(','x','^','(','2',')',')','/','(','x','-','1',')'],['0']).roots.map(r=>r.value),[0]);
  fails(()=>solve(['x','^','(','0',')'],['1']),'unsupported');
  assert.deepEqual(solve(['x','^','(','4',')'],['16']).roots.map(r=>r.value),[-2,2]); // every real root, never one
  fails(()=>solve(['1'],['1']),'unsupported');
});
test('polynomial coefficients handled exactly without floating point identity guesses', () => {
  assert.equal(solve(['x','/','3','+','x','/','3','+','x','/','3'],['x']).kind,'identity');
  const r = solve(['0.1','x'],['0.3']);
  assert.equal(r.roots[0].value,3);
  assert.equal(r.roots[0].rational.n,3n);
});

test('trigonometric rounding noise is removed but real small values survive', () => {
  assert.equal(v(['sin', '(', '180', ')'], {angle: 'deg'}), 0);
  assert.equal(v(['sin', '(', '360', ')'], {angle: 'deg'}), 0);
  assert.equal(v(['cos', '(', '90', ')'], {angle: 'deg'}), 0);
  assert.equal(v(['sin', '(', 'π', ')'], {angle: 'rad'}), 0);
  assert.equal(v(['cos', '(', 'π', '/', '2', ')'], {angle: 'rad'}), 0);
  within(v(['sin', '(', '30', ')'], {angle: 'deg'}), 0.5);
  within(v(['sin', '(', '.0000001', ')'], {angle: 'rad'}), 1e-7, 1e-20); // small argument: value is real
  within(v(['cos', '(', '60', ')'], {angle: 'deg'}), 0.5);
});
test('hostile input stays bounded', () => {
  const deep = [...Array(70).fill('('), '1', ...Array(70).fill(')')];
  fails(() => v(deep), 'unsupported');
  fails(() => v(Array(200).fill('1')), 'unsupported');
  assert.throws(() => v('not-an-array'), MathCore.MathError);
  fails(() => v(['9', '!', '!', '!', '!']), 'undefined'); // 9!!!! overflows the factorial domain
});
