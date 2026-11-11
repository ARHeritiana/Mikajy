/* Mikajy Spark: canvas, pen input, animation and editing. The mathematics of what was written lives in the
 * expression tree (ink.js); this file turns pen strokes into tree edits and draws the tree. */
const cv=document.getElementById('pad');let ctx=cv.getContext('2d');const $=id=>document.getElementById(id);
let DPR=1,lastL=null,lp=null,drag=null,SW=0,SH=0,lines=[],fx=[],ghosts=[],cur=null,down=null,started=false,rt=null,raf=0,tPrev=0;
const FONT='H, serif';
const disp=c=>c=='*'?'×':c=='/'?'÷':c=='-'?'−':c;
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const ch=Ink.ch;
let SET=SettingsStore.load(localStorage);
let LANG=I18n.resolve(SET.lang,navigator.language),TAB='actions';
const T=(k,p)=>I18n.t(LANG,k,p);
function applyLang(){document.documentElement.lang=LANG;$('pad').setAttribute('aria-label',T('canvasAria'));$('mb').setAttribute('aria-label',T('menuAria'))}
function saveSet(){SettingsStore.save(localStorage,SET)}
const PALETTES={
 dark:{ink:'#f4f4f4',accent:'#ff2a36',canvas:'#000000',dragBackground:'#151515',dragShadow:'rgba(255,42,54,.35)'},
 light:{ink:'#000000',accent:'#d71920',canvas:'#ffffff',dragBackground:'#ffffff',dragShadow:'rgba(0,0,0,.25)'}
};
if(!Object.hasOwn(PALETTES,SET.theme))SET.theme='dark';
let palette=PALETTES[SET.theme];
function applyTheme(){
 palette=PALETTES[SET.theme]||PALETTES.dark;
 document.documentElement.dataset.theme=SET.theme;
 const bar=document.querySelector('meta[name="theme-color"]');
 if(bar)bar.content=palette.canvas;
 kick();
}

/* ---------- timing ---------- */
const RECOGNISE_MS=550;   // pause after the last stroke before it is read
const REOPEN_MS=1800;     // a stroke crossing a symbol read this recently completes that symbol (= + i 5 π x 4)

/* ---------- glyph metrics: advance widths measured once per character ---------- */
const ADV=new Map();
function M(c){let w=ADV.get(c);if(w===undefined){if(c=='√')w=.62;else{ctx.font='100px '+FONT;w=ctx.measureText(disp(c)).width/100}ADV.set(c,w)}return w}

/* ---------- lines ---------- */
/* A line: {seq: expression tree, ans: answer tree, ink: strokes waiting to be read, F: font size, base, x0, at: answer text}. */
const newLine=o=>Object.assign({seq:[],ans:[],ink:[],x0:0,base:0,F:80,at:null},o);
/** Visual nodes of a tree (the ones that are drawn and animated): glyphs, fraction bars, root signs. */
function visuals(seq,out=[]){Ink.walk(seq,n=>{if(n.t!='sup')out.push(n)});return out}
const allNodes=L=>visuals(L.seq,visuals(L.ans));
function layoutLine(L){
 const F=L.F,w=Ink.layoutSeq(L.seq,0,0,F,M)+(L.ans.length?.22*F+Ink.layoutSeq(L.ans,0,0,F,M):0);
 let x0=L.x0,f=Math.min(1,(SW-24-x0)/Math.max(w,1));if(f<.6){x0=12;f=Math.min(1,(SW-24)/Math.max(w,1))}
 const s=F*f,base=Math.min(SH-24,Math.max(s*.95+12,L.base)),e=Ink.layoutSeq(L.seq,x0,base,s,M);
 if(L.ans.length)Ink.layoutSeq(L.ans,e+.16*s,base,s,M);
 L.s=s;L.y=base;L.box=Ink.unionOf(L.seq.concat(L.ans));
 for(const n of allNodes(L))if(n.x===undefined)snap(n)}
/** Puts a node directly at its target, invisible, ready to fade in. */
function snap(n){n.x=n.tx;n.y=n.ty;n.sz=n.tsz||n.ts;n.bw=n.tbw;n.vx=n.tvx;n.top=n.ttop;n.a=0;n.ta=1}

/* ---------- animation ---------- */
const PAIRS=[['x','tx'],['y','ty'],['sz','tsz'],['bw','tbw'],['vx','tvx'],['top','ttop']];
function stepN(n,dt,now){if(now<(n.delay||0))return true;const k=1-Math.exp(-dt*11),ka=1-Math.exp(-dt*10);let r=false;
 for(const[p,t]of PAIRS){const v=n[t];if(v===undefined)continue;if(n[p]===undefined)n[p]=v;n[p]+=(v-n[p])*k;if(Math.abs(v-n[p])>.25)r=true;else n[p]=v}
 if(n.ta===undefined)n.ta=1;if(n.a===undefined)n.a=0;n.a+=(n.ta-n.a)*ka;if(Math.abs(n.ta-n.a)>.01)r=true;else n.a=n.ta;
 if(n.ot>0){n.ot=Math.max(0,n.ot-dt*4);r=true}return r}
function step(dt,now){let act=false;for(const L of lines)for(const n of allNodes(L))if(stepN(n,dt,now))act=true;
 for(const n of fx)if(stepN(n,dt,now))act=true;if(fx.length)fx=fx.filter(n=>n.a>.02);
 if(ghosts.length)ghosts=ghosts.filter(g=>now-g.t0<420);return act||ghosts.length>0}
function kick(){if(!raf){tPrev=performance.now();raf=requestAnimationFrame(frame)}}
function frame(now){raf=0;const dt=Math.min(.05,(now-tPrev)/1000);tPrev=now;const act=step(dt,now);render(now);if(act||cur)kick()}
/** Fades a node (and everything inside it) out. */
function kill(n){for(const v of visuals([n])){v.ta=0;v.tsz=(v.tsz||v.sz)*.8;v.ty=(v.ty??v.y)+14;v.ink=null;v.delay=0;fx.push(v)}}

/* ---------- drawing ---------- */
function fit(){const d=DPR=Math.min(devicePixelRatio||1,2);SW=innerWidth;SH=innerHeight;cv.width=SW*d;cv.height=SH*d;ADV.clear();lines.forEach(layoutLine);kick()}
function strokePath(s){ctx.beginPath();ctx.moveTo(...s[0]);ctx.lineTo(...mid(s[0],s[1]));for(let i=1;i<s.length-1;i++)ctx.quadraticCurveTo(...s[i],...mid(s[i],s[i+1]));ctx.lineTo(...s[s.length-1]);ctx.stroke()}
function drawInk(s,a){if(a<=.01||!s.length)return;ctx.globalAlpha=a;ctx.strokeStyle=ctx.fillStyle=palette.ink;ctx.lineWidth=4.5;ctx.lineCap=ctx.lineJoin='round';
 if(s.length==1){ctx.beginPath();ctx.arc(s[0][0],s[0][1],2.6,0,7);ctx.fill()}else strokePath(s);ctx.globalAlpha=1}
