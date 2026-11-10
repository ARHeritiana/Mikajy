/* Mikajy recogniser heuristics: everything that turns raw per-glyph guesses into mathematics.
 * Pure functions on plain objects; no DOM, canvas or storage, so they can be tested in Node.
 *
 * A glyph `g` is {c: [{c, p}, ...] (candidates, best first), i: chosen index, b: bbox {x0,y0,x1,y1,w,h},
 *                 locked?: true when the user picked it by tapping}.
 * Screen coordinates: y grows downwards.
 */
const Recognizer = (() => {
  'use strict';
  const ch = g => g.c[g.i].c;
  const isLetter = c => /^[a-z]$/.test(c);

  /* ---- Glyph metrics -------------------------------------------------------------------------
   * HR: height of the glyph relative to its font size; letters without ascenders are "x-height". */
  const HR = {'(': .88, ')': .88, a: .38, c: .38, e: .38, n: .34, o: .37, s: .43, g: .6, l: .67, i: .53, t: .56, 'π': .4, '!': .6,
    x: .38, p: .6, q: .6, r: .34, u: .34};
  const DS = {g: .2, p: .2, q: .2, '(': .13, ')': .13};
  const DIGIT_H = .55;
  const DESCENDERS = new Set(['g', 'p', 'q', 'y', 'j']);

  /** Height a digit would have if written at the same size as `g` (x-height letters are short). */
  function nominalHeight(g) {
    const r = HR[ch(g)];
    return r && r < .5 ? Math.max(g.b.h, g.b.h / r * DIGIT_H) : g.b.h;
  }
  /** y of the writing line the glyph stands on (descenders hang below it). */
  const baseline = g => DESCENDERS.has(ch(g)) ? g.b.y1 - .3 * g.b.h : g.b.y1;

  /* ---- Exponents ---------------------------------------------------------------------------- */
  /** Marks `g.sup` for glyphs written as raised, smaller text (powers, exponentials, sin², 10⁻³, e^{2x}). */
  function assignSup(A) {
    let B = null, inSup = false;
    for (const g of A) {
      const c = ch(g), b = g.b;
      g.sup = false;
      if (!b || c === '.') continue;
      const isOp = '+-*/=()'.includes(c);
      let sup = false;
      if (B) {
        const NH = Math.max(nominalHeight(B), 20);
        const foot = (baseline(B) - b.y1) / NH;                                     // how far the foot is raised
        const centre = ((B.b.y0 + B.b.y1) / 2 - (b.y0 + b.y1) / 2) / NH;            // how far the centre is raised
        if (inSup) sup = (foot > .25 || centre > .3) && c !== '=' && b.h < .9 * NH;
        else if (c === '-') sup = b.y1 < B.b.y0 + .25 * NH && b.w < .6 * NH;
        else if (c === '*') sup = foot > .3 && centre > .35 && b.h < .7 * NH;           // x as the first symbol of an exponent
        else if (!isOp || c === '(') sup = (foot > .3 || (centre > .3 && foot > .12)) && b.h < .85 * NH;
      }
      if (sup) { g.sup = true; inSup = true; }
      else { inSup = false; B = (isOp && c !== ')') || c === '√' ? null : g; }
    }
  }

  /* ---- Function words ------------------------------------------------------------------------
   * Letters the CNN knows: a c e g i l n o s t h b. Letters it does not know (x p q r u) are matched
   * through look-alikes; in "exp" the x is the multiplication-shaped glyph. */
  const WORDS = ['sinh', 'cosh', 'tanh', 'asin', 'acos', 'atan', 'sqrt', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'exp', 'log', 'ln', 'abs'];
  const KNOWN = new Set('acegilnostbh'.split(''));
  const LOOKALIKE = {
    s: ['5', '$'], i: ['1', 'l', '!', '7'], l: ['1', 'i', '!', '/'], n: ['h', 'm'], o: ['0', 'a', 'c'], a: ['o', '9', 'g'],
    c: ['e', '(', 'o'], t: ['+', 'f'], e: ['c', 'o', 'a'], g: ['9'], h: ['n', 'b', '4'], b: ['6', 'h'],
    x: ['*'], p: ['g', '9', 'o'], q: ['g', '9'], r: ['n', 'i', '1', 's'], u: ['n', 'o', 'a']
  };
  const FUZZY_P = .25;   // weight of a look-alike reading relative to its own probability

  /** Probability that glyph `g` is the letter `ltr`, and whether it was a look-alike reading. */
  function letterScore(g, ltr) {
    const direct = g.c.find(o => o.c === ltr && o.p > .002);
    if (direct) return {p: direct.p, fuzzy: false};
    let best = 0;
    for (const alt of LOOKALIKE[ltr] || []) {
      const o = g.c.find(q => q.c === alt && q.p > .03);
      if (o && o.p > best) best = o.p;
    }
    // Letters outside the model's classes can only ever be read as look-alikes, so that is not "fuzzy".
    return best ? {p: best * FUZZY_P, fuzzy: KNOWN.has(ltr)} : null;
  }

  /** Re-reads runs of glyphs as function names (sin, cos, ln, exp...) when the candidates allow it. */
  function wordfix(A) {
    const n = A.length, used = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      let best = null;
      for (const w of WORDS) {
        if (i + w.length > n) continue;
        let score = 1, fuzzy = 0, ok = true;
        const budget = w.length >= 4 ? 1 : w.length === 3 ? 1 : 0;
        for (let j = 0; j < w.length; j++) {
          const g = A[i + j];
          if (g.locked || used[i + j]) { ok = false; break; }
          const s = letterScore(g, w[j]);
          const top = g.c[0];
          // A confidently read digit/operator is not part of a word (the x of "exp" is the one exception).
          if (!s || (top.p > .9 && top.c !== w[j] && !isLetter(top.c) && !(w[j] === 'x' && top.c === '*'))) { ok = false; break; }
          score *= s.p;
          if (s.fuzzy && ++fuzzy > budget) { ok = false; break; }
        }
        if (ok && (!best || w.length > best.w.length || (w.length === best.w.length && score > best.score))) best = {w, score};
      }
      if (best && best.score > 1e-6) {
        for (let j = 0; j < best.w.length; j++) {
          const g = A[i + j], ltr = best.w[j];
          let k = g.c.findIndex(o => o.c === ltr);
          if (k < 0) { g.c.push({c: ltr, p: Math.max(.002, letterScore(g, ltr).p)}); k = g.c.length - 1; }
          g.i = k; g.word = true; used[i + j] = true;
        }
        i += best.w.length - 1;
      }
    }
    // Lone letters: the only letter that means something on its own is the constant e.
    A.forEach((g, k) => {
      if (used[k] || g.locked || !g.b) return;
      const c = ch(g);
      if (!isLetter(c)) return;
      const e = g.c.find(o => o.c === 'e');
      if (c !== 'e' && e && e.p >= .12 && e.p >= .25 * g.c[g.i].p) { g.i = g.c.indexOf(e); return; }   // cursive e read as c / o
      if (c === 'e' && g.c[g.i].p > .5) return;
      const j = g.c.findIndex(o => !isLetter(o.c) && o.p > .01);
      if (j >= 0) g.i = j;
    });
    // The base of an exponent is a number, a bracket or a constant: a lone o/c/a there is a cursive e.
    A.forEach((g, k) => {
      if (g.locked || !g.b || g.word || !A[k + 1] || !A[k + 1].sup || g.sup) return;
      const e = g.c.find(o => o.c === 'e');
      if ('coa'.includes(ch(g)) && e && e.p > .02) g.i = g.c.indexOf(e);
    });
  }

  /* ---- Cursive: splitting one connected stroke into letters ---------------------------------- */
  /** Points spaced `step` apart along the polyline. */
  function resample(s, step) {
    const o = [s[0]];
    let acc = 0, a = s[0];
    for (let i = 1; i < s.length; i++) {
      const b = s[i];
      let d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      while (acc + d >= step) {
        const t = (step - acc) / d;
        a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        o.push(a);
        d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        acc = 0;
      }
      acc += d; a = b;
    }
    return o;
  }
  const extent = s => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of s) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return {x0, y0, x1, y1, w: x1 - x0, h: y1 - y0};
  };

  /**
   * Indices (into `s`) where a cursive stroke plausibly passes from one letter to the next: the pen is
   * at its lowest (the writing line) while travelling to the right. Returns [] for strokes that are
   * not wide enough to hold several letters.
   */
  function ligatureCuts(s) {
    if (s.vin || s.length < 12) return [];
    const b = extent(s);
    if (b.h < 18 || b.w < 1.5 * b.h) return [];
    const p = resample(s, 3);
    if (p.length < 12) return [];
    const win = Math.max(3, Math.round(.1 * b.w / 3)), cuts = [];
    for (let i = win; i < p.length - win; i++) {
      const y = p[i][1];
      if (y < b.y0 + .6 * b.h) continue;                                    // only near the writing line
      let valley = true;
      for (let j = i - win; j <= i + win && valley; j++) if (p[j][1] > y + .001 && j !== i) valley = false;
      if (!valley || p[i + win][0] - p[i - win][0] < .04 * b.w) continue;    // travelling rightwards
      if (p[i][0] < b.x0 + .2 * b.h || p[i][0] > b.x1 - .2 * b.h) continue;  // not at the very ends
      const last = cuts[cuts.length - 1];
      if (last && p[i][0] - last.x < .35 * b.h) { if (y > last.y) { last.x = p[i][0]; last.y = y; last.p = i; } continue; }
      cuts.push({x: p[i][0], y, p: i});
    }
    // Map resampled positions back to the original points by x/y proximity.
    return cuts.slice(0, 6).map(c => {
      let best = 0, bd = Infinity;
      for (let k = 0; k < s.length; k++) { const d = Math.hypot(s[k][0] - p[c.p][0], s[k][1] - p[c.p][1]); if (d < bd) { bd = d; best = k; } }
      return best;
    }).filter((k, i, a) => k > 2 && k < s.length - 3 && (i === 0 || k > a[i - 1] + 2));
  }

  /** Pieces of `s` cut at the given point indices (neighbouring pieces share their joint point). */
  function cutAt(s, cuts) {
    const out = [];
    let from = 0;
    for (const k of cuts) { out.push(s.slice(from, k + 1)); from = k; }
    out.push(s.slice(from));
    return out;
  }

  const WORD_BONUS = Math.log(12), SPLIT_PENALTY = Math.log(.6), SPLIT_MARGIN = .7;
  const WORD_SET = new Set(WORDS);
  /** True when the top-3 readings of consecutive pieces can spell a known function word. */
  function spellsWord(pieces) {
    const spell = (k, acc) => k === pieces.length ? WORD_SET.has(acc) :
      pieces[k].cands.slice(0, 3).some(o => spell(k + 1, acc + o.c));
    return pieces.length >= 2 && spell(0, '');
  }
  /** Subsets of cut positions, smallest first. */
  function* subsets(n) { for (let m = 0; m < 1 << n; m++) yield [...Array(n).keys()].filter(i => m >> i & 1); }

  /**
   * Decides whether a connected stroke is one symbol or several joined letters/digits.
   * `classify(strokes)` resolves to the candidate list [{c, p}] (best first) for those strokes drawn as one glyph.
   * Every segmentation into pieces is scored by the recogniser's own confidence in each piece, with a
   * prior against splitting, a penalty for slivers and a bonus when the pieces spell a function word.
   * Resolves to an array of strokes (the original, when splitting is not clearly better).
   */
  async function segmentStroke(s, classify) {
    const cuts = ligatureCuts(s);
    if (!cuts.length) return [s];
    const cache = new Map();
    const read = async (a, z) => {                       // piece between cut slots a..z (-1 = start, cuts.length = end)
      const key = a + ':' + z;
      if (!cache.has(key)) {
        const from = a < 0 ? 0 : cuts[a], to = z >= cuts.length ? s.length - 1 : cuts[z];
        const piece = s.slice(from, to + 1), e = extent(piece);
        const cands = piece.length < 4 ? [{c: '.', p: 1e-3}] : await classify([piece]);
        cache.set(key, {piece, cands, w: e.w, h: e.h, score: Math.log(Math.max(1e-4, cands[0].p))});
      }
      return cache.get(key);
    };
    const whole = await read(-1, cuts.length);
    const full = extent(s);
    let best = {score: whole.score, pieces: [whole]};
    const baseline = whole.score;
    for (const pick of subsets(cuts.length)) {
      if (!pick.length) continue;
      const slots = [-1, ...pick, cuts.length], pieces = [];
      let score = 0;
      for (let k = 0; k + 1 < slots.length; k++) {
        const r = await read(slots[k], slots[k + 1]);
        // Slivers (cut inside a letter) and still-wide pieces are unlikely letters.
        const sliver = r.w < .22 * full.h || r.h < .25 * full.h;
        score += r.score + (sliver ? Math.log(.2) : 0) + (r.w > 1.6 * full.h ? Math.log(.5) : 0);
        pieces.push(r);
      }
      score += pick.length * SPLIT_PENALTY + (spellsWord(pieces) ? WORD_BONUS : 0);
      if (score > best.score + (best.pieces.length === 1 ? SPLIT_MARGIN : 0)) best = {score, pieces};
    }
    if (best.pieces.length === 1 || best.score < baseline + SPLIT_MARGIN) return [s];
    return best.pieces.map(r => r.piece);
  }


  /* ---- Spatial ink grouping and late glyph completion ----------------------------------------
   * Both operations use the original pen coordinates, never the typeset positions.  A glyph may
   * be finished after a recognition timeout or after the writer has drawn other characters. */
  const joinBoxes = (a, b) => ({
    x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
    w: Math.max(a.x1, b.x1) - Math.min(a.x0, b.x0),
    h: Math.max(a.y1, b.y1) - Math.min(a.y0, b.y0)
  });
  const centre = b => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  const horizontal = b => b.w >= 3 * Math.max(b.h, 1);
  const vertical = b => b.h >= 1.4 * Math.max(b.w, 1);
  const span = b => Math.max(b.w, b.h);

  function relatedInkBoxes(a, b) {
    const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    const [ax, ay] = centre(a), [bx, by] = centre(b);
    // Two separately drawn, horizontally aligned bars form '=' (or later '≠').
    if (horizontal(a) && horizontal(b) && Math.min(a.w, b.w) >= 14 &&
        ox >= .55 * Math.min(a.w, b.w) &&
        Math.abs(ay - by) <= .42 * Math.min(a.w, b.w)) return true;
    const markToStem = (m, stem) => vertical(stem) && span(m) <= .25 * stem.h &&
      Math.abs(centre(m)[0] - centre(stem)[0]) <= Math.max(6, .18 * stem.h) &&
      Math.max(m.y0 - stem.y1, stem.y0 - m.y1, 0) <= .6 * stem.h;
    // The three marks of a division sign may be drawn in any order.
    const markToBar = (m, bar) => horizontal(bar) && span(m) <= .12 * bar.w &&
      Math.abs(centre(m)[0] - centre(bar)[0]) <= .22 * bar.w &&
      Math.abs(centre(m)[1] - centre(bar)[1]) <= .4 * bar.w;
    if (markToStem(a, b) || markToStem(b, a) ||
        markToBar(a, b) || markToBar(b, a)) return true;
    // Actual crossing/overlapping marks (plus, pi, percent, t) are one symbol.
    // Do not join nearby disjoint characters or fraction numerators to bars.
    return ox >= -1.5 && oy >= -1.5;
  }

  function groupStrokes(strokes) {
    if (!strokes.length) return [];
    const bs = strokes.map(extent), parent = strokes.map((_, i) => i);
    const root = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for (let i = 0; i < strokes.length; i++)
      for (let j = 0; j < i; j++)
        if (relatedInkBoxes(bs[i], bs[j])) parent[root(i)] = root(j);
    const groups = new Map();
    strokes.forEach((s, i) => {
      const k = root(i);
      if (!groups.has(k)) groups.set(k, {s: [], b: bs[i]});
      const g = groups.get(k); g.s.push(s); g.b = joinBoxes(g.b, bs[i]);
    });
    const ref = Math.max(40, ...bs.map(span));
    return [...groups.values()].map(g => ({...g, tiny: g.b.w < .2 * ref && g.b.h < .2 * ref}))
      .sort((a, b) => centre(a.b)[0] - centre(b.b)[0]);
  }

  function reopenCandidate(stroke, glyphs) {
    const b = extent(stroke), [x, y] = centre(b);
    let best = null, score = Infinity;
    for (const g of glyphs) {
      // Preserve the original ink separately from animation ink, which is discarded on fade-in.
      if (g.locked || g.fp || !Array.isArray(g.raw) || !g.raw.length) continue;
      if (!g.raw.some(s => relatedInkBoxes(b, extent(s)))) continue;
      const old = g.b || g.raw.map(extent).reduce(joinBoxes);
      const [gx, gy] = centre(old), d = Math.hypot(x - gx, y - gy) / Math.max(15, span(old));
      if (d < score) {best = g; score = d;}
    }
    return best;
  }

  return Object.freeze({ch, HR, DS, WORDS, assignSup, wordfix, resample, extent, ligatureCuts, cutAt, segmentStroke, nominalHeight, groupStrokes, reopenCandidate});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Recognizer;
