import asyncio
from e2e2lib import *
from e2e3 import bar
async def scenario(label,bar_args,den_x,sc=None):
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page(viewport={'width':520,'height':440});errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/pkg/InkCalc-source/android/assets/index.html');await pg.wait_for_timeout(400)
        st=lambda:pg.evaluate("lines.map(L=>[L.syms.map(g=>(g.fp||'')+ch(g)).join(' '),L.at])")
        for s in glyph('2',50,110,90):await stroke(pg,s)
        await stroke(pg,[(120+i*4,150) for i in range(11)])
        for s in g4('4',200,110,90):await stroke(pg,s)
        await pg.wait_for_timeout(3300);before=await st()
        base=await pg.evaluate("[lines[0].base,lines[0].F]")
        for s in bar(*bar_args):await stroke(pg,s)
        await pg.wait_for_timeout(200)
        for s in glyph('5',den_x,bar_args[1]+22,80):await stroke(pg,s)
        await pg.wait_for_timeout(3600)
        print(label.ljust(22),'before',before,'-> after',await st(),errs);await pg.screenshot(path=sc or 'fu.png');await b.close()
S4=[[(.7,0),(0,.65),(1,.65)],[(.7,0),(.7,1)]]
def g4(c,x,y,h):
    w=h*.6;return [[(x+px*w,y+py*h) for px,py in s] for s in S4]
async def main():
    # expression sits roughly x=50..260, base ~ y=200; bar below it
    await scenario('bar under whole expr',(40,235,240),140,'fu_a.png')
    await scenario('bar under the 4 only',(190,235,90),215,'fu_b.png')
if __name__=="__main__":asyncio.run(main())
