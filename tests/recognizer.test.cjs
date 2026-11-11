'use strict';
// Behavioural tests for web/recognizer.js (function words, cursive splitting) and exponent placement (web/ink.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../web/recognizer.js');
const Ink = require('../web/ink.js');

/** A glyph whose candidate list is `cands` ("a:.6,e:.3"), drawn in a box at (x, base) with the given height. */
function glyph(cands, x, base, h, w = h * .7) {
  const c = cands.split(',').map(t => { const [k, p] = t.split(':'); return {c: k, p: +p}; });
  return {c, i: 0, b: {x0: x, x1: x + w, y0: base - h, y1: base, w, h}};
}
/** Places the glyphs (left to right) into an expression tree and reads it: exponents come out marked with ^. */
const run = A => {
  const seq = [];
  for (const g of A) Ink.insert(seq, Object.assign(g, {t: 'g', raw: g.b}), 60);
  Ink.readAll(seq, false);
  const out = [], emit = (s, up) => s.forEach(n => n.t === 'sup' ? emit(n.body, true) : out.push(R.ch(n) + (up ? '^' : '')));
  emit(seq, false);
  return out.join(' ');
};

test('exponents: digits raised and smaller are superscripts, text back on the line is not', () => {
  const two = glyph('2:.95', 0, 100, 50), three = glyph('3:.95', 40, 70, 28);
  assert.equal(run([two, three]), '2 3^');
  const A = [glyph('2:.95', 0, 100, 50), glyph('3:.95', 40, 70, 28), glyph('+:.95', 80, 90, 30), glyph('1:.95', 120, 100, 50)];
  assert.equal(run(A), '2 3^ + 1');
});

test('exponent of a bracket, a letter with descender, and a negative exponent', () => {
  assert.equal(run([glyph('(:.9', 0, 110, 60, 20), glyph('1:.9', 25, 100, 50), glyph('):.9', 55, 110, 60, 20), glyph('2:.9', 80, 70, 26)]), '( 1 ) 2^');
  const ten = [glyph('1:.95', 0, 100, 50), glyph('0:.95', 35, 100, 50), glyph('-:.9', 70, 62, 4, 18), glyph('3:.95', 95, 72, 28)];
  assert.equal(run(ten), '1 0 -^ 3^');
});

test('exponentials: e^x, e^(2x), cursive e', () => {
  // e is an x-height letter: an exponent of the same size as the e, raised by half the e, is still a power.
  const e = glyph('e:.8,c:.1', 0, 100, 30, 24), x = glyph('*:.9', 30, 78, 20, 18);
  assert.equal(run([e, x]), 'e *^');   // the multiplication-shaped glyph becomes the variable x when tokenised
  const e2 = glyph('e:.8', 0, 100, 30, 24), two = glyph('2:.9', 30, 76, 24, 14), xx = glyph('*:.9', 48, 74, 20, 18);
  assert.equal(run([e2, two, xx]), 'e 2^ *^');
  // A cursive e that the CNN reads as "c" or "o" before a raised exponent is still the constant e.
  const odd = glyph('o:.55,e:.3', 0, 100, 30, 24), sup = glyph('2:.9', 30, 76, 24, 14);
  assert.equal(run([odd, sup]), 'e 2^');
  assert.equal(run([glyph('c:.5,e:.35', 0, 100, 30), glyph('+:.9', 40, 90, 30), glyph('1:.9', 80, 100, 50)]), 'e + 1');
});

test('sin², tan⁻¹ keep the function word and raise the exponent', () => {
  const A = [glyph('s:.7', 0, 100, 25), glyph('i:.6,l:.2', 20, 100, 40, 8), glyph('n:.6', 32, 100, 25), glyph('2:.9', 62, 70, 24), glyph('x:.01,*:.9', 90, 100, 26)];
  assert.equal(run(A).startsWith('s i n 2^'.replace(/ /g, ' ')), true);
  assert.equal(A.slice(0, 3).every(g => g.word), true);
});

