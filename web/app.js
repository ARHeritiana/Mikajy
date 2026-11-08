const cv=document.getElementById('pad');let ctx=cv.getContext('2d');const $=id=>document.getElementById(id);
let DPR=1,lastL=null,lp=null,drag=null,SW=0,SH=0,lines=[],fx=[],ghosts=[],cur=null,down=null,started=false,rt=null,raf=0,tPrev=0;
const FONT='H, serif';
/* Unlimited board: everything lives in world coordinates; V maps world -> screen (x,y translate, k zoom). */
const V={x:0,y:0,k:1},ZMIN=.3,ZMAX=3,ptrs=new Map();let gest=null;
const toW=(x,y)=>[(x-V.x)/V.k,(y-V.y)/V.k];
const viewMoved=()=>V.x!==0||V.y!==0||V.k!==1;
function setView(x,y,k){V.x=x;V.y=y;V.k=k;const b=$('zr');if(b){b.style.display=viewMoved()?'block':'none';b.textContent=Math.round(k*100)+'%'}kick()}
function zoomAt(cx,cy,k){k=Math.min(ZMAX,Math.max(ZMIN,k));const w=toW(cx,cy);setView(cx-w[0]*k,cy-w[1]*k,k)}
function drawGrid(){if(!viewMoved())return;const S=80,x0=Math.floor(-V.x/V.k/S)*S,x1=(SW-V.x)/V.k,y0=Math.floor(-V.y/V.k/S)*S,y1=(SH-V.y)/V.k;
 if(((x1-x0)/S+1)*((y1-y0)/S+1)>4000)return;const r=1.6/Math.sqrt(V.k);ctx.globalAlpha=.16;ctx.fillStyle=palette.ink;
 for(let x=x0;x<=x1;x+=S)for(let y=y0;y<=y1;y+=S)ctx.fillRect(x-r,y-r,2*r,2*r);ctx.globalAlpha=1}
const disp=c=>c=='*'?'×':c=='/'?'÷':c=='-'?'−':c;
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const ch=g=>g.c[g.i].c;
const FUNCS=new Set(['sin','cos','tan','cot','sec','csc','asin','acos','atan','sinh','cosh','tanh','ln','log','exp','sqrt','abs']);
let SET=SettingsStore.load(localStorage);
let LANG=I18n.resolve(SET.lang,navigator.language),TAB='actions';
const T=(k,p)=>I18n.t(LANG,k,p);
function applyLang(){document.documentElement.lang=LANG;$('pad').setAttribute('aria-label',T('canvasAria'));$('mb').setAttribute('aria-label',T('menuAria'));$('zr').setAttribute('aria-label',T('resetView'))}
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

function fmt(v){if(!isFinite(v))return'undefined';if(Math.abs(v)<1e-12)v=0;return String(parseFloat(v.toPrecision(10)))}
function fit(){const d=DPR=Math.min(devicePixelRatio||1,2);SW=innerWidth;SH=innerHeight;cv.width=SW*d;cv.height=SH*d;lines.forEach(layout);kick()}
function strokePath(s){ctx.beginPath();ctx.moveTo(...s[0]);ctx.lineTo(...mid(s[0],s[1]));for(let i=1;i<s.length-1;i++)ctx.quadraticCurveTo(...s[i],...mid(s[i],s[i+1]));ctx.lineTo(...s[s.length-1]);ctx.stroke()}
function drawInk(s,a){if(a<=.01)return;ctx.globalAlpha=a;ctx.strokeStyle=ctx.fillStyle=palette.ink;ctx.lineWidth=4.5;ctx.lineCap=ctx.lineJoin='round';
 if(s.length==1){ctx.beginPath();ctx.arc(s[0][0],s[0][1],2.6,0,7);ctx.fill()}else strokePath(s);ctx.globalAlpha=1}
function drawRad(g,a){const s=g.sz,x=g.x,y=g.y,top=y-.8*s;ctx.globalAlpha=a;ctx.strokeStyle=g.ans?palette.accent:palette.ink;ctx.lineWidth=Math.max(2,s*.055);ctx.lineCap=ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(x+.02*s,y-.36*s);ctx.lineTo(x+.1*s,y-.43*s);ctx.lineTo(x+.26*s,y-.02*s);ctx.lineTo(x+.5*s,top);ctx.lineTo(Math.max(g.vx,x+.56*s),top);ctx.stroke();ctx.globalAlpha=1}
function drawBar(g,a){ctx.globalAlpha=a;ctx.strokeStyle=g.ans?palette.accent:palette.ink;ctx.lineWidth=Math.max(2.5,g.sz*.05);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(g.x,g.y);ctx.lineTo(g.x+g.bw,g.y);ctx.stroke();ctx.globalAlpha=1}
function drawG(g){const col=g.ans?palette.accent:palette.ink;ctx.fillStyle=col;ctx.font=Math.round(g.sz)+'px '+FONT;ctx.textBaseline='alphabetic';
 const a=Math.max(0,Math.min(1,g.a)),c=ch(g);
 if(c=='√')drawRad(g,a);
 else if(c=='§')drawBar(g,a);
 else{if(g.ot>0&&g.old){ctx.globalAlpha=a*g.ot;ctx.fillText(disp(g.old),g.x,g.y);ctx.globalAlpha=a*(1-g.ot)}else ctx.globalAlpha=a;
  ctx.fillText(disp(c),g.x,g.y);ctx.globalAlpha=1}
 if(g.ink&&g.a<.99){const k=Math.max(0,1-g.a*1.1);g.ink.forEach(s=>drawInk(s,k))}else g.ink=null}
function render(now){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.setTransform(DPR,0,0,DPR,0,0);
 if(!started&&!lines.length&&!cur){ctx.globalAlpha=.25;ctx.fillStyle=palette.ink;ctx.font='54px '+FONT;ctx.textAlign='center';ctx.fillText(T('writeHint'),SW/2,SH/2);ctx.textAlign='left';ctx.globalAlpha=1}
 ctx.setTransform(DPR*V.k,0,0,DPR*V.k,DPR*V.x,DPR*V.y);drawGrid();
 for(const L of lines){L.syms.forEach(drawG);L.ans.forEach(drawG);L.ink.forEach(s=>drawInk(s,1))}
 fx.forEach(drawG);ghosts.forEach(g=>drawInk(g.pts,1-(now-g.t0)/420));if(cur)drawInk(cur,1);
 ctx.setTransform(DPR,0,0,DPR,0,0);
 if(drag){ctx.font='44px '+FONT;const w=ctx.measureText(drag.text).width+30,x=drag.x-w/2,y=drag.y-86;ctx.save();ctx.shadowColor=palette.dragShadow;ctx.shadowBlur=16;ctx.shadowOffsetY=4;ctx.fillStyle=palette.dragBackground;ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,60,16):ctx.rect(x,y,w,60);ctx.fill();ctx.restore();ctx.strokeStyle=palette.accent;ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,60,16):ctx.rect(x,y,w,60);ctx.stroke();ctx.fillStyle=palette.accent;ctx.textBaseline='middle';ctx.fillText(drag.text,x+15,y+32);ctx.textBaseline='alphabetic'}}
function stepG(g,dt,now){if(now<g.delay)return true;const k=1-Math.exp(-dt*7),k2=1-Math.exp(-dt*8);g.x+=(g.tx-g.x)*k;g.y+=(g.ty-g.y)*k;g.sz+=(g.tsz-g.sz)*k;g.a+=(g.ta-g.a)*k2;if(g.ot>0)g.ot=Math.max(0,g.ot-dt*4);
 let r=Math.abs(g.tx-g.x)>.3||Math.abs(g.ty-g.y)>.3||Math.abs(g.tsz-g.sz)>.3||Math.abs(g.ta-g.a)>.01||g.ot>0;
 if(g.vtx!==undefined){g.vx+=(g.vtx-g.vx)*k;if(Math.abs(g.vtx-g.vx)>.3)r=true}
 if(g.bwt!==undefined){g.bw+=(g.bwt-g.bw)*k;if(Math.abs(g.bwt-g.bw)>.3)r=true}return r}