function drawNode(n){const a=Math.max(0,Math.min(1,n.a));if(a<=.005&&!n.ink)return;const col=n.ans?palette.accent:palette.ink;ctx.globalAlpha=a;ctx.strokeStyle=ctx.fillStyle=col;ctx.lineCap=ctx.lineJoin='round';
 if(n.t=='frac'){ctx.lineWidth=Math.max(2.5,(n.ts||60)*.05);ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(n.x+n.bw,n.y);ctx.stroke()}
 else if(n.t=='root'){const s=n.sz,x=n.x,y=n.y,top=n.top;ctx.lineWidth=Math.max(2,s*.055);ctx.beginPath();ctx.moveTo(x+.02*s,y-.36*s);ctx.lineTo(x+.1*s,y-.43*s);ctx.lineTo(x+.26*s,y-.02*s);ctx.lineTo(x+.5*s,top);ctx.lineTo(Math.max(n.vx,x+.56*s),top);ctx.stroke()}
 else{ctx.font=Math.round(n.sz)+'px '+FONT;ctx.textBaseline='alphabetic';
  if(n.ot>0&&n.old){ctx.globalAlpha=a*n.ot;ctx.fillText(disp(n.old),n.x,n.y);ctx.globalAlpha=a*(1-n.ot)}ctx.fillText(disp(ch(n)),n.x,n.y)}
 ctx.globalAlpha=1;
 if(n.ink){if(n.a<.99){const k=Math.max(0,1-n.a*1.1);n.ink.forEach(s=>drawInk(s.full||s,k))}else n.ink=null}}
function render(now){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.setTransform(DPR,0,0,DPR,0,0);
 if(!started&&!lines.length&&!cur){ctx.globalAlpha=.25;ctx.fillStyle=palette.ink;ctx.font='54px '+FONT;ctx.textAlign='center';ctx.fillText(T('writeHint'),SW/2,SH/2);ctx.textAlign='left';ctx.globalAlpha=1}
 for(const L of lines){allNodes(L).forEach(drawNode);L.ink.forEach(s=>drawInk(s.full||s,1))}
 fx.forEach(drawNode);ghosts.forEach(g=>drawInk(g.pts,1-(now-g.t0)/420));
 if(cur)drawInk(cur.length>1&&(cur.raw||cur.pred)?cur.concat(cur.raw?[cur.raw]:[],cur.pred||[]):cur,1);   // live stroke up to the pen tip (+ predicted points; never stored)
 if(drag){ctx.font='44px '+FONT;const w=ctx.measureText(drag.text).width+30,x=drag.x-w/2,y=drag.y-86;ctx.save();ctx.shadowColor=palette.dragShadow;ctx.shadowBlur=16;ctx.shadowOffsetY=4;ctx.fillStyle=palette.dragBackground;ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,60,16):ctx.rect(x,y,w,60);ctx.fill();ctx.restore();ctx.strokeStyle=palette.accent;ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,60,16):ctx.rect(x,y,w,60);ctx.stroke();ctx.fillStyle=palette.accent;ctx.textBaseline='middle';ctx.fillText(drag.text,x+15,y+32);ctx.textBaseline='alphabetic'}}
/** On-screen box of a node right now (hit tests for taps and drags). */
function nowBox(n){if(n.t=='frac')return{x0:n.x,x1:n.x+n.bw,y0:n.y-.12*n.ts,y1:n.y+.12*n.ts};if(n.t=='root')return{x0:n.x,x1:Math.max(n.vx,n.x+.56*n.sz),y0:n.top,y1:n.y};
 const b=Ink.glyphBox(ch(n),n.x,n.y,n.sz,n.w||M(ch(n))*n.sz);return{x0:b.x0,x1:b.x1,y0:Math.min(b.y0,n.y-.62*n.sz),y1:Math.max(b.y1,n.y+.12*n.sz)}}

/* ---------- answers ---------- */
function computeAns(L){const top=L.seq[L.seq.length-1],trailingEquals=!!(top&&top.t=='g'&&ch(top)=='=');let tokens;
 try{tokens=Ink.tokens(L.seq,true)}catch(_){return null}
 return Calculator.compute(tokens,{...SET,lang:LANG},trailingEquals)}
function buildAns(pieces){const now=performance.now();let k=0;const out=[],d=()=>now+200+(k++)*60,g=c=>Ink.glyph(c,{ans:true,delay:d()});
 for(const p of pieces){if(p.s!==undefined)[...p.s].forEach(c=>{if(c!=' ')out.push(g(c))});
  else{const f=Ink.frac([],[]);f.ans=true;f.delay=d();f.num=[...p.f[0]].map(g);f.den=[...p.f[1]].map(g);out.push(f)}}
 return out}
function updateAns(L){const r=computeAns(L),key=r?r.text:null;if(key===L.at)return;L.at=key;L.val=r?r.val:undefined;lastL=L;L.ans.forEach(kill);L.ans=[];
 if(r){L.ans=buildAns(r.pieces);layoutLine(L);for(const n of visuals(L.ans)){snap(n);n.x+=4;n.y+=L.F*.3;if(n.t=='frac')n.bw=0}}else layoutLine(L);
 if(r&&window.histSave)histSave(L)}
const relayout=L=>{layoutLine(L);updateAns(L);kick()};

/* ---------- strokes: which line, roots, bars ---------- */
const isBar=s=>{const b=bb(s);return!s.vin&&b.w>=56&&b.h<.2*b.w};
/** Horizontal band of the canvas that belongs to a line: its content, room for exponents, pending fraction parts and ink. */
function region(L){let r=null;
 if(L.box&&L.seq.length){const s=L.s;r={y0:Math.min(L.box.y0,L.y-1.05*s)-.25*s,y1:Math.max(L.box.y1,L.y+.3*s)+.25*s};
  Ink.walk(L.seq,n=>{if(n.t!='frac'||!n.bar)return;if(!n.den.length)r.y1=Math.max(r.y1,n.bar.y+1.5*n.ts);if(!n.num.length)r.y0=Math.min(r.y0,n.bar.y-1.4*n.ts)})}
 if(L.ink.length){const q=L.ink.map(bb).reduce(un),m=Math.max(.4*q.h+10,35);r=r?{y0:Math.min(r.y0,q.y0-m),y1:Math.max(r.y1,q.y1+m)}:{y0:q.y0-m,y1:q.y1+m}}
 return r}
function attach(s){const b=bb(s),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;let best=null,bd=1e9;
 for(const L of lines){const r=region(L);if(!r||cy<r.y0||cy>r.y1)continue;const d=Math.abs(cy-(L.box?L.y-.3*L.s:(r.y0+r.y1)/2));if(d<bd){bd=d;best=L}}
 if(best)best.ink.push(s);else lines.push(newLine({ink:[s]}))}
/* A hand-drawn root sign: tick, down-stroke, rise, then the bar (the vinculum) over the radicand. The bar may be flat, slanted,
 * short, or missing; the part up to the corner of the rise becomes the sign, the bar records how far the root reaches.
 * `full` keeps every point so the whole sign stays visible and a root drawn in several pen-downs can be re-read (mergeRoot). */
