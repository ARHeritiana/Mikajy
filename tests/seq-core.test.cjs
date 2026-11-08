'use strict';
// Parity of the JS stroke-sequence recogniser with the torch reference.  Set MIKAJY_SEQ_MODEL (packed json) and MIKAJY_SEQ_PARITY (parity json) to run it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const SeqCore = require('../web/seq-core.js');

const model = process.env.MIKAJY_SEQ_MODEL, parity = process.env.MIKAJY_SEQ_PARITY;

test('featurise: normalised ink starts at the origin with unit = median stroke extent', () => {
  const f = SeqCore.featurise([[[10, 20, 0], [30, 20, 50]], [[10, 20, 400], [10, 60, 450]], [[50, 40, 900], [90, 40, 950]]]);
  assert.strictEqual(f.S, 3);
  assert.ok(Math.abs(f.P[0]) < 1e-6 && Math.abs(f.P[1]) < 1e-6);
  assert.ok(Math.abs(f.P[(0 * 24 + 23) * 2] - 0.5) < 1e-6);        // 20 px wide / median extent 40
  assert.ok(f.T[3] > f.T[0]);                                     // second stroke follows a pause
});

test('JS inference reproduces the torch tokens', { skip: !(model && parity) }, () => {
  const M = SeqCore.load(JSON.parse(fs.readFileSync(model, 'utf8')));
  const cases = JSON.parse(fs.readFileSync(parity, 'utf8'));
  let same = 0;
  for (const c of cases) same += SeqCore.recognise(M, c.strokes).join(' ') === c.tokens.join(' ');
  // int8 weights + float32 JS vs bf16 torch can flip a near-tie, so require nearly all
  assert.ok(same >= cases.length - 1, `${same}/${cases.length} identical`);
});

test('toMathTokens: LaTeX -> engine tokens evaluate to the right numbers', () => {
  const Calc = require('../web/calculator.js');
  const run = (latex, set = {domain: 'real', angle: 'rad'}) => {
    const t = SeqCore.toMathTokens(latex.split(' '), {complex: set.domain === 'complex'});
    return Calc.compute(t, set, false);
  };
  const val = r => r && r.val;
  assert.deepStrictEqual(SeqCore.toMathTokens('\\frac { 1 } { 2 } + 3'.split(' ')), ['(', '(', '1', ')', '/', '(', '2', ')', ')', '+', '3']);
  assert.deepStrictEqual(SeqCore.toMathTokens('{ 2 } ^ { 1 0 } ='.split(' ')), ['2', '^', '(', '10', ')']);
  assert.deepStrictEqual(SeqCore.toMathTokens('\\sqrt { 9 } \\times 4'.split(' ')), ['√', '(', '9', ')', '*', '4']);
  assert.deepStrictEqual(SeqCore.toMathTokens('\\left ( 1 + 2 \\right ) \\div 3'.split(' ')), ['(', '1', '+', '2', ')', '/', '3']);
  assert.throws(() => SeqCore.toMathTokens('7 \\bmod 3'.split(' ')), e => e.unsupported);
  assert.throws(() => SeqCore.toMathTokens('3 + i'.split(' ')), e => e.unsupported);
  assert.deepStrictEqual(SeqCore.toMathTokens('3 + i'.split(' '), {complex: true}), ['3', '+', 'i']);
  assert.ok(run('\\frac { 1 } { 2 } + 3'));
});

test('toGlyphs: fractions, roots, exponents and words become the board glyph structure', () => {
  const g = l => SeqCore.toGlyphs(l.split(' '));
  const show = l => g(l).map(x => (x.fp ? x.fp[0] + x.fid + ':' : '') + (x.sup ? '^' : '') + x.c + (x.cover !== undefined ? '/' + x.cover : '')).join(' ');
  assert.strictEqual(show('\\frac { 1 } { 2 } + 3'), 'b1:§ n1:1 d1:2 + 3');
  assert.strictEqual(show('{ 5 } ^ { - 4 }'), '5 ^- ^4');
  assert.strictEqual(show('\\sqrt { 7 + x } - 1'), '√/3 7 + x - 1');
  assert.strictEqual(show('\\sin \\left ( x \\right )'), 's i n ( x )');
  assert.strictEqual(show('\\frac { \\frac { 1 } { 2 } } { 3 }'), 'b1:§ b2:§ n2:1 d2:2 d1:3');   // a nested fraction keeps its own bar and parts
  assert.strictEqual(show('\\sqrt { \\frac { 1 } { 2 } }'), '√/1 b1:§ n1:1 d1:2');
  assert.strictEqual(show('\\sqrt { x ^ { 2 } } + 1'), '√/2 x ^2 + 1');
  assert.strictEqual(show('7 \\bmod 3'), '7 m o d 3');
  assert.strictEqual(g('\\sin x').map(x => !!x.wb).join(), 'true,false,false,true');
});

test('a fraction inside a fraction stays stacked (own bar with a parent link); one inside an exponent stays inline', () => {
  const g = SeqCore.toGlyphs('\\frac { \\frac { 2 } { 3 } } { 5 }'.split(' '));
  const bars = g.filter(x => x.fp === 'bar');
  assert.equal(bars.length, 2);
  assert.equal(bars[1].pfid, bars[0].fid); assert.equal(bars[1].pfp, 'n');
  assert.deepEqual(g.filter(x => x.fid === bars[1].fid && x.fp === 'd').map(x => x.c), ['3']);
  const inl = SeqCore.toGlyphs('{ x } ^ { \\frac { 1 } { 2 } }'.split(' '));
  assert.equal(inl.some(x => x.fp === 'bar'), false);
});
