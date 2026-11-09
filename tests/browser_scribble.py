#!/usr/bin/env python3
"""A zigzag scribbled over a finished reading (sequence recogniser) erases the line."""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
FIX=json.loads((ROOT/'tests/fixtures/seq_strokes.json').read_text())
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True); pg=await b.new_page(viewport={"width":800,"height":700})
        await pg.add_init_script("localStorage.setItem('inkset', JSON.stringify({recogniser:'seq', fmt:'dec'}))")
        await pg.goto((ROOT/'android/assets/index.html').as_uri()); await pg.locator('#pad').wait_for()
        async def stroke(pts):
            await pg.mouse.move(*pts[0]); await pg.mouse.down()
            for q in pts[1:]: await pg.mouse.move(*q, steps=6)
            await pg.mouse.up(); await pg.wait_for_timeout(40)
        for s in FIX['strokes']: await stroke([(x,y) for x,y,_ in s])
        await pg.wait_for_function("() => lines.length && lines.every(L=>L.sk||!L.ink.length)&&!recBusy",timeout=40000)
        bb=await pg.evaluate("()=>{const q=lines[0].ink.map(bb);return [Math.min(...q.map(a=>a.x0)),Math.min(...q.map(a=>a.y0)),Math.max(...q.map(a=>a.x1)),Math.max(...q.map(a=>a.y1))]}")
        x0,y0,x1,y1=bb
        n=16; pts=[(x0+(x1-x0)*i/n, y0-6 if i%2==0 else y1+6) for i in range(n+1)]
        await stroke(pts); await pg.wait_for_timeout(600)
        left = await pg.evaluate("() => lines.length"); assert left == 0, left
        print('Scribble over a finished reading erases the line: PASS')
        await b.close()
asyncio.run(main())
