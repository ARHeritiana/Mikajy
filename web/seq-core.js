/* Stroke-sequence recogniser: raw pen strokes in, LaTeX-like tokens out.
 * Mirrors training/strokefeat.py + training/seqmodel.py (pre-LN transformer, GELU tanh, encoder over strokes, greedy decoder with a KV cache).
 * Pure functions, no DOM, no network: the model is passed to SeqCore.load(). Weights are int8 per output row (see training/pack_seq.py). */
const SeqCore = (() => {
  'use strict';
  const K = 24, FREQS = 6;

  /* ---- Featurisation (identical to strokefeat.featurise) ------------------------------------ */
  function resample(pts) {
    const n = pts.length, out = new Float64Array(K * 2);
    if (n === 1) { for (let k = 0; k < K; k++) { out[2 * k] = pts[0][0]; out[2 * k + 1] = pts[0][1]; } return out; }
    const d = new Float64Array(n);
    for (let i = 1; i < n; i++) d[i] = d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d[n - 1] < 1e-6) { for (let k = 0; k < K; k++) { out[2 * k] = pts[0][0]; out[2 * k + 1] = pts[0][1]; } return out; }
    let j = 0;
    for (let k = 0; k < K; k++) {
      const u = d[n - 1] * k / (K - 1);
      while (j < n - 2 && d[j + 1] < u) j++;
      const span = d[j + 1] - d[j], f = span > 0 ? (u - d[j]) / span : 0;
      out[2 * k] = pts[j][0] + f * (pts[j + 1][0] - pts[j][0]);
      out[2 * k + 1] = pts[j][1] + f * (pts[j + 1][1] - pts[j][1]);
    }
    return out;
  }

  /** strokes: [{pts: [[x, y, t_ms], ...]}] or [[[x, y, t], ...]] -> {P: Float32Array[S*K*2], T: Float32Array[S*3], S} */
  function featurise(strokes) {
    const raw = strokes.map(s => s.pts || s), S = raw.length, rs = raw.map(resample);
    let mnx = Infinity, mny = Infinity;
    const ext = new Float64Array(S);
    rs.forEach((r, i) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = 0; k < K; k++) { x0 = Math.min(x0, r[2 * k]); x1 = Math.max(x1, r[2 * k]); y0 = Math.min(y0, r[2 * k + 1]); y1 = Math.max(y1, r[2 * k + 1]); }
      mnx = Math.min(mnx, x0); mny = Math.min(mny, y0); ext[i] = Math.max(x1 - x0, y1 - y0, 1e-3);
    });
    const sorted = Array.from(ext).sort((a, b) => a - b);
    const med = S % 2 ? sorted[S >> 1] : (sorted[S / 2 - 1] + sorted[S / 2]) / 2;      // numpy.median
    const unit = Math.max(med, 4);
    const P = new Float32Array(S * K * 2), T = new Float32Array(S * 3);
    rs.forEach((r, i) => { for (let k = 0; k < K; k++) { P[(i * K + k) * 2] = (r[2 * k] - mnx) / unit; P[(i * K + k) * 2 + 1] = (r[2 * k + 1] - mny) / unit; } });
    for (let i = 0; i < S; i++) {
      const a = raw[i], t0 = a[0][2] || 0, t1 = a[a.length - 1][2] || 0, pe = i ? (raw[i - 1][raw[i - 1].length - 1][2] || 0) : t0;
      T[i * 3] = Math.log1p(Math.max(t0 - pe, 0) / 100); T[i * 3 + 1] = Math.log1p(Math.max(t1 - t0, 0) / 100); T[i * 3 + 2] = i / Math.max(S - 1, 1);
    }
    return {P, T, S};
  }

  /* ---- Weights ------------------------------------------------------------------------------- */
  const b64 = s => {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
    const bin = atob(s), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  };
  function f16(u8) {
    const h = new Uint16Array(u8.buffer, u8.byteOffset, u8.byteLength >> 1), o = new Float32Array(h.length);
    for (let i = 0; i < h.length; i++) {
      const e = (h[i] >> 10) & 31, m = h[i] & 1023, s = h[i] & 0x8000 ? -1 : 1;
      o[i] = e === 0 ? s * m * 5.960464477539063e-8 : e === 31 ? (m ? NaN : s * Infinity) : s * Math.pow(2, e - 15) * (1 + m / 1024);
    }
    return o;
  }
  /** model = {cfg:{d,ff,layers}, vocab:[...], tensors:{name:{shape, fmt:'i8'|'f16', data:b64, scale?:b64(f16 per row)}}} */
  function load(model) {
    const W = {};
    for (const [name, t] of Object.entries(model.tensors)) {
      const u = b64(t.data);
      if (t.fmt === 'f16') { W[name] = f16(u); continue; }
      const q = new Int8Array(u.buffer, u.byteOffset, u.byteLength), sc = f16(b64(t.scale)), cols = t.shape[1], o = new Float32Array(q.length);
      for (let r = 0; r < sc.length; r++) for (let c = 0; c < cols; c++) o[r * cols + c] = q[r * cols + c] * sc[r];
      W[name] = o;
    }
    return {W, cfg: model.cfg, vocab: model.vocab, bos: model.vocab.indexOf('<bos>'), eos: model.vocab.indexOf('<eos>')};
  }

  /* ---- Linear algebra ------------------------------------------------------------------------- */
  /** y[n,out] = x[n,in] @ w[out,in]^T + b */
  function linear(x, n, inD, w, b, outD) {
    const y = new Float32Array(n * outD);
    for (let i = 0; i < n; i++) {
      const xo = i * inD, yo = i * outD;
      for (let o = 0; o < outD; o++) {
        let s = b ? b[o] : 0;
        const wo = o * inD;
        for (let k = 0; k < inD; k++) s += x[xo + k] * w[wo + k];
        y[yo + o] = s;
      }
    }
    return y;
  }
  function layerNorm(x, n, d, g, b) {
    const y = new Float32Array(n * d);
    for (let i = 0; i < n; i++) {
      let m = 0, v = 0;
      for (let k = 0; k < d; k++) m += x[i * d + k];
      m /= d;
      for (let k = 0; k < d; k++) { const c = x[i * d + k] - m; v += c * c; }
      const r = 1 / Math.sqrt(v / d + 1e-5);
      for (let k = 0; k < d; k++) y[i * d + k] = (x[i * d + k] - m) * r * g[k] + b[k];
    }
    return y;
  }
  const gelu = v => 0.5 * v * (1 + Math.tanh(0.7978845608028654 * (v + 0.044715 * v * v * v)));
  /** multi-head attention of q[nq,d] over k,v[nk,d]; `limit(i)` = number of keys visible to query i. */
  function attend(q, nq, k, v, nk, d, h, limit) {
    const hd = d / h, out = new Float32Array(nq * d), sc = new Float32Array(nk), s = 1 / Math.sqrt(hd);
    for (let i = 0; i < nq; i++) {
      const lim = limit(i);
      for (let a = 0; a < h; a++) {
        let mx = -Infinity;
        for (let j = 0; j < lim; j++) {
          let dot = 0;
          for (let c = 0; c < hd; c++) dot += q[i * d + a * hd + c] * k[j * d + a * hd + c];
          sc[j] = dot * s; if (sc[j] > mx) mx = sc[j];
        }
        let z = 0;
        for (let j = 0; j < lim; j++) { sc[j] = Math.exp(sc[j] - mx); z += sc[j]; }
        for (let j = 0; j < lim; j++) {
          const p = sc[j] / z;
          for (let c = 0; c < hd; c++) out[i * d + a * hd + c] += p * v[j * d + a * hd + c];
        }
      }
    }
    return out;
  }
  const addTo = (a, b) => { for (let i = 0; i < a.length; i++) a[i] += b[i]; };

  /* ---- Model ---------------------------------------------------------------------------------- */
  function strokeFeatures(P, T, S) {
    const F = K * 2 + 6 + 3 + 4 * FREQS, out = new Float32Array(S * F);
    for (let i = 0; i < S; i++) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = 0; k < K; k++) { const x = P[(i * K + k) * 2], y = P[(i * K + k) * 2 + 1]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const w = x1 - x0, hh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, sz = Math.max(w, hh, 0.05), o = i * F;
      for (let k = 0; k < K; k++) { out[o + 2 * k] = (P[(i * K + k) * 2] - cx) / sz; out[o + 2 * k + 1] = (P[(i * K + k) * 2 + 1] - cy) / sz; }
      let p = K * 2;
      out[o + p++] = x0; out[o + p++] = y0; out[o + p++] = x1; out[o + p++] = y1; out[o + p++] = w; out[o + p++] = hh;
      out[o + p++] = T[i * 3]; out[o + p++] = T[i * 3 + 1]; out[o + p++] = T[i * 3 + 2];
      // torch layout: [sin(cx f_0..f_5), cos(cx f_0..), sin(cy f_0..), cos(cy ..)]... flattened from [2, 2*FREQS] -> per coordinate sin block then cos block
      for (const c of [cx, cy]) {
        for (let f = 0; f < FREQS; f++) out[o + p + f] = Math.sin(c * Math.pow(2, f) * Math.PI / 8);
        for (let f = 0; f < FREQS; f++) out[o + p + FREQS + f] = Math.cos(c * Math.pow(2, f) * Math.PI / 8);
        p += 2 * FREQS;
      }
    }
    return {F, x: out};
  }

  function encode(M, P, T, S) {
    const {W, cfg} = M, d = cfg.d, h = d / 32, ff = cfg.ff;
    const {F, x: feat} = strokeFeatures(P, T, S);
    let x = linear(feat, S, F, W['in1.weight'], W['in1.bias'], d);
    for (let i = 0; i < x.length; i++) x[i] = gelu(x[i]);
    x = linear(x, S, d, W['in2.weight'], W['in2.bias'], d);
    for (let i = 0; i < S; i++) for (let c = 0; c < d; c++) x[i * d + c] += W['idx.weight'][Math.min(i, 159) * d + c];
    for (let l = 0; l < cfg.layers; l++) {
      const p = `enc.${l}.`;
      const n = layerNorm(x, S, d, W[p + 'n1.weight'], W[p + 'n1.bias']);
      const q = linear(n, S, d, W[p + 'a1.q.weight'], W[p + 'a1.q.bias'], d), k = linear(n, S, d, W[p + 'a1.k.weight'], W[p + 'a1.k.bias'], d), v = linear(n, S, d, W[p + 'a1.v.weight'], W[p + 'a1.v.bias'], d);
      addTo(x, linear(attend(q, S, k, v, S, d, h, () => S), S, d, W[p + 'a1.o.weight'], W[p + 'a1.o.bias'], d));
      const m = layerNorm(x, S, d, W[p + 'n3.weight'], W[p + 'n3.bias']);
      const u = linear(m, S, d, W[p + 'f1.weight'], W[p + 'f1.bias'], ff);
      for (let i = 0; i < u.length; i++) u[i] = gelu(u[i]);
      addTo(x, linear(u, S, ff, W[p + 'f2.weight'], W[p + 'f2.bias'], d));
    }
    const enc = layerNorm(x, S, d, W['encn.weight'], W['encn.bias']), cross = [];
    for (let l = 0; l < cfg.layers; l++) {
      const p = `dec.${l}.a2.`;
      cross.push({k: linear(enc, S, d, W[p + 'k.weight'], W[p + 'k.bias'], d), v: linear(enc, S, d, W[p + 'v.weight'], W[p + 'v.bias'], d)});
    }
    return {S, cross};
  }

  /** Greedy decode. Returns the token strings (without bos/eos). `maxLen` caps runaway output. */
  function decode(M, E, maxLen = 120) {
    const {W, cfg, vocab} = M, d = cfg.d, h = d / 32, ff = cfg.ff, V = vocab.length, L = cfg.layers;
    const selfK = Array.from({length: L}, () => new Float32Array(maxLen * d)), selfV = Array.from({length: L}, () => new Float32Array(maxLen * d));
    const out = [];
    let tok = M.bos;
    for (let t = 0; t < maxLen; t++) {
      let x = new Float32Array(d);
      for (let c = 0; c < d; c++) x[c] = W['emb.weight'][tok * d + c] + W['pos.weight'][t * d + c];
      for (let l = 0; l < L; l++) {
        const p = `dec.${l}.`;
        let n = layerNorm(x, 1, d, W[p + 'n1.weight'], W[p + 'n1.bias']);
        const q = linear(n, 1, d, W[p + 'a1.q.weight'], W[p + 'a1.q.bias'], d), k = linear(n, 1, d, W[p + 'a1.k.weight'], W[p + 'a1.k.bias'], d), v = linear(n, 1, d, W[p + 'a1.v.weight'], W[p + 'a1.v.bias'], d);
        selfK[l].set(k, t * d); selfV[l].set(v, t * d);
        addTo(x, linear(attend(q, 1, selfK[l], selfV[l], t + 1, d, h, () => t + 1), 1, d, W[p + 'a1.o.weight'], W[p + 'a1.o.bias'], d));
        n = layerNorm(x, 1, d, W[p + 'n2.weight'], W[p + 'n2.bias']);
        const q2 = linear(n, 1, d, W[p + 'a2.q.weight'], W[p + 'a2.q.bias'], d);
        addTo(x, linear(attend(q2, 1, E.cross[l].k, E.cross[l].v, E.S, d, h, () => E.S), 1, d, W[p + 'a2.o.weight'], W[p + 'a2.o.bias'], d));
        n = layerNorm(x, 1, d, W[p + 'n3.weight'], W[p + 'n3.bias']);
        const u = linear(n, 1, d, W[p + 'f1.weight'], W[p + 'f1.bias'], ff);
        for (let i = 0; i < u.length; i++) u[i] = gelu(u[i]);
        addTo(x, linear(u, 1, ff, W[p + 'f2.weight'], W[p + 'f2.bias'], d));
      }
      const z = layerNorm(x, 1, d, W['decn.weight'], W['decn.bias']);
      let best = -1, bv = -Infinity;
      for (let o = 0; o < V; o++) {
        let s = 0;
        for (let c = 0; c < d; c++) s += z[c] * W['emb.weight'][o * d + c];
        if (s > bv) { bv = s; best = o; }
      }
      if (best === M.eos) break;
      out.push(vocab[best]); tok = best;
    }
    return out;
  }

  /** Strokes -> token list. Lines are separated by the '<nl>' token. */
  function recognise(M, strokes, maxLen) {
    if (!strokes.length) return [];
    const {P, T, S} = featurise(strokes);
    return decode(M, encode(M, P, T, Math.min(S, 160)), maxLen);
  }
  /** Tokens -> LaTeX text, one string per line. */
  function toLatex(tokens) {
    const lines = [[]];
    for (const t of tokens) t === '<nl>' ? lines.push([]) : lines[lines.length - 1].push(t);
    return lines.map(l => l.join(' '));
  }

  /* ---- LaTeX tokens -> the token list math-core.js parses ------------------------------------
   * Handles what the engine can evaluate (numbers, x, i, e, π, + - × ÷, powers, fractions, roots, functions, brackets, factorial, %);
   * anything else (matrices, mod, determinants, ...) is reported through `unsupported` so the caller can show it without an answer. */
  const FUNCTION_WORDS = new Set(['sin', 'cos', 'tan', 'ln', 'log', 'exp', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan']);
  const ARC = {arcsin: 'asin', arccos: 'acos', arctan: 'atan'};
  function toMathTokens(tokens, {complex = false} = {}) {
    let i = 0;
    const out = [], fail = why => { const e = new Error(why); e.unsupported = true; throw e; };
    const peek = () => tokens[i], next = () => tokens[i++];
    function group() {                       // {...} -> emitted flat; returns nothing
      if (next() !== '{') fail('syntax');
      seq('}'); if (next() !== '}') fail('syntax');
    }
    function wrapped(fn) { out.push('('); fn(); out.push(')'); }
    function seq(stop) {
      while (i < tokens.length && peek() !== stop) {
        const t = next();
        if (/^[0-9.]$/.test(t)) { let n = t; while (i < tokens.length && /^[0-9.]$/.test(peek())) n += next(); out.push(n); }
        else if (t === '{') { i--; group(); }
        else if (t === '^') { out.push('^'); wrapped(() => { if (peek() === '{') group(); else out.push(next()); }); }
        else if (t === '\\frac') { wrapped(() => { out.push('('); group(); out.push(')'); out.push('/'); out.push('('); group(); out.push(')'); }); }
        else if (t === '\\sqrt') { out.push('√'); wrapped(() => group()); }
        else if (t === '\\times') out.push('*');
        else if (t === '\\div') out.push('/');
        else if (t === '\\pi') out.push('π');
        else if (t === '\\left' || t === '\\right') { /* the bracket token follows */ }
        else if (t === '(' || t === ')' || t === '+' || t === '-' || t === '=' || t === '!' || t === '%') out.push(t);
        else if (t === 'x' || t === 'e') out.push(t);
        else if (t === 'i') { if (!complex) fail('i needs the complex setting'); out.push('i'); }
        else if (t.startsWith('\\') && FUNCTION_WORDS.has(t.slice(1))) out.push(ARC[t.slice(1)] || t.slice(1));
        else fail('unsupported: ' + t);
      }
    }
    seq(undefined);
    while (out.length && out[out.length - 1] === '=') out.pop();   // trailing "=" asks for the answer, as on the board
    return out;
  }

  /* ---- LaTeX tokens -> board glyph specs --------------------------------------------------------
   * The board stores a line as a flat list of glyphs: {c, sup?, fp?, fid?, wb?, mul?, cover?}.
   * A top-level fraction is [bar(fp 'bar'), numerator glyphs(fp 'n'), denominator glyphs(fp 'd')] sharing one fid; a root carries
   * `cover` = how many following glyphs of the same sequence it spans; `wb` marks the first letter of a word (sin, x, a) so that
   * "sin x" is not read as the word "sinx".  A fraction nested in a numerator / denominator is a bar glyph with pfid/pfp (the part it sits in) and stays stacked up to 3 levels;
   fractions inside exponents are written inline as (a)/(b). */
  const WORD_OF = {bmod: 'mod', mod: 'mod', pmod: 'mod'};
  function toGlyphs(tokens) {
    let i = 0, fids = 0;
    const flat = [], peek = () => tokens[i], next = () => tokens[i++];
    const glyph = (c, ctx, extra) => { const g = Object.assign({c}, extra); if (ctx.sup) g.sup = true; if (ctx.fid) { g.fp = ctx.fp; g.fid = ctx.fid; } flat.push(g); ctx.cnt.n++; return g; };
    function item(ctx) {
      if (peek() === '{') { next(); run(ctx, '}'); if (peek() === '}') next(); } else if (i < tokens.length) one(ctx, next());
    }
    function run(ctx, stop) { while (i < tokens.length && peek() !== stop) one(ctx, next()); }
    function word(w, ctx) { [...w].forEach((c, k) => glyph(c, ctx, k ? undefined : {wb: true})); }
    function one(ctx, t) {
      if (t === '{') { run(ctx, '}'); if (peek() === '}') next(); }
      else if (t === '}' || t === '<nl>' || t === '\\left' || t === '\\right' || t === '\\quad') { /* structure only */ }
      else if (t === '^') item(Object.assign({}, ctx, {sup: true}));
      else if (t === '\\frac') {
        if (ctx.sup || (ctx.fid && ctx.depth >= 3)) {                  // inside an exponent, or nested too deep: inline (a)/(b)
          glyph('(', ctx); item(ctx); glyph(')', ctx); glyph('/', ctx); glyph('(', ctx); item(ctx); glyph(')', ctx);
        } else if (ctx.fid) {                                          // a fraction inside a numerator / denominator stays stacked
          const id = ++fids, bar = glyph('§', ctx);
          bar.pfid = ctx.fid; bar.pfp = ctx.fp; bar.fp = 'bar'; bar.fid = id;   // its own bar; the parent link says which part it sits in
          item({sup: false, fid: id, fp: 'n', cnt: {n: 0}, depth: (ctx.depth || 1) + 1}); item({sup: false, fid: id, fp: 'd', cnt: {n: 0}, depth: (ctx.depth || 1) + 1});
        } else {
          const id = ++fids; glyph('§', ctx, {fp: 'bar', fid: id});
          item({sup: false, fid: id, fp: 'n', cnt: {n: 0}, depth: 1}); item({sup: false, fid: id, fp: 'd', cnt: {n: 0}, depth: 1});
        }
      } else if (t === '\\sqrt') { const g = glyph('√', ctx), before = ctx.cnt.n; item(ctx); g.cover = ctx.cnt.n - before; }
      else if (t === '\\times') glyph('*', ctx, {mul: true});
      else if (t === '\\div') glyph('/', ctx);
      else if (t === '\\pi') glyph('π', ctx);
      else if (t === '\\equiv') glyph('≡', ctx);
      else if (t === '\\begin' || t === '\\end') {                  // \begin{bmatrix} ... \end{bmatrix}: brackets only, never the environment's name
        let name = ''; if (peek() === '{') { next(); while (i < tokens.length && peek() !== '}') name += next(); if (peek() === '}') next(); }
        const pair = {bmatrix: '[]', matrix: '[]', pmatrix: '()', vmatrix: '||'}[name] || '[]';
        glyph(pair[t === '\\begin' ? 0 : 1], ctx);
      }
      else if (t === '&') glyph(',', ctx);
      else if (t === '\\\\') glyph(';', ctx);
      else if (t === '\\overline') { item(ctx); }
      else if (t.startsWith('\\')) word(WORD_OF[t.slice(1)] || t.slice(1), ctx);
      else if (/^[a-zA-Z]$/.test(t)) glyph(t, ctx, {wb: true});
      else glyph(t, ctx);
    }
    run({cnt: {n: 0}}, undefined);
    return flat;
  }

  return Object.freeze({K, featurise, load, encode, decode, recognise, toLatex, toMathTokens, toGlyphs});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SeqCore;