function radical(s){const n=s.length;if(n<8)return null;let v=0;for(let i=0;i<n;i++)if(s[i][1]>s[v][1])v=i;if(v<2||v>n-3)return null;
 const e=s[n-1],cx=e[0]-s[v][0],cy=e[1]-s[v][1],cl=Math.hypot(cx,cy)||1;let a=n-1,bd=0;
 for(let i=v+1;i<n;i++){const d=Math.abs((s[i][0]-s[v][0])*cy-(s[i][1]-s[v][1])*cx)/cl;if(d>bd){bd=d;a=i}}   // corner = point of the rise farthest from the chord valley->end
 if(bd<.06*cl)a=n-1;
 let tx=0;
 if(a<n-1){const t=s.slice(a),H0=s[v][1]-s[a][1];tx=Math.max(...t.map(p=>p[0]))-s[a][0];
  if(tx<.15*H0||Math.abs(t[t.length-1][1]-s[a][1])>.45*tx){a=n-1;tx=0}}   // not a bar after all: the stroke is just a rise
 const H=s[v][1]-s[a][1];if(H<28)return null;
 if(!(s[0][1]<s[v][1]-.15*H&&s[0][1]>s[a][1]&&s[v][0]>s[0][0]&&s[a][0]>s[v][0]+.15*H))return null;
 if(tx<.15*H&&s[0][1]<s[a][1]+.35*H)return null;   // without a bar, the tick must be clearly shorter than the rise (else it is a v or a u)
 const main=s.slice(0,a+1);main.vin={x0:s[a][0],x1:s[a][0]+tx};main.full=s;main.hook=tx<.25*H;return main}
/* A root written in several pen-downs (hook, then bar; or tick-and-down, then rise-and-bar) is read as one stroke, but only when the
 * result is a root WITH a bar: two ordinary strokes (a 1 and a slash) must never be fused into a hook. */
function mergeRoot(s){const f=s[0];
 for(const L of lines)for(let k=L.ink.length-1;k>=Math.max(0,L.ink.length-2);k--){const t=L.ink[k],raw=t.full||t;if(t.vin&&!t.hook)continue;
  const e=raw[raw.length-1],bt=bb(raw);if(Math.hypot(f[0]-e[0],f[1]-e[1])>Math.max(30,.4*bt.h))continue;
  const r=radical(raw.concat(s));if(r&&!r.hook){L.ink.splice(k,1);if(!L.ink.length&&!L.seq.length)lines.splice(lines.indexOf(L),1);return r}}
 return null}
/* A bar drawn after a bare root sign was already typeset: it gives the root its reach (what is under it becomes the radicand). */
function lateBar(s){const b=bb(s);if(b.w<30||b.h>.25*b.w)return false;
 for(const L of lines)for(const r of visuals(L.seq)){if(r.t!='root'||Ink.hasBar(r))continue;const top=r.ty-.8*r.tsz;
  if(Math.abs(s[0][0]-(r.tx+.5*r.tsz))<.45*r.tsz&&Math.abs(s[0][1]-top)<.35*r.tsz){Ink.extendRoot(L.seq,r,Math.max(0,b.x1-(r.tx+.5*r.tsz))/r.tsz);relayout(L);return true}}
 return false}

/* ---------- erasing ---------- */
const resamp=Recognizer.resample;
function cusps(s){const p=resamp(s,8);let n=0;for(let i=0;i+6<p.length;){const a=[p[i+3][0]-p[i][0],p[i+3][1]-p[i][1]],b=[p[i+6][0]-p[i+3][0],p[i+6][1]-p[i+3][1]];
 const c=(a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b)||1);if(c<-.5){n++;i+=4}else i++}return n}
/** Share of a 7x4 grid over box `b` that passes within `r` of the scribble. */
function coverage(pts,b,r){const gx=7,gy=4;let hit=0;for(let i=0;i<gx;i++)for(let j=0;j<gy;j++){const cx=b.x0+(i+.5)*(b.x1-b.x0)/gx,cy=b.y0+(j+.5)*(b.y1-b.y0)/gy;
 for(const p of pts){if(Math.abs(p[0]-cx)<r&&Math.abs(p[1]-cy)<r&&Math.hypot(p[0]-cx,p[1]-cy)<r){hit++;break}}}return hit/(gx*gy)}
/** Does the scribble erase box `q`? It must pass over the middle of it and cover enough of it, with a reach that scales with the
 * symbol (a fixed reach either misses big symbols or takes small neighbours with it). */
function erases(pts,sb,q,bar){const w=Math.max(6,q.x1-q.x0),h=Math.max(6,q.y1-q.y0),cx=(q.x0+q.x1)/2,cy=(q.y0+q.y1)/2;
 if(cx<sb.x0-.12*w||cx>sb.x1+.12*w||cy<sb.y0-.3*h||cy>sb.y1+.3*h)return false;
 if(bar)return coverage(pts,q,6)>=.45;
 return coverage(pts,q,Math.max(6,Math.min(18,.35*Math.min(w,h)+4)))>=.22}
function allBoxes(){const bs=[];for(const L of lines){allNodes(L).forEach(n=>bs.push(nowBox(n)));L.ink.forEach(t=>{const q=bb(t);bs.push({x0:q.x0-6,y0:q.y0-6,x1:q.x1+6,y1:q.y1+6})})}return bs}
function isScribble(s){if(s.length<8)return false;const b=bb(s),m=Math.max(b.w,b.h);if(m<18)return false;let len=0;for(let i=1;i<s.length;i++)len+=Math.hypot(s[i][0]-s[i-1][0],s[i][1]-s[i-1][1]);
 const ratio=len/m,c=cusps(s),pts=resamp(s,6),over=allBoxes().some(q=>coverage(pts,q,18)>=.15);
 return over?((c>=3&&ratio>=2.2)||(c>=2&&ratio>=2.6)||ratio>=4.2):((c>=4&&ratio>=3.5)||ratio>=6)}
function scribble(s){const now=performance.now();ghosts.push({pts:s,t0:now});const pts=resamp(s,6),sb=bb(s),hit=(q,kind)=>erases(pts,sb,q,kind=='bar');
 for(const L of lines.slice()){
  L.ink=L.ink.filter(t=>{const q=bb(t);if(hit({x0:q.x0-8,y0:q.y0-8,x1:q.x1+8,y1:q.y1+8})){ghosts.push({pts:t,t0:now});return false}return true});
  const ansG=visuals(L.ans).filter(n=>n.t=='g'&&ch(n)!='=');
  if(ansG.length&&ansG.filter(n=>hit(nowBox(n))).length>=Math.ceil(ansG.length/2)){L.seq.forEach(kill);L.seq=[];L.ans.forEach(kill);L.ans=[];L.at=null}   // most of the answer scribbled out: the whole line goes
  else{const gone=Ink.erase(L.seq,hit);if(gone.length){gone.forEach(kill);if(L.seq.length)relayout(L);else{L.ans.forEach(kill);L.ans=[];L.at=null;L.box=null}}}
  if(!L.seq.length&&!L.ink.length)lines.splice(lines.indexOf(L),1)}}

/* ---------- recogniser (CNN in a Web Worker, main-thread fallback) ---------- */
const CLS=/*CLS*/;
loadMem(CLS);
const cnnSrc=document.getElementById('cnn').textContent;
const CNN_BOOT_MS=10000,CNN_REQUEST_MS=4000;
let wk=null,pend=new Map(),pid=0,local=null,workerUrl=null,wkReady=false,wkBoot=0;
function localPredict(x){if(!local){const s=document.createElement('script');s.textContent='window.__mikajyPredict=(function(){'+cnnSrc+';return predict})();';
  document.head.appendChild(s);s.remove();local=window.__mikajyPredict;delete window.__mikajyPredict}return local(x)}
