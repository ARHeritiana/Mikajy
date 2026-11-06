const cv=document.getElementById('pad');let ctx=cv.getContext('2d');const $=id=>document.getElementById(id);
let lastL=null,lp=null,drag=null,SW=0,SH=0,lines=[],fx=[],ghosts=[],cur=null,down=null,started=false,rt=null,raf=0,tPrev=0;
const FONT='H, serif';
const disp=c=>c=='*'?'×':c=='/'?'÷':c=='-'?'−':c;
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const ch=g=>g.c[g.i].c;
const FUNCS=new Set(['sin','cos','tan','asin','acos','atan','sinh','cosh','tanh','ln','log','abs']);
let SET={mode:'instant',angle:'rad',fmt:'dec'};try{Object.assign(SET,JSON.parse(localStorage.getItem('inkset')||'{}'))}catch(e){}
function saveSet(){try{localStorage.setItem('inkset',JSON.stringify(SET))}catch(e){}}

function fmt(v){if(!isFinite(v))return'undefined';if(Math.abs(v)<1e-12)v=0;return String(parseFloat(v.toPrecision(10)))}
function fit(){const d=Math.min(devicePixelRatio||1,2);SW=innerWidth;SH=innerHeight;cv.width=SW*d;cv.height=SH*d;lines.forEach(layout);kick()}
function strokePath(s){ctx.beginPath();ctx.moveTo(...s[0]);ctx.lineTo(...mid(s[0],s[1]));for(let i=1;i<s.length-1;i++)ctx.quadraticCurveTo(...s[i],...mid(s[i],s[i+1]));ctx.lineTo(...s[s.length-1]);ctx.stroke()}
function drawInk(s,a){if(a<=.01)return;ctx.globalAlpha=a;ctx.strokeStyle=ctx.fillStyle='#1f2937';ctx.lineWidth=4.5;ctx.lineCap=ctx.lineJoin='round';
 if(s.length==1){ctx.beginPath();ctx.arc(s[0][0],s[0][1],2.6,0,7);ctx.fill()}else strokePath(s);ctx.globalAlpha=1}
function drawRad(g,a){const s=g.sz,x=g.x,y=g.y,top=y-.8*s;ctx.globalAlpha=a;ctx.strokeStyle=g.ans?'#2456c4':'#1f2937';ctx.lineWidth=Math.max(2,s*.055);ctx.lineCap=ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(x+.02*s,y-.36*s);ctx.lineTo(x+.1*s,y-.43*s);ctx.lineTo(x+.26*s,y-.02*s);ctx.lineTo(x+.5*s,top);ctx.lineTo(Math.max(g.vx,x+.56*s),top);ctx.stroke();ctx.globalAlpha=1}
function drawBar(g,a){ctx.globalAlpha=a;ctx.strokeStyle=g.ans?'#2456c4':'#1f2937';ctx.lineWidth=Math.max(2.5,g.sz*.05);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(g.x,g.y);ctx.lineTo(g.x+g.bw,g.y);ctx.stroke();ctx.globalAlpha=1}
function drawG(g){const col=g.ans?'#2456c4':'#1f2937';ctx.fillStyle=col;ctx.font=Math.round(g.sz)+'px '+FONT;ctx.textBaseline='alphabetic';
 const a=Math.max(0,Math.min(1,g.a)),c=ch(g);
 if(c=='√')drawRad(g,a);
 else if(c=='§')drawBar(g,a);
 else{if(g.ot>0&&g.old){ctx.globalAlpha=a*g.ot;ctx.fillText(disp(g.old),g.x,g.y);ctx.globalAlpha=a*(1-g.ot)}else ctx.globalAlpha=a;
  ctx.fillText(disp(c),g.x,g.y);ctx.globalAlpha=1}
 if(g.ink&&g.a<.99){const k=Math.max(0,1-g.a*1.1);g.ink.forEach(s=>drawInk(s,k))}else g.ink=null}
