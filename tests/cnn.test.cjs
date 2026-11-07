'use strict';
// The shipped model is float16 (web/model/model4.f16.json), packed from the float32 checkpoint
// by training/pack_model.py. These tests guard that the packing is faithful and the CNN is sound.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const template = read('web/core_cnn.js');
const load = model => new Function(template.replace('/*MODEL*/', model) + ';return predict')();
const f16 = load(read('web/model/model4.f16.json'));
const f32 = load(read('training/model4.json'));
const classes = JSON.parse(read('web/model/model4.f16.json')).cls;

// Deterministic pseudo-random "handwriting": a few thick random-walk strokes on a 28x28 grid.
function probes(n) {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  return Array.from({length: n}, () => {
    const x = new Float32Array(784);
    for (let s = 0, strokes = 1 + Math.floor(rnd() * 3); s < strokes; s++) {
      let a = 4 + rnd() * 20, b = 4 + rnd() * 20;
      for (let t = 0; t < 30; t++) {
        a += rnd() * 3 - 1.5; b += rnd() * 3 - 1.5;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const i = Math.round(b + dy), j = Math.round(a + dx);
          if (i >= 0 && i < 28 && j >= 0 && j < 28) x[i * 28 + j] = Math.max(x[i * 28 + j], 1 - .3 * (Math.abs(dx) + Math.abs(dy)));
        }
      }
    }
    return x;
  });
}
const argmax = p => p.indexOf(Math.max(...p));

test('predict returns a plain probability array over every class', () => {
  const p = f16(probes(1)[0]);
  assert.ok(Array.isArray(p), 'callers use Array.prototype.map to build {c, p} objects');
  assert.equal(p.length, classes.length);
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-5);
  assert.ok(p.every(v => v >= 0 && v <= 1));
});

test('float16 weights track the float32 checkpoint (top-1 identical, probabilities within 2e-3)', () => {
  let worst = 0;
  for (const x of probes(150)) {
    const a = f32(x), b = f16(x);
    assert.equal(argmax(b), argmax(a));
    for (let k = 0; k < a.length; k++) worst = Math.max(worst, Math.abs(a[k] - b[k]));
  }
  assert.ok(worst < 2e-3, `max probability change ${worst}`);
});

test('predict is repeatable (shared scratch buffers are fully overwritten)', () => {
  const [x, y] = probes(2);
  const first = f16(x);
  f16(y);
  assert.deepEqual(f16(x), first);
});
