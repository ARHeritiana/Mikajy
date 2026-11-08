'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I18n = require('../web/i18n.js');
const Calculator = require('../web/calculator.js');

test('French has every English key and no leftover placeholders', () => {
  assert.deepEqual(Object.keys(I18n.FR).sort(), Object.keys(I18n.EN).sort());
  for (const [k, v] of Object.entries(I18n.FR)) assert.equal(typeof v, 'string', k);
  assert.equal(I18n.t('fr', 'getUpdate', {v: '6.0'}), 'Obtenir Mikajy 6.0');
  assert.equal(I18n.t('en', 'getUpdate', {v: '6.0'}), 'Get Mikajy 6.0');
});
test('language follows the device unless the user chose one; unknown keys never blank', () => {
  assert.equal(I18n.resolve('auto', 'fr-MG'), 'fr');
  assert.equal(I18n.resolve('auto', 'mg-MG'), 'en');
  assert.equal(I18n.resolve('en', 'fr-FR'), 'en');
  assert.equal(I18n.resolve('xx', undefined), 'en');
  assert.equal(I18n.t('fr', 'nope'), 'nope');
  assert.equal(I18n.t('de', 'done'), 'Done');
});
test('calculator result words follow the interface language', () => {
  const c = (t, lang) => Calculator.compute(t.split(' '), {mode: 'instant', angle: 'rad', fmt: 'frac', domain: 'real', lang}, true).text;
  assert.equal(c('4 = 2', 'fr'), 'Faux');
  assert.equal(c('4 = 4', 'fr'), 'Vrai');
  assert.equal(c('4 = 2', 'en'), 'False');
  assert.equal(c('x / x = 1', 'fr'), '= non géré');
  assert.equal(c('1 / 0', 'fr'), '= indéfini');
});