function step(dt,now){let act=false;const tick=g=>{if(stepG(g,dt,now))act=true};
 for(const L of lines){L.syms.forEach(tick);L.ans.forEach(tick)}
 fx.forEach(tick);if(fx.length)fx=fx.filter(g=>g.a>.02);if(ghosts.length)ghosts=ghosts.filter(g=>now-g.t0<420);return act||ghosts.length>0}
function kick(){if(!raf){tPrev=performance.now();raf=requestAnimationFrame(frame)}}
function frame(now){raf=0;const dt=Math.min(.05,(now-tPrev)/1000);tPrev=now;const act=step(dt,now);render(now);if(act||cur)kick()}
const adv=(c,F)=>{if(c=='√')return F*.62;ctx.font=F+'px '+FONT;return ctx.measureText(disp(c)).width};
function coverN(A,k){const g=A[k];if(g.cover>0)return Math.min(g.cover,A.length-k-1);let j=k+1,n=0;if(j>=A.length)return 0;
 if(ch(A[j])=='('){let d=0;for(;j<A.length;j++){const q=ch(A[j]);if(q=='(')d++;if(q==')'){d--;if(d==0){j++;break}}}return j-k-1}
 while(j<A.length){const q=ch(A[j]),ok=A[j].sup?n>0:/[0-9.πe]/.test(q);if(!ok)break;n++;j++}return n}
const isPart=g=>g.fp=='n'||g.fp=='d';
const partsOf=(L,bar,p)=>L.syms.concat(L.ans).filter(s=>s.fid===bar.fid&&s.fp==p||s.fp=='bar'&&s.pfid===bar.fid&&s.pfp==p);   // a part's glyphs, nested bars included
function seqs(L){const top=[],m=new Map();for(const g of L.syms){if(isPart(g)||g.pfid){const k=g.pfid?g.pfid+g.pfp:g.fid+g.fp;if(!m.has(k))m.set(k,[]);m.get(k).push(g)}else top.push(g)}return[top,...m.values()]}
/* Stacked fractions, nested to any shown depth. A sequence is laid out at font size s on a baseline; a '§' glyph is a fraction whose
   numerator / denominator sequences (partsOf) are laid out recursively at .8 s. ext() measures how far a sequence reaches above and
   below its baseline so that a fraction inside a numerator lifts it clear of the bar (and one in a denominator pushes it down). */
const isFB=g=>ch(g)=='§'&&g.fp=='bar';
const extOf=(L,A,s)=>{let up=0,dn=0;for(const g of A){let u,d;if(isFB(g)){const e=fracExt(L,g,s*(g.sup?.62:1));u=e.up;d=e.dn}else{const z=g.sup?.62:1;u=.72*s*z+(g.sup?.42*s:0);d=.22*s*z}up=Math.max(up,u);dn=Math.max(dn,d)}return{up,dn}};
function partOffs(L,g,s){const sn=.8*s,N=extOf(L,partsOf(L,g,'n'),sn),D=extOf(L,partsOf(L,g,'d'),sn);return{sn,N,D,nOff:Math.max(.14*s,N.dn+.06*s),dOff:Math.max(.14*s+.55*sn,D.up+.1*s)}}
function fracExt(L,g,s){const o=partOffs(L,g,s);return{up:.28*s+o.nOff+o.N.up,dn:Math.max(.22*s,o.dOff-.28*s+o.D.dn)}}
const seqW=(L,A,s)=>A.reduce((w,g)=>w+(isFB(g)?fracW(L,g,s*(g.sup?.62:1)):adv(ch(g),s*(g.sup?.62:1)))+.06*s*(g.sup?.62:1),0);
function fracW(L,g,s){const sn=.8*s;g.nW=seqW(L,partsOf(L,g,'n'),sn);g.dW=seqW(L,partsOf(L,g,'d'),sn);return g.w0=Math.max(g.nW,g.dW)+.4*s}
function placeFrac(L,g,x,base,s){const o=partOffs(L,g,s),ay=base-.28*s;g.tx=x;g.ty=ay;g.tsz=s;g.w=g.w0;g.bwt=g.w;if(!g.bw)g.bw=g.w;
 placeSeq(L,partsOf(L,g,'n'),x+(g.w-g.nW)/2,ay-o.nOff,o.sn);placeSeq(L,partsOf(L,g,'d'),x+(g.w-g.dW)/2,ay+o.dOff,o.sn)}
function placeSeq(L,A,x,base,s){for(const g of A){const z=g.sup?.62:1;if(isFB(g)){fracW(L,g,s*z);placeFrac(L,g,x,base,s*z);x+=g.w+.06*s*z}
 else{const a=adv(ch(g),s*z);g.tx=x;g.tsz=s*z;g.ty=base-(g.sup?.42*s:0);g.w=a;x+=a+.06*s*z}}}
function layout(L){const F=L.F,top=L.syms.filter(g=>!isPart(g)&&!g.pfid),items=top.concat(L.ans.filter(g=>!isPart(g)&&!g.pfid));if(!items.length)return;let tot=0;
 const sf=g=>g.sup?.62:1,first=(g,k)=>g.ans&&(k==0||!items[k-1].ans),extra=(g,k)=>(first(g,k)?.28*F:0)+(ch(g)=='§'&&k>0?.1*F:0),trail=g=>.06*F*sf(g)+(g.ans&&ch(g)=='='?.14*F:0);
 items.forEach((g,k)=>{if(ch(g)=='§')fracW(L,g,F);else g.w0=adv(ch(g),F*sf(g));tot+=g.w0+trail(g)+extra(g,k)});
 let x0=L.x0,f=1;
 const base=L.base;let x=x0;
 items.forEach((g,k)=>{x+=extra(g,k)*f;
  if(ch(g)=='§')placeFrac(L,g,x,base,F*f);
  else{g.tx=x;g.tsz=F*f*sf(g);g.w=g.w0*f;g.ty=base-(g.sup?.42*F*f:0)}
  x+=(g.w0+trail(g))*f});
 seqs(L).forEach(A=>A.forEach((g,k)=>{if(ch(g)=='√'){const n=coverN(A,k),e=A[Math.min(k+n,A.length-1)];g.vtx=n>0?e.tx+e.w:g.tx+g.w;if(g.vx===undefined)g.vx=g.tx+.56*g.tsz}}))}
function tokSeq(L,A0,top){const A=A0.slice();if(top)while(A.length&&ch(A[A.length-1])=='=')A.pop();
 const out=[],close=new Map();let inSup=false,num='',word='';
 const fN=()=>{if(num){out.push(num);num=''}},fW=()=>{if(word){if(word=='e'||word=='o'||word=='x'||(word=='i'&&SET.domain=='complex')||FUNCS.has(word))out.push(word);else throw new Error('unknown word');word=''}};
 A.forEach((g,k)=>{const c=ch(g);
  if(g.sup&&!inSup){fN();fW();out.push('^','(');inSup=true}
  if(!g.sup&&inSup){fN();fW();out.push(')');inSup=false}
  if(/[0-9.]/.test(c)){fW();num+=c}else if(/[a-z]/.test(c)){fN();if(g.wb)fW();word+=c}
  else{fN();fW();
   if(c=='§'){const n=tokSeq(L,partsOf(L,g,'n'),false),d=tokSeq(L,partsOf(L,g,'d'),false);if(!n.length||!d.length)throw new Error('empty fraction part');out.push('(','(',...n,')','/','(',...d,')',')')}
   else if(c=='√'){out.push('√');const n=coverN(A,k);if(n>0){out.push('(');close.set(k+n,(close.get(k+n)||0)+1)}}else if(c=='*'&&g.mul)out.push('*');else if(c=='*'){const nx=A[k+1],pv=A[k-1],nc=nx&&ch(nx),pc=pv&&ch(pv);out.push((!nx||nx.sup||g.sup&&!(pv&&pv.sup)||'+-*/=)%→d'.includes(nc)||!pv||'+-*/=(d∫→'.includes(pc))?'x':'*')}else out.push(c)}
  if(close.has(k)){fN();fW();if(inSup&&!(A[k+1]&&A[k+1].sup)){out.push(')');inSup=false}for(let q=close.get(k);q>0;q--)out.push(')')}});
 fN();fW();if(inSup)out.push(')');return out}
