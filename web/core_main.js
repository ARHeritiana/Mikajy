const FC=document.createElement('canvas');FC.width=FC.height=112;const FG=FC.getContext('2d',{willReadFrequently:true});

/* ---- Personalisation: cosine-kNN over the user's confirmed corrections ------------------------
 * MEM entries: {c: class, k: class index, v: Uint8Array(784) as stored, u: v/255 scaled to unit length}.
 * Keeping `u` pre-normalised turns each comparison into one dot product. */
const MAX_SAMPLES = 400, BOOST = 3, MATCH_FLOOR = .75;
const HIDDEN_CLASSES = new Set(['d', 'm', '∫', 'Σ', '→', '∞']);   // legacy classes the model still emits
let MEM = [];
const nrm = v => Math.hypot(...v) || 1;
function unitOf(bytes) {
  const u = new Float32Array(784);
  let s = 0;
  for (let i = 0; i < 784; i++) { const t = bytes[i] / 255; u[i] = t; s += t * t; }
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < 784; i++) u[i] /= n;
  return u;
}
const indexSample = (m, classes) => { m.k = classes.indexOf(m.c); m.u = unitOf(m.v); return m; };
function loadMem(classes) { MEM = Store.loadSamples(localStorage, classes).map(m => indexSample(m, classes)); }

/** Blend the CNN probabilities `p` with the best cosine match per class; return the top-5 candidates. */
function classifyP(p, x) {
  if (MEM.length) {
    const nx = nrm(x), best = new Array(p.length).fill(0);
    for (const m of MEM) {
      let d = 0;
      for (let i = 0; i < 784; i++) d += x[i] * m.u[i];
      d /= nx;
      if (d > best[m.k]) best[m.k] = d;
    }
    let s = 0;
    for (let k = 0; k < p.length; k++) { p[k] += BOOST * Math.max(0, best[k] - MATCH_FLOOR); s += p[k]; }
    for (let k = 0; k < p.length; k++) p[k] /= s;
  }
  return p.map((v, i) => ({c: CLS[i], p: v})).filter(o => !HIDDEN_CLASSES.has(o.c)).sort((u, v) => v.p - u.p).slice(0, 5);
}
function remember(x, c) {
  const v = Uint8Array.from(x, t => Math.min(255, Math.round(t * 255)));
  MEM.push(indexSample({c, v}, CLS));
  if (MEM.length > MAX_SAMPLES) MEM.shift();
  Store.saveSamples(localStorage, MEM);
}

const bb=s=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const[x,y]of s){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}return{x0,y0,x1,y1,w:x1-x0,h:y1-y0}};
const un=(a,b)=>{const x0=Math.min(a.x0,b.x0),y0=Math.min(a.y0,b.y0),x1=Math.max(a.x1,b.x1),y1=Math.max(a.y1,b.y1);return{x0,y0,x1,y1,w:x1-x0,h:y1-y0}};
function feat(ss){let b=ss.map(bb).reduce(un);const sz=Math.max(b.w,b.h,1),k=80/sz,cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;
 const g=FG;g.setTransform(1,0,0,1,0,0);g.fillStyle='#000';g.fillRect(0,0,112,112);
 g.strokeStyle=g.fillStyle='#fff';g.lineWidth=11.6;g.lineCap=g.lineJoin='round';
 for(const s of ss){const P=s.map(([x,y])=>[(x-cx)*k+56,(y-cy)*k+56]);g.beginPath();g.moveTo(...P[0]);
  if(P.length==1){g.arc(P[0][0],P[0][1],5.8,0,7);g.fill()}else{for(const q of P)g.lineTo(...q);g.stroke()}}
 const d=g.getImageData(0,0,112,112).data,o=new Float32Array(784);
 for(let y=0;y<112;y++)for(let x=0;x<112;x++)o[(y>>2)*28+(x>>2)]+=d[(y*112+x)*4]/255/16;return o}
/** Strokes -> symbols, independent of drawing order (see Recognizer.groupStrokes). */
const group=S=>Recognizer.groupStrokes(S);
