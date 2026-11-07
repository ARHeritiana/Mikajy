const cv=document.getElementById('pad');let ctx=cv.getContext('2d');const $=id=>document.getElementById(id);
let DPR=1,lastL=null,lp=null,drag=null,SW=0,SH=0,lines=[],fx=[],ghosts=[],cur=null,down=null,started=false,rt=null,raf=0,tPrev=0;
const FONT='H, serif';
const disp=c=>c=='*'?'×':c=='/'?'÷':c=='-'?'−':c;
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const ch=g=>g.c[g.i].c;
const FUNCS=new Set(['sin','cos','tan','asin','acos','atan','sinh','cosh','tanh','ln','log','abs']);
let SET=SettingsStore.load(localStorage);
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
 if(!started&&!lines.length&&!cur){ctx.globalAlpha=.25;ctx.fillStyle=palette.ink;ctx.font='54px '+FONT;ctx.textAlign='center';ctx.fillText('write a sum',SW/2,SH/2);ctx.textAlign='left';ctx.globalAlpha=1}
 for(const L of lines){L.syms.forEach(drawG);L.ans.forEach(drawG);L.ink.forEach(s=>drawInk(s,1))}
 fx.forEach(drawG);ghosts.forEach(g=>drawInk(g.pts,1-(now-g.t0)/420));if(cur)drawInk(cur,1);
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
const partsOf=(L,bar,p)=>L.syms.concat(L.ans).filter(s=>s.fid===bar.fid&&s.fp==p);
function seqs(L){const top=[],m=new Map();for(const g of L.syms){if(isPart(g)){const k=g.fid+g.fp;if(!m.has(k))m.set(k,[]);m.get(k).push(g)}else top.push(g)}return[top,...m.values()]}
function layout(L){const F=L.F,top=L.syms.filter(g=>!isPart(g)),items=top.concat(L.ans.filter(g=>!isPart(g)));if(!items.length)return;let tot=0;
 const sf=g=>g.sup?.62:1,first=(g,k)=>g.ans&&(k==0||!items[k-1].ans),extra=(g,k)=>(first(g,k)?.28*F:0)+(ch(g)=='§'&&k>0?.1*F:0),trail=g=>.06*F*sf(g)+(g.ans&&ch(g)=='='?.14*F:0);
 const seqW=(A,s)=>A.reduce((w,g)=>w+adv(ch(g),s*sf(g))+.06*s*sf(g),0);
 items.forEach((g,k)=>{if(ch(g)=='§'){g.nW=seqW(partsOf(L,g,'n'),.8*F);g.dW=seqW(partsOf(L,g,'d'),.8*F);g.w0=Math.max(g.nW,g.dW)+.4*F}else g.w0=adv(ch(g),F*sf(g));tot+=g.w0+trail(g)+extra(g,k)});
 let x0=L.x0,f=Math.min(1,(SW-24-x0)/tot);if(f<.6){x0=12;f=Math.min(1,(SW-24)/tot)}
 const base=Math.min(SH-24,Math.max(F*f*.95+12,L.base));let x=x0;
 items.forEach((g,k)=>{x+=extra(g,k)*f;g.tx=x;g.tsz=F*f*sf(g);g.w=g.w0*f;
  if(ch(g)=='§'){const ay=base-.28*F*f;g.ty=ay;g.bwt=g.w;if(!g.bw)g.bw=g.w;const sn=.8*F*f;let nx=x+(g.w-g.nW*f)/2,dx=x+(g.w-g.dW*f)/2;
   for(const s of partsOf(L,g,'n')){const a=adv(ch(s),.8*F*sf(s));s.tx=nx;s.tsz=sn*sf(s);s.ty=ay-.14*F*f-(s.sup?.42*sn:0);s.w=a*f;nx+=(a+.06*.8*F*sf(s))*f}
   for(const s of partsOf(L,g,'d')){const a=adv(ch(s),.8*F*sf(s));s.tx=dx;s.tsz=sn*sf(s);s.ty=ay+.14*F*f+.55*sn-(s.sup?.42*sn:0);s.w=a*f;dx+=(a+.06*.8*F*sf(s))*f}}
  else g.ty=base-(g.sup?.42*F*f:0);
  x+=(g.w0+trail(g))*f});
 seqs(L).forEach(A=>A.forEach((g,k)=>{if(ch(g)=='√'){const n=coverN(A,k),e=A[Math.min(k+n,A.length-1)];g.vtx=n>0?e.tx+e.w:g.tx+g.w;if(g.vx===undefined)g.vx=g.tx+.56*g.tsz}}))}