function localFallback(q){
 setTimeout(()=>{try{q.res(localPredict(q.x))}catch(e){q.reject(e)}},0);
}
function stopCNN(){
 clearTimeout(wkBoot);wkReady=false;
 if(wk){wk.terminate();wk=null}
 if(workerUrl){URL.revokeObjectURL(workerUrl);workerUrl=null}
 const old=[...pend.values()];pend.clear();
 for(const q of old){clearTimeout(q.t);localFallback(q)}
}
function initCNN(){try{
 const b=new Blob([cnnSrc+"\nonmessage=function(e){postMessage({id:e.data.id,p:predict(e.data.x)})};predict(new Float32Array(784));postMessage({ready:true});"],{type:'text/javascript'});
 workerUrl=URL.createObjectURL(b);
 wk=new Worker(workerUrl);wkBoot=setTimeout(stopCNN,CNN_BOOT_MS);
 wk.onmessage=e=>{
  if(workerUrl){URL.revokeObjectURL(workerUrl);workerUrl=null}
  if(e.data.ready){wkReady=true;clearTimeout(wkBoot);for(const q of pend.values())q.t=setTimeout(stopCNN,CNN_REQUEST_MS);return}
  const q=pend.get(e.data.id);if(q){pend.delete(e.data.id);clearTimeout(q.t);q.res(e.data.p)}
 };
 wk.onerror=()=>stopCNN();
 }catch(e){stopCNN()}}
function predictAsync(x){return new Promise((res,reject)=>{
 if(!wk){localFallback({res,reject,x});return}
 const id=++pid,q={res,reject,x,t:wkReady?setTimeout(stopCNN,CNN_REQUEST_MS):0};
 pend.set(id,q);
 try{wk.postMessage({id,x})}catch(e){stopCNN()}
})}
initCNN();
const classify=async ss=>{const x=feat(ss);return{x,cands:classifyP(await predictAsync(x),x)}};

/* ---------- reading what was written ---------- */
let recBusy=false,recAgain=false;
function recognize(){if(recBusy){recAgain=true;return}recBusy=true;doRecognize().catch(e=>console.error(e)).then(()=>{recBusy=false;if(recAgain){recAgain=false;recognize()}})}
/** A new stroke that crosses a symbol read moments ago completes it: the symbol goes back to ink and both are read together. */
function touches(s,src){const r=Math.max(8,.1*Math.max(...src.map(t=>{const q=bb(t);return Math.max(q.w,q.h)}))),P=resamp(s,4),Q=src.flatMap(t=>t.length>1?resamp(t,4):t);
 return P.some(p=>Q.some(q=>Math.abs(p[0]-q[0])<r&&Math.abs(p[1]-q[1])<r))}
/** Does stroke `s` complete the symbol `n` read moments ago? While its ink is still on screen, touching that ink counts; afterwards
 * the stroke must cross the middle of the typeset symbol. Also: the second bar of =, the dot of i or !. */
function joins(s,n,now){const b=bb(s),inkShown=now-n.tc<900,P=resamp(s,4);
 if(inkShown&&touches(s,n.src))return true;
 for(const q of inkShown?[n.rb,n.box]:[n.box]){if(!q)continue;
  const cx=(q.x0+q.x1)/2,cy=(q.y0+q.y1)/2;
  if(P.some(p=>Math.abs(p[0]-cx)<.25*q.w+3&&Math.abs(p[1]-cy)<.25*q.h+4))return true;
  const flat=o=>o.h<.3*Math.max(o.w,1),ov=Math.min(b.x1,q.x1)-Math.max(b.x0,q.x0);
  if(flat(b)&&flat(q)&&Math.max(b.w,q.w)<4*Math.min(b.w,q.w)&&ov>=.6*Math.min(b.w,q.w)&&Math.abs((b.y0+b.y1)-(q.y0+q.y1))/2<.8*Math.max(b.w,q.w))return true;
  const H=Math.max(q.h,q.w),dx=(b.x0+b.x1)/2,dy=(b.y0+b.y1)/2;
  if(Math.max(b.w,b.h)<.35*H&&q.h>1.3*q.w&&dx>=q.x0-.3*H&&dx<=q.x1+.3*H&&(dy<q.y0&&q.y0-dy<.7*q.h||dy>q.y1&&dy-q.y1<.6*q.h))return true}
 return false}
function reopenRecent(L){const now=performance.now(),fresh=L.ink.filter(s=>!s.vin);if(!fresh.length)return;
 for(const n of visuals(L.seq)){if(n.t!='g'||!n.src||now-n.tc>REOPEN_MS||n.locked)continue;
  const j=fresh.find(s=>joins(s,n,now));if(!j)continue;
  const host=Ink.findSeq(L.seq,n);host.splice(host.indexOf(n),1);if(!host.length)Ink.erase(L.seq,()=>false);   // drops an exponent left empty
  let src=n.src.filter(s=>!L.ink.includes(s));
  if(now-n.tc>=900&&n.box){const q=n.rb,v=n.box,k=Math.min(2,Math.max(.5,Math.max(v.w,v.h)/Math.max(q.w,q.h,1))),qx=(q.x0+q.x1)/2,qy=(q.y0+q.y1)/2,vx=(v.x0+v.x1)/2,vy=(v.y0+v.y1)/2;
   src=src.map(t=>t.map(([x,y])=>[vx+(x-qx)*k,vy+(y-qy)*k]))}   // its ink is gone from the screen: re-read it where the symbol is shown
  n.ink=null;L.ink.splice(L.ink.indexOf(j),0,...src)}}
/** A cursive word written in one pen-down (sin, ln, 12) is cut into its letters before it is read. */
async function splitCursive(L){
 const cut=new Map(),cl=async ss=>(await classify(ss)).cands;
 for(const s of L.ink.slice()){if(s.vin||s.length<12)continue;const parts=await Recognizer.segmentStroke(s,cl);if(parts.length>1)cut.set(s,parts)}
 if(cut.size)L.ink=L.ink.flatMap(s=>cut.get(s)||[s])}
/** Long flat strokes that may be fraction bars, set apart before the other strokes are grouped into symbols. */
function fractionBars(L,S){const info=S.map(s=>({s,b:bb(s)})),ref=Math.max(40,...info.map(o=>Math.max(o.b.w,o.b.h))),big=o=>Math.max(o.b.w,o.b.h)>=.2*ref,out=[];
 for(const o of info){if(!isBar(o.s))continue;const y=(o.b.y0+o.b.y1)/2,inr=p=>p!==o&&(p.b.x0+p.b.x1)/2>=o.b.x0-12&&(p.b.x0+p.b.x1)/2<=o.b.x1+12;
  if(info.some(p=>inr(p)&&p.b.y0<y-4&&p.b.y1>y+4))continue;                                        // crossed: part of + or π
  if(info.some(p=>inr(p)&&isBar(p.s)&&p.b.w>.6*o.b.w&&Math.abs((p.b.y0+p.b.y1)/2-y)<.8*o.b.w))continue;   // two bars: =
  const H=Math.max(30,...info.filter(p=>inr(p)&&big(p)).map(p=>p.b.h)),
   up=info.some(p=>inr(p)&&big(p)&&p.b.y1<=y+10&&y-p.b.y1<1.3*H),dn=info.some(p=>inr(p)&&big(p)&&p.b.y0>=y-10&&p.b.y0-y<1.3*H);
  if(up||dn||Ink.contentAbove(L.seq,o.b,L.s||L.F))out.push({s:o.s,b:o.b,up,dn})}
 return out}
