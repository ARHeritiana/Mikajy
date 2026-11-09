/* The board's memory: user functions (f(x) = x^2 + 1, then f(3), f(g(2))) and declared random variables (X ~ B(10, 1/2), then P(X = 2)).
 * Pure: it works on the LaTeX token arrays the recogniser emits and keeps no state of its own. A *store* is {defs, rvs}; scan() returns a new one.
 * Lines are applied top to bottom, so a later definition replaces an earlier one and a line only sees what is written above it.
 * Function calls are expanded in place, so every existing engine (exact arithmetic, symbolic results, calculus, ...) works on the result unchanged. */
const BoardCore = (() => {
  'use strict';
  const MAX_DEPTH = 8, MAX_TOKENS = 600;
  const RESERVED = new Set(['e', 'i', 'x', 'y']);                 // e, i are constants; x is the variable; y belongs to differential equations
  const isLower = t => typeof t === 'string' && /^[a-z]$/.test(t);
  const isUpper = t => typeof t === 'string' && /^[A-Z]$/.test(t);
  const empty = () => ({defs: {}, rvs: {}});
  const clone = s => ({defs: {...s.defs}, rvs: {...s.rvs}});
  class BoardError extends Error { constructor(code) { super(code); this.name = 'BoardError'; this.code = code; } }
  const fail = code => { throw new BoardError(code); };

  const isOpen = (t, u) => (t === '\\left' && u === '(') ;
  /** index just after the group that starts at i (a "(" or "\left(" or "{"), or -1 */
  function skipGroup(tokens, i) {
    let depth = 0;
    for (let k = i; k < tokens.length; k++) {
      const t = tokens[k];
      if (t === '(' || t === '{') depth++;
      else if (t === ')' || t === '}') { depth--; if (depth === 0) return k + 1; }
    }
    return -1;
  }
  /** opening of a call's argument list at i: [index of "(", index after the matching ")"], or null */
  function callArgs(tokens, i) {
    let o = i;
    if (tokens[o] === '\\left') o++;
    if (tokens[o] !== '(') return null;
    const end = skipGroup(tokens, o);
    if (end < 0) return null;
    return [o, end];
  }
  function inner(tokens, o, end) {                                // tokens strictly inside "(" ... ")" (dropping a trailing \right)
    let stop = end - 1;
    if (tokens[stop - 1] === '\\right') stop--;
    return tokens.slice(o + 1, stop);
  }

  /** the statement a line makes, without touching the store: {kind:'def', name, body} | {kind:'rv', name, dist, args} | null */
  function parseStatement(tokens) {
    const t = tokens.filter(u => u !== '<nl>');
    while (t.length && t[t.length - 1] === '=') t.pop();
    // f ( x ) = body
    if (t.length > 6 && isLower(t[0]) && !RESERVED.has(t[0])) {
      const c = callArgs(t, 1);
      if (c && inner(t, c[0], c[1]).length === 1 && inner(t, c[0], c[1])[0] === 'x' && t[c[1]] === '=') {
        const body = t.slice(c[1] + 1);
        if (body.length) return {kind: 'def', name: t[0], body};
      }
    }
    // X \sim D ( a , b )
    if (t.length > 5 && isUpper(t[0]) && t[1] === '\\sim' && isUpper(t[2])) {
      const c = callArgs(t, 3);
      if (c && c[1] === t.length) {
        const args = [[]]; let depth = 0;
        for (const u of inner(t, c[0], c[1])) {
          if (u === '(' || u === '{') depth++; else if (u === ')' || u === '}') depth--;
          if ((u === ',' || u === ';') && depth === 0) args.push([]); else args[args.length - 1].push(u);
        }
        return {kind: 'rv', name: t[0], dist: t[2], args};
      }
    }
    return null;
  }

  /** a new store with this line's statement applied (or the same store if the line states nothing) */
  function scan(tokens, store) {
    const st = parseStatement(tokens);
    if (!st) return store;
    const next = clone(store);
    if (st.kind === 'def') next.defs[st.name] = {param: 'x', body: st.body};
    else next.rvs[st.name] = {dist: st.dist, args: st.args};
    return next;
  }

  /** replace every call of a defined function by its body with the argument substituted; leaves anything else alone */
  function expand(tokens, store, stack = []) {
    if (tokens.length > MAX_TOKENS) fail('unsupported');
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const def = isLower(t) && Object.prototype.hasOwnProperty.call(store.defs, t) ? store.defs[t] : null;
      const c = def ? callArgs(tokens, i + 1) : null;
      if (!def || !c) { out.push(t); continue; }
      if (stack.includes(t) || stack.length >= MAX_DEPTH) fail('unsupported');   // f defined through itself
      const arg = expand(inner(tokens, c[0], c[1]), store, stack);
      if (!arg.length) fail('syntax');
      const body = expand(def.body, store, [...stack, t]);
      const sub = ['\\left', '(', ...arg, '\\right', ')'];
      out.push('\\left', '(');
      for (const u of body) { if (u === def.param) out.push(...sub); else out.push(u); }
      out.push('\\right', ')');
      i = c[1] - 1;
    }
    return out;
  }

  /** does this reading mention a function the store defines, called with arguments? */
  function usesDefs(tokens, store) {
    for (let i = 0; i < tokens.length; i++) {
      if (isLower(tokens[i]) && Object.prototype.hasOwnProperty.call(store.defs, tokens[i]) && callArgs(tokens, i + 1)) return true;
    }
    return false;
  }

  return Object.freeze({empty, scan, expand, usesDefs, parseStatement, BoardError, isUpper, isLower, callArgs, inner});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BoardCore;
