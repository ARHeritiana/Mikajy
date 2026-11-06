import asyncio
from e2e2lib import *
async def run(spec,label):
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page(viewport={'width':700,'height':380});errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/Mikajy-source/android/assets/index.html');await pg.wait_for_timeout(400)
        x=40
        for c in spec:
            if c=='=':
                for y in (150,182):await stroke(pg,[(x+i*4,y) for i in range(14)])
                x+=80
            else:
                for s in glyph(c,x,120,100):await stroke(pg,s)
                x+=80 if c not in '+*' else 110
            await pg.wait_for_timeout(120)
        await pg.wait_for_timeout(3600);pg.on('x',lambda:0)
        r=await pg.evaluate("lines.map(L=>[L.syms.map(ch).join(''),L.at])");print(label.ljust(14),r,errs);await pg.screenshot(path='eq.png');await b.close()
async def main():
    await run('2*+3=7','2x+3=7')
    await run('5*=1','5x=1 (not integer)')
asyncio.run(main())