function tokSeq(L,A0,top){const A=A0.slice();if(top)while(A.length&&ch(A[A.length-1])=='=')A.pop();
 const out=[],close=new Set();let inSup=false,num='',word='';
 const fN=()=>{if(num){out.push(num);num=''}},fW=()=>{if(word){if(word=='e'||word=='o'||FUNCS.has(word))out.push(word);else throw new Error('unknown word');word=''}};
 A.forEach((g,k)=>{const c=ch(g);
  if(g.sup&&!inSup){fN();fW();out.push('^','(');inSup=true}
  if(!g.sup&&inSup){fN();fW();out.push(')');inSup=false}
  if(/[0-9.]/.test(c)){fW();num+=c}else if(/[a-z]/.test(c)){fN();word+=c}
  else{fN();fW();
   if(c=='§'){const n=tokSeq(L,partsOf(L,g,'n'),false),d=tokSeq(L,partsOf(L,g,'d'),false);if(!n.length||!d.length)throw new Error('empty fraction part');out.push('(','(',...n,')','/','(',...d,')',')')}
   else if(c=='√'){out.push('√');const n=coverN(A,k);if(n>0){out.push('(');close.add(k+n)}}else if(c=='*'){const nx=A[k+1],pv=A[k-1],nc=nx&&ch(nx),pc=pv&&ch(pv);out.push((!nx||nx.sup||'+-*/=)%→d'.includes(nc)||!pv||'+-*/=(d∫→'.includes(pc))?'x':'*')}else out.push(c)}
  if(close.has(k)){fN();fW();if(inSup&&!(A[k+1]&&A[k+1].sup)){out.push(')');inSup=false}out.push(')')}});
 fN();fW();if(inSup)out.push(')');return out}
function tokenize(L){return tokSeq(L,seqs(L)[0],true)}
/* Mathematical parsing and evaluation live in math-core.js + calculator.js. */
function computeAns(L) {
  const last=L.syms[L.syms.length-1],trailingEquals=!!(last&&ch(last)=='=');
  let tokens;
  try { tokens=tokenize(L); } catch (_) { return null; }
  return Calculator.compute(tokens,SET,trailingEquals);
}
function buildAns(pieces){const now=performance.now();let k=0;const out=[];const d=()=>now+260+(k++)*75;
 for(const p of pieces){if(p.s!==undefined)[...p.s].forEach(c=>{if(c!=' ')out.push(newG([{c,p:1}],{ans:true,delay:d()}))});
  else{const fid='a'+(++FID);out.push(newG([{c:'§',p:1}],{ans:true,fp:'bar',fid,delay:d()}));[...p.f[0]].forEach(c=>out.push(newG([{c,p:1}],{ans:true,fp:'n',fid,delay:d()})));[...p.f[1]].forEach(c=>out.push(newG([{c,p:1}],{ans:true,fp:'d',fid,delay:d()})))}}
 return out}
function newG(c,o){return Object.assign({c,i:0,x:0,y:0,sz:60,tx:0,ty:0,tsz:60,a:0,ta:1,ot:0,old:null,delay:0,ink:null,w:0,w0:0,sup:false,bw:0},o)}
function updateAns(L){const r=computeAns(L),key=r?r.text:null;if(key===L.at)return;L.at=key;L.val=r?r.val:undefined;lastL=L;L.ans.forEach(kill);L.ans=[];if(!r)return;
 L.ans=buildAns(r.pieces);layout(L);L.ans.forEach(g=>{g.x=g.tx+4;g.y=g.ty+L.F*.35;g.sz=g.tsz;if(g.fp=='bar')g.bw=0});if(window.histSave)histSave(L)}
