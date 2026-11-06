import asyncio,math,random
from e2e2lib import *
random.seed(3)
def zigzag(x0,x1,y,amp,n,jit=6):
    pts=[];
    for i in range(n+1):
        x=x0+(x1-x0)*(i%2==0 and 0 or 1) if False else (x0 if i%2==0 else x1)
        pts.append((x+random.uniform(-jit,jit),y+(-amp+2*amp*i/n)+random.uniform(-jit,jit)))
    return pts
def vzig(x,y0,y1,w,n,jit=6):
    return [(x+(-w if i%2==0 else w)+random.uniform(-jit,jit),y0+(y1-y0)*i/n+random.uniform(-jit,jit)) for i in range(n+1)]
def loops(cx,cy,r,n):
    return [(cx+r*math.cos(t/10*2*math.pi)*(1+.15*random.random())+t*2,cy+r*math.sin(t/10*2*math.pi)*(1+.15*random.random())) for t in range(int(n*10)+1)]
def zshape(x0,x1,y0,y1):return [(x0,y0),(x1,y0+8),(x0+8,y1-8),(x1,y1)]
async def setup(pg):
    x=120
    for c in '25+7':
        for s in glyph(c,x,140,110):await stroke(pg,s)
        x+=100 if c not in '+*' else 130
    await pg.wait_for_timeout(3600)
async def trial(name,mk,expect):
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page(viewport={'width':900,'height':380})
        await pg.goto('file:///home/claude/ink/assets/index.html');await pg.wait_for_timeout(400);await setup(pg)
        bx=await pg.evaluate("lines[0].syms.map(g=>{const b=gbox(g);return [ch(g),b.x0,b.x1,b.y0,b.y1]})")
        await stroke(pg,mk(bx));await pg.wait_for_timeout(1500)
        r=await pg.evaluate("lines.map(L=>L.syms.map(ch).join(''))");r=r[0] if r else ''
        print(name.ljust(28),'left:',repr(r).ljust(8),'expected',repr(expect),'OK' if r==expect else 'MISMATCH');await b.close()
async def main():
    B=lambda bx,i:bx[i]
    await trial('zigzag over all',lambda bx:zigzag(bx[0][1]-10,bx[3][2]+10,(bx[0][3]+bx[0][4])/2,60,9),'')
    await trial('5-sweep loose zigzag',lambda bx:zigzag(bx[0][1]-10,bx[3][2]+10,(bx[0][3]+bx[0][4])/2,70,5,14),'')
    await trial('vertical zigzag on 7',lambda bx:vzig((bx[3][1]+bx[3][2])/2,bx[3][3]-10,bx[3][4]+10,28,7),'25+')
    await trial('loops over 5+',lambda bx:loops((bx[1][1]+bx[2][2])/2-30,(bx[1][3]+bx[1][4])/2,45,3),'27')
    await trial('Z cross-out over all',lambda bx:zshape(bx[0][1]-10,bx[3][2]+10,bx[0][3]-10,bx[0][4]+10),'')
    await trial('thin vertical on 2',lambda bx:vzig((bx[0][1]+bx[0][2])/2,bx[0][3]-10,bx[0][4]+10,22,8,4),'5+7')
    await trial('3-sweep small zigzag on +',lambda bx:zigzag(bx[2][1]-8,bx[2][2]+8,(bx[2][3]+bx[2][4])/2,30,3,5),'257')
    await trial('write 8 over text',lambda bx:arc(.5,.27,.3,.27,60,-270,18)[:0] or [(bx[1][1]+30*math.cos(a/3),bx[1][3]+30+25*math.sin(a/3)+(a>18 and 40 or 0)) for a in range(0,38)],None)
if __name__=="__main__":asyncio.run(main())