function render(now){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);const d=Math.min(devicePixelRatio||1,2);ctx.setTransform(d,0,0,d,0,0);
 if(!started&&!lines.length&&!cur){ctx.globalAlpha=.25;ctx.fillStyle='#1f2937';ctx.font='54px '+FONT;ctx.textAlign='center';ctx.fillText('write a sum',SW/2,SH/2);ctx.textAlign='left';ctx.globalAlpha=1}
 for(const L of lines){L.syms.forEach(drawG);L.ans.forEach(drawG);L.ink.forEach(s=>drawInk(s,1))}
 fx.forEach(drawG);ghosts.forEach(g=>drawInk(g.pts,1-(now-g.t0)/420));if(cur)drawInk(cur,1);
 if(drag){ctx.font='44px '+FONT;const w=ctx.measureText(drag.text).width+30,x=drag.x-w/2,y=drag.y-86;ctx.save();ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=14;ctx.shadowOffsetY=4;ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,60,16):ctx.rect(x,y,w,60);ctx.fill();ctx.restore();ctx.fillStyle='#2456c4';ctx.textBaseline='middle';ctx.fillText(drag.text,x+15,y+32);ctx.textBaseline='alphabetic'}}
function stepG(g,dt,now){if(now<g.delay)return true;const k=1-Math.exp(-dt*7),k2=1-Math.exp(-dt*8);g.x+=(g.tx-g.x)*k;g.y+=(g.ty-g.y)*k;g.sz+=(g.tsz-g.sz)*k;g.a+=(g.ta-g.a)*k2;if(g.ot>0)g.ot=Math.max(0,g.ot-dt*4);
 let r=Math.abs(g.tx-g.x)>.3||Math.abs(g.ty-g.y)>.3||Math.abs(g.tsz-g.sz)>.3||Math.abs(g.ta-g.a)>.01||g.ot>0;
 if(g.vtx!==undefined){g.vx+=(g.vtx-g.vx)*k;if(Math.abs(g.vtx-g.vx)>.3)r=true}
 if(g.bwt!==undefined){g.bw+=(g.bwt-g.bw)*k;if(Math.abs(g.bwt-g.bw)>.3)r=true}return r}
function step(dt,now){let act=false;for(const L of lines)for(const g of L.syms.concat(L.ans))if(stepG(g,dt,now))act=true;
 for(const g of fx)if(stepG(g,dt,now))act=true;fx=fx.filter(g=>g.a>.02);ghosts=ghosts.filter(g=>now-g.t0<420);return act||ghosts.length>0}
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
 const fN=()=>{if(num){out.push(num);num=''}},fW=()=>{if(word){if(word=='e'||word=='o'||FUNCS.has(word))out.push(word);else throw 0;word=''}};
 A.forEach((g,k)=>{const c=ch(g);
  if(g.sup&&!inSup){fN();fW();out.push('^','(');inSup=true}
  if(!g.sup&&inSup){fN();fW();out.push(')');inSup=false}
  if(/[0-9.]/.test(c)){fW();num+=c}else if(/[a-z]/.test(c)){fN();word+=c}
  else{fN();fW();
   if(c=='§'){const n=tokSeq(L,partsOf(L,g,'n'),false),d=tokSeq(L,partsOf(L,g,'d'),false);if(!n.length||!d.length)throw 0;out.push('(','(',...n,')','/','(',...d,')',')')}
   else if(c=='√'){out.push('√');const n=coverN(A,k);if(n>0){out.push('(');close.add(k+n)}}else if(c=='*'){const nx=A[k+1],pv=A[k-1],nc=nx&&ch(nx),pc=pv&&ch(pv);out.push((!nx||nx.sup||'+-*/=)%'.includes(nc)||!pv||'+-*/=('.includes(pc))?'x':'*')}else out.push(c)}
  if(close.has(k)){fN();fW();if(inSup&&!(A[k+1]&&A[k+1].sup)){out.push(')');inSup=false}out.push(')')}});
 fN();fW();if(inSup)out.push(')');return out}