function tokenize(L){return tokSeq(L,seqs(L)[0],true)}
/* Mathematical parsing and evaluation live in math-core.js + calculator.js. */
function computeAns(L) {
  const last=L.syms[L.syms.length-1],trailingEquals=!!(last&&ch(last)=='=');
  let tokens;
  try { tokens=tokenize(L); } catch (_) { return null; }
  return Calculator.compute(tokens,{...SET,lang:LANG},trailingEquals);
}
function buildAns(pieces){const now=performance.now();let k=0;const out=[];const d=()=>now+260+(k++)*75;
 for(const p of pieces){if(p.s!==undefined)[...p.s].forEach(c=>{if(c!=' ')out.push(newG([{c,p:1}],{ans:true,delay:d()}))});
  else{const fid='a'+(++FID);out.push(newG([{c:'§',p:1}],{ans:true,fp:'bar',fid,delay:d()}));[...p.f[0]].forEach(c=>out.push(newG([{c,p:1}],{ans:true,fp:'n',fid,delay:d()})));[...p.f[1]].forEach(c=>out.push(newG([{c,p:1}],{ans:true,fp:'d',fid,delay:d()})))}}
 return out}
function newG(c,o){return Object.assign({c,i:0,x:0,y:0,sz:60,tx:0,ty:0,tsz:60,a:0,ta:1,ot:0,old:null,delay:0,ink:null,w:0,w0:0,sup:false,bw:0},o)}
function updateAns(L){const r=computeAns(L),key=r?r.text:null;if(key===L.at)return;L.at=key;L.val=r?r.val:undefined;lastL=L;L.ans.forEach(kill);L.ans=[];if(!r)return;
 L.ans=buildAns(r.pieces);layout(L);L.ans.forEach(g=>{g.x=g.tx+4;g.y=g.ty+L.F*.35;g.sz=g.tsz;if(g.fp=='bar')g.bw=0});if(window.histSave)histSave(L)}
function kill(g){g.ta=0;g.tsz*=.75;g.ty+=16;g.ink=null;g.delay=0;fx.push(g)}
function inkBand(L){let y0=1e9,y1=-1e9;L.ink.forEach(s=>{const b=bb(s);y0=Math.min(y0,b.y0);y1=Math.max(y1,b.y1)});const m=Math.max(.4*(y1-y0)+10,35);return[y0-m,y1+m]}
function lineBox(L){if(L.seq&&L.ink.length)return inkBand(L);if(L.syms.length||L.ans.length)return[L.base-1.05*L.F,L.base+.4*L.F];let y0=1e9,y1=-1e9;L.ink.forEach(s=>{const b=bb(s);y0=Math.min(y0,b.y0);y1=Math.max(y1,b.y1)});const h=y1-y0,m=Math.max(.4*h+10,35);return[y0-m,y1+m]}
const isBar=s=>{const b=bb(s);return!s.vin&&b.w>=56&&b.h<.2*b.w};
function attach(s){const b=bb(s),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;
 for(const L of lines)for(const t of L.ink){if(t===s)continue;const tb=bb(t);
  if(isBar(t)&&!isBar(s)){if(cx>=tb.x0-12&&cx<=tb.x1+12&&Math.abs(cy-(tb.y0+tb.y1)/2)<Math.max(130,tb.w)){L.ink.push(s);return}}
  else if(isBar(s)&&!isBar(t)){const tc=(tb.x0+tb.x1)/2;if(tc>=b.x0-12&&tc<=b.x1+12&&Math.abs((tb.y0+tb.y1)/2-cy)<Math.max(130,b.w)){L.ink.push(s);return}}}
 let best=null,bd=1e9;
 for(const L of lines){if(L.kidOf)continue;const[a,z]=lineBox(L);const d=cy<a?a-cy:cy>z?cy-z:0;if(d<bd){bd=d;best=L}}
 if(best&&bd==0){best.ink.push(s);return}
 lines.push({syms:[],ans:[],ink:[s],x0:0,base:0,F:80,at:null})}
const ovl=(a,e)=>{const w=Math.min(a.x1,e.x1)-Math.max(a.x0,e.x0),h=Math.min(a.y1,e.y1)-Math.max(a.y0,e.y0);return w>0&&h>0?w*h/Math.max(1,(a.x1-a.x0)*(a.y1-a.y0)):0};
const GB={'(':.9,')':.9,'√':.85,l:.7,t:.62};
const gbox=g=>{const c=ch(g);if(c=='§')return{x0:g.x,x1:g.x+Math.max(g.bw,g.w),y0:g.y-.12*g.sz,y1:g.y+.12*g.sz};return{x0:g.x,x1:g.x+Math.max(g.w,g.sz*.3),y0:g.y-(GB[c]||.62)*g.sz,y1:g.y+(c=='g'?.25:.12)*g.sz}};
const resamp=Recognizer.resample;
function cusps(s){const p=resamp(s,8);let n=0;for(let i=0;i+6<p.length;){const a=[p[i+3][0]-p[i][0],p[i+3][1]-p[i][1]],b=[p[i+6][0]-p[i+3][0],p[i+6][1]-p[i+3][1]];
 const c=(a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b)||1);if(c<-.5){n++;i+=4}else i++}return n}
function coverage(pts,b,r=18){const gx=7,gy=4;let hit=0;for(let i=0;i<gx;i++)for(let j=0;j<gy;j++){const cx=b.x0+(i+.5)*(b.x1-b.x0)/gx,cy=b.y0+(j+.5)*(b.y1-b.y0)/gy;
 for(const p of pts){if(Math.abs(p[0]-cx)<r&&Math.abs(p[1]-cy)<r&&Math.hypot(p[0]-cx,p[1]-cy)<r){hit++;break}}}return hit/(gx*gy)}
function allBoxes(){const bs=[];for(const L of lines){L.syms.concat(L.ans).forEach(g=>bs.push(gbox(g)));L.ink.forEach(t=>{const q=bb(t);bs.push({x0:q.x0-6,y0:q.y0-6,x1:q.x1+6,y1:q.y1+6})})}return bs}
function revs(v,amp){let d=0,ext=v[0],n=0;for(const x of v){if(d==0){if(Math.abs(x-ext)>amp){d=x>ext?1:-1;ext=x}}else if(d==1){if(x>ext)ext=x;else if(ext-x>amp){d=-1;ext=x;n++}}else{if(x<ext)ext=x;else if(x-ext>amp){d=1;ext=x;n++}}}return n}
function scribStats(s){const b=bb(s),m=Math.max(b.w,b.h);let len=0;for(let i=1;i<s.length;i++)len+=Math.hypot(s[i][0]-s[i-1][0],s[i][1]-s[i-1][1]);
 const pts=resamp(s,6);return{m,ratio:len/Math.max(m,1),c:cusps(s),over:allBoxes().some(q=>coverage(pts,q)>=.15)}}
function isScribble(s){if(s.length<8)return false;const k=scribStats(s);if(k.m<18)return false;
 if(seqOn()){if(!((k.c>=5&&k.ratio>=3.5)||(k.c>=4&&k.ratio>=7)))return false;const pts=resamp(s,6);return allBoxes().some(q=>coverage(pts,q)>=.4)}   // ink stays on the board: only a real wiggle over existing ink erases (a looped 2 or a cursive x overlaps a neighbour)
 return k.over?((k.c>=3&&k.ratio>=2.2)||(k.c>=2&&k.ratio>=2.6)||k.ratio>=4.2):((k.c>=4&&k.ratio>=3.5)||k.ratio>=6)}