/** Which part of the expression a stroke is written in: above / below a new or typeset fraction bar, an exponent, or the line. */
function zoneOf(L,b,bars){const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,H=L.s||L.F;
 for(let i=0;i<bars.length;i++){const o=bars[i].b,y=(o.y0+o.y1)/2;if(cx>=o.x0-12&&cx<=o.x1+12){if(cy<y&&y-cy<1.4*H)return'n'+i;if(cy>y&&cy-y<1.6*H)return'd'+i}}
 const at=Ink.slot(L.seq,b,'',H);return at.sup?'sup':at.seq}
async function doRecognize(){
 for(const L of lines.slice())if(L.ink.length){reopenRecent(L);await splitCursive(L)}
 const jobs=[];
 for(const L of lines){if(!L.ink.length)continue;const S=L.ink.slice(),bars=fractionBars(L,S),barSet=new Set(bars.map(o=>o.s)),zones=new Map(),items=[];
  for(const st of S){if(barSet.has(st))continue;const z=zoneOf(L,bb(st),bars);if(!zones.has(z))zones.set(z,[]);zones.get(z).push(st)}
  const G=[...zones.values()].flatMap(group);   // strokes of a numerator, a denominator or an exponent never form one symbol with others
  for(const o of bars)items.push({kind:'bar',strokes:[o.s],b:o.b,up:o.up,dn:o.dn});
  for(const g of G){const b=g.b,rs=g.s.find(t=>t.vin);
   if(g.tiny&&G.length>1||Math.max(b.w,b.h)<16)items.push({kind:'dot',strokes:g.s,b});else items.push({kind:'sym',strokes:g.s,b,vin:rs&&rs.vin,hook:rs&&rs.hook})}
  jobs.push({L,items})}
 await Promise.all(jobs.flatMap(j=>j.items.filter(it=>it.kind=='sym').map(async it=>{const r=await classify(it.strokes);it.x=r.x;it.cands=r.cands})));
 for(const{L,items}of jobs){if(!lines.includes(L))continue;
  const live=items.filter(it=>it.strokes.every(s=>L.ink.includes(s)));if(!live.length)continue;
  const used=new Set(live.flatMap(it=>it.strokes));L.ink=L.ink.filter(s=>!used.has(s));
  const isNew=!L.seq.length,s=isNew?L.F:L.s,tc=performance.now(),fresh=[];
  if(isNew)startLine(L,live);
  const mark=(n,it)=>{Object.assign(n,{raw:it.b,ink:it.strokes,src:it.strokes,rb:it.b,tc});fresh.push(n);return n};
  // 1. fraction bars (what is written above / below them is placed into them afterwards)
  for(const it of live.filter(it=>it.kind=='bar')){const f=Ink.addFraction(L.seq,it.b,s,it.up,it.dn);
   if(f)mark(f,it);else Ink.insert(L.seq,mark(Ink.glyph('-',{fresh:false}),it),s)}
  // 2. root signs (what is under their bar goes inside)
  const syms=live.filter(it=>it.kind!='bar').sort((a,b)=>a.b.x0-b.b.x0);
  for(const it of syms.filter(isRootItem)){const b=it.b,sz=Math.max(24,b.h/.8),r=Ink.root([],it.vin?Math.max(0,it.vin.x1-it.vin.x0)/sz:0);
   r.bar={x0:it.vin?it.vin.x0:b.x1,x1:it.vin?it.vin.x1:b.x1,top:b.y0,base:b.y1};r.raw0=sz;r.vx0=it.vin?it.vin.x1:b.x1;Ink.addRoot(L.seq,mark(r,it),s)}
  // 3. everything else, left to right: over an existing symbol it replaces it, otherwise it goes where it was written
  for(const it of syms.filter(it=>!isRootItem(it))){
   const n=mark(it.kind=='dot'?Ink.glyph('.',{fresh:false}):Ink.glyph(it.cands,{fresh:true,fv:it.x}),it);
   const ow=it.kind=='dot'?null:Ink.overwritten(L.seq,it.b);
   if(ow){kill(ow.seq[ow.k]);ow.seq[ow.k]=n}else Ink.insert(L.seq,n,s)}
  Ink.readAll(L.seq,true);
  if(!isNew)L.x0=Math.min(L.x0,...fresh.filter(n=>L.seq.includes(n)).map(n=>n.raw.x0));
  layoutLine(L);fresh.forEach(fromInk);updateAns(L)}
 kick()}
const isRootItem=it=>it.kind=='sym'&&it.vin&&(!it.hook||it.cands.findIndex(o=>o.c=='√')===0||(it.cands.find(o=>o.c=='√')||{p:0}).p*3>=it.cands[0].p);
/** Size and baseline of a new line, from the digits just written (or a fraction bar). */
function startLine(L,items){const med=a=>a.slice().sort((p,q)=>p-q)[a.length>>1],dg=items.filter(it=>it.kind=='sym'&&/[0-9]/.test(it.cands[0].c)).map(it=>it.b),bar=items.find(it=>it.kind=='bar');
 const hs=dg.filter(b=>!bar||b.y1<(bar.b.y0+bar.b.y1)/2-.3*b.h||b.y0>(bar.b.y0+bar.b.y1)/2+.3*b.h);
 L.F=Math.max(56,Math.min(170,dg.length?med(dg.map(b=>b.h))/(bar&&hs.length===dg.length?.55*.8:.55):80));
 L.base=bar?(bar.b.y0+bar.b.y1)/2+.28*L.F:dg.length?med(dg.map(b=>b.y1)):(items[0].b.y0+items[0].b.y1)/2+.3*L.F;
 L.x0=Math.min(...items.map(it=>it.b.x0))}
/** A freshly read node starts where its ink was, at the ink's size, then glides to its typeset place. */
function fromInk(n){const b=n.raw;n.a=0;n.ta=1;
 if(n.t=='frac'){n.x=b.x0;n.y=(b.y0+b.y1)/2;n.bw=b.x1-b.x0;return}
 if(n.t=='root'){n.x=b.x0;n.y=b.y1;n.sz=n.raw0;n.top=b.y0;n.vx=Math.max(n.vx0,b.x0+.56*n.raw0);return}
 const c=ch(n),HR=Recognizer.HR,DS=Recognizer.DS,dgt=/[0-9a-z()!π]/.test(c);
 const sz=dgt?Math.max(24,b.h/(HR[c]||.55)):(c=='+'||c=='*')?Math.min(n.tsz*1.4,Math.max(b.w,b.h)/.38):n.tsz;
 n.sz=sz;n.x=(b.x0+b.x1)/2-M(c)*sz/2;n.y=c=='.'?b.y1+2:dgt?b.y1-(DS[c]||0)*sz:(b.y0+b.y1)/2+.2*sz}