function tokenize(L){return tokSeq(L,seqs(L)[0],true)}
function evalTok(T,xv){let i=0;const pk=()=>T[i],isN=t=>t!==undefined&&/^[0-9.]+$/.test(t),D=SET.angle=='deg',kd=D?Math.PI/180:1;
 const FN={sin:a=>Math.sin(a*kd),cos:a=>Math.cos(a*kd),tan:a=>Math.tan(a*kd),asin:a=>Math.asin(a)/kd,acos:a=>Math.acos(a)/kd,atan:a=>Math.atan(a)/kd,sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,ln:Math.log,log:Math.log10,abs:Math.abs},INV={sin:'asin',cos:'acos',tan:'atan'};
 const aS=t=>isN(t)||t=='('||t=='π'||t=='e'||t=='x'||t=='√'||FUNCS.has(t);
 const fact=v=>{if(v<0||v>170||Math.floor(v)!=v)return NaN;let r=1;for(let k=2;k<=v;k++)r*=k;return r};
 const expr=()=>{let v=term();while(pk()=='+'||pk()=='-'){const o=T[i++];let r;
   if(isN(pk())&&T[i+1]=='%'&&(T[i+2]===undefined||'+-)'.includes(T[i+2]))){r=v*parseFloat(pk())/100;i+=2}else r=term();v=o=='+'?v+r:v-r}return v};
 const term=()=>{let v=unary();for(;;){const c=pk();if(c=='*'||c=='/'){i++;const r=unary();v=c=='*'?v*r:v/r}else if(aS(c))v*=pow();else break}return v};
 const unary=()=>{if(pk()=='-'){i++;return-unary()}if(pk()=='+'){i++;return unary()}return pow()};
 const expo=()=>{if(pk()!='(')throw 0;i++;const v=expr();if(pk()==')')i++;return v};
 const pow=()=>{const b=post();if(pk()=='^'){i++;return Math.pow(b,expo())}return b};
 const post=()=>{const lit=isN(pk());let v=atom();
  if(lit&&pk()=='^'&&T[i+1]=='('&&(T[i+2]=='0'||T[i+2]=='o')&&T[i+3]==')'){i+=4;v=D?v:v*Math.PI/180}
  for(;;){if(pk()=='!'){i++;v=fact(v)}else if(pk()=='%'){i++;v=v/100}else break}return v};
 const atom=()=>{const t=pk();
  if(t=='('){i++;const v=expr();if(pk()==')')i++;return v}
  if(isN(t)){i++;const n=parseFloat(t);if(isNaN(n))throw 0;return n}
  if(t=='π'){i++;return Math.PI}if(t=='e'){i++;return Math.E}
  if(t=='x'){if(xv===undefined)throw 0;i++;return xv}
  if(t=='√'){i++;const v=post();return v<0?NaN:Math.sqrt(v)}
  if(FUNCS.has(t)){i++;let ex=null;if(pk()=='^'&&T[i+1]=='('){i++;ex=expo()}const a=pk()=='('?atom():post();let r;
   if(ex===-1&&INV[t])r=FN[INV[t]](a);else{r=FN[t](a);if(ex!==null)r=Math.pow(r,ex)}return r}
  throw 0};
 const v=expr();if(i<T.length)throw 0;return v}
function solveEq(Lt,Rt){const f=x=>{const v=evalTok(Lt,x)-evalTok(Rt,x);return v},ok=Number.isFinite;
 let f0,f1,f2,fm;try{f0=f(0);f1=f(1);f2=f(2);fm=f(-3)}catch(e){return null}
 if([f0,f1,f2,fm].every(ok)&&Math.abs((f2-f1)-(f1-f0))<1e-9*(1+Math.abs(f1))&&Math.abs((f1-f0)-(f0-fm)/3)<1e-9*(1+Math.abs(f1))){const a=f1-f0;
  if(Math.abs(a)<1e-12)return Math.abs(f0)<1e-9?'all':[];return[-f0/a]}
 const roots=[],add=r=>{r=parseFloat(r.toPrecision(10));if(!roots.some(q=>Math.abs(q-r)<1e-6))roots.push(r)};let px=-100,py;
 try{py=f(px)}catch(e){py=NaN}
 for(let x=-99.95;x<=100;x+=.05){let y;try{y=f(x)}catch(e){y=NaN}
  if(ok(py)&&ok(y)){if(py==0)add(px);else if(py*y<0){let a=px,b=x,fa=py;for(let n=0;n<60;n++){const m=(a+b)/2,fmv=f(m);if(fa*fmv<=0)b=m;else{a=m;fa=fmv}}add((a+b)/2)}
   else if(Math.abs(y)<Math.abs(py)&&Math.abs(y)<1e-2){const y2=(()=>{try{return f(x+.05)}catch(e){return NaN}})();if(ok(y2)&&Math.abs(y2)>Math.abs(y)){let a=px,b=x+.05,best=x,by=Math.abs(y);for(let n=0;n<60;n++){const m1=a+(b-a)/3,m2=b-(b-a)/3;if(Math.abs(f(m1))<Math.abs(f(m2)))b=m2;else a=m1}const xm=(a+b)/2;if(Math.abs(f(xm))<1e-7)add(xm)}}}
  px=x;py=y}
 roots.sort((p,q)=>p-q);return roots.slice(0,4)}
