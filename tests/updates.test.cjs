'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Updates = require('../web/updates.js');
const R = Updates.RELEASES;

test('versions compare numerically, not as text', () => {
  assert.deepEqual(Updates.parseVersion('v5.10.2'), [5, 10, 2]);
  assert.deepEqual(Updates.parseVersion('5.0'), [5, 0, 0]);
  for (const bad of ['', 'latest', 'v5', 'v5.x', '5.1.2.3', null, undefined, 7]) assert.equal(Updates.parseVersion(bad), null);
  assert.equal(Updates.isNewer('v5.10', '5.9'), true);
  assert.equal(Updates.isNewer('v5.0.1', '5.0'), true);
  assert.equal(Updates.isNewer('v5.0', '5.0'), false);
  assert.equal(Updates.isNewer('v4.9', '5.0'), false);
  assert.equal(Updates.isNewer('garbage', '5.0'), false);
  assert.equal(Updates.isNewer('v9.0', 'garbage'), false);   // unknown local version: never nag
});

test('shell answers are interpreted conservatively', () => {
  const ok = {ok: true, tag: 'v5.1', url: R + 'tag/v5.1', apk: R + 'download/v5.1/Mikajy-5.1.apk'};
  assert.deepEqual(Updates.interpret(ok, '5.0'), {status: 'available', version: '5.1', url: ok.url, apk: ok.apk});
  assert.equal(Updates.interpret(ok, '5.1').status, 'current');
  assert.equal(Updates.interpret(ok, '6.0').status, 'current');
  assert.equal(Updates.interpret({ok: false, reason: 'offline'}, '5.0').status, 'offline');
  assert.equal(Updates.interpret({ok: false, reason: 'error'}, '5.0').status, 'error');
  assert.equal(Updates.interpret(null, '5.0').status, 'error');
  assert.equal(Updates.interpret({ok: true, tag: 'nightly'}, '5.0').status, 'error');
  // Links pointing anywhere but this project's releases are replaced, never followed.
  const evil = Updates.interpret({...ok, url: 'https://evil.example/x', apk: 'javascript:alert(1)'}, '5.0');
  assert.equal(evil.url, R + 'latest'); assert.equal(evil.apk, '');
  assert.equal(Updates.interpret({...ok, url: R + '../../evil'}, '5.0').url, R + 'latest');
});

test('stored state is validated and automatic checks are rate limited', () => {
  const day = Updates.INTERVAL_MS, now = 10 * day;
  assert.equal(Updates.shouldCheck({checked: 0}, now, 'auto'), true);
  assert.equal(Updates.shouldCheck({checked: now - day / 2}, now, 'auto'), false);
  assert.equal(Updates.shouldCheck({checked: now - day}, now, 'auto'), true);
  assert.equal(Updates.shouldCheck({checked: now + day}, now, 'auto'), true);       // clock moved backwards
  assert.equal(Updates.shouldCheck({checked: 0}, now, 'off'), false);
  const hostile = Updates.validate({checked: 'x', version: '<b>9.9</b>', url: 'http://evil', apk: {}});
  assert.deepEqual(hostile, {checked: 0, version: '', url: '', apk: ''});
  const storage = {d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }};
  const st = Updates.record({}, {status: 'available', version: '5.1', url: R + 'latest', apk: ''}, 123);
  assert.equal(Updates.save(storage, st), true);
  assert.deepEqual(Updates.load(storage), st);
  assert.equal(Updates.pending(st, '5.0').version, '5.1');
  assert.equal(Updates.pending(st, '5.1'), null);                                    // installed: banner disappears
  assert.deepEqual(Updates.record(st, {status: 'current', version: '5.1'}, 456), {checked: 456, version: '', url: '', apk: ''});
  storage.d.inkupd = '{broken'; assert.equal(Updates.load(storage).checked, 0);
});