function scribble(s){const now=performance.now();ghosts.push({pts:s,t0:now});const pts=resamp(s,6),cov=(b,r)=>coverage(pts,b,r),cg=g=>ch(g)=='§'?cov(gbox(g),6)*(.22/.45):cov(gbox(g),18);
 for(const L of lines.slice()){const nIn=L.ink.length;L.ink=L.ink.filter(t=>{const q=bb(t);if(cov({x0:q.x0-8,y0:q.y0-8,x1:q.x1+8,y1:q.y1+8})>=.22){ghosts.push({pts:t,t0:now});return false}return true});
  if(L.seq){if(L.ink.length!==nIn){L.sk=null;if(!L.ink.length){clearReading(L);lines.splice(lines.indexOf(L),1)}}continue}
  if(L.ans.some(g=>cg(g)>=.22)){L.syms.forEach(kill);L.syms=[];L.ans.forEach(kill);L.ans=[];L.at=null}
  else{const rem=L.syms.filter(g=>cg(g)>=.22);for(let i=0;i<rem.length;i++){const bar=rem[i];if(bar.fp=='bar')L.syms.forEach(s=>{if((s.fid===bar.fid||s.pfid===bar.fid)&&!rem.includes(s))rem.push(s)})}   // erasing a bar takes its parts and any fraction nested in them
   if(rem.length){rem.forEach(kill);L.syms=L.syms.filter(g=>!rem.includes(g));if(L.syms.length){layout(L);updateAns(L)}else{L.ans.forEach(kill);L.ans=[];L.at=null}}}
  if(!L.syms.length&&!L.ink.length)lines.splice(lines.indexOf(L),1)}}
function radical(s){const n=s.length;if(n<8)return null;let v=0;for(let i=0;i<n;i++)if(s[i][1]>s[v][1])v=i;if(v<2||v>n-3)return null;
 let m=v;for(let i=v;i<n;i++)if(s[i][1]<s[m][1])m=i;const H=s[v][1]-s[m][1];if(H<28)return null;let a=v;for(let i=v;i<n;i++)if(s[i][1]<=s[m][1]+.08*H){a=i;break}
 if(!(s[0][1]<s[v][1]-.15*H&&s[0][1]>s[a][1]&&s[v][0]>s[0][0]&&s[a][0]>s[v][0]+.15*H))return null;
 const tail=s.slice(a),tx=Math.max(...tail.map(p=>p[0]))-s[a][0];if(tx<.8*H)return null;
 const main=s.slice(0,a+1);main.vin={x0:s[a][0],x1:s[a][0]+tx};return main}
function ctxfix(arr){let pc='',open=0;arr.forEach((y,k)=>{if(y.fresh){const last=k==arr.length-1;y.c.forEach(o=>{let f=1;const c=o.c;
 if(('*/)'.includes(c)||c=='→')&&(k==0||'+-*/('.includes(pc)))f*=.25;if(c==')'&&open<=0)f*=.3;if(c=='='&&!last)f*=.3;if(last&&'+-*/'.includes(c))f*=.5;o.p*=f});
 y.c.sort((a,b)=>b.p-a.p);y.c=y.c.slice(0,5);y.i=0;y.fresh=false}
 const c=ch(y);if(c=='(')open++;if(c==')')open--;pc=c})}
const {wordfix,assignSup}=Recognizer;
function assignCover(A){A.forEach((g,k)=>{if(ch(g)=='√'&&g.vin){let n=0;for(let j=k+1;j<A.length;j++){if(!A[j].b)break;const cx=(A[j].b.x0+A[j].b.x1)/2;if(cx>=g.vin.x0-10&&cx<=g.vin.x1+14)n++;else break}g.cover=n}})}
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
/* ---------- sequence recogniser: the ink stays where it was written; its typeset reading and the answer appear below it ---------- */
const seqEl=document.getElementById('seq');
let sw=null,swPend=new Map(),swId=0,swDead=!seqEl,swUrl=null,swBoot=0;
const seqOn=()=>SET.recogniser==='seq'&&!swDead;
function seqFail(){swDead=true;clearTimeout(swBoot);if(sw){sw.terminate();sw=null}if(swUrl){URL.revokeObjectURL(swUrl);swUrl=null}
 for(const q of swPend.values()){clearTimeout(q.t);q.rej(new Error('sequence recogniser unavailable'))}swPend.clear();
 for(const L of lines.slice())if(L.seq)dropReading(L)}
function seqBoot(){if(swDead||sw||SET.recogniser!=='seq')return;try{
 swUrl=URL.createObjectURL(new Blob([seqEl.textContent+"\nconst M=SeqCore.load(SEQ_MODEL);onmessage=e=>{let t=null;try{t=SeqCore.recognise(M,e.data.s)}catch(x){}postMessage({id:e.data.id,t})};postMessage({ready:true});"],{type:'text/javascript'}));
 sw=new Worker(swUrl);swBoot=setTimeout(seqFail,60000);
 sw.onmessage=e=>{if(swUrl){URL.revokeObjectURL(swUrl);swUrl=null}if(e.data.ready){clearTimeout(swBoot);return}
  const q=swPend.get(e.data.id);if(q){swPend.delete(e.data.id);clearTimeout(q.t);e.data.t?q.res(e.data.t):q.rej(new Error('recognition failed'))}};
 sw.onerror=seqFail}catch(e){seqFail()}}
function seqRun(S){return new Promise((res,rej)=>{seqBoot();if(!sw){rej(new Error('no worker'));return}
 const id=++swId,pts=S.map(s=>s.map((p,k)=>[p[0],p[1],k==0?s.t0||0:k==s.length-1?s.t1||0:0]));
 swPend.set(id,{res,rej,t:setTimeout(seqFail,90000)});try{sw.postMessage({id,s:pts})}catch(e){seqFail()}})}
function dropReading(L){L.syms.forEach(kill);L.syms=[];L.ans.forEach(kill);L.ans=[];L.at=null;
 (L.kids||[]).forEach(K=>{K.syms.concat(K.ans).forEach(kill);const i=lines.indexOf(K);if(i>=0)lines.splice(i,1)});L.kids=[];L.seq=false;L.sk=L.tk=null}
const clearReading=dropReading;
function mkGlyphs(row){const ids=new Map();return SeqCore.toGlyphs(row).map(o=>{let fid;if(o.fid){if(!ids.has(o.fid))ids.set(o.fid,++FID);fid=ids.get(o.fid)}
 return newG([{c:o.c,p:1}],{sup:!!o.sup,fp:o.fp,fid,pfid:o.pfid?ids.get(o.pfid):undefined,pfp:o.pfp,cover:o.cover||0,wb:!!o.wb,mul:!!o.mul,fresh:false})})}
function placeRow(L,gs,x0,base,F){L.syms=gs;L.x0=x0;L.base=base;L.F=F;layout(L);
 for(const g of gs){g.x=g.tx;g.y=g.ty+10;g.sz=g.tsz;g.a=0;g.ta=1;if(ch(g)=='√')g.vx=g.tx+.56*g.tsz}updateAns(L)}
function applyReading(L,tokens){const key=tokens.join(' ');if(L.seq&&L.tk===key)return;
 const rows=[[]];for(const t of tokens)t==='<nl>'?rows.push([]):rows[rows.length-1].push(t);
 dropReading(L);L.tk=key;
 let x0=1e9,y1=-1e9;const hs=[];for(const s of L.ink){const b=bb(s);x0=Math.min(x0,b.x0);y1=Math.max(y1,b.y1);if(b.h>=12)hs.push(b.h)}
 hs.sort((a,b)=>a-b);const h=hs.length?hs[Math.floor(hs.length*.75)]:40,F=Math.max(48,Math.min(110,h/.55*.85));
 L.seq=true;placeRow(L,mkGlyphs(rows[0]),x0,y1+1.1*F,F);
 let base=L.base;rows.slice(1).forEach(r=>{base+=1.5*F;const K={syms:[],ans:[],ink:[],x0,base,F,at:null,kidOf:L};lines.push(K);L.kids.push(K);placeRow(K,mkGlyphs(r),x0,base,F)})}
async function doRecognizeSeq(){
 for(const L of lines.slice()){if(L.kidOf||!L.ink.length||!lines.includes(L))continue;
  const snap=L.ink.slice(),key=snap.length+':'+snap.map(s=>s.length).join(',');if(L.sk===key)continue;
  const toks=await seqRun(snap);
  if(!lines.includes(L)||L.ink.length!==snap.length||L.ink.some((s,k)=>s!==snap[k]))continue;
  if(toks.length)applyReading(L,toks);L.sk=key}
 kick()}