function toFrac(v){if(Number.isInteger(v)||Math.abs(v)>1e9)return null;const s=v<0?-1:1,x=Math.abs(v);let a=Math.floor(x),h=[1,a],k=[0,1],r=x-a;
 for(let n=0;n<30&&r>1e-12;n++){const inv=1/r;a=Math.floor(inv);r=inv-a;const hn=a*h[h.length-1]+h[h.length-2],kn=a*k[k.length-1]+k[k.length-2];h.push(hn);k.push(kn);if(kn>100000)return null;if(Math.abs(x-hn/kn)<1e-10*Math.max(1,x))return{p:s*hn,q:kn}}return null}
const SP=s=>({s});
function resPieces(v){if(!Number.isFinite(v))return[SP('?')];
 if(SET.fmt!='dec'){const f=toFrac(v);if(f&&f.q>1){const pc=[],p=Math.abs(f.p);if(f.p<0)pc.push(SP('-'));
  if(SET.fmt=='mixed'&&p>f.q){const w=Math.floor(p/f.q);pc.push(SP(String(w)),{f:[String(p-w*f.q),String(f.q)]})}else pc.push({f:[String(p),String(f.q)]});return pc}}
 return[SP(fmt(v))]}
const pText=P=>P.map((p,i)=>p.s!==undefined?p.s:(i&&P[i-1].s!==undefined&&/\d$/.test(P[i-1].s)?' ':'')+p.f[0]+'/'+p.f[1]).join('');
function computeAns(L){const last=L.syms[L.syms.length-1],eq=last&&ch(last)=='=';let T;try{T=tokenize(L)}catch(e){return null}if(!T.length)return null;
 const ei=T.indexOf('=');
 try{if(ei>=0){if(T.indexOf('=',ei+1)>=0)return null;const Lt=T.slice(0,ei),Rt=T.slice(ei+1);if(!Lt.length||!Rt.length||!T.includes('x'))return null;
   const r=solveEq(Lt,Rt);if(r==null)return null;let P=[SP('x='),...(r=='all'?[SP('ℝ')]:r.length?[]:[SP('∅')])];
   if(Array.isArray(r))r.forEach((q,k)=>{if(k)P.push(SP(', '));P.push(...resPieces(q))});return{pieces:P,text:pText(P),val:Array.isArray(r)&&r.length?r[0]:undefined}}
  if(T.includes('x'))return null;const v=evalTok(T);if(!(T.length>1||eq))return null;if(SET.mode=='demand'&&!eq)return null;
  const P=[...(eq?[]:[SP('=')]),...resPieces(v)];return{pieces:P,text:pText(P),val:v}}catch(e){return null}}
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
 if('*/)'.includes(c)&&(k==0||'+-*/('.includes(pc)))f*=.25;if(c==')'&&open<=0)f*=.3;if(c=='='&&!last)f*=.3;if(last&&'+-*/'.includes(c))f*=.5;o.p*=f});
 y.c.sort((a,b)=>b.p-a.p);y.c=y.c.slice(0,5);y.i=0;y.fresh=false}
 const c=ch(y);if(c=='(')open++;if(c==')')open--;pc=c})}
