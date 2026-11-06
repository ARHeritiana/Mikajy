import asyncio
from e2e2lib import *
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page(viewport={'width':412,'height':800});errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/ink/assets/index.html');await pg.wait_for_timeout(400)
        x=40
        for c in '25+7':
            for s in glyph(c,x,200,80):await stroke(pg,s)
            x+=70 if c not in '+*' else 90
        await pg.wait_for_timeout(3600)
        st=lambda:pg.evaluate("lines.map(L=>[L.syms.map(ch).join(''),L.at])")
        print('written   ',await st())
        # long-press drag the answer to memory bar
        ab=await pg.evaluate("(()=>{const g=lines[0].ans.find(g=>ch(g)!='=');const b=gbox(g);return[(b.x0+b.x1)/2,(b.y0+b.y1)/2]})()")
        await pg.mouse.move(*ab);await pg.mouse.down();await pg.wait_for_timeout(600);await pg.mouse.move(200,500,steps=6);await pg.mouse.move(200,770,steps=6);await pg.mouse.up();await pg.wait_for_timeout(300)
        print('memory    ',await pg.evaluate("MEMV"),'bar visible:',await pg.evaluate("$('mem').style.display"))
        # drag chip to canvas empty area -> new line
        chip=await pg.evaluate("(()=>{const r=document.querySelector('.chip').getBoundingClientRect();return[r.x+20,r.y+r.height/2]})()")
        await pg.mouse.move(*chip);await pg.mouse.down();await pg.wait_for_timeout(450);await pg.mouse.move(150,400,steps=8);await pg.mouse.up();await pg.wait_for_timeout(2500)
        print('after chip drop',await st())
        # drag number '7' from line 0 onto the new line
        sb=await pg.evaluate("(()=>{const g=lines[0].syms[3];const b=gbox(g);return[(b.x0+b.x1)/2,(b.y0+b.y1)/2]})()")
        tb=await pg.evaluate("(()=>{const L=lines[1];const b=gbox(L.syms[L.syms.length-1]);return[b.x1+30,(b.y0+b.y1)/2]})()")
        await pg.mouse.move(*sb);await pg.mouse.down();await pg.wait_for_timeout(600);await pg.mouse.move(*tb,steps=10);await pg.mouse.up();await pg.wait_for_timeout(2500)
        print('after move 7 ',await st())
        # settings
        await pg.click('#mb');await pg.wait_for_timeout(200)
        await pg.click('button[data-k=angle][data-v=deg]');await pg.click('button[data-k=fmt][data-v=frac]');await pg.wait_for_timeout(200)
        print('settings  ',await pg.evaluate("JSON.stringify(SET)"),await pg.evaluate("localStorage.getItem('inkset')"))
        await pg.click('button[data-a=hist]');await pg.wait_for_timeout(200)
        print('history   ',await pg.evaluate("HIST.map(h=>h.text+' '+h.ans)"))
        await pg.screenshot(path='ui_hist.png')
        await pg.click('button[data-a=hopen][data-i="0"]');await pg.wait_for_timeout(2500);print('reopened  ',await st(),errs)
        await pg.screenshot(path='ui_main.png');await b.close()
asyncio.run(main())