/* ---------- taps: cycle through the recogniser's alternatives ---------- */
function learnLater(g){clearTimeout(g.lt);g.lt=setTimeout(()=>{if(g.fv&&g.c[g.i])remember(g.fv,g.c[g.i].c)},2500)}
function tapCycle(p){for(const L of lines)for(const g of visuals(L.seq)){if(g.t!='g'||g.c.length<2)continue;const b=nowBox(g);
 if(p[0]>b.x0-8&&p[0]<b.x1+8&&p[1]>b.y0-8&&p[1]<b.y1+8){g.old=ch(g);g.ot=1;g.i=(g.i+1)%g.c.length;g.locked=true;Ink.readAll(L.seq,true);relayout(L);if(g.fv)learnLater(g);return true}}return false}

/* ---------- pen input ---------- */
const pt=e=>[e.clientX,e.clientY];
cv.onpointerdown=e=>{if(!e.isPrimary)return;clearTimeout(rt);cv.setPointerCapture(e.pointerId);started=true;cur=[pt(e)];down={t:performance.now(),p:pt(e),len:0};clearTimeout(lp);
 lp=setTimeout(()=>{if(cur&&down.len<8){const d=hitDrag(down.p);if(d){cur=null;beginDrag(d,down.p)}}},450);kick()};
cv.onpointermove=e=>{if(!e.isPrimary)return;if(drag){dragMove(pt(e));return}if(!cur)return;const es=e.getCoalescedEvents?e.getCoalescedEvents():[e];
 for(const ev of es){const q=pt(ev),l=cur[cur.length-1];const d=Math.hypot(q[0]-l[0],q[1]-l[1]);if(d<2.5)continue;down.len+=d;cur.raw=q;cur.push([l[0]*.35+q[0]*.65,l[1]*.35+q[1]*.65])}
 cur.pred=e.getPredictedEvents?e.getPredictedEvents().slice(0,2).map(pt):null;if(down.len>=8)clearTimeout(lp);kick()};
cv.onpointerup=cv.onpointercancel=e=>{if(e&&e.isPrimary===false)return;clearTimeout(lp);if(drag){dragEnd();return}let s=cur;cur=null;if(!s)return;if(s.raw&&s.length>1)s.push(s.raw);delete s.raw;delete s.pred;
 if(down.len<8&&performance.now()-down.t<350&&tapCycle(down.p)){return}
 if(isScribble(s))scribble(s);else if(!lateBar(s)){const r=mergeRoot(s)||radical(s);attach(r||s)}
 rt=setTimeout(recognize,RECOGNISE_MS);kick()};
addEventListener('resize',fit);
document.fonts.load('40px H').then(()=>{fit()});fit();

/* ---------- memory bar, drag & drop ---------- */
let MEMV=Store.cleanChips(Store.loadArray(localStorage,'inkmem'));
const memSave=()=>{Store.save(localStorage,'inkmem',MEMV)};
function memRender(){const m=$('mem');m.innerHTML='';MEMV.forEach((v,i)=>{const c=document.createElement('div');c.className='chip';c.textContent=v;
 const x=document.createElement('b');x.textContent='×';x.onclick=e=>{e.stopPropagation();MEMV.splice(i,1);memSave();memRender()};c.appendChild(x);chipDrag(c,v);m.appendChild(c)});
 m.style.display=(MEMV.length||drag)?'flex':'none';m.classList.toggle('hot',!!drag&&drag.y>SH-70)}
function memAdd(v){if(!v)return;MEMV=MEMV.filter(q=>q!=v);MEMV.unshift(v);MEMV=MEMV.slice(0,12);memSave();memRender()}
function chipDrag(c,v){let t=null,sp=null;c.onpointerdown=e=>{if(e.target.tagName=='B')return;sp=[e.clientX,e.clientY];c.setPointerCapture(e.pointerId);t=setTimeout(()=>beginDrag({text:v,src:null,fromMem:true},sp),300)};
 c.onpointermove=e=>{if(drag)dragMove([e.clientX,e.clientY]);else if(sp&&Math.hypot(e.clientX-sp[0],e.clientY-sp[1])>10)clearTimeout(t)};
 c.onpointerup=c.onpointercancel=()=>{clearTimeout(t);if(drag)dragEnd()}}
const inBox=(p,b)=>p[0]>=b.x0-8&&p[0]<=b.x1+8&&p[1]>=b.y0-8&&p[1]<=b.y1+8;
const isNum=n=>n&&n.t=='g'&&/[0-9.]/.test(ch(n));
function hitDrag(p){for(const L of lines){
 if(Number.isFinite(L.val)&&visuals(L.ans).some(n=>n.t=='g'&&inBox(p,nowBox(n)))){const t=Store.plainNumber(L.val);if(t)return{text:t,src:null,L}}
 let found=null;
 Ink.walk(L.seq,(n,seq)=>{if(found||!isNum(n)||!inBox(p,nowBox(n)))return;let a=seq.indexOf(n),z=a;while(isNum(seq[a-1]))a--;while(isNum(seq[z+1]))z++;
  const run=seq.slice(a,z+1);found={text:run.map(ch).join(''),src:{L,seq,run},L}});
 if(found)return found}return null}
function beginDrag(d,p){drag={text:d.text,src:d.src,fromMem:d.fromMem,x:p[0],y:p[1]};if(navigator.vibrate)try{navigator.vibrate(15)}catch(e){}memRender();kick()}
function dragMove(p){drag.x=p[0];drag.y=p[1];$('mem').classList.toggle('hot',p[1]>SH-70);kick()}
function dragEnd(){const d=drag;drag=null;memRender();drop(d);kick()}
function drop(d){const x=d.x,y=d.y;if(y>SH-70){if(!d.fromMem)memAdd(d.text);return}
 const chars=[...d.text].filter(c=>/[0-9.\-+πe]/.test(c));if(!chars.length)return;
 if(d.src&&d.src.run){const r=d.src.run,b0=nowBox(r[0]),b1=nowBox(r[r.length-1]);if(Math.abs(x-(b0.x0+b1.x1)/2)<30&&Math.abs(y-(b0.y0+b0.y1)/2)<60)return;
  const SL=d.src.L;r.forEach(n=>{const k=d.src.seq.indexOf(n);if(k>=0)d.src.seq.splice(k,1);kill(n)});Ink.erase(SL.seq,()=>false);
  if(SL.seq.length)relayout(SL);else{SL.ans.forEach(kill);SL.ans=[];lines.splice(lines.indexOf(SL),1)}}
 let tgt=null;for(const L of lines){const r=region(L);if(L.seq.length&&r&&y>=r.y0&&y<=r.y1){tgt=L;break}}
 const F=tgt?tgt.s:d.src&&d.src.L?d.src.L.F:70,w=.55*F,gs=chars.map((c,i)=>Ink.glyph(c,{raw:Ink.box(x+(i-chars.length/2)*w,y-.55*F,x+(i-chars.length/2+.9)*w,y)}));
 if(tgt){gs.forEach(g=>{Ink.insert(tgt.seq,g,F);g.x=x;g.y=y;g.sz=F});relayout(tgt)}
 else{const L=newLine({seq:gs,x0:Math.max(12,x-.3*F*gs.length),base:y,F});lines.push(L);layoutLine(L);gs.forEach(g=>{g.x=x;g.y=y;g.sz=F});updateAns(L)}}

