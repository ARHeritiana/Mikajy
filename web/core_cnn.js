/* CNN inference: conv3x3(24) - pool - conv3x3(48) - pool - fc(192) - fc(classes).
 * Runs inside a Web Worker (and, as a fallback, on the main thread), so it must stay self-contained.
 * The model placeholder below is replaced at build time by web/model/model4.f16.json (see build_web.py).
 * Weights are float16 (fmt "f16"); the legacy float32 layout (no `fmt`) is still decoded for tests. */
const M = /*MODEL*/;

const bytesOf = b64 => {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};
/** float16 -> float32 through a 64K lookup table (built once, much faster than per-value maths). */
let F16;
function f16Table() {
  const t = new Float32Array(65536);
  for (let h = 0; h < 65536; h++) {
    const e = (h >> 10) & 31, m = h & 1023, s = h & 0x8000 ? -1 : 1;
    t[h] = e === 0 ? s * m * 5.960464477539063e-8          // subnormal: m * 2^-24
         : e === 31 ? (m ? NaN : s * Infinity)
         : s * Math.pow(2, e - 15) * (1 + m / 1024);
  }
  return t;
}
function decode(b64) {
  const u = bytesOf(b64);
  if (M.fmt !== 'f16') return new Float32Array(u.buffer);
  const h = new Uint16Array(u.buffer), o = new Float32Array(h.length);
  F16 = F16 || f16Table();
  for (let i = 0; i < h.length; i++) o[i] = F16[h[i]];
  return o;
}
const W = {};
for (const k of ['w1', 'b1', 'w2', 'b2', 'w3', 'b3', 'w4', 'b4']) W[k] = decode(M[k]);

const C1 = W.b1.length, C2 = W.b2.length, FC = W.b3.length, NC = W.b4.length;
// Scratch buffers are allocated once: inference is synchronous, so they are never shared.
const A1 = new Float32Array(28 * 28 * C1), P1 = new Float32Array(14 * 14 * C1);
const A2 = new Float32Array(14 * 14 * C2), P2 = new Float32Array(7 * 7 * C2);
const HID = new Float32Array(FC), OUT = new Float32Array(NC);

/** 3x3 "same" convolution + ReLU, NHWC layout, weights [ky][kx][ci][co]. Zero inputs are skipped. */
function conv(x, H, Wd, Ci, w, b, Co, o) {
  for (let y = 0; y < H; y++) for (let xx = 0; xx < Wd; xx++) {
    const op = (y * Wd + xx) * Co;
    for (let c = 0; c < Co; c++) o[op + c] = b[c];
    for (let ky = 0; ky < 3; ky++) {
      const yy = y + ky - 1;
      if (yy < 0 || yy >= H) continue;
      for (let kx = 0; kx < 3; kx++) {
        const x2 = xx + kx - 1;
        if (x2 < 0 || x2 >= Wd) continue;
        const ip = (yy * Wd + x2) * Ci, wp = (ky * 3 + kx) * Ci * Co;
        for (let ci = 0; ci < Ci; ci++) {
          const v = x[ip + ci];
          if (v === 0) continue;
          const wb = wp + ci * Co;
          for (let c = 0; c < Co; c++) o[op + c] += v * w[wb + c];
        }
      }
    }
    for (let c = 0; c < Co; c++) if (o[op + c] < 0) o[op + c] = 0;
  }
}
/** 2x2 max pooling (inputs are post-ReLU, so 0 is a valid floor). */
function pool(x, H, Wd, C, o) {
  const h = H >> 1, w = Wd >> 1;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) for (let c = 0; c < C; c++) {
    const i = ((2 * y) * Wd + 2 * xx) * C + c, rowStep = Wd * C;
    o[(y * w + xx) * C + c] = Math.max(x[i], x[i + C], x[i + rowStep], x[i + rowStep + C]);
  }
}
/** @param {Float32Array} x 28x28 ink image in [0,1]. @returns {number[]} class probabilities. */
function predict(x) {
  conv(x, 28, 28, 1, W.w1, W.b1, C1, A1); pool(A1, 28, 28, C1, P1);
  conv(P1, 14, 14, C1, W.w2, W.b2, C2, A2); pool(A2, 14, 14, C2, P2);
  HID.set(W.b3);
  for (let i = 0; i < 49 * C2; i++) {
    const v = P2[i];
    if (!v) continue;
    const r = i * FC;
    for (let j = 0; j < FC; j++) HID[j] += v * W.w3[r + j];
  }
  OUT.set(W.b4);
  for (let j = 0; j < FC; j++) {
    const h = HID[j];
    if (h <= 0) continue;
    const r = j * NC;
    for (let k = 0; k < NC; k++) OUT[k] += h * W.w4[r + k];
  }
  let mx = -Infinity;
  for (let k = 0; k < NC; k++) if (OUT[k] > mx) mx = OUT[k];
  const p = new Array(NC);
  let s = 0;
  for (let k = 0; k < NC; k++) { p[k] = Math.exp(OUT[k] - mx); s += p[k]; }
  for (let k = 0; k < NC; k++) p[k] /= s;
  return p;
}
