/* Update bookkeeping for the page. The network requests and the installation are made by the Android shell
 * (UpdateChecker.java, SelfInstaller.java); this file only decides what their answers mean and when to ask again. */
const Updates = (() => {
  'use strict';
  const KEY = 'inkupd';
  const INTERVAL_MS = 24 * 60 * 60 * 1000;
  const RELEASES = 'https://github.com/ARHeritiana/Mikajy-Spark/releases/';
  const TAG = /^v?(\d{1,4})\.(\d{1,4})(?:\.(\d{1,4}))?$/;

  /** "v5.1" / "5.1.2" -> [5, 1, 0] / [5, 1, 2]; anything else -> null. */
  function parseVersion(text) {
    const m = TAG.exec(String(text || '').trim());
    return m ? [+m[1], +m[2], +(m[3] || 0)] : null;
  }
  /** Negative, zero or positive like Array.sort. Unparseable versions never count as newer. */
  function compare(a, b) {
    const x = parseVersion(a), y = parseVersion(b);
    if (!x || !y) return 0;
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  }
  const isNewer = (remote, local) => !!parseVersion(local) && compare(remote, local) > 0;
  const safeUrl = u => typeof u === 'string' && u.length < 512 && u.startsWith(RELEASES) && !u.includes('..') && !u.includes('\\');

  /** Turns the shell's JSON answer into {status: 'available'|'current'|'offline'|'error', version, url, apk, sums}. */
  function interpret(answer, localVersion) {
    if (!answer || typeof answer !== 'object') return {status: 'error'};
    if (answer.ok !== true) return {status: answer.reason === 'offline' ? 'offline' : 'error'};
    if (!parseVersion(answer.tag) || !parseVersion(localVersion)) return {status: 'error'};
    const version = answer.tag.replace(/^v/, '');
    if (!isNewer(answer.tag, localVersion)) return {status: 'current', version};
    return {status: 'available', version, url: safeUrl(answer.url) ? answer.url : RELEASES + 'latest', apk: safeUrl(answer.apk) ? answer.apk : '',
      sums: safeUrl(answer.sums) ? answer.sums : ''};
  }

  const EMPTY = Object.freeze({checked: 0, version: '', url: '', apk: '', sums: ''});
  /** Rebuilds the stored record field by field; storage content is never trusted. */
  function validate(raw) {
    const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const version = parseVersion(o.version) ? String(o.version) : '';
    return {
      checked: Number.isFinite(o.checked) && o.checked > 0 ? o.checked : 0,
      version,
      url: version && safeUrl(o.url) ? o.url : '',
      apk: version && safeUrl(o.apk) ? o.apk : '',
      sums: version && safeUrl(o.sums) ? o.sums : ''
    };
  }
  function load(storage) {
    try { return validate(JSON.parse(storage?.getItem(KEY) || 'null')); } catch (_) { return {...EMPTY}; }
  }
  function save(storage, state) {
    try { storage?.setItem(KEY, JSON.stringify(validate(state))); return true; } catch (_) { return false; }
  }
  /** Remembers the outcome of a successful check (an available update, or none). */
  function record(state, result, now) {
    const next = {...EMPTY, checked: now};
    if (result.status === 'available') Object.assign(next, {version: result.version, url: result.url, apk: result.apk, sums: result.sums});
    return validate(next);
  }
  /** The update worth showing, or null: stored versions that are no longer newer are ignored. */
  const pending = (state, localVersion) => state.version && isNewer(state.version, localVersion) ? state : null;
  /** Can the app download and install this update itself (needs the APK and its checksum file)? */
  const installable = u => !!(u && u.apk && u.sums && u.apk.endsWith('.apk'));
  /** Install progress from the shell ({state, p, reason}), validated: unknown states and reasons are dropped. */
  const STATES = ['downloading', 'verifying', 'permission', 'installing', 'confirm', 'installed', 'failed'];
  const REASONS = ['offline', 'checksum', 'package', 'permission', 'aborted', 'install', 'error'];
  function progress(raw) {
    const o = raw && typeof raw === 'object' ? raw : {};
    if (!STATES.includes(o.state)) return null;
    const out = {state: o.state};
    if (o.state === 'downloading') out.p = Number.isFinite(o.p) && o.p >= 0 && o.p <= 1 ? o.p : -1;
    if (o.state === 'failed') out.reason = REASONS.includes(o.reason) ? o.reason : 'error';
    return out;
  }
  /** Automatic checks run at most once a day, and never when the user switched them off. */
  const shouldCheck = (state, now, setting) => setting !== 'off' && (!(state.checked > 0) || now - state.checked >= INTERVAL_MS || state.checked > now);

  return Object.freeze({parseVersion, compare, isNewer, interpret, validate, load, save, record, pending, installable, progress, shouldCheck, INTERVAL_MS, RELEASES});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Updates;