test('function words: clean, noisy, cursive look-alikes and the unknown letters of exp / sqrt', () => {
  const sin = [glyph('s:.8', 0, 100, 25), glyph('i:.7', 25, 100, 40, 8), glyph('n:.8', 40, 100, 25)];
  assert.equal(run(sin), 's i n');
  assert.deepEqual(sin.map(g => g.word), [true, true, true]);
  // 5 for s, 1 for i: read through look-alikes
  const noisy = [glyph('5:.7,s:.1', 0, 100, 40), glyph('1:.6,i:.2', 25, 100, 40, 8), glyph('n:.8', 40, 100, 25)];
  assert.equal(run(noisy), 's i n');
  // cos with a bracket-looking c
  const cos = [glyph('(:.5,c:.3', 0, 100, 25), glyph('o:.6', 25, 100, 25), glyph('s:.7', 50, 100, 25)];
  assert.equal(run(cos), 'c o s');
  // exp: the x is the multiplication-shaped glyph, p is a g/9
  const exp = [glyph('e:.8', 0, 100, 25), glyph('*:.9', 25, 100, 22, 20), glyph('g:.5,9:.3', 50, 110, 38, 18)];
  assert.equal(run(exp), 'e x p');
  // sqrt written as letters: q ~ g, r ~ n
  const sqrt = [glyph('s:.8', 0, 100, 25), glyph('g:.6', 25, 110, 38), glyph('n:.5,i:.2', 50, 100, 22, 12), glyph('t:.8', 70, 100, 36, 14)];
  assert.equal(run(sqrt), 's q r t');
});

test('words never swallow confidently written digits or operators', () => {
  const digits = [glyph('5:.97', 0, 100, 50), glyph('1:.97', 35, 100, 50), glyph('7:.97', 70, 100, 50)];
  assert.equal(run(digits), '5 1 7');
  const times = [glyph('e:.8', 0, 100, 25), glyph('*:.97', 25, 100, 22, 20), glyph('9:.97', 50, 100, 50)];
  assert.equal(run(times), 'e * 9');   // e × 9, not "exp"
  assert.equal(run([glyph('4:.97', 0, 100, 50), glyph('s:.6,5:.3', 35, 100, 30)]).includes('s'), false); // lone letter becomes a digit
});

test('user-locked glyphs are never rewritten', () => {
  const A = [glyph('5:.7,s:.1', 0, 100, 40), glyph('1:.6,i:.2', 25, 100, 40, 8), glyph('n:.8', 40, 100, 25)];
  A[0].locked = true;
  assert.equal(run(A), '5 1 n');   // the locked 5 blocks "sin"; nothing else is touched
});

// ---- cursive splitting -------------------------------------------------------------------------
/** A connected cursive stroke of `n` humps (letters) of width `w` and height `h`, joined on the baseline. */
function cursive(n, w = 34, h = 40, base = 200, x0 = 20) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const x = x0 + k * (w + 6);
    pts.push([x, base]);                                              // ligature joins at the writing line
    for (let t = 0; t <= 20; t++) {                                   // an arch: up and over, back down to the line
      const a = t / 20 * Math.PI;
      pts.push([x + 6 + (w - 6) * (t / 20), base - h * Math.sin(a)]);
    }
  }
  pts.push([x0 + n * (w + 6), base]);
  return pts;
}
test('a single glyph or a narrow stroke is never cut', () => {
  assert.deepEqual(R.ligatureCuts(cursive(1)), []);
  assert.deepEqual(R.ligatureCuts([[0, 0], [30, 0], [60, 0]]), []);
  const vin = cursive(3); vin.vin = {x0: 0, x1: 10};
  assert.deepEqual(R.ligatureCuts(vin), []);
});
test('a connected 3-letter stroke gets one cut per joint', () => {
  const s = cursive(3), cuts = R.ligatureCuts(s);
  assert.ok(cuts.length >= 2, `cuts: ${cuts}`);
  const xs = cuts.map(k => s[k][0]);
  assert.ok(xs.some(x => Math.abs(x - (20 + 40)) < 8) && xs.some(x => Math.abs(x - (20 + 80)) < 8), xs.join());
});
test('segmentStroke splits when pieces are read confidently or spell a word, and not otherwise', async () => {
  const s = cursive(3);
  // Fake recogniser: a piece that covers exactly one hump is a confident letter; a longer one is a poor guess.
  const classify = async ([piece]) => {
    const w = R.extent(piece).w, mid = (R.extent(piece).x0 + R.extent(piece).x1) / 2;
    if (w < 52) return [{c: 'sin'[Math.min(2, Math.floor((mid - 20) / 40))], p: .9}, {c: '1', p: .05}];
    return [{c: '8', p: .35}, {c: '0', p: .2}];
  };
  const pieces = await R.segmentStroke(s, classify);
  assert.equal(pieces.length, 3);
  assert.equal(pieces.reduce((n, q) => n + q.length, 0) >= s.length, true);
  // If the whole stroke is already a confident single symbol, it stays whole.
  const whole = await R.segmentStroke(s, async ([piece]) => R.extent(piece).w > 100 ? [{c: '8', p: .99}] : [{c: '1', p: .5}]);
  assert.equal(whole.length, 1);
  assert.equal(whole[0], s);
});