function kill(g){g.ta=0;g.tsz*=.75;g.ty+=16;g.ink=null;g.delay=0;fx.push(g)}
function lineBox(L){if(L.syms.length||L.ans.length)return[L.base-1.05*L.F,L.base+.4*L.F];let y0=1e9,y1=-1e9;L.ink.forEach(s=>{const b=bb(s);y0=Math.min(y0,b.y0);y1=Math.max(y1,b.y1)});const h=y1-y0,m=Math.max(.4*h+10,35);return[y0-m,y1+m]}
const isBar=s=>{const b=bb(s);return!s.vin&&b.w>=56&&b.h<.2*b.w};
function attach(s){const b=bb(s),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;
 for(const L of lines)for(const t of L.ink){if(t===s)continue;const tb=bb(t);
  if(isBar(t)&&!isBar(s)){if(cx>=tb.x0-12&&cx<=tb.x1+12&&Math.abs(cy-(tb.y0+tb.y1)/2)<Math.max(130,tb.w)){L.ink.push(s);return}}
  else if(isBar(s)&&!isBar(t)){const tc=(tb.x0+tb.x1)/2;if(tc>=b.x0-12&&tc<=b.x1+12&&Math.abs((tb.y0+tb.y1)/2-cy)<Math.max(130,b.w)){L.ink.push(s);return}}}
 let best=null,bd=1e9;
 for(const L of lines){const[a,z]=lineBox(L);const d=cy<a?a-cy:cy>z?cy-z:0;if(d<bd){bd=d;best=L}}
 if(best&&bd==0){best.ink.push(s);return}
 lines.push({syms:[],ans:[],ink:[s],x0:0,base:0,F:80,at:null})}
const ovl=(a,e)=>{const w=Math.min(a.x1,e.x1)-Math.max(a.x0,e.x0),h=Math.min(a.y1,e.y1)-Math.max(a.y0,e.y0);return w>0&&h>0?w*h/Math.max(1,(a.x1-a.x0)*(a.y1-a.y0)):0};
const GB={'(':.9,')':.9,'√':.85,l:.7,t:.62};
const gbox=g=>{const c=ch(g);if(c=='§')return{x0:g.x,x1:g.x+Math.max(g.bw,g.w),y0:g.y-.12*g.sz,y1:g.y+.12*g.sz};return{x0:g.x,x1:g.x+Math.max(g.w,g.sz*.3),y0:g.y-(GB[c]||.62)*g.sz,y1:g.y+(c=='g'?.25:.12)*g.sz}};
function resamp(s,step){const o=[s[0]];let acc=0,a=s[0];for(let i=1;i<s.length;i++){const b=s[i];let d=Math.hypot(b[0]-a[0],b[1]-a[1]);while(acc+d>=step){const t=(step-acc)/d;a=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];o.push(a);d=Math.hypot(b[0]-a[0],b[1]-a[1]);acc=0}acc+=d;a=b}return o}
function cusps(s){const p=resamp(s,8);let n=0;for(let i=0;i+6<p.length;){const a=[p[i+3][0]-p[i][0],p[i+3][1]-p[i][1]],b=[p[i+6][0]-p[i+3][0],p[i+6][1]-p[i+3][1]];
 const c=(a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b)||1);if(c<-.5){n++;i+=4}else i++}return n}
function coverage(pts,b,r=18){const gx=7,gy=4;let hit=0;for(let i=0;i<gx;i++)for(let j=0;j<gy;j++){const cx=b.x0+(i+.5)*(b.x1-b.x0)/gx,cy=b.y0+(j+.5)*(b.y1-b.y0)/gy;
 for(const p of pts){if(Math.abs(p[0]-cx)<r&&Math.abs(p[1]-cy)<r&&Math.hypot(p[0]-cx,p[1]-cy)<r){hit++;break}}}return hit/(gx*gy)}
function allBoxes(){const bs=[];for(const L of lines){L.syms.concat(L.ans).forEach(g=>bs.push(gbox(g)));L.ink.forEach(t=>{const q=bb(t);bs.push({x0:q.x0-6,y0:q.y0-6,x1:q.x1+6,y1:q.y1+6})})}return bs}
function revs(v,amp){let d=0,ext=v[0],n=0;for(const x of v){if(d==0){if(Math.abs(x-ext)>amp){d=x>ext?1:-1;ext=x}}else if(d==1){if(x>ext)ext=x;else if(ext-x>amp){d=-1;ext=x;n++}}else{if(x<ext)ext=x;else if(x-ext>amp){d=1;ext=x;n++}}}return n}
function scribStats(s){const b=bb(s),m=Math.max(b.w,b.h);let len=0;for(let i=1;i<s.length;i++)len+=Math.hypot(s[i][0]-s[i-1][0],s[i][1]-s[i-1][1]);
 const pts=resamp(s,6);return{m,ratio:len/Math.max(m,1),c:cusps(s),over:allBoxes().some(q=>coverage(pts,q)>=.15)}}
