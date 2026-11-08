'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const SettingsStore = require('../web/settings.js');
test('settings are validated independently of the UI and survive corrupted storage', () => {
  const storage = {
    data: '{"angle":"deg","theme":"light","fmt":"bad","__proto__":123}',
    getItem() {return this.data;}, setItem(k,v) {this.data=v;}
  };
  const v = SettingsStore.load(storage);
  assert.deepEqual(v,{mode:'instant',angle:'deg',fmt:'frac',theme:'light',updates:'auto',domain:'real',recogniser:'seq'});
  assert.equal(SettingsStore.save(storage,{...v,mode:'demand'}),true);
  assert.equal(SettingsStore.load(storage).mode,'demand');
  storage.data='{'; assert.equal(SettingsStore.load(storage).theme,'dark');
  assert.deepEqual(SettingsStore.validate(null),SettingsStore.validate({}));
  assert.equal(SettingsStore.validate({domain:'complex'}).domain,'complex');
  assert.equal(SettingsStore.validate({domain:'quaternion'}).domain,'real');
});
