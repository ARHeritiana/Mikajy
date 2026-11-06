import asyncio
from fu import *
async def scen(label,order,bar_args):
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page(viewport={'width':520,'height':460});errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/pkg/Mikajy-source/android/assets/index.html');await pg.wait_for_timeout(400)
        st=lambda:pg.evaluate("lines.map(L=>[L.syms.map(g=>(g.fp||'')+ch(g)).join(' '),L.at])")
        for s in glyph('2',50,110,90):await stroke(pg,s)
        await stroke(pg,[(120+i*4,150) for i in range(11)])
        for s in g4('4',200,110,90):await stroke(pg,s)
        await pg.wait_for_timeout(3300)
        den=lambda:[st_ for c,x in (('5',140),('2',200)) for st_ in glyph(c,x,260,80)]
        if order=='den-first':
            for s in den():await stroke(pg,s)
            await pg.wait_for_timeout(200)
            for s in bar(*bar_args):await stroke(pg,s)
        else:
            for s in bar(*bar_args):await stroke(pg,s)
            await pg.wait_for_timeout(200)
            for s in den():await stroke(pg,s)
        await pg.wait_for_timeout(3800)
        print(label.ljust(26),await st(),errs);await b.close()
async def main2():
    await scen('slanted bar, 2-digit den',  'bar-first',(40,236,250,12))
    await scen('den written first',          'den-first',(40,240,250,0))
    await scen('short bar under "-4"',       'bar-first',(150,236,130,0))
asyncio.run(main2())