function isScribble(s){if(s.length<8)return false;const k=scribStats(s);if(k.m<18)return false;
 return k.over?((k.c>=3&&k.ratio>=2.2)||(k.c>=2&&k.ratio>=2.6)||k.ratio>=4.2):((k.c>=4&&k.ratio>=3.5)||k.ratio>=6)}
function scribble(s){const now=performance.now();ghosts.push({pts:s,t0:now});const pts=resamp(s,6),cov=(b,r)=>coverage(pts,b,r),cg=g=>ch(g)=='§'?cov(gbox(g),6)*(.22/.45):cov(gbox(g),18);
 for(const L of lines.slice()){L.ink=L.ink.filter(t=>{const q=bb(t);if(cov({x0:q.x0-8,y0:q.y0-8,x1:q.x1+8,y1:q.y1+8})>=.22){ghosts.push({pts:t,t0:now});return false}return true});
  if(L.ans.some(g=>cg(g)>=.22)){L.syms.forEach(kill);L.syms=[];L.ans.forEach(kill);L.ans=[];L.at=null}
  else{const rem=L.syms.filter(g=>cg(g)>=.22);rem.filter(g=>g.fp=='bar').forEach(bar=>L.syms.forEach(s=>{if(s.fid===bar.fid&&!rem.includes(s))rem.push(s)}));
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
const WORDS=['sinh','cosh','tanh','asin','acos','atan','sin','cos','tan','log','ln','abs'];
function wordfix(A){const n=A.length,used=new Array(n).fill(false),idx=(g,c)=>g.c.findIndex(o=>o.c==c&&o.p>.002);
 for(let i=0;i<n;i++){let best=null;for(const w of WORDS){if(i+w.length>n)continue;let sc=1,ok=true;
  for(let j=0;j<w.length;j++){const g=A[i+j];if(g.locked||used[i+j]){ok=false;break}const k=idx(g,w[j]);if(k<0||(g.c[0].p>.9&&g.c[0].c!=w[j]&&!/[a-z]/.test(g.c[0].c))){ok=false;break}sc*=g.c[k].p}
  if(ok&&(!best||w.length>best.w.length||(w.length==best.w.length&&sc>best.sc)))best={w,sc}}
  if(best&&best.sc>1e-6){for(let j=0;j<best.w.length;j++){A[i+j].i=idx(A[i+j],best.w[j]);used[i+j]=true}i+=best.w.length-1}}
 A.forEach((g,k)=>{if(used[k]||g.locked||!g.b)return;const c=ch(g);if(/[a-z]/.test(c)&&!(c=='e'&&g.c[g.i].p>.5)){const j=g.c.findIndex(o=>!/[a-z]/.test(o.c)&&o.p>.01);if(j>=0)g.i=j}})}
function assignSup(A){let B=null,inSup=false;for(const g of A){const c=ch(g),b=g.b;g.sup=false;if(!b){continue}
 if(c=='.'){continue}
 const isOp='+-*/=()'.includes(c);let sup=false;
 if(B){const bh=Math.max(B.b.h,20),rel=(B.b.y1-b.y1)/bh;
  if(inSup)sup=rel>.28&&c!='='&&b.h<.85*bh;
  else if(c=='-')sup=b.y1<B.b.y0+.25*bh&&b.w<.6*bh;
  else if(!isOp||c=='(')sup=rel>.3&&b.h<.85*bh}
 if(sup){g.sup=true;inSup=true}else{inSup=false;B=(isOp&&c!=')')||c=='√'?null:g}}}
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
initCNN();
let recBusy=false,recAgain=false;
function recognize(){if(recBusy){recAgain=true;return}recBusy=true;doRecognize().catch(e=>console.error(e)).then(()=>{recBusy=false;if(recAgain){recAgain=false;recognize()}})}
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
async function doRecognize(){moveBarsToHosts();const jobs=[];
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
  const HR={'(':.88,')':.88,a:.38,c:.38,e:.38,n:.34,o:.37,s:.43,g:.6,l:.67,i:.53,t:.56,'π':.4,'!':.6},DS={g:.2,'(':.13,')':.13};
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
const pt=e=>[e.clientX,e.clientY];
cv.onpointerdown=e=>{if(!e.isPrimary)return;clearTimeout(rt);cv.setPointerCapture(e.pointerId);started=true;cur=[pt(e)];down={t:performance.now(),p:pt(e),len:0};clearTimeout(lp);
 lp=setTimeout(()=>{if(cur&&down.len<8){const d=hitDrag(down.p);if(d){cur=null;beginDrag(d,down.p)}}},450);kick()};
cv.onpointermove=e=>{if(!e.isPrimary)return;if(drag){dragMove(pt(e));return}if(!cur)return;const es=e.getCoalescedEvents?e.getCoalescedEvents():[e];
 for(const ev of es){const q=pt(ev),l=cur[cur.length-1];const d=Math.hypot(q[0]-l[0],q[1]-l[1]);if(d<2.5)continue;down.len+=d;cur.raw=q;cur.push([l[0]*.35+q[0]*.65,l[1]*.35+q[1]*.65])}if(down.len>=8)clearTimeout(lp)};
cv.onpointerup=cv.onpointercancel=e=>{if(e&&e.isPrimary===false)return;clearTimeout(lp);if(drag){dragEnd();return}let s=cur;cur=null;if(!s)return;if(s.raw&&s.length>1)s.push(s.raw);
 if(down.len<8&&performance.now()-down.t<350&&tapCycle(down.p)){return}
 if(isScribble(s))scribble(s);else{const r=radical(s);attach(r||s)}
 rt=setTimeout(recognize,650);kick()};
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
function drop(d){const x=d.x,y=d.y;if(y>SH-70){if(!d.fromMem)memAdd(d.text);return}
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
const serial=L=>L.syms.map(g=>({c:ch(g),sup:g.sup?1:0,fp:g.fp||'',fid:g.fid||'',cover:g.cover||0}));
window.histSave=function(L){if(!L.syms.length)return;L.hid=L.hid||Date.now()+'-'+Math.random().toString(36).slice(2,6);clearTimeout(L.ht);
 L.ht=setTimeout(()=>{const r=computeAns(L);if(!r||!lines.includes(L))return;const e={id:L.hid,ts:Date.now(),syms:serial(L),F:L.F,ans:r.text,text:textOf(L)},i=HIST.findIndex(h=>h.id==L.hid);
  if(i>=0)HIST[i]=e;else HIST.unshift(e);HIST=HIST.slice(0,100);histPersist()},1500)};
function openHist(e){closeSheet();const L={syms:[],ans:[],ink:[],x0:30,base:SH*.35,F:e.F||70,at:null,hid:e.id};for(const q of lines)L.base=Math.max(L.base,q.base+q.F*1.5);
 e.syms.forEach(s=>L.syms.push(newG([{c:s.c,p:1}],{sup:!!s.sup,fp:s.fp||undefined,fid:s.fid||undefined,cover:s.cover,fresh:false})));
 lines.push(L);layout(L);L.syms.forEach(g=>{g.x=g.tx;g.y=g.ty+12;g.sz=g.tsz*.9;g.a=0;g.ta=1});updateAns(L);kick()}
/* ---------- export ---------- */
function copyText(t){if(window.Android&&Android.copy){Android.copy(t);toast('Copied')}else{try{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();toast('Copied')}catch(e){}}}
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
 back:'<path d="M14.5 5.5L8 12l6.5 6.5"/>',close:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'};
const ico=n=>`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const row=(label,k,opts)=>`<div class="row"><span class="lab">${label}</span><div class="opts">${opts.map(o=>`<button class="opt${SET[k]==o[0]?' on':''}" data-k="${k}" data-v="${o[0]}">${o[1]}<svg class="ring" aria-hidden="true"><path pathLength="1"/></svg></button>`).join('')}</div></div>`;
const tool=(a,i,t,c='')=>`<button class="tool ${c}" data-a="${a}">${ico(i)}<span>${t}</span></button>`;
function fitRings(){document.querySelectorAll('#panel .opt').forEach((b,n)=>{const w=b.offsetWidth,h=b.offsetHeight,r=b.querySelector('.ring'),p=r.firstElementChild,j=(((n*37)%11)-5)/200;
 r.setAttribute('viewBox',`0 0 ${w} ${h}`);r.style.width=w+'px';r.style.height=h+'px';
 const X=v=>(v*w).toFixed(1),Y=v=>(v*h).toFixed(1);
 p.setAttribute('d',`M${X(.1)} ${Y(.66)}C${X(.01+j)} ${Y(.22)} ${X(.3)} ${Y(.02)} ${X(.55)} ${Y(.07)}C${X(.86)} ${Y(.11)} ${X(1.01)} ${Y(.34)} ${X(.94)} ${Y(.66)}C${X(.88)} ${Y(.95)} ${X(.5)} ${Y(1.01-j)} ${X(.3)} ${Y(.93)}C${X(.09)} ${Y(.85)} ${X(-.01)} ${Y(.58)} ${X(.1)} ${Y(.28)}`)})}
function openSheet(page){const p=$('panel'),s=$('sheet'),first=s.style.display!='block';s.style.display='block';
 if(page=='hist'){p.innerHTML=`<div class="head"><button class="iconbtn" data-a="back" aria-label="Back">${ico('back')}</button><h2>History</h2><button class="done" data-a="hexp">Export</button></div>`+
  (HIST.length?HIST.map((h,i)=>`<div class="hrow"><button class="hmain" data-a="hopen" data-i="${i}"><span class="ex">${esc(h.text)}</span><span class="an">${esc(h.ans.replace(/^=/,'= '))}</span></button><button class="iconbtn" data-a="hcopy" data-i="${i}" aria-label="Copy">${ico('copy')}</button><button class="iconbtn" data-a="hdel" data-i="${i}" aria-label="Delete">${ico('close')}</button></div>`).join('')+`<button class="textbtn danger" data-a="hclr">Clear history</button>`:`<p class="empty">Nothing here yet.<br>Calculations are saved as you write them.</p>`)}
 else p.innerHTML=`<div class="head"><h2>Settings</h2><button class="done" data-a="done">Done</button></div>${row('Theme','theme',[['dark','Dark'],['light','Light']])}${row('Calculate','mode',[['instant','Instant'],['demand','On demand']])}${row('Angles','angle',[['rad','Radians'],['deg','Degrees']])}${row('Results','fmt',[['dec','Decimal'],['frac','Fraction'],['mixed','Mixed']])}<div class="tools">${tool('hist','hist','History')}${tool('copy','copy','Copy result')}${tool('img','share','Share image')}${tool('addmem','mem','To memory')}${tool('clrmem','trash','Empty memory')}${tool('clear','eraser','Clear canvas','danger')}</div><p class="hint">Hold a number or a result, then drag it into another expression or down to the memory bar.</p>`;
 if(first){s.classList.remove('in');void s.offsetWidth}s.classList.add('in');fitRings()}
const cleanAns=L=>L&&L.at?L.at.replace(/^=/,''):'';
$('panel').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.k){SET[d.k]=d.v;saveSet();b.parentNode.querySelectorAll('.opt').forEach(o=>o.classList.toggle('on',o===b));if(d.k==='theme')applyTheme();else refreshAll();return}
 const i=+d.i;switch(d.a){case'done':closeSheet();break;case'hist':openSheet('hist');break;case'back':openSheet('main');break;
  case'copy':{const t=cleanAns(lastL&&lines.includes(lastL)?lastL:lines.find(L=>L.at));t?copyText(t):toast('No result yet');closeSheet();break}
  case'img':{const u=exportPNG();if(!u)toast('Nothing to share');else if(window.Android&&Android.shareImage)Android.shareImage(u.split(',')[1]);else window.open(u);closeSheet();break}
  case'addmem':{const L=lastL&&lines.includes(lastL)?lastL:lines.find(L=>Number.isFinite(L.val));const t=L&&Store.plainNumber(L.val);if(t){memAdd(t);toast('Saved to memory')}else toast(L&&Number.isFinite(L.val)?'Too large for memory':'No result yet');closeSheet();break}
  case'clrmem':MEMV=[];memSave();memRender();toast('Memory emptied');closeSheet();break;
  case'clear':lines.forEach(L=>L.syms.concat(L.ans).forEach(kill));lines=[];kick();closeSheet();break;
  case'hopen':if(HIST[i])openHist(HIST[i]);break;case'hcopy':if(HIST[i])copyText(HIST[i].text+' '+HIST[i].ans.replace(/^=/,'= '));break;
  case'hdel':if(HIST[i]){HIST.splice(i,1);histPersist();openSheet('hist')}break;case'hclr':HIST=[];histPersist();openSheet('hist');break;
  case'hexp':shareText(HIST.map(h=>h.text+' '+h.ans.replace(/^=/,'= ')).join('\n'));break}};
$('back').onclick=closeSheet;$('mb').onclick=()=>openSheet('main');
window.onBack=()=>{if($('sheet').classList.contains('in')){closeSheet();return true}if(drag){drag=null;memRender();return true}return false};
memRender();
applyTheme();
