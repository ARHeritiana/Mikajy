/* Mikajy expression tree: what was written, as mathematics.
 *
 * A line is a sequence of nodes:
 *   glyph {t:'g', c:[{c,p}...] (candidates, best first), i: chosen index}
 *   sup   {t:'sup', body:[...]}                 exponent of the node before it
 *   frac  {t:'frac', num:[...], den:[...]}
 *   root  {t:'root', body:[...], reach}          reach: length of the drawn bar, in font sizes (0 for a bare hook)
 *
 * Every node has a box "as the user sees it": `raw` (its ink) until it is typeset, then `box` (its typeset place).
 * All editing decisions (where a new symbol goes, whether it is an exponent, what a scribble erases) compare the
 * new ink with these boxes, so the user always edits what is on the screen.
 *
 * Pure: no DOM, canvas or storage. `M(c)` (advance width of character c at font size 1) is supplied by the caller.
 * Screen coordinates: y grows downwards.
 */
const Ink = (() => {
  'use strict';
  const R = typeof module !== 'undefined' && module.exports ? require('./recognizer.js') : Recognizer;
  const GAP = .06, SUP = .62, RAISE = .42, FRAC = .8, BAR_Y = .28, BAR_MIN = .15;
  const FUNCS = new Set(R.WORDS);

  const ch = g => g.c[g.i].c;
  const glyph = (c, o) => Object.assign({t: 'g', c: typeof c === 'string' ? [{c, p: 1}] : c, i: 0}, o);
  const sup = body => ({t: 'sup', body});
  const frac = (num, den) => ({t: 'frac', num, den});
  const root = (body, reach) => ({t: 'root', body, reach: reach || 0});
  const bx = n => n.box || n.raw;
  const midX = n => { const b = bx(n); return b ? (b.x0 + b.x1) / 2 : 0; };
  const hasBar = n => n.t === 'root' && (n.reach > BAR_MIN || n.body.length > 0);
  const isOp = c => '+-*/='.includes(c);
  const box = (x0, y0, x1, y1) => ({x0, y0, x1, y1, w: x1 - x0, h: y1 - y0});
  const union = bs => bs.length ? box(Math.min(...bs.map(b => b.x0)), Math.min(...bs.map(b => b.y0)),
    Math.max(...bs.map(b => b.x1)), Math.max(...bs.map(b => b.y1))) : null;
  const unionOf = seq => union(seq.map(bx).filter(Boolean));
  const children = n => n.t === 'frac' ? [n.num, n.den] : n.t === 'g' ? [] : [n.body];

  /** Calls fn(node, seq, depth) for every node, depth first. */
  function walk(seq, fn, d = 0) { for (const n of seq) { fn(n, seq, d); for (const s of children(n)) walk(s, fn, d + 1); } }
  function count(seq) { let k = 0; walk(seq, () => k++); return k; }

  /* ---- Layout -------------------------------------------------------------------------------- */
  /** Typeset box of a glyph (its ink-like extent), from the font metrics shared with the recogniser. */
  function glyphBox(c, x, y, s, w) {
    const x1 = x + Math.max(w, .2 * s);
    if (c === '√') return box(x, y - .8 * s, x1, y);
    if (isOp(c) || c === '%') {
      const tall = c === '/' || c === '%', h = c === '-' ? .06 * s : c === '=' ? .24 * s : tall ? .6 * s : .36 * s, m = tall ? y - .3 * s : y - .27 * s;
      return box(x, m - h / 2, x1, m + h / 2);
    }
    if (c === '.') return box(x, y - .08 * s, x1, y);
    const y1 = y + (R.DS[c] || 0) * s;
    return box(x, y1 - (R.HR[c] || .55) * s, x1, y1);
  }
  const seqWidth = (seq, s, M) => seq.length ? layoutSeq(seq, 0, 0, s, M) - GAP * s : 0;

  /**
   * Sets typeset targets (tx, ty, tsz, w; frac: tbw, bar; root: tvx, ttop, bar) and `box` of every node.
   * Returns the x where the next node would start.
   */
  function layoutSeq(seq, x, base, s, M) {
    const hooks = [];
    seq.forEach((n, k) => {
      if (n.t === 'g') {
        const c = ch(n), w = M(c) * s;
        Object.assign(n, {tx: x, ty: base, tsz: s, w});
        n.box = glyphBox(c, x, base, s, w);
        x += w + GAP * s;
      } else if (n.t === 'sup') {
        const ss = s * SUP, y = base - RAISE * s, x0 = x;
        x = layoutSeq(n.body, x, y, ss, M);
        n.ts = ss;
        n.box = unionOf(n.body) || box(x0, y - .55 * ss, x0 + .3 * ss, y);
      } else if (n.t === 'frac') {
        const fs = s * FRAC, nw = seqWidth(n.num, fs, M), dw = seqWidth(n.den, fs, M);
        const W = Math.max(nw, dw, .45 * s) + .3 * s, by = base - BAR_Y * s;
        layoutSeq(n.num, x + (W - nw) / 2, by - .14 * s, fs, M);
        layoutSeq(n.den, x + (W - dw) / 2, by + .14 * s + .55 * fs, fs, M);
        const m = .05 * s;   // side margin: the bar never touches its neighbours
        Object.assign(n, {tx: x + m, ty: by, tbw: W - 2 * m, ts: s, bar: {x0: x + m, x1: x + W - m, y: by}});
        const u = unionOf(n.num.concat(n.den));
        n.box = box(x, Math.min(by - .1 * s, u ? u.y0 : by), x + W, Math.max(by + .1 * s, u ? u.y1 : by));
        x += W + .1 * s;
      } else {
        const e = layoutSeq(n.body, x + .6 * s, base, s, M), u = unionOf(n.body);
        let end = n.body.length ? e - GAP * s + .04 * s : x + .56 * s;
        if (n.reach > BAR_MIN) end = Math.max(end, x + .5 * s + n.reach * s);   // the bar keeps the reach it was drawn with
        const top = Math.min(base - .8 * s, u ? u.y0 - .1 * s : Infinity);
        Object.assign(n, {tx: x, ty: base, tsz: s, tvx: end, ttop: top, bar: {x0: x + .5 * s, x1: end, top, base}});
        n.box = box(x, top, end, base + .05 * s);
        if (!hasBar(n)) hooks.push(k);
        x = Math.max(e, end + .1 * s);
      }
    });
    // A root written without a bar applies to the number or bracket after it: draw its bar over that.
    for (const k of hooks) {
      const r = seq[k], run = implicitRun(seq, k);
      if (run) { r.tvx = Math.max(r.tvx, bx(run).x1); r.bar.x1 = r.tvx; r.box.x1 = r.tvx; }
    }
    return x;
  }
  /** Last node of what a bar-less root applies to: a bracket group, or a number (digits . π e). */
  function implicitRun(seq, k) {
    let j = k + 1;
    if (!seq[j] || seq[j].t !== 'g') return null;
    if (ch(seq[j]) === '(') {
      let d = 0;
      for (; j < seq.length; j++) {
        if (seq[j].t !== 'g') continue;
        const c = ch(seq[j]);
        if (c === '(') d++;
        if (c === ')' && --d === 0) return seq[j];
      }
      return seq[seq.length - 1];
    }
    let last = null;
    while (seq[j] && seq[j].t === 'g' && /[0-9.πe]/.test(ch(seq[j]))) last = seq[j++];
    return last;
  }

  /* ---- Placement ----------------------------------------------------------------------------- */
  /** Is a symbol with ink box `b` and reading `c` written as an exponent of node `B`? (Raised and smaller.) */
  function raised(B, b, c, continuing) {
    if (B.t !== 'g') return false;
    const q = bx(B), bc = ch(B);
    if (!q || (isOp(bc) && bc !== ')') || bc === '(' || bc === '√' || bc === '.') return false;
    const r = R.HR[bc], NH = Math.max(r && r < .5 ? Math.max(q.h, q.h / r * .55) : q.h, 20);
    const line = 'gpqyj'.includes(bc) ? q.y1 - .3 * q.h : q.y1;
    const foot = (line - b.y1) / NH, centre = ((q.y0 + q.y1) / 2 - (b.y0 + b.y1) / 2) / NH;
    if (continuing) return (foot > .25 || centre > .3) && c !== '=' && b.h < .9 * NH;
    if (c === '-') return b.y1 < q.y0 + .25 * NH && b.w < .6 * NH;
    if (c === '*') return foot > .3 && centre > .35 && b.h < .7 * NH;
    if (isOp(c) || c === ')' || c === '√') return false;
    return (foot > .3 || (centre > .3 && foot > .12)) && b.h < .85 * NH;
  }

  /**
   * Where a new symbol (ink box `b`, reading `c`) belongs: {seq, k, sup}. `s` is the font size of `seq`.
   * Inside a fraction (above / below its bar) or under a root's bar it goes into that part; otherwise it is
   * ordered by x, and becomes (or extends) an exponent when it is raised above the node before it.
   */
  function slot(seq, b, c, s) {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    for (const n of seq) {
      if (n.t === 'frac' && n.bar) {
        const B = n.bar, fs = n.ts || s;
        if (cx >= B.x0 - .15 * fs && cx <= B.x1 + .15 * fs) {
          if (cy < B.y && B.y - cy < 1.4 * fs) return slot(n.num, b, c, fs * FRAC);
          if (cy > B.y && B.y - cy > -1.6 * fs) return slot(n.den, b, c, fs * FRAC);
        }
      } else if (n.t === 'root' && n.bar && hasBar(n)) {
        const B = n.bar, rs = n.tsz || s;
        if (cx > B.x0 && cx <= B.x1 + .12 * rs && cy > B.top && cy < B.base + .3 * rs) return slot(n.body, b, c, rs);
      }
    }
    let k = 0;
    while (k < seq.length && midX(seq[k]) < cx) k++;
    const prev = seq[k - 1], next = seq[k];
    if (prev && prev.t === 'sup' && seq[k - 2] && raised(seq[k - 2], b, c, true)) {
      let j = 0;
      while (j < prev.body.length && midX(prev.body[j]) < cx) j++;
      return {seq: prev.body, k: j};
    }
    if (prev && raised(prev, b, c, false)) return next && next.t === 'sup' ? {seq: next.body, k: 0} : {seq, k, sup: true};
    return {seq, k};
  }
  /** Inserts `node` (with its ink box in `node.raw`) where it belongs. */
  function insert(seq, node, s) {
    const at = slot(seq, node.raw, node.t === 'g' ? ch(node) : '', s);
    at.seq.splice(at.k, 0, at.sup ? sup([node]) : node);
    return at;
  }
  /** Removes and returns the nodes of `seq` matched by `pick`, provided they are consecutive. */
  function takeRun(seq, pick) {
    const idx = seq.map((n, k) => pick(n) ? k : -1).filter(k => k >= 0);
    if (!idx.length || idx[idx.length - 1] - idx[0] !== idx.length - 1) return {k: -1, run: []};
    return {k: idx[0], run: seq.splice(idx[0], idx.length)};
  }
  const flat = n => n.t === 'g' && (ch(n) === '-' || ch(n) === '=');

  /**
   * A long flat stroke `b`: a fraction bar when something is written above or below it (now, or already typeset),
   * otherwise null (it is a minus). Typeset nodes above it become the numerator (a bar drawn under a finished
   * expression); what is written with it is placed later, by `slot`, into the numerator or denominator.
   */
  function aboveBar(b, s) {
    const y = (b.y0 + b.y1) / 2, H = 1.3 * Math.max(s * .55, 30);
    return n => { const q = bx(n), m = midX(n); return !!q && !flat(n) && m >= b.x0 - 12 && m <= b.x1 + 12 && q.y1 <= y + 10 && y - q.y1 < H; };
  }
  /** Is typeset content standing just above the flat stroke `b` (a bar drawn under a finished expression)? */
  const contentAbove = (seq, b, s) => slot(seq, b, '-', s).seq.some(aboveBar(b, s));
  function addFraction(seq, b, s, inkAbove, inkBelow) {
    const at = slot(seq, b, '-', s), y = (b.y0 + b.y1) / 2, above = aboveBar(b, s);
    if (!inkAbove && !inkBelow && !at.seq.some(above)) return null;
    const {k, run} = takeRun(at.seq, above), f = frac(run, []);
    Object.assign(f, {raw: box(b.x0, y - 4, b.x1, y + 4), bar: {x0: b.x0, x1: b.x1, y}, ts: s});
    at.seq.splice(k >= 0 ? k : at.k, 0, f);
    return f;
  }
  /** A root sign drawn with its bar: typeset nodes already under the bar become its radicand. */
  function addRoot(seq, r, s) {
    const at = slot(seq, r.raw, '√', s), B = r.bar;
    const under = n => { const q = bx(n), m = midX(n); return q && m > B.x0 && m <= B.x1 + 14 && (q.y0 + q.y1) / 2 > B.top; };
    if (hasBar(r) || r.reach > BAR_MIN) {
      const rest = at.seq.slice(at.k), {k, run} = takeRun(rest, under);
      if (k === 0 && run.length) { at.seq.splice(at.k, run.length); r.body.push(...run); }
    }
    at.seq.splice(at.k, 0, r);
    return at;
  }
  /** Extends a bar-less root with a bar drawn later; what is under the new bar becomes its radicand. */
  function extendRoot(seq, r, reachEm) {
    r.reach = reachEm;
    const host = findSeq(seq, r);
    if (!host) return;
    const s = r.tsz, B = {x0: r.tx + .5 * s, x1: r.tx + (.5 + reachEm) * s};
    const k = host.indexOf(r), rest = host.slice(k + 1);
    const {k: j, run} = takeRun(rest, n => { const m = midX(n); return m > B.x0 && m <= B.x1 + 14; });
    if (j === 0 && run.length) { host.splice(k + 1, run.length); r.body.push(...run); }
  }
  function findSeq(seq, node) {
    if (seq.includes(node)) return seq;
    for (const n of seq) for (const c of children(n)) { const f = findSeq(c, node); if (f) return f; }
    return null;
  }

  /** A glyph written over an existing glyph replaces it: returns {seq, k} of the glyph it covers, or null. */
  function overwritten(seq, b) {
    const cx = (b.x0 + b.x1) / 2, na = Math.max(1, b.w * b.h);
    let hit = null;
    walk(seq, (n, s) => {
      if (hit || n.t !== 'g' || !n.box) return;
      const q = n.box, iw = Math.min(b.x1, q.x1) - Math.max(b.x0, q.x0), ih = Math.min(b.y1, q.y1) - Math.max(b.y0, q.y0);
      if (iw <= 0 || ih <= 0 || cx <= q.x0 || cx >= q.x1) return;
      const r = iw * ih / Math.min(Math.max(1, q.w * q.h), Math.max(na, (b.w + 8) * (b.h + 8)));
      if (r >= .5) hit = {seq: s, k: s.indexOf(n)};
    });
    return hit;
  }

  /* ---- Erasing ------------------------------------------------------------------------------- */
  const barBox = n => { const s = n.ts || 60; return box(n.bar.x0, n.bar.y - .12 * s, n.bar.x1, n.bar.y + .12 * s); };
  const signBox = n => n.box ? box(n.tx, n.ttop, n.tx + .56 * n.tsz, n.ty) : n.raw;
  /**
   * Removes what `hit(box, kind)` selects; returns the removed nodes (for the fade-out).
   * A fraction goes with its bar; erasing a root sign keeps its radicand; empty exponents and fractions go.
   */
  function erase(seq, hit, out = []) {
    for (let k = seq.length - 1; k >= 0; k--) {
      const n = seq[k];
      if (n.t === 'g') { if (bx(n) && hit(bx(n), 'g')) { out.push(n); seq.splice(k, 1); } }
      else if (n.t === 'sup') { erase(n.body, hit, out); if (!n.body.length) seq.splice(k, 1); }
      else if (n.t === 'frac') {
        if (n.bar && hit(barBox(n), 'bar')) { out.push(n); seq.splice(k, 1); continue; }
        erase(n.num, hit, out); erase(n.den, hit, out);
        if (!n.num.length && !n.den.length) { out.push(n); seq.splice(k, 1); }
      } else {
        const sb = signBox(n);
        if (sb && hit(sb, 'g')) { const body = n.body; n.body = []; out.push(n); seq.splice(k, 1, ...body); }
        else erase(n.body, hit, out);
      }
    }
    return out;
  }

  /* ---- Reading: candidates in context --------------------------------------------------------- */
  /** Down-weights readings that make no sense where they stand (an operator after an operator, ...). */
  function contextFix(seq, last) {
    let pc = '', open = 0;
    seq.forEach((n, k) => {
      if (n.t !== 'g') { pc = 'n'; return; }
      if (n.fresh) {
        const end = last && k === seq.length - 1;
        n.c.forEach(o => {
          let f = 1;
          const c = o.c;
          if ('*/)'.includes(c) && (k === 0 || '+-*/('.includes(pc))) f *= .25;
          if (c === ')' && open <= 0) f *= .3;
          if (c === '=' && !end) f *= .3;
          if (end && '+-*/'.includes(c)) f *= .5;
          o.p *= f;
        });
        n.c.sort((a, b) => b.p - a.p); n.c = n.c.slice(0, 5); n.i = 0; n.fresh = false;
      }
      const c = ch(n);
      if (c === '(') open++;
      if (c === ')') open--;
      pc = c;
    });
  }
  /** Function words, look-alike letters and the constant e, read over each sequence (see Recognizer.wordfix). */
  function readWords(seq) {
    const view = seq.map(n => n.t === 'g' ? Object.assign(n, {b: bx(n), sup: false})
      : {c: [{c: n.t === 'sup' ? '^' : '§', p: 1}], i: 0, locked: true, sup: n.t === 'sup', b: bx(n)});
    R.wordfix(view);
    seq.forEach(n => { if (n.t === 'g') { delete n.b; delete n.sup; } });
  }
  function readAll(seq, top) {
    contextFix(seq, top); readWords(seq);
    for (const n of seq) for (const c of children(n)) readAll(c, false);
  }

  /* ---- Tokens for the maths engine ------------------------------------------------------------ */
  function tokens(seq, top) {
    let A = seq;
    if (top) { let e = A.length; while (e && A[e - 1].t === 'g' && ch(A[e - 1]) === '=') e--; A = A.slice(0, e); }
    const out = [];
    let num = '', word = '';
    const fN = () => { if (num) { out.push(num); num = ''; } };
    const fW = () => {
      if (!word) return;
      if (word === 'e' || word === 'x' || FUNCS.has(word)) out.push(word); else throw new Error('unknown word');
      word = '';
    };
    A.forEach((n, k) => {
      if (n.t === 'g') {
        const c = ch(n);
        if (/[0-9.]/.test(c)) { fW(); num += c; return; }
        if (/[a-z]/.test(c)) { fN(); word += c; return; }
        fN(); fW();
        if (c === '*') {
          const nx = A[k + 1], pv = A[k - 1], nc = nx && nx.t === 'g' ? ch(nx) : '', pc = pv && pv.t === 'g' ? ch(pv) : '';
          out.push(!nx || nx.t === 'sup' || '+-*/=)%'.includes(nc) || !pv || '+-*/=('.includes(pc) ? 'x' : '*');
        } else out.push(c);
        return;
      }
      fN(); fW();
      if (n.t === 'sup') {
        if (!n.body.length) throw new Error('empty exponent');
        out.push('^', '(', ...tokens(n.body), ')');
      } else if (n.t === 'frac') {
        if (!n.num.length || !n.den.length) throw new Error('incomplete fraction');
        out.push('(', '(', ...tokens(n.num), ')', '/', '(', ...tokens(n.den), ')', ')');
      } else {
        out.push('√');
        if (n.body.length) out.push('(', ...tokens(n.body), ')');
        else if (n.reach > BAR_MIN) throw new Error('empty root');
      }
    });
    fN(); fW();
    return out;
  }
  const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  /** Plain-text form (history, sharing). */
  function text(seq) {
    return seq.map(n => {
      if (n.t === 'g') { const c = ch(n); return c === '*' ? '×' : c === '/' ? '÷' : c; }
      if (n.t === 'sup') { const t = text(n.body); return /^[0-9]+$/.test(t) ? [...t].map(d => SUPS[d]).join('') : '^(' + t + ')'; }
      if (n.t === 'frac') return '(' + text(n.num) + ')/(' + text(n.den) + ')';
      return n.body.length ? '√(' + text(n.body) + ')' : '√';
    }).join('');
  }

  /* ---- Persistence ---------------------------------------------------------------------------- */
  function serialize(seq) {
    return seq.map(n => n.t === 'g' ? {c: ch(n)} : n.t === 'sup' ? {s: serialize(n.body)}
      : n.t === 'frac' ? {n: serialize(n.num), d: serialize(n.den)} : {r: serialize(n.body), k: Math.round(n.reach * 100) / 100});
  }
  /** Input must already be validated (Store.cleanTree). */
  function deserialize(list) {
    return list.map(o => o.c !== undefined ? glyph(o.c) : o.s ? sup(deserialize(o.s))
      : o.n ? frac(deserialize(o.n), deserialize(o.d)) : root(deserialize(o.r), o.k));
  }
  /** History entries written before the tree: flat symbols with sup flags, fraction ids and root covers. */
  function fromLegacy(syms) {
    const out = [], fr = new Map();
    let pend = [];   // [root, remaining cover]
    const push = (seq, n, isSup) => {
      const last = seq[seq.length - 1];
      if (isSup) { if (last && last.t === 'sup') last.body.push(n); else seq.push(sup([n])); } else seq.push(n);
    };
    for (const s of syms) {
      let target = out;
      if (s.fp === 'n' || s.fp === 'd') { const f = fr.get(s.fid); if (f) target = s.fp === 'n' ? f.num : f.den; }
      else if (pend.length) { const p = pend[pend.length - 1]; target = p[0].body; if (--p[1] <= 0) pend.pop(); }
      if (s.c === '§') { const f = frac([], []); fr.set(s.fid, f); push(target, f, false); continue; }
      const n = s.c === '√' ? root([], s.cover > 0 ? 1 : 0) : glyph(s.c);
      push(target, n, !!s.sup);
      if (s.c === '√' && s.cover > 0) pend.push([n, s.cover]);
    }
    return out;
  }

  return Object.freeze({GAP, SUP, RAISE, FRAC, BAR_MIN, ch, glyph, sup, frac, root, bx, box, union, unionOf, hasBar, children,
    walk, count, glyphBox, layoutSeq, seqWidth, raised, slot, insert, contentAbove, addFraction, addRoot, extendRoot, findSeq, overwritten,
    barBox, signBox, erase, contextFix, readAll, tokens, text, serialize, deserialize, fromLegacy});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Ink;