initCNN();
seqBoot();
let recBusy=false,recAgain=false;
function recognize(){if(recBusy){recAgain=true;return}recBusy=true;(seqOn()?doRecognizeSeq().catch(e=>{console.error(e);seqFail();return doRecognize()}):doRecognize()).catch(e=>console.error(e)).then(()=>{recBusy=false;if(recAgain){recAgain=false;recognize()}})}
function typesetNum(L,b){const bcy=(b.y0+b.y1)/2;if(L.syms.some(g=>ch(g)=='§'&&g.x+g.bw>b.x0-15&&g.x<b.x1+15))return[];
 return L.syms.filter(g=>{if(isPart(g))return false;const q=gbox(g),cx=(q.x0+q.x1)/2;return cx>=b.x0-15&&cx<=b.x1+15&&q.y1<bcy+10})}
function hostOK(L,b){const top=L.syms.filter(g=>!isPart(g));if(!top.length)return false;const x0=Math.min(...top.map(g=>g.tx)),x1=Math.max(...top.map(g=>g.tx+g.w)),bcy=(b.y0+b.y1)/2,ov=Math.min(b.x1,x1)-Math.max(b.x0,x0);
 return ov>=.4*Math.min(b.w,x1-x0)&&bcy>L.base+2&&bcy<L.base+1.4*L.F}
function findFractions(S,L){const out=[],used=new Set(),info=S.map(s=>({s,b:bb(s)})),ref=Math.max(40,...info.map(o=>Math.max(o.b.w,o.b.h)));
 for(const bar of info){if(used.has(bar.s)||!isBar(bar.s))continue;const bb0=bar.b,bcy=(bb0.y0+bb0.y1)/2;
  const cand=info.filter(o=>o!==bar&&!used.has(o.s)&&!(isBar(o.s)&&o.b.w>.6*bb0.w)&&(o.b.x0+o.b.x1)/2>=bb0.x0-12&&(o.b.x0+o.b.x1)/2<=bb0.x1+12);
  const big=o=>Math.max(o.b.w,o.b.h)>=.2*ref,H=Math.max(30,...cand.filter(big).map(o=>o.b.h));
  const up=cand.filter(o=>o.b.y1<=bcy+10&&bcy-o.b.y1<1.3*H),dn=cand.filter(o=>o.b.y0>=bcy-10&&o.b.y0-bcy<1.3*H);
  if(up.some(big)&&dn.some(big)){const f={bar:bar.s,n:up.map(o=>o.s),d:dn.map(o=>o.s)};[bar.s,...f.n,...f.d].forEach(s=>used.add(s));out.push(f)}
  else if(L&&!up.some(big)&&dn.some(big)){const num=typesetNum(L,bb0);if(num.length){const f={bar:bar.s,n:[],d:dn.map(o=>o.s),conv:num};[bar.s,...f.d].forEach(s=>used.add(s));out.push(f)}}}
 return{out,used}}
let FID=0;
function barNear(L,b){const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;for(const g of L.syms){if(g.fp!='bar'||ch(g)!='§')continue;
  if(cx>=g.x-12&&cx<=g.x+Math.max(g.bw,g.w)+12){if(cy<g.y-4&&g.y-cy<1.4*L.F)return{fid:g.fid,fp:'n'};if(cy>g.y+4&&cy-g.y<1.4*L.F)return{fid:g.fid,fp:'d'}}}return null}
function insertPart(L,g,cx){const S=L.syms,bi=S.findIndex(s=>s.fid===g.fid&&s.fp=='bar');if(bi<0){S.push(g);return}
 const same=S.map((s,k)=>({s,k})).filter(o=>o.s.fid===g.fid&&o.s.fp==g.fp);let idx;
 if(!same.length){const lastN=S.map((s,k)=>({s,k})).filter(o=>o.s.fid===g.fid&&o.s.fp=='n').pop();idx=g.fp=='n'?bi+1:(lastN?lastN.k+1:bi+1)}
 else{const nxt=same.find(o=>o.s.tx+o.s.w/2>cx);idx=nxt?nxt.k:same[same.length-1].k+1}S.splice(idx,0,g)}
function moveBarsToHosts(){for(const L2 of lines.slice()){if(!L2.ink.length)continue;const info=L2.ink.map(s=>({s,b:bb(s)})),ref=Math.max(40,...info.map(o=>Math.max(o.b.w,o.b.h)));
 for(const bar of info){if(!isBar(bar.s))continue;const b0=bar.b,bcy=(b0.y0+b0.y1)/2,inr=o=>o!==bar&&(o.b.x0+o.b.x1)/2>=b0.x0-12&&(o.b.x0+o.b.x1)/2<=b0.x1+12,big=o=>Math.max(o.b.w,o.b.h)>=.2*ref;
  const H=Math.max(30,...info.filter(o=>inr(o)&&big(o)).map(o=>o.b.h)),up=info.filter(o=>inr(o)&&o.b.y1<=bcy+10&&bcy-o.b.y1<1.3*H),dn=info.filter(o=>inr(o)&&o.b.y0>=bcy-10&&o.b.y0-bcy<1.3*H);
  if(up.some(big)||!dn.some(big))continue;const host=lines.find(L1=>L1!==L2&&L1.syms.length&&hostOK(L1,b0));
  if(host){const mv=[bar.s,...dn.map(o=>o.s)];L2.ink=L2.ink.filter(s=>!mv.includes(s));host.ink.push(...mv);if(!L2.ink.length&&!L2.syms.length)lines.splice(lines.indexOf(L2),1);break}}}}
/** A cursive word written in one pen-down (sin, ln, 12) is cut into its letters before recognition. */
async function splitCursive(L){
 const cut=new Map(),classify=async ss=>{const x=feat(ss);return classifyP(await predictAsync(x),x)};
 for(const s of L.ink.slice()){if(s.vin||s.length<12)continue;const parts=await Recognizer.segmentStroke(s,classify);if(parts.length>1)cut.set(s,parts)}
 if(cut.size)L.ink=L.ink.flatMap(s=>cut.get(s)||[s])}
