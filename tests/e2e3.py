import asyncio
from e2e2lib import *
def bar(x,y,w,slope=0):return [[(x+w*i/10,y+slope*i/10) for i in range(11)]]
async def fr(spec,expect,shot=None):
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page(viewport={'width':900,'height':380});errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/ink/assets/index.html');await pg.wait_for_timeout(400)
        for kind,*a in spec:
            S={'g':lambda c,x,y,h:glyph(c,x,y,h),'b':bar}[kind](*a)
            for s in S:await stroke(pg,s)
            await pg.wait_for_timeout(100)
        await pg.wait_for_timeout(3600)
        if shot:await pg.screenshot(path=shot)
        r=await pg.evaluate("lines.map(L=>[L.syms.map(g=>(g.fp?g.fp:'')+ch(g)).join(' '),L.at])")
        print(expect.ljust(12),r,errs);await b.close()
async def main():
    await fr([('g','1',200,60,80),('b',150,170,130),('g','2',200,195,80)],'1/2=0.5','f1.png')
    await fr([('b',150,170,150),('g','1',180,60,80),('g','2',230,60,80),('g','5',200,195,80)],'12/5=2.4 (bar first)')
    await fr([('g','5',60,130,100),('g','+',120,130,100),('g','3',250,60,80),('b',230,175,110),('g','7',260,195,80)],'5+3/7','f3.png')
    await fr([('g','2',100,130,100),('g','*',170,130,100),('g','1',300,60,80),('b',280,175,110,3),('g','2',310,195,80)],'2*1/2=1')
if __name__=="__main__":asyncio.run(main())
