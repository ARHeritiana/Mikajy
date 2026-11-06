import asyncio,sys
exec(open('e2e.py').read().split('async def main')[0])
from playwright.async_api import async_playwright
async def main(rate):
    async with async_playwright() as p:
        b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':412,'height':800},device_scale_factor=2.6);pg=await ctx.new_page()
        await pg.add_init_script("window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())__lt.push(Math.round(e.duration))}).observe({entryTypes:['longtask']});window.__fr=[];let _l=0;(function f(t){if(_l)__fr.push(t-_l);_l=t;requestAnimationFrame(f)})(0)")
        await pg.goto('file:///home/claude/Mikajy-source/android/assets/index.html');await pg.wait_for_timeout(600)
        cdp=await ctx.new_cdp_session(pg);await cdp.send('Emulation.setCPUThrottlingRate',{'rate':rate})
        x=30
        for c in sys.argv[2]:
            for s in glyph(c,x,300,70):await stroke(pg,s)
            x+=52 if c not in '+*' else 70
        await pg.evaluate("__lt.length=0;__fr.length=0")
        await pg.wait_for_timeout(5000)
        r=await pg.evaluate("({lt:__lt,maxFrame:Math.round(Math.max(...__fr)),slow:__fr.filter(f=>f>50).length,res:lines.map(L=>L.at)})")
        print('cpu x%d:'%rate,r);await b.close()
asyncio.run(main(int(sys.argv[1])))