async function doRecognize(){moveBarsToHosts();for(const L of lines.slice())if(L.ink.length)await splitCursive(L);const jobs=[];
 const mk=(g,G,fp,fid)=>{const b=g.b;if(g.tiny&&G.length>1||Math.max(b.w,b.h)<16)return{g,dot:true,fp,fid};const rs=g.s.find(t=>t.vin);return{g,x:feat(g.s),vin:rs&&rs.vin,fp,fid}};
 for(const L of lines){if(!L.ink.length)continue;const snap=L.ink.slice(),{out,used}=findFractions(snap,L),items=[];
  for(const f of out){const fid=++FID;if(f.conv){items.push({g:{s:[f.bar],b:bb(f.bar)},bar:true,fp:'bar',fid,conv:f.conv});const G=group(f.d);G.forEach(g=>items.push(mk(g,G,'d',fid)));continue}items.push({g:{s:[f.bar],b:bb(f.bar)},bar:true,fp:'bar',fid});for(const[p,S] of [['n',f.n],['d',f.d]]){const G=group(S);G.forEach(g=>items.push(mk(g,G,p,fid)))}}
  const rest=snap.filter(s=>!used.has(s)),G=group(rest);G.forEach(g=>{const tb=barNear(L,g.b);items.push(mk(g,G,tb&&tb.fp,tb&&tb.fid))});
  jobs.push({L,items})}
 const need=jobs.flatMap(j=>j.items.filter(it=>it.x)),ps=await Promise.all(need.map(it=>predictAsync(it.x)));need.forEach((it,k)=>it.p=ps[k]);
 for(const j of jobs){const L=j.L;if(!lines.includes(L))continue;
  const alive=j.items.filter(it=>it.g.s.every(s=>L.ink.includes(s)));if(!alive.length)continue;
  const done=new Set();alive.forEach(it=>it.g.s.forEach(s=>done.add(s)));L.ink=L.ink.filter(s=>!done.has(s));
  const fresh=alive.map(it=>{const g=it.g,b=g.b,o={b,ink:g.s,fp:it.fp,fid:it.fid};
   if(it.bar)return newG([{c:'§',p:1}],Object.assign(o,{fresh:false,conv:it.conv}));
   return it.dot?newG([{c:'.',p:1}],Object.assign(o,{fresh:false})):newG(classifyP(it.p,it.x),Object.assign(o,{fv:it.x,fresh:true,vin:it.vin}))});
  const key=g=>(g.b.x0+g.b.x1)/2,units=[],late=[];
  for(const bar of fresh.filter(g=>g.conv)){const nums=bar.conv.filter(s=>L.syms.includes(s));if(!nums.length)continue;
   const ds=fresh.filter(g=>g.fid===bar.fid&&g.fp=='d').sort((a,b)=>key(a)-key(b));nums.forEach(s=>{s.fp='n';s.fid=bar.fid});
   L.syms.splice(L.syms.indexOf(nums[0]),0,bar);L.syms.splice(L.syms.indexOf(nums[nums.length-1])+1,0,...ds);bar.done=true;ds.forEach(g=>g.done=true)}
  const rest=fresh.filter(g=>!g.done);
  for(const g of rest){if(g.fp=='bar'||(g.fp&&!L.syms.some(s=>s.fid===g.fid)&&!L.ans.some(s=>s.fid===g.fid)))continue;
   const nb=g.b,na=Math.max(1,nb.w*nb.h);let hit=null;
   for(const s of L.syms){if(ch(s)=='§'||s.fp=='bar')continue;const q=gbox(s),iw=Math.min(nb.x1,q.x1)-Math.max(nb.x0,q.x0),ih=Math.min(nb.y1,q.y1)-Math.max(nb.y0,q.y0);
    if(iw>0&&ih>0){const r=iw*ih/Math.min(Math.max(1,(q.x1-q.x0)*(q.y1-q.y0)),Math.max(na,(nb.w+8)*(nb.h+8)));if(r>=.5&&key(g)>q.x0&&key(g)<q.x1){hit=s;break}}}
   if(hit){if(hit.fp){g.fp=hit.fp;g.fid=hit.fid}L.syms.splice(L.syms.indexOf(hit),1);kill(hit)}}
  for(const g of rest){if(g.fp=='bar')continue;if(g.fp&&L.syms.some(s=>s.fid===g.fid&&s.fp=='bar')){late.push(g);continue}if(!g.fp)units.push({k:key(g),a:[g]})}
  const fids=[...new Set(rest.filter(g=>g.fp=='bar').map(g=>g.fid))];
  for(const id of fids){const part=p=>rest.filter(g=>g.fid===id&&g.fp==p).sort((a,b)=>key(a)-key(b)),bar=part('bar')[0];units.push({k:key(bar),a:[bar,...part('n'),...part('d')]})}
  units.sort((a,b)=>a.k-b.k);const isNew=!L.syms.length;
  for(const un of units){let k=L.syms.findIndex(s=>!isPart(s)&&s.tx+s.w/2>un.k);if(k<0)k=L.syms.length;L.syms.splice(k,0,...un.a)}
  late.sort((a,b)=>key(a)-key(b));for(const g of late)insertPart(L,g,key(g));
  for(const A of seqs(L)){ctxfix(A);wordfix(A);assignSup(A);assignCover(A)}
  const topF=fresh.filter(g=>!g.fp),dg=topF.filter(g=>!g.sup&&/[0-9]/.test(ch(g))).map(g=>g.b),pdg=fresh.filter(g=>g.fp&&g.fp!='bar'&&!g.sup&&/[0-9]/.test(ch(g))).map(g=>g.b),bars=fresh.filter(g=>g.fp=='bar');
  if(isNew){const med=a=>a.sort((p,q)=>p-q)[a.length>>1];
   const h=dg.length?med(dg.map(b=>b.h))/.55:pdg.length?med(pdg.map(b=>b.h))/(.55*.8):80;L.F=Math.max(56,Math.min(170,h));
   L.base=dg.length?med(dg.map(b=>b.y1)):bars.length?(bars[0].b.y0+bars[0].b.y1)/2+.28*L.F:(fresh.map(g=>(g.b.y0+g.b.y1)/2)[0]+.3*L.F);L.x0=Math.min(...fresh.map(g=>g.b.x0))}
  else L.x0=Math.min(L.x0,...fresh.filter(g=>g.fp!='n'&&g.fp!='d').map(g=>g.b.x0));
  layout(L);
  const {HR,DS}=Recognizer;
  for(const g of fresh){const c=ch(g);
   if(c=='§'){g.sz=L.F;g.x=g.b.x0;g.y=(g.b.y0+g.b.y1)/2;g.bw=g.b.w;g.a=0;g.ta=1;continue}
   const dgt=/[0-9a-z()!π]/.test(c);let sz;
   if(dgt)sz=Math.max(24,g.b.h/(HR[c]||.55));else if(c=='+'||c=='*')sz=Math.min(L.F,Math.max(g.b.w,g.b.h)/.38);else sz=L.F;
   if(c=='√')sz=Math.max(24,g.b.h/.8);g.sz=sz;g.x=(g.b.x0+g.b.x1)/2-adv(c,sz)/2;
   g.y=c=='.'?g.b.y1+2:dgt?g.b.y1-(DS[c]||0)*sz:(g.b.y0+g.b.y1)/2+.2*sz;g.a=0;g.ta=1;
   if(c=='√'){g.x=g.b.x0;g.y=g.b.y1;g.vx=g.x+.56*sz}}
  updateAns(L)}
 kick()}
function learnLater(g){clearTimeout(g.lt);g.lt=setTimeout(()=>{if(g.fv&&g.c[g.i])remember(g.fv,g.c[g.i].c)},2500)}
function tapCycle(p){for(const L of lines)for(const g of L.syms){const b=gbox(g);if(g.c.length>1&&p[0]>b.x0-8&&p[0]<b.x1+8&&p[1]>b.y0-8&&p[1]<b.y1+8){g.old=ch(g);g.ot=1;g.i=(g.i+1)%g.c.length;g.locked=true;layout(L);updateAns(L);if(g.fv)learnLater(g);kick();return true}}return false}
const pt=e=>toW(e.clientX,e.clientY),spt=e=>[e.clientX,e.clientY];
function gestureStart(){const [a,b]=[...ptrs.values()];clearTimeout(lp);clearTimeout(rt);
 if(cur){cur=null;down=null}                                            /* a second finger means pan/zoom: drop the half-drawn stroke */
 const c=[(a[0]+b[0])/2,(a[1]+b[1])/2];gest={d0:Math.max(20,Math.hypot(a[0]-b[0],a[1]-b[1])),k0:V.k,w:toW(c[0],c[1])};kick()}
function gestureMove(){const [a,b]=[...ptrs.values()],c=[(a[0]+b[0])/2,(a[1]+b[1])/2],k=Math.min(ZMAX,Math.max(ZMIN,gest.k0*Math.hypot(a[0]-b[0],a[1]-b[1])/gest.d0));
 setView(c[0]-gest.w[0]*k,c[1]-gest.w[1]*k,k)}
function ptrEnd(e){ptrs.delete(e.pointerId);if(gest&&ptrs.size<2){if(!ptrs.size){gest=null;if(lines.some(L=>L.ink.length))rt=setTimeout(recognize,650)}else gest.dead=true}}
cv.onpointerdown=e=>{try{cv.setPointerCapture(e.pointerId)}catch(_){}ptrs.set(e.pointerId,spt(e));
 if(ptrs.size===2&&e.pointerType!=='mouse'){gestureStart();return}if(ptrs.size>2||gest)return;
 if(!e.isPrimary)return;clearTimeout(rt);started=true;cur=[pt(e)];down={t:performance.now(),p:pt(e),s:spt(e),len:0};clearTimeout(lp);
 lp=setTimeout(()=>{if(cur&&down.len<8){const d=hitDrag(down.p);if(d){cur=null;beginDrag(d,down.s)}}},450);kick()};
