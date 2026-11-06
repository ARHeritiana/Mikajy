import asyncio
from e2e2lib import *
from e2e3 import bar
from scrib import zigzag,vzig
S4={'4':[[(.7,0),(0,.65),(1,.65)],[(.7,0),(.7,1)]]}
def g4(c,x,y,h):
    if c=='4':
        w=h*.6;return [[(x+px*w,y+py*h) for px,py in s] for s in S4['4']]
    return glyph(c,x,y,h)
async def draw(pg,spec):
    for kind,*a in spec:
        S=bar(*a) if kind=='b' else g4(*a)
        for s in S:await stroke(pg,s)
        await pg.wait_for_timeout(100)
async def state(pg):return await pg.evaluate("lines.map(L=>[L.syms.map(g=>(g.fp||'')+ch(g)).join(' '),L.at])")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();errs=[]
        for mode in ('overwrite','scribble-then-write'):
            pg=await b.new_page(viewport={'width':900,'height':380});pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('file:///home/claude/Mikajy-source/android/assets/index.html');await pg.wait_for_timeout(400)
            await draw(pg,[('g','1',130,60,80),('b',90,170,110),('g','2',130,195,80),('g','+',250,125,90),('g','1',390,60,80),('b',350,170,110),('g','3',390,195,80)])
            await pg.wait_for_timeout(3500);print(mode,'start :',await state(pg))
            bx=await pg.evaluate("lines[0].syms.map(g=>{const b=gbox(g);return [g.fp+ch(g),Math.round(b.x0),Math.round(b.x1),Math.round(b.y0),Math.round(b.y1)]})")
            den=[x for x in bx if x[0]=='d3'][0]
            if mode=='overwrite':
                await draw(pg,[('g','4',(den[1]+den[2])/2-22,(den[3]+den[4])/2-30,70)])
            else:
                await stroke(pg,vzig((den[1]+den[2])/2,den[3]-6,den[4]+6,22,8,3));await pg.wait_for_timeout(1500);print(mode,'erased:',await state(pg))
                bx2=await pg.evaluate("lines[0].syms.map(g=>{const b=gbox(g);return [g.fp+ch(g),Math.round(b.x0),Math.round(b.x1),Math.round(b.y0),Math.round(b.y1)]})")
                print(bx2,den);bar2=[x for x in bx2 if x[0]=='bar§'][1]
                await draw(pg,[('g','4',(bar2[1]+bar2[2])/2-22,bar2[3]+30,70)])
            await pg.wait_for_timeout(3500);print(mode,'result:',await state(pg),errs);await pg.close()
        await b.close()
asyncio.run(main())
