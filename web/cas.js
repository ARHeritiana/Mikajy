/* CAS: symbolic/numeric calculus+algebra engine. AST: number | 'x'|'π'|'e' | ['+',a,b] ['*',a,b] ['^',a,b] ['f',name,a] */
const CAS=(()=>{const N=v=>typeof v=='number',A=Array.isArray,Fn=(f,a)=>['f',f,a];
const add=(a,b)=>N(a)&&N(b)?a+b:a===0?b:b===0?a:['+',a,b];
const mul=(a,b)=>{if(A(b)&&b[0]=='*'&&N(b[1])&&!N(a))return mul(b[1],mul(a,b[2]));if(N(b)&&!N(a))[a,b]=[b,a];return N(a)&&N(b)?a*b:a===0||b===0?0:a===1?b:b===1?a:N(a)&&A(b)&&b[0]=='*'&&N(b[1])?mul(a*b[1],b[2]):['*',a,b]};
const neg=a=>mul(-1,a),sub=(a,b)=>add(a,neg(b)),P=(a,b)=>b===0?1:b===1?a:N(a)&&N(b)&&(Number.isInteger(b)||a>0)?Math.pow(a,b):['^',a,b],div=(a,b)=>mul(a,P(b,-1));
const fact=v=>{if(v<0||v>170||v%1)return NaN;let r=1;for(let k=2;k<=v;k++)r*=k;return r};
const FNS={sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,ln:Math.log,log:Math.log10,abs:Math.abs,fact,lnabs:a=>Math.log(Math.abs(a))};
const ev=(n,x)=>N(n)?n:n=='x'?x:n=='π'?Math.PI:n=='e'?Math.E:n[0]=='+'?ev(n[1],x)+ev(n[2],x):n[0]=='*'?ev(n[1],x)*ev(n[2],x):n[0]=='^'?Math.pow(ev(n[1],x),ev(n[2],x)):FNS[n[1]](ev(n[2],x));
const hasX=n=>N(n)?false:A(n)?(n[0]=='f'?hasX(n[2]):hasX(n[1])||hasX(n[2])):n=='x';
function parse(T){let i=0;const pk=()=>T[i],isN=t=>t!==undefined&&/^[0-9.]+$/.test(t),aS=t=>isN(t)||t=='('||t=='π'||t=='e'||t=='x'||t=='√'||FUNCS.has(t);
 const expr=()=>{let v=term();while(pk()=='+'||pk()=='-'){const o=T[i++],r=term();v=o=='+'?add(v,r):sub(v,r)}return v},
 term=()=>{let v=un();for(;;){const c=pk();if(c=='*'||c=='/'){i++;const r=un();v=c=='*'?mul(v,r):div(v,r)}else if(aS(c))v=mul(v,pw());else break}return v},
 un=()=>{if(pk()=='-'){i++;return neg(un())}if(pk()=='+'){i++;return un()}return pw()},
 ex=()=>{if(pk()!='(')throw 0;i++;const v=expr();if(pk()==')')i++;return v},
 pw=()=>{const b=po();if(pk()=='^'){i++;return P(b,ex())}return b},
 po=()=>{let v=at();for(;;){if(pk()=='!'){i++;v=Fn('fact',v)}else if(pk()=='%'){i++;v=mul(v,.01)}else break}return v},
 at=()=>{const t=pk();if(t=='('){i++;const v=expr();if(pk()==')')i++;return v}
  if(isN(t)){i++;return parseFloat(t)}if(t=='π'||t=='e'||t=='x'){i++;return t}if(t=='√'){i++;return P(po(),.5)}
  if(FUNCS.has(t)){i++;let e=null;if(pk()=='^'&&T[i+1]=='('){i++;e=ex()}const a=pk()=='('?at():po();
   if(e===-1&&'sin cos tan'.includes(t))return Fn('a'+t,a);return e!==null?P(Fn(t,a),e):Fn(t,a)}throw 0},v=expr();if(i<T.length)throw 0;return v}
const D1={sin:u=>Fn('cos',u),cos:u=>neg(Fn('sin',u)),tan:u=>P(Fn('cos',u),-2),asin:u=>P(sub(1,P(u,2)),-.5),acos:u=>neg(P(sub(1,P(u,2)),-.5)),atan:u=>P(add(1,P(u,2)),-1),sinh:u=>Fn('cosh',u),cosh:u=>Fn('sinh',u),tanh:u=>sub(1,P(Fn('tanh',u),2)),ln:u=>P(u,-1),lnabs:u=>P(u,-1),log:u=>P(mul(u,Math.LN10),-1),abs:u=>mul(u,P(Fn('abs',u),-1))};
function dx(n){if(N(n)||n=='π'||n=='e')return 0;if(n=='x')return 1;
 if(n[0]=='+')return add(dx(n[1]),dx(n[2]));if(n[0]=='*')return add(mul(dx(n[1]),n[2]),mul(n[1],dx(n[2])));
 if(n[0]=='f'){if(!D1[n[1]])throw 0;return mul(D1[n[1]](n[2]),dx(n[2]))}
 const[,a,b]=n;if(N(b))return mul(mul(b,P(a,b-1)),dx(a));if(a=='e')return mul(n,dx(b));return mul(n,add(mul(dx(b),Fn('ln',a)),mul(b,mul(dx(a),P(a,-1)))))}
/* polynomials */
const pm=(a,b)=>{const r=Array(a.length+b.length-1).fill(0);a.forEach((p,i)=>b.forEach((q,j)=>r[i+j]+=p*q));return r};
function poly(n){if(N(n))return[n];if(n=='x')return[0,1];if(!A(n))return null;
 if(n[0]=='+'){const a=poly(n[1]),b=poly(n[2]);if(!a||!b)return null;const r=Array(Math.max(a.length,b.length)).fill(0);a.forEach((v,i)=>r[i]+=v);b.forEach((v,i)=>r[i]+=v);return r}
 if(n[0]=='*'){const a=poly(n[1]),b=poly(n[2]);return a&&b?pm(a,b):null}
 if(n[0]=='^'&&N(n[2])&&Number.isInteger(n[2])&&n[2]>=0&&n[2]<40){const a=poly(n[1]);if(!a)return null;let r=[1];for(let k=0;k<n[2];k++)r=pm(r,a);return r}return null}
const trim=c=>{c=c.slice();while(c.length>1&&Math.abs(c[c.length-1])<1e-12)c.pop();return c};
const fromPoly=c=>{let r=0;c.forEach((v,k)=>{if(v)r=add(r,mul(v,P('x',k)))});for(let k=c.length-1,s=0;0;);return r};
const fromPolyD=c=>{let r=0;for(let k=c.length-1;k>=0;k--)if(c[k])r=add(r,mul(c[k],P('x',k)));return r};
/* printing */
function nf(v){if(!Number.isFinite(v))return v>0?'∞':v<0?'-∞':'?';const r=Math.round(v);if(Math.abs(v-r)<1e-9*Math.max(1,Math.abs(r)))return String(r);const f=toFrac(v);if(f)return f.p+'/'+f.q;return String(parseFloat(v.toPrecision(8)))}
function str(n,p=0){if(N(n))return n<0&&p>0?'('+nf(n)+')':nf(n);if(!A(n))return n;
 if(n[0]=='+'){const b=n[2],ng=N(b)?b<0:A(b)&&b[0]=='*'&&N(b[1])&&b[1]<0,s=str(n[1],1)+(ng?' - '+str(neg(b),2):' + '+str(b,1));return p>1?'('+s+')':s}
 if(n[0]=='*'){const f=[];(function w(m){A(m)&&m[0]=='*'?(w(m[1]),w(m[2])):f.push(m)})(n);const nu=[],de=[];
  f.forEach(q=>A(q)&&q[0]=='^'&&N(q[2])&&q[2]<0?de.push(P(q[1],-q[2])):nu.push(q));let c=1;if(nu.length&&N(nu[0]))c=nu.shift();
  let s=nu.map(q=>str(q,2)).join('·');if(c==-1)s='-'+(s||'1');else if(c!=1)s=nf(c)+(s?'·'+s:'');if(!s)s='1';
  if(de.length){const d=de.reduce((a,b)=>mul(a,b));s+='/'+str(d,3)}return p>2?'('+s+')':s}
 if(n[0]=='^'){const b=n[2];const e=N(b)&&b>=0&&b<10?nf(b):'('+str(b)+')';if(b===.5)return '√('+str(n[1])+')';return str(n[1],3)+'^'+e}
 if(n[1]=='lnabs')return 'ln|'+str(n[2])+'|';if(n[1]=='fact')return str(n[2],3)+'!';return n[1]+'('+str(n[2])+')'}
/* integration */
const flat=n=>A(n)&&n[0]=='*'?[...flat(n[1]),...flat(n[2])]:[n],prod=a=>a.reduce((p,q)=>mul(p,q),1);
function uform(F){if(A(F)&&F[0]=='f'){const u=F[2],T={sin:neg(Fn('cos',u)),cos:Fn('sin',u),tan:neg(Fn('lnabs',Fn('cos',u))),sinh:Fn('cosh',u),cosh:Fn('sinh',u),ln:sub(mul(u,F),u)}[F[1]];return T!==undefined?{u,G:T}:null}
 if(A(F)&&F[0]=='^'){const[,a,b]=F;if(a=='e')return{u:b,G:F};if(N(b)){if(A(a)&&a[0]=='+'&&a[1]===1&&A(a[2])){const w=a[2];if(b===-1&&w[0]=='^'&&w[2]===2&&hasX(w[1]))return{u:w[1],G:Fn('atan',w[1])};if(b===-.5&&w[0]=='*'&&w[1]===-1&&A(w[2])&&w[2][0]=='^'&&w[2][2]===2)return{u:w[2][1],G:Fn('asin',w[2][1])}}
  return hasX(a)?{u:a,G:b==-1?Fn('lnabs',a):mul(1/(b+1),P(a,b+1))}:null}}return null}
function integ(n,d=0){if(d>8)return null;if(!hasX(n))return mul(n,'x');if(n=='x')return mul(.5,P('x',2));
 if(n[0]=='+'){const a=integ(n[1],d+1),b=a&&integ(n[2],d+1);return b&&add(a,b)}
 const pc=poly(n);if(pc)return fromPolyD([0,...pc.map((c,k)=>c/(k+1))]);
 const fs=flat(n);if(fs.some(N)){const k=prod(fs.filter(N)),r=integ(prod(fs.filter(q=>!N(q))),d+1);return r&&mul(k,r)}
 for(let i=0;i<fs.length;i++){const U=uform(fs[i]);if(!U)continue;const rest=prod(fs.filter((_,j)=>j!=i)),du=dx(U.u);let k=null,ok=true;
  for(const x0 of[.37,.9,1.7,2.4]){const r=ev(rest,x0)/ev(du,x0);if(!Number.isFinite(r)||(k!==null&&Math.abs(r-k)>1e-7*(1+Math.abs(k)))){ok=false;break}k=r}
  if(ok&&k!==null)return mul(k,U.G)}
 const pf=fs.filter(q=>poly(q)),g=prod(fs.filter(q=>!poly(q))),Pc=poly(prod(pf));
 if(Pc&&g!==1){const isLn=A(g)&&g[0]=='f'&&g[1]=='ln'&&g[2]=='x';
  if(isLn){const Q=integ(fromPolyD(Pc),d+1),r=Q&&integ(mul(Q,P('x',-1)),d+1);return r&&sub(mul(Q,g),r)}
  const U=uform(g);if(U&&A(g)&&!N(dx(U.u))===false){const G=integ(g,d+1),dP=trim(Pc.slice(1).map((c,k)=>c*(k+1)));const r=G&&integ(mul(fromPolyD(dP),G),d+1);return r&&sub(mul(fromPolyD(Pc),G),r)}}
 return null}
/* numeric */
function simpson(f,a,b,n=4000){const h=(b-a)/n;let s=0;for(let k=0;k<=n;k++){let v=f(Math.min(Math.max(a+k*h,a+1e-12),b-1e-12));if(!Number.isFinite(v))v=0;s+=v*(k==0||k==n?1:k%2?4:2)}return s*h/3}
function nint(F,a,b){if(a==b)return 0;if(a>b)return-nint(F,b,a);const f=x=>ev(F,x);
 if(Number.isFinite(a)&&Number.isFinite(b))return simpson(f,a,b);
 if(!Number.isFinite(a)&&!Number.isFinite(b))return simpson(t=>f(t/(1-t*t))*(1+t*t)/((1-t*t)**2),-1,1,20000);
 if(!Number.isFinite(b))return simpson(t=>f(a+t/(1-t))/((1-t)**2),0,1,20000);return simpson(t=>f(b-t/(1-t))/((1-t)**2),0,1,20000)}
function roots(f,lo=-50,hi=50){const r=[];let px=lo,py=f(px);for(let x=lo+.02;x<=hi;x+=.02){const y=f(x);if(Number.isFinite(py)&&Number.isFinite(y)&&py*y<=0&&!(py==0&&y==0)){let a=px,b=x,fa=py;for(let k=0;k<70;k++){const m=(a+b)/2,fm=f(m);if(fa*fm<=0)b=m;else{a=m;fa=fm}}const q=(a+b)/2;if(Math.abs(f(q))<1e-6&&!r.some(z=>Math.abs(z-q)<1e-5))r.push(q)}px=x;py=y}return r.slice(0,8)}
function factor(c){c=trim(c);if(c.some(v=>Math.abs(v-Math.round(v))>1e-9)||c.length<3)return null;let q=c.map(Math.round),out=[],sg=1;
 if(q[q.length-1]<0){q=q.map(v=>-v);sg=-1}while(q[0]==0){out.push('x');q.shift()}
 const dv=m=>{m=Math.abs(m);const r=[];for(let k=1;k<=Math.min(m,2000);k++)if(m%k==0)r.push(k);return r};
 let g=true;while(g&&q.length>2){g=false;for(const p of dv(q[0]))for(const s of dv(q[q.length-1])){for(const sg2 of[1,-1]){const r=sg2*p/s;if(Math.abs(q.reduceRight((a,v)=>a*r+v,0))<1e-9){const num=-sg2*p;
   const d=q.slice().reverse(),co=[d[0]];for(let k=1;k<d.length-1;k++)co.push(d[k]+r*co[k-1]);const qq=co.map(v=>v/s);if(qq.some(v=>Math.abs(v-Math.round(v))>1e-9))continue;
   q=qq.reverse().map(Math.round);out.push('('+(s==1?'x':s+'x')+(num<0?' - '+(-num):' + '+num)+')');g=true;break}}if(g)break}}
 if(q.length>1||q[0]!=1||!out.length){const pp=str(fromPolyD(q));out.push(q.length>1?'('+pp+')':pp)}const m={};out.forEach(o=>m[o]=(m[o]||0)+1);return(sg<0?'-':'')+Object.keys(m).map(o=>m[o]>1?(o[0]=='('?o:'('+o+')')+'^'+m[o]:o).join('')}
const V=s=>{s=String(s||'').trim().toLowerCase();if(!s)return null;if(/^\+?(inf|oo|∞)$/.test(s))return Infinity;if(/^-(inf|oo|∞)$/.test(s))return-Infinity;
 s=s.replace(/pi|π/g,'('+Math.PI+')');if(!/^[0-9+\-*/().e ]*$/.test(s))return null;try{const v=Function('return '+s)();return Number.isFinite(v)?v:null}catch(e){return null}};
function limit(f,a){const g=a==Infinity?[1e3,1e5,1e7]:a==-Infinity?[-1e3,-1e5,-1e7]:null;
 if(g){const v=g.map(x=>f(x));if(Math.abs(v[2]-v[1])<1e-4*(1+Math.abs(v[2])))return nf(+v[2].toPrecision(6));return Math.abs(v[2])>Math.abs(v[1])&&Math.abs(v[2])>1e6?(v[2]>0?'∞':'-∞'):'diverges'}
 const s=h=>[f(a+h),f(a-h)],L=s(1e-6),R=s(1e-8);if(L.concat(R).some(v=>!Number.isFinite(v))){if(L[0]>1e6&&L[1]>1e6)return'∞';if(L[0]<-1e6&&L[1]<-1e6)return'-∞';return'does not exist'}
 return Math.abs(R[0]-R[1])<1e-4*(1+Math.abs(R[0]))&&Math.abs(R[0]-L[0])<1e-3*(1+Math.abs(R[0]))?nf(Math.abs(R[0]-Math.round(R[0]))<1e-5?Math.round(R[0]):+R[0].toPrecision(6)):'does not exist'}
function run(op,T,pa,pb){const a=V(pa),b=V(pb);let ei=T.indexOf('='),ast;
 if(ei>=0){if(op!='solve')return null;ast=sub(parse(T.slice(0,ei)),parse(T.slice(ei+1)))}else ast=parse(T);const f=x=>ev(ast,x),out=s=>({pieces:[SP('= '+s)],text:'= '+s,val:undefined});
 switch(op){
 case'd':{const d=dx(ast);let s=str(d);if(a!==null)s+='   at x='+nf(a)+': '+nf(ev(d,a));return out(s)}
 case'dd':{const d=dx(dx(ast));return out(str(d))}
 case'int':{const F=integ(ast);if(a!==null&&b!==null){let v;if(F&&Number.isFinite(a)&&Number.isFinite(b)){v=ev(F,b)-ev(F,a);if(!Number.isFinite(v))v=nint(ast,a,b)}else v=nint(ast,a,b);return out(nf(+v.toPrecision(10)))}
  return out(F?str(F)+' + C':'no closed form (set a, b for a numeric value)')}
 case'lim':return out(limit(f,a===null?0:a));
 case'taylor':{const n=Math.min(8,b!==null?Math.round(b):5),c=a===null?0:a;let d=ast,t=[];for(let k=0;k<=n;k++){const co=ev(d,c)/fact(k);if(Math.abs(co)>1e-12){const xs=c==0?'x':'(x - '+nf(c)+')';t.push([co,k?xs+(k>1?'^'+k:''):''])}d=dx(d)}
  return out(t.map(([co,m],i)=>(i?(co<0?' - ':' + '):(co<0?'-':''))+(m&&Math.abs(co)==1?'':nf(Math.abs(co)))+(m&&Math.abs(co)!=1?'·':'')+m).join('')||'0')}
 case'solve':{const pc=poly(ast);if(pc&&trim(pc).length==3){const[c0,c1,c2]=trim(pc),D=c1*c1-4*c2*c0;return out('x = '+(D<0?nf(-c1/(2*c2))+' ± '+nf(Math.sqrt(-D)/(2*c2))+'i':D==0?nf(-c1/(2*c2)):nf((-c1-Math.sqrt(D))/(2*c2))+' , '+nf((-c1+Math.sqrt(D))/(2*c2))))}
  const r=roots(f);return out(r.length?'x = '+r.map(nf).join(' , '):'no real root in [-50,50]')}
 case'factor':{const pc=poly(ast);if(!pc)return null;return out(factor(pc)||str(fromPolyD(trim(pc))))}
 case'expand':{const pc=poly(ast);if(!pc)return null;return out(str(fromPolyD(trim(pc))))}
 case'ext':{const d=dx(ast),d2=dx(d),r=roots(x=>ev(d,x));return out(r.length?r.map(x=>{const s=ev(d2,x);return(s>1e-9?'min':s<-1e-9?'max':'flat')+' at x='+nf(x)+' (y='+nf(f(x))+')'}).join('; '):'no critical point')}
 case'sum':{const lo=Math.round(a===null?1:a);let hi=b===null?10:b,s=0;if(hi==Infinity){let k=lo;for(;k<2e6;k++)s+=f(k);const t=f(2e6);return out(Math.abs(t)<1e-4&&Number.isFinite(s)?nf(+s.toPrecision(8))+' (≈ converges)':'diverges')}
  for(let k=lo;k<=hi;k++)s+=f(k);return out(nf(+s.toPrecision(12)))}
 case'val':return out(nf(f(a===null?0:a)));
 case'area':{const d=nint(ast,a===null?0:a,b===null?1:b);return out(nf(+d.toPrecision(8)))}}
 return null}

const sp=s=>({pieces:[SP('= '+s)],text:'= '+s,val:undefined});
const PRE=[['(','(','d',')','/','(','d','x',')',')'],['d','/','d','x'],['(','(','d','^','(','2',')',')','/','(','d','x','^','(','2',')',')',')'],['d','^','(','2',')','/','d','x','^','(','2',')']];
const bnd=t=>t.length==1&&t[0]=='∞'?Infinity:t.length==2&&t[0]=='-'&&t[1]=='∞'?-Infinity:ev(parse(t),0);
function grp(T,i){let d=0,j=i;for(;j<T.length;j++){if(T[j]=='(')d++;if(T[j]==')'&&--d==0)break}return j}
function special(T,eq){try{
 const t0=T[0];
 for(let k=0;k<4;k++){const p=PRE[k];if(p.every((q,i)=>T[i]==q)){let ast=parse(T.slice(p.length));if(k>1)ast=dx(ast);return sp(str(dx(ast)))}}
 if(t0=='∫'){let R=T.slice(1),a=null,b=null;const n=R.length;if(n>2&&R[n-2]=='d'&&R[n-1]=='x')R=R.slice(0,n-2);
  if(R[0]=='('){const j=grp(R,0),k=R.indexOf('→');if(k>0&&k<j){a=bnd(R.slice(1,k));b=bnd(R.slice(k+1,j));R=R.slice(j+1)}}
  const f=parse(R),F=integ(f);if(a!==null){let v;if(F&&Number.isFinite(a)&&Number.isFinite(b)){v=ev(F,b)-ev(F,a);if(!Number.isFinite(v))v=nint(f,a,b)}else v=nint(f,a,b);return sp(nf(+v.toPrecision(10)))}
  return sp(F?str(F)+' + C':'no closed form (try limits: ∫(a→b))')}
 if(t0=='lim'){if(T[1]!='('||T[2]!='x'||T[3]!='→')return false;const j=grp(T,1),a=bnd(T.slice(4,j)),f=parse(T.slice(j+1));return sp(limit(x=>ev(f,x),a))}
 if(t0=='Σ'){if(T[1]!='('||T[2]!='x'||T[3]!='=')return false;const j=grp(T,1),k=T.indexOf('→');if(k<0||k>j)return false;const lo=Math.round(bnd(T.slice(4,k))),hi=bnd(T.slice(k+1,j)),f=parse(T.slice(j+1)),g=x=>ev(f,x);let s=0;
  if(hi==Infinity){for(let q=lo;q<2e6;q++)s+=g(q);return sp(Math.abs(g(2e6))<1e-4&&Number.isFinite(s)?nf(+s.toPrecision(8)):'diverges')}
  for(let q=lo;q<=hi&&q-lo<1e7;q++)s+=g(q);return sp(nf(+s.toPrecision(12)))}
 if(T.some(q=>q=='∫'||q=='Σ'||q=='→'||q=='∞'||q=='lim'||q=='d'))return false;
 if(eq&&T.includes('x')&&!T.includes('=')){const f=parse(T),pc=poly(f);if(!pc)return false;const c=trim(pc),r=roots(x=>ev(f,x)),fc=factor(c),ex=str(fromPolyD(c));
  return sp((fc&&fc!=ex?fc+'  =  ':'')+ex+(r.length?'   x = '+r.map(nf).join(', '):''))}
 }catch(e){return false}return null}
return{run,parse,V,special}})();