cv.onpointermove=e=>{if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,spt(e));if(gest){if(ptrs.size>=2&&!gest.dead)gestureMove();return}
 if(!e.isPrimary)return;if(drag){dragMove(spt(e));return}if(!cur)return;const es=e.getCoalescedEvents&&e.getCoalescedEvents().length?e.getCoalescedEvents():[e];
 for(const ev of es){const q=pt(ev),l=cur[cur.length-1];const d=Math.hypot(q[0]-l[0],q[1]-l[1])*V.k;if(d<2.5)continue;down.len+=d;cur.raw=q;cur.push([l[0]*.35+q[0]*.65,l[1]*.35+q[1]*.65])}if(down.len>=8)clearTimeout(lp)};
cv.onpointerup=cv.onpointercancel=e=>{const wasGest=!!gest;ptrEnd(e);if(wasGest||e&&e.isPrimary===false)return;clearTimeout(lp);if(drag){dragEnd();return}let s=cur;cur=null;if(!s)return;if(s.raw&&s.length>1)s.push(s.raw);s.t0=down.t;s.t1=performance.now();
 if(down.len<8&&performance.now()-down.t<350&&tapCycle(down.p)){return}
 if(isScribble(s))scribble(s);else{const r=seqOn()?null:radical(s);attach(r||s)}
 rt=setTimeout(recognize,650);kick()};
$('zr').onclick=()=>setView(0,0,1);
cv.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,V.k*Math.exp(-e.deltaY*(e.ctrlKey?.01:.0015)))},{passive:false});
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
function hitDrag(p){for(const L of lines){
 for(const g of L.ans){if(ch(g)=='§')continue;const b=gbox(g);if(p[0]>=b.x0-8&&p[0]<=b.x1+8&&p[1]>=b.y0-8&&p[1]<=b.y1+8&&Number.isFinite(L.val)){const t=Store.plainNumber(L.val);if(t)return{text:t,src:null,L}}}
 const S=L.syms;for(let k=0;k<S.length;k++){const g=S[k];if(!/[0-9.]/.test(ch(g)))continue;const b=gbox(g);
  if(p[0]>=b.x0-8&&p[0]<=b.x1+8&&p[1]>=b.y0-8&&p[1]<=b.y1+8){let a=k,z=k;const same=s=>s&&s.fid===g.fid&&s.fp===g.fp&&/[0-9.]/.test(ch(s))&&!!s.sup===!!g.sup;
   while(same(S[a-1]))a--;while(same(S[z+1]))z++;const run=S.slice(a,z+1);return{text:run.map(ch).join(''),src:{L,run},L}}}}return null}
function beginDrag(d,p){drag={text:d.text,src:d.src,fromMem:d.fromMem,x:p[0],y:p[1]};if(navigator.vibrate)try{navigator.vibrate(15)}catch(e){}memRender();kick()}
function dragMove(p){drag.x=p[0];drag.y=p[1];$('mem').classList.toggle('hot',p[1]>SH-70);kick()}
function dragEnd(){const d=drag;drag=null;memRender();drop(d);kick()}
const typed=t=>[...t].filter(c=>/[0-9.\-+πe]/.test(c)).map(c=>newG([{c,p:1}],{fresh:false}));
function drop(d){if(d.y>SH-70){if(!d.fromMem)memAdd(d.text);return}const [x,y]=toW(d.x,d.y);
 const gs=typed(d.text);if(!gs.length)return;let tgt=null;for(const L of lines){if(!L.syms.length)continue;const[a,z]=lineBox(L);if(y>=a-30&&y<=z+30){tgt=L;break}}
 if(d.src&&d.src.run){const r=d.src.run,b0=gbox(r[0]),b1=gbox(r[r.length-1]);if(Math.abs(x-(b0.x0+b1.x1)/2)<30&&Math.abs(y-(b0.y0+b0.y1)/2)<60)return;
  const SL=d.src.L;r.forEach(kill);SL.syms=SL.syms.filter(s=>!r.includes(s));
  if(SL.syms.length){layout(SL);SL.at='\0';updateAns(SL)}else{SL.ans.forEach(kill);SL.ans=[];lines.splice(lines.indexOf(SL),1)}}
 if(tgt&&lines.includes(tgt)){let k=tgt.syms.findIndex(s=>!isPart(s)&&s.tx+s.w/2>x);if(k<0)k=tgt.syms.length;tgt.syms.splice(k,0,...gs);
  gs.forEach(g=>{g.sz=tgt.F;g.x=x;g.y=y;g.a=0;g.ta=1});layout(tgt);tgt.at='\0';updateAns(tgt)}
 else{const F=d.src&&d.src.L?d.src.L.F:70,L={syms:gs,ans:[],ink:[],x0:Math.max(12,x-.3*F*gs.length),base:y,F,at:null};gs.forEach(g=>{g.sz=F;g.x=x;g.y=y;g.a=0;g.ta=1});lines.push(L);layout(L);updateAns(L)}}
/* ---------- history ---------- */
let HIST=Store.cleanHistory(Store.loadArray(localStorage,'inkhist'));
const histPersist=()=>{Store.save(localStorage,'inkhist',HIST)};
const SUP='⁰¹²³⁴⁵⁶⁷⁸⁹';
function strSeq(L,A){let o='',run='',inSup=false;const flush=()=>{if(!run)return;o+=/^[0-9]+$/.test(run)?[...run].map(c=>SUP[c]).join(''):'^('+run+')';run=''};
 A.forEach(g=>{const c=ch(g);if(g.sup){inSup=true;run+=c;return}if(inSup){flush();inSup=false}
  if(c=='§')o+='('+strSeq(L,partsOf(L,g,'n'))+')/('+strSeq(L,partsOf(L,g,'d'))+')';else o+=c=='*'?'×':c=='/'?'÷':c});flush();return o}
const textOf=L=>strSeq(L,seqs(L)[0]).replace(/=+$/,'').trim();
const serial=L=>L.syms.map(g=>({c:ch(g),sup:g.sup?1:0,fp:g.fp||'',fid:g.fid||'',cover:g.cover||0,pfid:g.pfid||'',pfp:g.pfp||''}));
window.histSave=function(L){if(!L.syms.length)return;L.hid=L.hid||Date.now()+'-'+Math.random().toString(36).slice(2,6);clearTimeout(L.ht);
 L.ht=setTimeout(()=>{const r=computeAns(L);if(!r||!lines.includes(L))return;const e={id:L.hid,ts:Date.now(),syms:serial(L),F:L.F,ans:r.text,text:textOf(L)},i=HIST.findIndex(h=>h.id==L.hid);
  if(i>=0)HIST[i]=e;else HIST.unshift(e);HIST=HIST.slice(0,100);histPersist()},1500)};
function openHist(e){closeSheet();const L={syms:[],ans:[],ink:[],x0:toW(30,0)[0],base:toW(0,SH*.35)[1],F:e.F||70,at:null,hid:e.id};for(const q of lines)L.base=Math.max(L.base,q.base+q.F*1.5);
 e.syms.forEach(s=>L.syms.push(newG([{c:s.c,p:1}],{sup:!!s.sup,fp:s.fp||undefined,fid:s.fid||undefined,pfid:s.pfid||undefined,pfp:s.pfp||undefined,cover:s.cover,fresh:false})));
 lines.push(L);layout(L);L.syms.forEach(g=>{g.x=g.tx;g.y=g.ty+12;g.sz=g.tsz*.9;g.a=0;g.ta=1});updateAns(L);kick()}
