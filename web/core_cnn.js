const M=/*MODEL*/;
const f32=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new Float32Array(u.buffer)};
const W={};for(const k of['w1','b1','w2','b2','w3','b3','w4','b4'])W[k]=f32(M[k]);
function conv(x,H,Wd,Ci,w,b,Co){const o=new Float32Array(H*Wd*Co);for(let y=0;y<H;y++)for(let xx=0;xx<Wd;xx++){const op=(y*Wd+xx)*Co;for(let c=0;c<Co;c++)o[op+c]=b[c];
 for(let ky=0;ky<3;ky++){const yy=y+ky-1;if(yy<0||yy>=H)continue;for(let kx=0;kx<3;kx++){const x2=xx+kx-1;if(x2<0||x2>=Wd)continue;const ip=(yy*Wd+x2)*Ci,wp=(ky*3+kx)*Ci*Co;
  for(let ci=0;ci<Ci;ci++){const v=x[ip+ci];if(v===0)continue;const wb=wp+ci*Co;for(let c=0;c<Co;c++)o[op+c]+=v*w[wb+c]}}}
 for(let c=0;c<Co;c++)if(o[op+c]<0)o[op+c]=0}return o}
function pool(x,H,Wd,C){const h=H>>1,w=Wd>>1,o=new Float32Array(h*w*C);for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++)for(let c=0;c<C;c++){let m=-1e9;
 for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const v=x[((2*y+dy)*Wd+2*xx+dx)*C+c];if(v>m)m=v}o[(y*w+xx)*C+c]=m}return o}
function predict(x){const C1=W.b1.length,C2=W.b2.length,FC=W.b3.length,NC=W.b4.length;let h=pool(conv(x,28,28,1,W.w1,W.b1,C1),28,28,C1);h=pool(conv(h,14,14,C1,W.w2,W.b2,C2),14,14,C2);
 const f=new Float32Array(FC);for(let j=0;j<FC;j++)f[j]=W.b3[j];for(let i=0;i<49*C2;i++){const v=h[i];if(!v)continue;const r=i*FC;for(let j=0;j<FC;j++)f[j]+=v*W.w3[r+j]}
 const o=Array.from(W.b4);for(let j=0;j<FC;j++){if(f[j]<=0)continue;for(let k=0;k<NC;k++)o[k]+=f[j]*W.w4[j*NC+k]}
 const mx=Math.max(...o);let s=0;const p=o.map(v=>{v=Math.exp(v-mx);s+=v;return v});return p.map(v=>v/s)}
