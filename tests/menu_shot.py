import asyncio
from e2e2lib import *
PAGE='file:///home/claude/pkg/InkCalc-source/android/assets/index.html'
async def write(pg,s='25+7',y=200):
    x=40
    for c in s:
        for st in glyph(c,x,y,80):await stroke(pg,st)
        x+=70 if c not in '+*' else 90
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();errs=[]
        pg=await b.new_page(viewport={'width':412,'height':800},device_scale_factor=2);pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(PAGE);await pg.wait_for_timeout(500);await write(pg);await pg.wait_for_timeout(5200)
        await write(pg,'73*5',320);await pg.wait_for_timeout(5200)
        await pg.click('#mb');await pg.wait_for_timeout(700);await pg.screenshot(path='m_main.png')
        await pg.click('button[data-k=angle][data-v=deg]');await pg.click('button[data-k=fmt][data-v=frac]');await pg.wait_for_timeout(700);await pg.screenshot(path='m_main2.png')
        await pg.click('button[data-a=hist]');await pg.wait_for_timeout(500);await pg.screenshot(path='m_hist.png')
        await pg.close()
        pg=await b.new_page(viewport={'width':800,'height':380},device_scale_factor=2)
        await pg.goto(PAGE);await pg.wait_for_timeout(500);await pg.click('#mb');await pg.wait_for_timeout(700);await pg.screenshot(path='m_land.png');print(errs);await b.close()
asyncio.run(main())
