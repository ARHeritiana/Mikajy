/* Versioned, validated settings storage, separate from the canvas. */
const SettingsStore = (() => {
  'use strict';
  const DEFAULTS = Object.freeze({mode: 'instant', angle: 'rad', fmt: 'frac', theme: 'dark', updates: 'auto', domain: 'real', recogniser: 'seq'});
  const ALLOWED = Object.freeze({
    mode: ['instant', 'demand'], angle: ['rad', 'deg'], fmt: ['dec', 'frac', 'mixed'], theme: ['dark', 'light'], updates: ['auto', 'off'], domain: ['real', 'complex'], recogniser: ['seq', 'classic']
  });
  function validate(input) {
    const result = {...DEFAULTS};
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      for (const key of Object.keys(ALLOWED)) {
        if (ALLOWED[key].includes(input[key])) result[key] = input[key];
      }
    }
    return result;
  }
  function load(storage) {
    try { return validate(JSON.parse(storage?.getItem('inkset') || '{}')); }
    catch (_) { return validate(); }
  }
  function save(storage, settings) {
    try { storage?.setItem('inkset', JSON.stringify(validate(settings))); return true; }
    catch (_) { return false; }
  }
  return Object.freeze({load, save, validate});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SettingsStore;
