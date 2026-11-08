'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../web/storage.js');

const mem = (data) => ({data, getItem() { return this.data; }, setItem(k, v) { this.data = v; }});
const sample = (c = 'a') => ({c, v: Array.from({length: 784}, (_, i) => i % 256)});

test('loadArray survives missing, corrupt and non-array storage', () => {
  assert.deepEqual(Store.loadArray(mem(null), 'k'), []);
  assert.deepEqual(Store.loadArray(mem('{'), 'k'), []);
  assert.deepEqual(Store.loadArray(mem('{"a":1}'), 'k'), []);
  assert.deepEqual(Store.loadArray(undefined, 'k'), []);
  assert.deepEqual(Store.loadArray(mem('[1,2]'), 'k'), [1, 2]);
});
test('save reports quota / access failures instead of throwing', () => {
  assert.equal(Store.save(mem(null), 'k', [1]), true);
  assert.equal(Store.save({setItem() { throw new Error('quota'); }}, 'k', [1]), false);
  assert.equal(Store.save(undefined, 'k', [1]), true); // optional chaining: nothing to write, nothing to fail
});
test('memory chips keep only plain decimal numbers, at most 12', () => {
  const chips = Store.cleanChips(['1', '-2.5', '1e+21', 'x', 7, null, '1'.repeat(30), '.5']);
  assert.deepEqual(chips, ['1', '-2.5']);
  assert.equal(Store.cleanChips(Array.from({length: 40}, (_, i) => String(i))).length, 12);
});
test('personalisation samples are validated for class, length and byte range', () => {
  const good = sample('a');
  const out = Store.cleanSamples([good, sample('Z'), {c: 'a', v: [1, 2]}, {c: 'a', v: good.v.map(() => 999)}, null, 'x'], ['a', 'b']);
  assert.equal(out.length, 1);
  assert.equal(out[0].c, 'a');
  assert.equal(Store.cleanSamples(Array.from({length: 450}, () => sample('a')), ['a']).length, 400);
});
test('samples accept the packed (base64) and the legacy (array) format and round-trip losslessly', () => {
  const bytes = Uint8Array.from({length: 784}, (_, i) => (i * 7) % 256);
  const store = {d: {ink3: JSON.stringify([{c: 'a', v: Array.from(bytes)}])},
    getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, removeItem(k) { delete this.d[k]; }};
  const loaded = Store.loadSamples(store, ['a']);
  assert.equal(loaded.length, 1);
  assert.deepEqual(Array.from(loaded[0].v), Array.from(bytes));
  assert.equal(Store.saveSamples(store, loaded), true);
  assert.equal(store.d.ink3, undefined, 'legacy key is removed after migration');
  assert.ok(store.d.ink4.length < 1200, 'packed form is ~1 KB per sample');
  assert.deepEqual(Array.from(Store.loadSamples(store, ['a'])[0].v), Array.from(bytes));
  assert.equal(Store.cleanSamples([{c: 'a', v: 'not-base64'}, {c: 'a', v: 'A'.repeat(1048)}], ['a']).length, 0);
});
test('history entries are rebuilt field by field', () => {
  const ok = {id: 'a-1', ts: 1, F: 70, ans: '=5', text: '2+3', syms: [{c: '2', fid: 7, fp: 'n', evil: 1}, {c: '+'}]};
  const [h] = Store.cleanHistory([ok, {id: 5}, null, {...ok, syms: []}, {...ok, id: 'b', syms: [{c: 'toolong'}]}, {...ok, id: 'c', ans: 'x'.repeat(500)}]);
  assert.equal(Store.cleanHistory([ok]).length, 1);
  assert.deepEqual(h.syms[0], {c: '2', sup: 0, fp: 'n', fid: '7', cover: 0, pfid: '', pfp: '', br: ''});
  assert.equal('evil' in h.syms[0], false);
  assert.equal(Store.cleanHistory([{...ok, F: 99999}])[0].F, 400);
  assert.equal(Store.cleanHistory(Array.from({length: 300}, (_, i) => ({...ok, id: 'i' + i}))).length, 100);
});
test('plainNumber refuses exponent notation and non-finite values', () => {
  assert.equal(Store.plainNumber(0.1 + 0.2), '0.3');
  assert.equal(Store.plainNumber(-42), '-42');
  assert.equal(Store.plainNumber(1e21), null);
  assert.equal(Store.plainNumber(1e-7), null);
  assert.equal(Store.plainNumber(NaN), null);
  assert.equal(Store.plainNumber(Infinity), null);
  assert.equal(Store.plainNumber(1e-13), '0');
});