/* ---------- history ---------- */
let HIST=Store.cleanHistory(Store.loadArray(localStorage,'inkhist'));
const histPersist=()=>{Store.save(localStorage,'inkhist',HIST)};
const textOf=L=>Ink.text(L.seq).replace(/=+$/,'').trim();
window.histSave=function(L){if(!L.seq.length)return;L.hid=L.hid||Date.now()+'-'+Math.random().toString(36).slice(2,6);clearTimeout(L.ht);
 L.ht=setTimeout(()=>{const r=computeAns(L);if(!r||!lines.includes(L))return;const e={id:L.hid,ts:Date.now(),tree:Ink.serialize(L.seq),F:L.F,ans:r.text,text:textOf(L)},i=HIST.findIndex(h=>h.id==L.hid);
  if(i>=0)HIST[i]=e;else HIST.unshift(e);HIST=HIST.slice(0,100);histPersist()},1500)};
function openHist(e){closeSheet();const L=newLine({x0:30,base:SH*.35,F:e.F||70,hid:e.id,seq:e.tree?Ink.deserialize(e.tree):Ink.fromLegacy(e.syms)});
 for(const q of lines)L.base=Math.max(L.base,q.base+q.F*1.5);lines.push(L);layoutLine(L);for(const n of visuals(L.seq)){n.y+=12;n.sz*=.9}updateAns(L);kick()}
/* ---------- export ---------- */
function copyText(t){if(window.Android&&Android.copy){Android.copy(t);toast(T('copied'))}else{try{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();toast(T('copied'))}catch(e){}}}
function shareText(t){if(window.Android&&Android.shareText)Android.shareText(t);else copyText(t)}
function exportPNG(){const ns=lines.flatMap(allNodes).filter(n=>n.a>.3);if(!ns.length)return null;const bs=ns.map(nowBox);
 const x0=Math.min(...bs.map(b=>b.x0))-28,x1=Math.max(...bs.map(b=>b.x1))+28,y0=Math.min(...bs.map(b=>b.y0))-28,y1=Math.max(...bs.map(b=>b.y1))+28,k=2,c=document.createElement('canvas');
 c.width=Math.round((x1-x0)*k);c.height=Math.round((y1-y0)*k);const keep=ctx;ctx=c.getContext('2d');ctx.fillStyle=palette.canvas;ctx.fillRect(0,0,c.width,c.height);ctx.setTransform(k,0,0,k,-x0*k,-y0*k);
 for(const n of ns){const a=n.a,ink=n.ink;n.a=1;n.ink=null;drawNode(n);n.a=a;n.ink=ink}ctx=keep;return c.toDataURL('image/png')}
