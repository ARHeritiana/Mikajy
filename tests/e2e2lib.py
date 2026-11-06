import asyncio,math,sys
from playwright.async_api import async_playwright
exec(open('e2e.py').read().split('async def main')[0])
def six(x,y,h):
    w=h*.6;pts=[(.8,0),(.4,.15),(.12,.55)]+arc(.5,.7,.4,.3,180,-180,22);return [[(x+px*w,y+py*h) for px,py in pts]]
def rad(x,y,h,tail):
    P=[(0,.55),(.12,.5),(.3,1.0),(.62,0)];pts=[(x+px*h*.7,y+py*h) for px,py in P];ax=pts[-1][0]
    return [pts+[(ax+tail*i/6,y) for i in range(1,7)]]
async def run(spec,expect):
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page(viewport={'width':900,'height':380});errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/ink/assets/index.html');await pg.wait_for_timeout(400)
        for kind,*a in spec:
            if kind=='g':
                c,x,y,h=a;S=glyph(c,x,y,h) if c!='6' else six(x,y,h)
            elif kind=='r':S=rad(*a)
            for s in S:await stroke(pg,s)
            await pg.wait_for_timeout(120)
        await pg.wait_for_timeout(900);await pg.screenshot(path='m1.png');await pg.wait_for_timeout(2600);await pg.screenshot(path='m2_'+str(len(expect))+'.png')
        r=await pg.evaluate("lines.map(L=>[L.syms.map(g=>ch(g)+(g.sup?'^':'')+(g.vin?'V':'')+(g.cover?'c'+g.cover:'')).join(' '),L.at])")
        print(expect,'->',r,errs);await b.close()
async def main():
    await run([('r',100,140,110,300),('g','1',210,150,100),('g','6',290,150,100)],'√16=4')
    await run([('g','3',120,140,110),('g','2',210,130,50)],'3^2=9')
    await run([('g','2',120,140,110),('g','5',210,110,48),('g','+',300,150,100),('g','1',420,140,110)],'2^5+1=33')