/* ---------- export ---------- */
function copyText(t){if(window.Android&&Android.copy){Android.copy(t);toast(T('copied'))}else{try{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();toast(T('copied'))}catch(e){}}}
function shareText(t){if(window.Android&&Android.shareText)Android.shareText(t);else copyText(t)}
function exportPNG(){const bs=[];for(const L of lines)L.syms.concat(L.ans).forEach(g=>{if(g.a>.3)bs.push(gbox(g))});if(!bs.length)return null;
 const x0=Math.min(...bs.map(b=>b.x0))-28,x1=Math.max(...bs.map(b=>b.x1))+28,y0=Math.min(...bs.map(b=>b.y0))-28,y1=Math.max(...bs.map(b=>b.y1))+28,k=2,c=document.createElement('canvas');
 c.width=Math.round((x1-x0)*k);c.height=Math.round((y1-y0)*k);const keep=ctx;ctx=c.getContext('2d');ctx.fillStyle=palette.canvas;ctx.fillRect(0,0,c.width,c.height);ctx.setTransform(k,0,0,k,-x0*k,-y0*k);
 for(const L of lines)L.syms.concat(L.ans).forEach(g=>{const a=g.a;g.a=Math.max(a,a>.3?1:a);drawG(g);g.a=a});ctx=keep;return c.toDataURL('image/png')}
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
 if(TAB=='math')return row('results','fmt',[['frac','exact'],['dec','decimal'],...(SET.fmt=='mixed'?[['mixed','mixed']]:[])])+`<p class="hint">${T('resultsHint')}</p>`+row('angles','angle',[['rad','radians'],['deg','degrees']])+row('numbers','domain',[['real','real'],['complex','complex']])+row('calculate','mode',[['instant','instant'],['demand','onDemand']])+`<p class="hint">${T('calculateHint')}</p>`;
 if(TAB=='app')return row('language','lang',[['en','English'],['fr','Français']],LANG)+row('theme','theme',[['dark','dark'],['light','light']])+(SET.recogniser=='classic'?row('recogniser','recogniser',[['seq','sequence'],['classic','classic']]):'')+(hasUpdater()?row('updates','updates',[['auto','auto'],['off','off']])+`<div class="tools">${updTools()}</div><p class="hint">${updHint()}</p>`:'');
 return `<div class="tools">${tool('hist','hist',T('history'))}${tool('copy','copy',T('copyResult'))}${tool('img','share',T('shareImage'))}${tool('addmem','mem',T('toMemory'))}${tool('clrmem','trash',T('emptyMemory'))}${tool('clear','eraser',T('clearCanvas'),'danger')}</div><p class="hint">${T('dragHint')}</p>`}
function openSheet(page){const p=$('panel'),s=$('sheet'),first=s.style.display!='block';s.style.display='block';
 if(page=='hist'){p.innerHTML=`<div class="head"><button class="iconbtn" data-a="back" aria-label="${T('back')}">${ico('back')}</button><h2>${T('history')}</h2><button class="done" data-a="hexp">${T('export')}</button></div>`+
  (HIST.length?HIST.map((h,i)=>`<div class="hrow"><button class="hmain" data-a="hopen" data-i="${i}"><span class="ex">${esc(h.text)}</span><span class="an">${esc(h.ans.replace(/^=/,'= '))}</span></button><button class="iconbtn" data-a="hcopy" data-i="${i}" aria-label="${T('copy')}">${ico('copy')}</button><button class="iconbtn" data-a="hdel" data-i="${i}" aria-label="${T('delete')}">${ico('close')}</button></div>`).join('')+`<button class="textbtn danger" data-a="hclr">${T('clearHistory')}</button>`:`<p class="empty">${T('historyEmpty')}</p>`)}
 else p.innerHTML=`<div class="head"><h2>Mikajy</h2><button class="done" data-a="done">${T('done')}</button></div><div class="tabs" role="tablist">${[['actions','tabActions'],['math','tabMath'],['app','tabApp']].map(([id,k])=>`<button class="tab${TAB==id?' on':''}" role="tab" aria-selected="${TAB==id}" data-tab="${id}">${T(k)}</button>`).join('')}</div>${menuBody()}`;
 if(first){s.classList.remove('in');void s.offsetWidth}s.classList.add('in');fitRings()}
const cleanAns=L=>L&&L.at?L.at.replace(/^=/,''):'';
$('panel').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.tab){TAB=d.tab;openSheet('main');return}
 if(d.k){SET[d.k]=d.v;saveSet();b.parentNode.querySelectorAll('.opt').forEach(o=>o.classList.toggle('on',o===b));if(d.k==='lang'){LANG=I18n.resolve(d.v,navigator.language);applyLang();refreshAll();openSheet('main');return}if(d.k==='theme')applyTheme();else if(d.k!=='updates'){if(d.k==='recogniser')seqBoot();refreshAll()}else if(SET.updates==='auto')checkUpdates(false);return}
 const i=+d.i;switch(d.a){case'done':closeSheet();break;case'hist':openSheet('hist');break;case'back':openSheet('main');break;
  case'copy':{const t=cleanAns(lastL&&lines.includes(lastL)?lastL:lines.find(L=>L.at));t?copyText(t):toast(T('noResult'));closeSheet();break}
  case'img':{const u=exportPNG();if(!u)toast(T('nothingToShare'));else if(window.Android&&Android.shareImage)Android.shareImage(u.split(',')[1]);else window.open(u);closeSheet();break}
  case'addmem':{const L=lastL&&lines.includes(lastL)?lastL:lines.find(L=>Number.isFinite(L.val));const t=L&&Store.plainNumber(L.val);if(t){memAdd(t);toast(T('savedToMemory'))}else toast(L&&Number.isFinite(L.val)?T('tooLarge'):T('noResult'));closeSheet();break}
  case'clrmem':MEMV=[];memSave();memRender();toast(T('memoryEmptied'));closeSheet();break;
  case'clear':lines.forEach(L=>L.syms.concat(L.ans).forEach(kill));lines=[];kick();closeSheet();break;
  case'hopen':if(HIST[i])openHist(HIST[i]);break;case'hcopy':if(HIST[i])copyText(HIST[i].text+' '+HIST[i].ans.replace(/^=/,'= '));break;
  case'hdel':if(HIST[i]){HIST.splice(i,1);histPersist();openSheet('hist')}break;case'hclr':HIST=[];histPersist();openSheet('hist');break;
  case'upd':checkUpdates(true);break;
  case'getupd':{const u=pendingUpdate();if(u)Android.openUpdate(u.apk||u.url);break}
  case'hexp':shareText(HIST.map(h=>h.text+' '+h.ans.replace(/^=/,'= ')).join('\n'));break}};
$('back').onclick=closeSheet;$('mb').onclick=()=>openSheet('main');
window.onBack=()=>{if($('sheet').classList.contains('in')){closeSheet();return true}if(drag){drag=null;memRender();return true}return false};
/* ---------- updates (the Android shell makes the request; this page only interprets the answer) ---------- */
let UPD=Updates.load(localStorage),updManual=false;
const hasUpdater=()=>!!(window.Android&&typeof Android.checkForUpdates==='function'&&typeof Android.version==='function');
const appVersion=()=>{try{return String(Android.version())}catch(e){return''}};
const pendingUpdate=()=>hasUpdater()?Updates.pending(UPD,appVersion()):null;
function updTools(){if(!hasUpdater())return'';const u=pendingUpdate();return tool('upd','sync',T('checkUpdates'))+(u?tool('getupd','get',T('getUpdate',{v:esc(u.version)}),'danger'):'')}
function updHint(){if(!hasUpdater())return'';const u=pendingUpdate();return T('updateHint',{v:esc(appVersion()),avail:u?T('availableSuffix',{n:esc(u.version)}):''})}
function updBadge(){$('mb').classList.toggle('upd',!!pendingUpdate())}
window.onUpdateResult=json=>{
 const manual=updManual;updManual=false;let r;
 try{r=Updates.interpret(JSON.parse(json),appVersion())}catch(e){r={status:'error'}}
 if(r.status==='offline'||r.status==='error'){if(manual)toast(T(r.status==='offline'?'offline':'checkFailed'));return}
 UPD=Updates.record(UPD,r,Date.now());Updates.save(localStorage,UPD);updBadge();
 if(r.status==='available')toast(T('updateAvailable',{v:r.version}));else if(manual)toast(T('upToDate'));
 if($('sheet').classList.contains('in'))openSheet('main')};
function checkUpdates(manual){if(!hasUpdater())return;updManual=manual;if(manual)toast(T('checking'));try{Android.checkForUpdates()}catch(e){updManual=false}}
updBadge();
if(hasUpdater()&&Updates.shouldCheck(UPD,Date.now(),SET.updates))setTimeout(()=>checkUpdates(false),5000);
memRender();
applyTheme();applyLang();