function toast(m){let t=$('toast');if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t)}t.textContent=m;t.style.opacity=1;clearTimeout(t.h);t.h=setTimeout(()=>t.style.opacity=0,1600)}
/* ---------- menu / settings sheet ---------- */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function refreshAll(){lines.forEach(L=>{L.at='\0';updateAns(L)});kick()}
function closeSheet(){$('sheet').classList.remove('in');setTimeout(()=>{if(!$('sheet').classList.contains('in'))$('sheet').style.display='none'},200)}
const IC={hist:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 2"/>',copy:'<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
 share:'<path d="M12 15V4M8 7.5l4-4 4 4"/><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/>',mem:'<path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-4-6 4V5.5a1 1 0 0 1 1-1z"/>',
 trash:'<path d="M5 7h14M10 7V5h4v2M7 7l.8 11.6A1.5 1.5 0 0 0 9.3 20h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7"/>',eraser:'<path d="M4.5 15.5l8.2-8.7a2 2 0 0 1 2.8-.1l3 3a2 2 0 0 1 0 2.8L13 18.5H8z"/><path d="M8 18.5H4.5M10.2 10.8l5 5"/>',
 sync:'<path d="M19 8.5A7.5 7.5 0 0 0 5.6 7M5 4v3.5h3.5"/><path d="M5 15.5A7.5 7.5 0 0 0 18.4 17M19 20v-3.5h-3.5"/>',get:'<path d="M12 4v11M8 11.5l4 4 4-4"/><path d="M5 19.5h14"/>',back:'<path d="M14.5 5.5L8 12l6.5 6.5"/>',close:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'};
const ico=n=>`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const row=(label,k,opts,cur=SET[k])=>`<div class="row"><span class="lab">${T(label)}</span><div class="opts">${opts.map(o=>`<button class="opt${cur==o[0]?' on':''}" data-k="${k}" data-v="${o[0]}">${T(o[1])}<svg class="ring" aria-hidden="true"><path pathLength="1"/></svg></button>`).join('')}</div></div>`;
const tool=(a,i,t,c='')=>`<button class="tool ${c}" data-a="${a}">${ico(i)}<span>${t}</span></button>`;
function fitRings(){document.querySelectorAll('#panel .opt').forEach((b,n)=>{const w=b.offsetWidth,h=b.offsetHeight,r=b.querySelector('.ring'),p=r.firstElementChild,j=(((n*37)%11)-5)/200;
 r.setAttribute('viewBox',`0 0 ${w} ${h}`);r.style.width=w+'px';r.style.height=h+'px';
 const X=v=>(v*w).toFixed(1),Y=v=>(v*h).toFixed(1);
 p.setAttribute('d',`M${X(.1)} ${Y(.66)}C${X(.01+j)} ${Y(.22)} ${X(.3)} ${Y(.02)} ${X(.55)} ${Y(.07)}C${X(.86)} ${Y(.11)} ${X(1.01)} ${Y(.34)} ${X(.94)} ${Y(.66)}C${X(.88)} ${Y(.95)} ${X(.5)} ${Y(1.01-j)} ${X(.3)} ${Y(.93)}C${X(.09)} ${Y(.85)} ${X(-.01)} ${Y(.58)} ${X(.1)} ${Y(.28)}`)})}
function menuBody(){
 if(TAB=='math')return row('results','fmt',[['dec','decimal'],['frac','fraction'],['mixed','mixed']])+`<p class="hint">${T('resultsHint')}</p>`+row('angles','angle',[['rad','radians'],['deg','degrees']])+row('calculate','mode',[['instant','instant'],['demand','onDemand']])+`<p class="hint">${T('calculateHint')}</p>`;
 if(TAB=='app')return row('language','lang',[['en','English'],['fr','Français']],LANG)+row('theme','theme',[['dark','dark'],['light','light']])+(hasUpdater()?row('updates','updates',[['auto','auto'],['off','off']])+`<div class="tools">${updTools()}</div><p class="hint">${updHint()}</p>`:'');
 return `<div class="tools">${tool('hist','hist',T('history'))}${tool('copy','copy',T('copyResult'))}${tool('img','share',T('shareImage'))}${tool('addmem','mem',T('toMemory'))}${tool('clrmem','trash',T('emptyMemory'))}${tool('clear','eraser',T('clearCanvas'),'danger')}</div><p class="hint">${T('dragHint')}</p>`}
function openSheet(page){const p=$('panel'),s=$('sheet'),first=s.style.display!='block';s.style.display='block';
 if(page=='hist'){p.innerHTML=`<div class="head"><button class="iconbtn" data-a="back" aria-label="${T('back')}">${ico('back')}</button><h2>${T('history')}</h2><button class="done" data-a="hexp">${T('export')}</button></div>`+
  (HIST.length?HIST.map((h,i)=>`<div class="hrow"><button class="hmain" data-a="hopen" data-i="${i}"><span class="ex">${esc(h.text)}</span><span class="an">${esc(h.ans.replace(/^=/,'= '))}</span></button><button class="iconbtn" data-a="hcopy" data-i="${i}" aria-label="${T('copy')}">${ico('copy')}</button><button class="iconbtn" data-a="hdel" data-i="${i}" aria-label="${T('delete')}">${ico('close')}</button></div>`).join('')+`<button class="textbtn danger" data-a="hclr">${T('clearHistory')}</button>`:`<p class="empty">${T('historyEmpty')}</p>`)}
 else p.innerHTML=`<div class="head"><h2>Mikajy Spark</h2><button class="done" data-a="done">${T('done')}</button></div><div class="tabs" role="tablist">${[['actions','tabActions'],['math','tabMath'],['app','tabApp']].map(([id,k])=>`<button class="tab${TAB==id?' on':''}" role="tab" aria-selected="${TAB==id}" data-tab="${id}">${T(k)}</button>`).join('')}</div>${menuBody()}`;
 if(first){s.classList.remove('in');void s.offsetWidth}s.classList.add('in');fitRings()}
const cleanAns=L=>L&&L.at?L.at.replace(/^=/,''):'';
$('panel').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.tab){TAB=d.tab;openSheet('main');return}
 if(d.k){SET[d.k]=d.v;saveSet();b.parentNode.querySelectorAll('.opt').forEach(o=>o.classList.toggle('on',o===b));if(d.k==='lang'){LANG=I18n.resolve(d.v,navigator.language);applyLang();refreshAll();openSheet('main');return}if(d.k==='theme')applyTheme();else if(d.k!=='updates')refreshAll();else if(SET.updates==='auto')checkUpdates(false);return}
 const i=+d.i;switch(d.a){case'done':closeSheet();break;case'hist':openSheet('hist');break;case'back':openSheet('main');break;
  case'copy':{const t=cleanAns(lastL&&lines.includes(lastL)?lastL:lines.find(L=>L.at));t?copyText(t):toast(T('noResult'));closeSheet();break}
  case'img':{const u=exportPNG();if(!u)toast(T('nothingToShare'));else if(window.Android&&Android.shareImage)Android.shareImage(u.split(',')[1]);else window.open(u);closeSheet();break}
  case'addmem':{const L=lastL&&lines.includes(lastL)?lastL:lines.find(L=>Number.isFinite(L.val));const t=L&&Store.plainNumber(L.val);if(t){memAdd(t);toast(T('savedToMemory'))}else toast(L&&Number.isFinite(L.val)?T('tooLarge'):'No result yet');closeSheet();break}
  case'clrmem':MEMV=[];memSave();memRender();toast(T('memoryEmptied'));closeSheet();break;
  case'clear':lines.forEach(L=>L.seq.concat(L.ans).forEach(kill));lines=[];kick();closeSheet();break;
  case'hopen':if(HIST[i])openHist(HIST[i]);break;case'hcopy':if(HIST[i])copyText(HIST[i].text+' '+HIST[i].ans.replace(/^=/,'= '));break;
  case'hdel':if(HIST[i]){HIST.splice(i,1);histPersist();openSheet('hist')}break;case'hclr':HIST=[];histPersist();openSheet('hist');break;
  case'upd':checkUpdates(true);break;
  case'getupd':{const u=pendingUpdate();if(!u)break;if(canSelfUpdate(u)&&!(INST&&INST.state=='failed')){if(!INST)startInstall(u)}else Android.openUpdate(u.apk||u.url);break}
  case'hexp':shareText(HIST.map(h=>h.text+' '+h.ans.replace(/^=/,'= ')).join('\n'));break}};
$('back').onclick=closeSheet;$('mb').onclick=()=>openSheet('main');
window.onBack=()=>{if($('sheet').classList.contains('in')){closeSheet();return true}if(drag){drag=null;memRender();return true}return false};
/* ---------- updates (the Android shell makes the request; this page only interprets the answer) ---------- */
let UPD=Updates.load(localStorage),updManual=false;
const hasUpdater=()=>!!(window.Android&&typeof Android.checkForUpdates==='function'&&typeof Android.version==='function');
const appVersion=()=>{try{return String(Android.version())}catch(e){return''}};
const pendingUpdate=()=>hasUpdater()?Updates.pending(UPD,appVersion()):null;
function updTools(){if(!hasUpdater())return'';const u=pendingUpdate();return tool('upd','sync',T('checkUpdates'))+(u?tool('getupd','get',esc(getLabel(u)),'danger'):'')}
/* ---------- in-app update: the shell downloads, verifies and hands the APK to Android's installer ---------- */
let INST=null;   // {state, p, reason} while an update is being installed, or after it failed
const canSelfUpdate=u=>typeof Android.installUpdate==='function'&&Updates.installable(u);
const pct=p=>p>=0?Math.round(p*100)+' %':'';
function getLabel(u){if(!INST)return T('getUpdate',{v:u.version});const s=INST.state;
 return s=='downloading'?T('downloading',{n:pct(INST.p)}):s=='verifying'?T('verifying'):s=='permission'?T('allowInstall'):s=='failed'?T('getInBrowser'):T('confirmInstall')}
function startInstall(u){INST={state:'downloading',p:0};toast(T('downloading',{n:''}));try{Android.installUpdate(u.apk,u.sums)}catch(e){INST={state:'failed',reason:'error'}}refreshUpd()}
function refreshUpd(){if($('sheet').classList.contains('in')&&TAB=='app')openSheet('main')}
window.onUpdateProgress=json=>{let r;try{r=Updates.progress(JSON.parse(json))}catch(e){r=null}if(!r)return;
 INST=r;const s=r.state;
 if(s=='downloading')toast(T('downloading',{n:pct(r.p)}));else if(s=='verifying')toast(T('verifying'));else if(s=='permission')toast(T('allowInstall'));
 else if(s=='confirm')toast(T('confirmInstall'));else if(s=='installed'){INST=null;toast(T('installed'))}
 else if(s=='failed')toast(T('installFailed',{why:T('why_'+r.reason)}));
 refreshUpd()};
function updHint(){if(!hasUpdater())return'';const u=pendingUpdate();return T('updateHint',{v:esc(appVersion()),avail:u?T('availableSuffix',{n:esc(u.version)}):''})}
function updBadge(){$('mb').classList.toggle('upd',!!pendingUpdate())}
window.onUpdateResult=json=>{
 const manual=updManual;updManual=false;let r;
 try{r=Updates.interpret(JSON.parse(json),appVersion())}catch(e){r={status:'error'}}
 if(r.status==='offline'||r.status==='error'){if(manual)toast(T(r.status==='offline'?'offline':'checkFailed'));return}
 UPD=Updates.record(UPD,r,Date.now());Updates.save(localStorage,UPD);updBadge();
 if(r.status==='available')toast(T('updateAvailable',{v:r.version}));else if(manual)toast(T('upToDate'));
 if($('sheet').classList.contains('in'))openSheet('main')};
function checkUpdates(manual){if(!hasUpdater())return;updManual=manual;if(manual&&INST&&INST.state=='failed')INST=null;if(manual)toast(T('checking'));try{Android.checkForUpdates()}catch(e){updManual=false}}
updBadge();
if(hasUpdater()&&Updates.shouldCheck(UPD,Date.now(),SET.updates))setTimeout(()=>checkUpdates(false),5000);
memRender();
applyTheme();applyLang();
