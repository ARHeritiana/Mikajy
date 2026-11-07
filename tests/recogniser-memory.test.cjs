'use strict';
// Characterisation tests for the personalisation (kNN) layer of web/core_main.js.
// The file is a browser script, so it is evaluated in a vm sandbox with a stubbed DOM/localStorage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Store = require('../web/storage.js');

const CLASSES = ['0', '1', '2', 'a', 'd'];            // 'd' is a hidden legacy class
const source = fs.readFileSync(path.join(__dirname, '../web/core_main.js'), 'utf8');

function sandbox(initial = {}) {
  const data = {...initial};
  const localStorage = {getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); }, removeItem: k => { delete data[k]; }};
  const ctx2d = {};
  const document = {createElement: () => ({getContext: () => ctx2d})};
  const api = vm.runInNewContext(
    `${source}\n;({loadMem, classifyP, remember, mem: () => MEM})`,
    {document, localStorage, Store, CLS: CLASSES, Math, Array, Float32Array, Uint8Array, Set, Object}
  );
  return {api, data};
}
const bytes = seed => Uint8Array.from({length: 784}, (_, i) => (i * seed + seed) % 256);
const image = seed => Float32Array.from(bytes(seed), v => v / 255);
// Reference implementation of the original (pre-optimisation) scoring formula.
function reference(p, x, samples) {
  const nrm = v => Math.hypot(...v) || 1;
  p = p.slice();
  if (samples.length) {
    const nx = nrm(x), b = new Array(p.length).fill(0);
    for (const m of samples) {
      const n = nrm(Array.from(m.v, t => t / 255));
      let d = 0;
      for (let i = 0; i < 784; i++) d += x[i] * m.v[i] / 255;
      d /= nx * n;
      const k = CLASSES.indexOf(m.c);
      if (d > b[k]) b[k] = d;
    }
    let s = 0;
    for (let k = 0; k < p.length; k++) { p[k] += 3 * Math.max(0, b[k] - .75); s += p[k]; }
    for (let k = 0; k < p.length; k++) p[k] /= s;
  }
  return p.map((v, i) => ({c: CLASSES[i], p: v})).filter(o => !['d', 'm', '∫', 'Σ', '→', '∞'].includes(o.c)).sort((u, v) => v.p - u.p).slice(0, 5);
}

test('classifyP without samples ranks by CNN probability and hides legacy classes', () => {
  const {api} = sandbox();
  api.loadMem(CLASSES);
  const out = api.classifyP([.1, .2, .3, .1, .3], image(3));
  assert.deepEqual(out.map(o => o.c), ['2', '1', '0', 'a']);
});

test('classifyP with samples matches the original scoring formula', () => {
  const samples = [{c: '1', v: bytes(5)}, {c: 'a', v: bytes(9)}, {c: '1', v: bytes(11)}];
  const {api} = sandbox({ink4: JSON.stringify(samples.map(s => ({c: s.c, v: Buffer.from(s.v).toString('base64')})))});
  api.loadMem(CLASSES);
  for (const seed of [5, 9, 13, 21]) {
    const p = [.3, .1, .25, .2, .15], x = image(seed);
    const got = api.classifyP(p.slice(), x), want = reference(p, x, samples);
    assert.deepEqual(got.map(o => o.c), want.map(o => o.c));
    got.forEach((o, i) => assert.ok(Math.abs(o.p - want[i].p) < 1e-5, `seed ${seed}: ${o.p} vs ${want[i].p}`));
  }
});

test('a remembered sample boosts its class and is persisted in the packed format', () => {
  const {api, data} = sandbox();
  api.loadMem(CLASSES);
  const x = image(7), p = [.3, .3, .1, .3, 0];
  const before = api.classifyP(p.slice(), x).find(o => o.c === '2').p;
  api.remember(x, '2');
  assert.ok(api.classifyP(p.slice(), x).find(o => o.c === '2').p > before);
  assert.equal(JSON.parse(data.ink4).length, 1);
  assert.equal(typeof JSON.parse(data.ink4)[0].v, 'string');
  assert.equal(data.ink3, undefined);
});

test('legacy samples are loaded and migrated; the memory is capped at 400', () => {
  const legacy = [{c: '0', v: Array.from(bytes(4))}];
  const {api, data} = sandbox({ink3: JSON.stringify(legacy)});
  api.loadMem(CLASSES);
  assert.equal(api.mem().length, 1);
  for (let i = 0; i < 405; i++) api.remember(image(i + 1), '1');
  assert.equal(api.mem().length, 400);
  assert.equal(JSON.parse(data.ink4).length, 400);
  assert.equal(data.ink3, undefined);
});

test('corrupt stored samples are ignored instead of throwing', () => {
  const {api} = sandbox({ink4: '[{"c":"0","v":"AAAA"},null,"x",{"c":"zz","v":[]}]'});
  assert.doesNotThrow(() => api.loadMem(CLASSES));
  assert.equal(api.mem().length, 0);
});
