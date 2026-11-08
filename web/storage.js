/* Defensive access to localStorage. Everything read back is untrusted input:
 * it may be corrupted, hand-edited, written by an older version, or far too large. */
const Store = (() => {
  'use strict';
  const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  const str = (v, max) => typeof v === 'string' && v.length <= max;
  const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/;

  function loadArray(storage, key) {
    try {
      const parsed = JSON.parse(storage?.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }
  function save(storage, key, value) {
    try { storage?.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }

  /** Memory-bar chips: plain decimal numbers only (anything else could not be dropped back safely). */
  function cleanChips(list, max = 12) {
    return list.filter(v => str(v, 24) && PLAIN_NUMBER.test(v)).slice(0, max);
  }

  /* Personalisation samples: {c: known class, v: 784 bytes}.
   * Stored packed (base64, ~1 KB each) under SAMPLES_KEY; the legacy format (JSON arrays of 784
   * integers, ~3 KB each, key LEGACY_SAMPLES_KEY) is still read and migrated on the next save. */
  const SAMPLES_KEY = 'ink4', LEGACY_SAMPLES_KEY = 'ink3', SAMPLE_BYTES = 784;
  const B64_SAMPLE = /^[A-Za-z0-9+/]{1046}==$/;   // 784 bytes -> 1048 base64 chars

  function decodeSample(v) {
    if (Array.isArray(v)) {
      if (v.length !== SAMPLE_BYTES || !v.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) return null;
      return Uint8Array.from(v);
    }
    if (typeof v !== 'string' || !B64_SAMPLE.test(v)) return null;
    try {
      const bin = atob(v);
      if (bin.length !== SAMPLE_BYTES) return null;
      const out = new Uint8Array(SAMPLE_BYTES);
      for (let i = 0; i < SAMPLE_BYTES; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch (_) { return null; }
  }
  function encodeSample(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  /** @returns {{c: string, v: Uint8Array}[]} at most `max` valid samples (the most recent ones). */
  function cleanSamples(list, classes, max = 400) {
    const known = new Set(classes);
    const out = [];
    for (const m of list) {
      if (!isObject(m) || !known.has(m.c)) continue;
      const v = decodeSample(m.v);
      if (v) out.push({c: m.c, v});
    }
    return out.slice(-max);
  }
  function loadSamples(storage, classes) {
    const packed = loadArray(storage, SAMPLES_KEY);
    return cleanSamples(packed.length ? packed : loadArray(storage, LEGACY_SAMPLES_KEY), classes);
  }
  function saveSamples(storage, samples) {
    const ok = save(storage, SAMPLES_KEY, samples.map(({c, v}) => ({c, v: encodeSample(v)})));
    if (ok) { try { storage?.removeItem?.(LEGACY_SAMPLES_KEY); } catch (_) { /* nothing to clean */ } }
    return ok;
  }

  /** History entries: rebuilt field by field so no unexpected property or type survives. */
  function cleanHistory(list, max = 100) {
    const out = [];
    for (const h of list) {
      if (!isObject(h) || !str(h.id, 64) || !h.id || !isNum(h.ts) || !str(h.ans, 200) || !str(h.text, 400)) continue;
      if (!Array.isArray(h.syms) || !h.syms.length || h.syms.length > 200) continue;
      const syms = [];
      for (const s of h.syms) {
        if (!isObject(s) || !str(s.c, 2) || !s.c) { syms.length = 0; break; }
        const fid = typeof s.fid === 'string' && s.fid.length <= 16 ? s.fid : isNum(s.fid) ? String(s.fid) : '';
        syms.push({
          c: s.c, sup: s.sup ? 1 : 0, fp: ['n', 'd', 'bar'].includes(s.fp) ? s.fp : '', fid,
          cover: Number.isInteger(s.cover) && s.cover >= 0 && s.cover <= 200 ? s.cover : 0,
          pfid: typeof s.pfid === 'string' && s.pfid.length <= 16 ? s.pfid : isNum(s.pfid) ? String(s.pfid) : '', pfp: ['n', 'd'].includes(s.pfp) ? s.pfp : ''
        });
      }
      if (!syms.length) continue;
      out.push({id: h.id, ts: h.ts, syms, F: isNum(h.F) ? Math.min(400, Math.max(20, h.F)) : 70, ans: h.ans, text: h.text});
      if (out.length >= max) break;
    }
    return out;
  }

  /** A result may be dragged/stored only if it is a plain decimal (no exponent, no 'undefined'). */
  function plainNumber(v) {
    if (!isNum(v)) return null;
    if (Math.abs(v) < 1e-12) v = 0;
    const s = String(parseFloat(v.toPrecision(10)));
    return PLAIN_NUMBER.test(s) ? s : null;
  }

  return Object.freeze({loadArray, save, cleanChips, cleanSamples, loadSamples, saveSamples, cleanHistory, plainNumber, PLAIN_NUMBER});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Store;
