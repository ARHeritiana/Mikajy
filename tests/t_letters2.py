import asyncio,json,numpy as np,os
src=open('train4.py').read().split("tr,va,te=")[0]
exec(src)
heldf=[f for f in fonts if os.path.basename(f)[:-4] in HELD]
from playwright.async_api import async_playwright
JS="""async (vs)=>{const xs=vs.map(v=>Float32Array.from(v)),ps=await Promise.all(xs.map(x=>predictAsync(x)));
 const syms=xs.map((x,k)=>newG(classifyP(ps[k],x),{b:{x0:k*60,x1:k*60+50,y0:100,y1:200,w:50,h:100},fv:x,fresh:true}));
 ctxfix(syms);wordfix(syms);const L={syms,ans:[]};let t=null;try{t=fmt(evalTok(tokenize(L)))}catch(e){t='ERR'};return [syms.map(g=>ch(g)).join(''),t]}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page();await pg.goto('file:///home/claude/Mikajy-source/android/assets/index.html');await pg.wait_for_timeout(300)
        tests=['sin30','cos0','tan45','ln1','log100','sinh1','cosh0','tanh1','abs5','asin1','acos1','atan1','50%','2+3','15*4']
        ok=0;tot=0
        for fi,fp in enumerate(heldf):
            for t in tests:
                vs=[]
                for i,c in enumerate(t):
                    k=CL.index(c);v=fgen(k,1,[fp],1000+fi*100+i*7+len(vs))
                    vs.append(v[0].tolist())
                r=await pg.evaluate(JS,vs);good=r[0]==t;ok+=good;tot+=1
                if not good:print(os.path.basename(fp)[:10],t,'->',r)
        print('exact string accuracy on unseen fonts: %d/%d'%(ok,tot));await b.close()
asyncio.run(main())