const WORDS=['sinh','cosh','tanh','asin','acos','atan','sin','cos','tan','log','ln','abs'];
function wordfix(A){const n=A.length,used=new Array(n).fill(false),idx=(g,c)=>g.c.findIndex(o=>o.c==c&&o.p>.002);
 for(let i=0;i<n;i++){let best=null;for(const w of WORDS){if(i+w.length>n)continue;let sc=1,ok=true;
  for(let j=0;j<w.length;j++){const g=A[i+j];if(g.locked||used[i+j]){ok=false;break}const k=idx(g,w[j]);if(k<0){ok=false;break}sc*=g.c[k].p}
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
const cnnSrc=document.getElementById('cnn').textContent;
let wk=null,pend=new Map(),pid=0,local=null;
function localPredict(x){if(!local)local=new Function(cnnSrc+';return predict')();return local(x)}
function initCNN(){try{const b=new Blob([cnnSrc+"\nonmessage=function(e){postMessage({id:e.data.id,p:predict(e.data.x)})};predict(new Float32Array(784));predict(new Float32Array(784).fill(.4));"],{type:'text/javascript'});
 wk=new Worker(URL.createObjectURL(b));wk.onmessage=e=>{const q=pend.get(e.data.id);if(q){pend.delete(e.data.id);clearTimeout(q.t);q.res(e.data.p)}};
 wk.onerror=()=>{wk=null;for(const q of pend.values()){clearTimeout(q.t);q.res(localPredict(q.x))}pend.clear()}}catch(e){wk=null}}
function predictAsync(x){return new Promise(res=>{if(!wk){setTimeout(()=>res(localPredict(x)),0);return}
 const id=++pid,q={res,x,t:setTimeout(()=>{if(pend.delete(id)){wk=null;res(localPredict(x))}},4000)};pend.set(id,q);wk.postMessage({id,x})})}
initCNN();setTimeout(()=>{if(!wk)localPredict(new Float32Array(784))},1500);
let recBusy=false,recAgain=false;
function recognize(){if(recBusy){recAgain=true;return}recBusy=true;doRecognize().catch(e=>console.error(e)).then(()=>{recBusy=false;if(recAgain){recAgain=false;recognize()}})}
function findFractions(S){const out=[],used=new Set(),info=S.map(s=>({s,b:bb(s)})),ref=Math.max(40,...info.map(o=>Math.max(o.b.w,o.b.h)));
 for(const bar of info){if(used.has(bar.s)||!isBar(bar.s))continue;const bb0=bar.b,bcy=(bb0.y0+bb0.y1)/2;
  const cand=info.filter(o=>o!==bar&&!used.has(o.s)&&!(isBar(o.s)&&o.b.w>.6*bb0.w)&&(o.b.x0+o.b.x1)/2>=bb0.x0-12&&(o.b.x0+o.b.x1)/2<=bb0.x1+12);
  const big=o=>Math.max(o.b.w,o.b.h)>=.2*ref,H=Math.max(30,...cand.filter(big).map(o=>o.b.h));
  const up=cand.filter(o=>o.b.y1<=bcy+10&&bcy-o.b.y1<1.3*H),dn=cand.filter(o=>o.b.y0>=bcy-10&&o.b.y0-bcy<1.3*H);
  if(up.some(big)&&dn.some(big)){const f={bar:bar.s,n:up.map(o=>o.s),d:dn.map(o=>o.s)};[bar.s,...f.n,...f.d].forEach(s=>used.add(s));out.push(f)}}
 return{out,used}}
let FID=0;
function barNear(L,b){const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;for(const g of L.syms){if(g.fp!='bar'||ch(g)!='§')continue;
  if(cx>=g.x-12&&cx<=g.x+Math.max(g.bw,g.w)+12){if(cy<g.y-4&&g.y-cy<1.4*L.F)return{fid:g.fid,fp:'n'};if(cy>g.y+4&&cy-g.y<1.4*L.F)return{fid:g.fid,fp:'d'}}}return null}
function insertPart(L,g,cx){const S=L.syms,bi=S.findIndex(s=>s.fid===g.fid&&s.fp=='bar');if(bi<0){S.push(g);return}
 const same=S.map((s,k)=>({s,k})).filter(o=>o.s.fid===g.fid&&o.s.fp==g.fp);let idx;
 if(!same.length){const lastN=S.map((s,k)=>({s,k})).filter(o=>o.s.fid===g.fid&&o.s.fp=='n').pop();idx=g.fp=='n'?bi+1:(lastN?lastN.k+1:bi+1)}
 else{const nxt=same.find(o=>o.s.tx+o.s.w/2>cx);idx=nxt?nxt.k:same[same.length-1].k+1}S.splice(idx,0,g)}
async function doRecognize(){const jobs=[];
 const mk=(g,G,fp,fid)=>{const b=g.b;if(g.tiny&&G.length>1||Math.max(b.w,b.h)<16)return{g,dot:true,fp,fid};const rs=g.s.find(t=>t.vin);return{g,x:feat(g.s),vin:rs&&rs.vin,fp,fid}};
 for(const L of lines){if(!L.ink.length)continue;const snap=L.ink.slice(),{out,used}=findFractions(snap),items=[];
  for(const f of out){const fid=++FID;items.push({g:{s:[f.bar],b:bb(f.bar)},bar:true,fp:'bar',fid});for(const[p,S] of [['n',f.n],['d',f.d]]){const G=group(S);G.forEach(g=>items.push(mk(g,G,p,fid)))}}
  const rest=snap.filter(s=>!used.has(s)),G=group(rest);G.forEach(g=>{const tb=barNear(L,g.b);items.push(mk(g,G,tb&&tb.fp,tb&&tb.fid))});
  jobs.push({L,items})}
 const need=jobs.flatMap(j=>j.items.filter(it=>it.x)),ps=await Promise.all(need.map(it=>predictAsync(it.x)));need.forEach((it,k)=>it.p=ps[k]);
 for(const j of jobs){const L=j.L;if(!lines.includes(L))continue;
  const alive=j.items.filter(it=>it.g.s.every(s=>L.ink.includes(s)));if(!alive.length)continue;
  const done=new Set();alive.forEach(it=>it.g.s.forEach(s=>done.add(s)));L.ink=L.ink.filter(s=>!done.has(s));
  const fresh=alive.map(it=>{const g=it.g,b=g.b,o={b,ink:g.s,fp:it.fp,fid:it.fid};
   if(it.bar)return newG([{c:'§',p:1}],Object.assign(o,{fresh:false}));
   return it.dot?newG([{c:'.',p:1}],Object.assign(o,{fresh:false})):newG(classifyP(it.p,it.x),Object.assign(o,{fv:it.x,fresh:true,vin:it.vin}))});
  const key=g=>(g.b.x0+g.b.x1)/2,units=[],late=[];
  for(const g of fresh){if(g.fp=='bar'||(g.fp&&!L.syms.some(s=>s.fid===g.fid)&&!L.ans.some(s=>s.fid===g.fid)))continue;
   const nb=g.b,na=Math.max(1,nb.w*nb.h);let hit=null;
   for(const s of L.syms){if(ch(s)=='§'||s.fp=='bar')continue;const q=gbox(s),iw=Math.min(nb.x1,q.x1)-Math.max(nb.x0,q.x0),ih=Math.min(nb.y1,q.y1)-Math.max(nb.y0,q.y0);
    if(iw>0&&ih>0){const r=iw*ih/Math.min(Math.max(1,(q.x1-q.x0)*(q.y1-q.y0)),Math.max(na,(nb.w+8)*(nb.h+8)));if(r>=.5&&key(g)>q.x0&&key(g)<q.x1){hit=s;break}}}
   if(hit){if(hit.fp){g.fp=hit.fp;g.fid=hit.fid}L.syms.splice(L.syms.indexOf(hit),1);kill(hit)}}
  for(const g of fresh){if(g.fp=='bar')continue;if(g.fp&&L.syms.some(s=>s.fid===g.fid&&s.fp=='bar')){late.push(g);continue}if(!g.fp)units.push({k:key(g),a:[g]})}
  const fids=[...new Set(fresh.filter(g=>g.fp=='bar').map(g=>g.fid))];
  for(const id of fids){const part=p=>fresh.filter(g=>g.fid===id&&g.fp==p).sort((a,b)=>key(a)-key(b)),bar=part('bar')[0];units.push({k:key(bar),a:[bar,...part('n'),...part('d')]})}
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
cv.onpointerdown=e=>{clearTimeout(rt);cv.setPointerCapture(e.pointerId);started=true;cur=[pt(e)];down={t:performance.now(),p:pt(e),len:0};clearTimeout(lp);
 lp=setTimeout(()=>{if(cur&&down.len<8){const d=hitDrag(down.p);if(d){cur=null;beginDrag(d,down.p)}}},450);kick()};
cv.onpointermove=e=>{if(drag){dragMove(pt(e));return}if(!cur)return;const es=e.getCoalescedEvents?e.getCoalescedEvents():[e];
 for(const ev of es){const q=pt(ev),l=cur[cur.length-1];const d=Math.hypot(q[0]-l[0],q[1]-l[1]);if(d<2.5)continue;down.len+=d;cur.raw=q;cur.push([l[0]*.35+q[0]*.65,l[1]*.35+q[1]*.65])}if(down.len>=8)clearTimeout(lp)};
cv.onpointerup=cv.onpointercancel=()=>{clearTimeout(lp);if(drag){dragEnd();return}let s=cur;cur=null;if(!s)return;if(s.raw&&s.length>1)s.push(s.raw);
 if(down.len<8&&performance.now()-down.t<350&&tapCycle(down.p)){return}
 if(isScribble(s))scribble(s);else{const r=radical(s);attach(r||s)}
 rt=setTimeout(recognize,650);kick()};
addEventListener('resize',fit);
document.fonts.load('40px H').then(()=>{fit()});fit();

/* ---------- memory bar, drag & drop ---------- */
let MEMV=[];try{MEMV=JSON.parse(localStorage.getItem('inkmem')||'[]')}catch(e){}
const memSave=()=>{try{localStorage.setItem('inkmem',JSON.stringify(MEMV))}catch(e){}};
function memRender(){const m=$('mem');m.innerHTML='';MEMV.forEach((v,i)=>{const c=document.createElement('div');c.className='chip';c.textContent=v;
 const x=document.createElement('b');x.textContent='×';x.onclick=e=>{e.stopPropagation();MEMV.splice(i,1);memSave();memRender()};c.appendChild(x);chipDrag(c,v);m.appendChild(c)});
 m.style.display=(MEMV.length||drag)?'flex':'none';m.classList.toggle('hot',!!drag&&drag.y>SH-70)}
function memAdd(v){if(!v)return;MEMV=MEMV.filter(q=>q!=v);MEMV.unshift(v);MEMV=MEMV.slice(0,12);memSave();memRender()}
function chipDrag(c,v){let t=null,sp=null;c.onpointerdown=e=>{if(e.target.tagName=='B')return;sp=[e.clientX,e.clientY];c.setPointerCapture(e.pointerId);t=setTimeout(()=>beginDrag({text:v,src:null,fromMem:true},sp),300)};
 c.onpointermove=e=>{if(drag)dragMove([e.clientX,e.clientY]);else if(sp&&Math.hypot(e.clientX-sp[0],e.clientY-sp[1])>10)clearTimeout(t)};
 c.onpointerup=c.onpointercancel=()=>{clearTimeout(t);if(drag)dragEnd()}}
function hitDrag(p){for(const L of lines){
 for(const g of L.ans){if(ch(g)=='§')continue;const b=gbox(g);if(p[0]>=b.x0-8&&p[0]<=b.x1+8&&p[1]>=b.y0-8&&p[1]<=b.y1+8&&Number.isFinite(L.val))return{text:fmt(L.val),src:null,L}}
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
let HIST=[];try{HIST=JSON.parse(localStorage.getItem('inkhist')||'[]')}catch(e){}
const histPersist=()=>{try{localStorage.setItem('inkhist',JSON.stringify(HIST))}catch(e){}};
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
 c.width=Math.round((x1-x0)*k);c.height=Math.round((y1-y0)*k);const keep=ctx;ctx=c.getContext('2d');ctx.fillStyle='#faf8f3';ctx.fillRect(0,0,c.width,c.height);ctx.setTransform(k,0,0,k,-x0*k,-y0*k);
 for(const L of lines)L.syms.concat(L.ans).forEach(g=>{const a=g.a;g.a=Math.max(a,a>.3?1:a);drawG(g);g.a=a});ctx=keep;return c.toDataURL('image/png')}
function toast(m){let t=$('toast');if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t)}t.textContent=m;t.style.opacity=1;clearTimeout(t.h);t.h=setTimeout(()=>t.style.opacity=0,1600)}
/* ---------- menu / settings sheet ---------- */
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function refreshAll(){lines.forEach(L=>{L.at='\0';updateAns(L)});kick()}
function closeSheet(){$('sheet').style.display='none'}
const seg=(label,k,opts)=>`<div class="s"><span>${label}</span><div class="seg">${opts.map(o=>`<button data-k="${k}" data-v="${o[0]}" class="${SET[k]==o[0]?'on':''}">${o[1]}</button>`).join('')}</div></div>`;
const cleanAns=L=>L&&L.at?L.at.replace(/^=/,''):'';
function openSheet(page){const p=$('panel');$('sheet').style.display='block';
 if(page=='hist'){p.innerHTML=`<div class="top"><button data-a="back">‹ Back</button><b>History</b><button data-a="hexp">Export</button></div>`+(HIST.length?HIST.map((h,i)=>`<div class="h"><div class="t">${esc(h.text)} <i>${esc(h.ans.replace(/^=/,'= '))}</i></div><div class="b"><button data-a="hopen" data-i="${i}">Open</button><button data-a="hcopy" data-i="${i}">Copy</button><button data-a="hdel" data-i="${i}">×</button></div></div>`).join('')+`<button class="danger" data-a="hclr">Clear history</button>`:`<p class="mut">Nothing yet. Calculations are saved here automatically.</p>`)}
 else p.innerHTML=`<h3>Settings</h3>${seg('Calculation','mode',[['instant','Instant'],['demand','On demand']])}${seg('Angles','angle',[['rad','Radians'],['deg','Degrees']])}${seg('Results','fmt',[['dec','Decimal'],['frac','Fraction'],['mixed','Mixed']])}
 <div class="row"><button data-a="hist">History</button><button data-a="copy">Copy result</button><button data-a="img">Share image</button><button data-a="addmem">Result → memory</button><button data-a="clrmem">Clear memory</button><button class="danger" data-a="clear">Clear canvas</button></div>
 <p class="mut">Tip: press and hold a number or result, then drag it into another expression or onto the memory bar.</p>`}
$('panel').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.k){SET[d.k]=d.v;saveSet();refreshAll();openSheet('main');return}
 const i=+d.i;switch(d.a){case'hist':openSheet('hist');break;case'back':openSheet('main');break;
  case'copy':{const t=cleanAns(lastL&&lines.includes(lastL)?lastL:lines.find(L=>L.at));t?copyText(t):toast('No result yet');closeSheet();break}
  case'img':{const u=exportPNG();if(!u)toast('Nothing to share');else if(window.Android&&Android.shareImage)Android.shareImage(u.split(',')[1]);else window.open(u);closeSheet();break}
  case'addmem':{const L=lastL&&lines.includes(lastL)?lastL:lines.find(L=>Number.isFinite(L.val));if(L&&Number.isFinite(L.val)){memAdd(fmt(L.val));toast('Stored in memory')}else toast('No result yet');closeSheet();break}
  case'clrmem':MEMV=[];memSave();memRender();toast('Memory cleared');closeSheet();break;
  case'clear':lines.forEach(L=>L.syms.concat(L.ans).forEach(kill));lines=[];kick();closeSheet();break;
  case'hopen':openHist(HIST[i]);break;case'hcopy':copyText(HIST[i].text+' '+HIST[i].ans.replace(/^=/,'= '));break;
  case'hdel':HIST.splice(i,1);histPersist();openSheet('hist');break;case'hclr':HIST=[];histPersist();openSheet('hist');break;
  case'hexp':shareText(HIST.map(h=>h.text+' '+h.ans.replace(/^=/,'= ')).join('\n'));break}};
$('back').onclick=closeSheet;$('mb').onclick=()=>openSheet('main');
window.onBack=()=>{if($('sheet').style.display=='block'){closeSheet();return true}if(drag){drag=null;memRender();return true}return false};
memRender();
