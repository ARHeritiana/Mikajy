import asyncio,math,sys
from playwright.async_api import async_playwright
def arc(cx,cy,rx,ry,a0,a1,n=24):return [(cx+rx*math.cos(math.radians(a)),cy+ry*math.sin(math.radians(a))) for a in [a0+(a1-a0)*i/(n-1) for i in range(n)]]
def glyph(c,x,y,h):
    w=h*.6
    S={'1':[[(.5,0),(.5,1)]],'2':[arc(.5,.3,.45,.3,-170,25,16)+[(.05,1),(.95,1)]],'5':[[(.9,0),(.15,0),(.1,.45)]+arc(.45,.68,.45,.32,-120,150,18)],
       '7':[[(.05,0),(.95,0),(.4,1)]],'+':[[(.5,.2),(.5,.8)],[(.1,.5),(.9,.5)]],'*':[[(0,.1),(1,.9)],[(1,.1),(0,.9)]],'3':[arc(.45,.27,.4,.27,-150,90,12)+arc(.45,.73,.45,.27,-90,150,12)]}[c]
    sc=h*.9 if c in '+*' else h
    return [[(x+px*(sc*.8 if c in '+*' else w),y+py*(sc if c in '+*' else h)) for px,py in s] for s in S]
def dens(pts,step=5):
    o=[]
    for a,b in zip(pts[:-1],pts[1:]):
        n=max(1,int(math.hypot(b[0]-a[0],b[1]-a[1])/step));o+=[(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n) for k in range(n)]
    return o+[pts[-1]]
async def stroke(page,pts):
    pts=dens(pts)
    await page.mouse.move(*pts[0]);await page.mouse.down()
    for p in pts[1:]:await page.mouse.move(*p,steps=1)
    await page.mouse.up()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page(viewport={'width':800,'height':380});errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file:///home/claude/pkg/InkCalc-source/android/assets/index.html');await pg.wait_for_timeout(500)
        x=120
        for c in sys.argv[1]:
            for s in glyph(c,x,140,110):await stroke(pg,s)
            x+=100 if c not in '+*' else 130
            await pg.wait_for_timeout(150)
        await pg.wait_for_timeout(700);await pg.screenshot(path='shot1.png');await pg.wait_for_timeout(2500);await pg.screenshot(path='shot2.png')
        print(await pg.evaluate("lines.map(L=>[L.syms.map(ch).join(""),L.at,L.syms.map(g=>[g.c.map(o=>o.c+o.p.toFixed(2)).join(\" \"),Math.round(g.b.x0),Math.round(g.b.x1),Math.round(g.b.y0),Math.round(g.b.y1)])])"));print('errors',errs)
        if len(sys.argv)>2:
            # scribble over it
            pts=[(100+i*30%400, 120+ (i%2)*110) for i in range(0,30)];pts=[(100+ (i*17)%500,130+(i%2)*100) for i in range(40)]
            await stroke(pg,pts);await pg.wait_for_timeout(1500);await pg.screenshot(path='shot3.png');print('after scribble',await pg.evaluate("lines.length"),errs)
        await b.close()
asyncio.run(main())
