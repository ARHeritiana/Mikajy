#!/usr/bin/env python3
"""Tap-to-correct for the sequence recogniser: the reading offers the model's runner-up tokens; tapping a glyph swaps in the next one, re-lays the
reading out and re-answers it without recognising again."""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
FIX = json.loads((ROOT / "tests/fixtures/seq_strokes.json").read_text()) if (ROOT / "tests/fixtures/seq_strokes.json").exists() else None


async def main():
    if FIX is None or not (ROOT / "web/model/seq1.json").exists():
        print("tap-to-correct: SKIPPED (no model in the build)"); return
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True); pg = await b.new_page(viewport={"width": 800, "height": 700})
        await pg.add_init_script("localStorage.setItem('inkset', JSON.stringify({recogniser: 'seq', fmt: 'dec'}))")
        await pg.goto((ROOT / "android/assets/index.html").as_uri()); await pg.locator("#pad").wait_for()
        async def stroke(pts):
            await pg.mouse.move(*pts[0]); await pg.mouse.down()
            for q in pts[1:]: await pg.mouse.move(*q)
            await pg.mouse.up(); await pg.wait_for_timeout(40)
        for s in FIX["strokes"]: await stroke([(x, y) for x, y, _ in s])
        await pg.wait_for_function("() => lines.length && lines.every(L => L.sk || !L.ink.length) && !recBusy && lines[0].syms.length", timeout=60000)
        await pg.evaluate("""() => { const L = lines[0], i = L.toks.findIndex(t => /^[0-9]$/.test(t)), alts = L.toks.map(() => []);   // the model may be sure of everything: offer a runner-up
            alts[i] = [{t: L.toks[i] === '8' ? '3' : '8', p: .3}]; L.tk = ''; applyReading(L, L.toks, alts); }""")
        info = await pg.evaluate("""() => { const L = lines[0]; const g = L.syms.find(g => g.ti !== undefined && g.c.length > 1);
            if (!g) return null; const bx = gbox(g); return {tk: L.tk, ti: g.ti, alts: g.c.map(c => c.tok), x: (bx.x0 + bx.x1) / 2 * V.k + V.x, y: (bx.y0 + bx.y1) / 2 * V.k + V.y}; }""")
        assert info and len(info["alts"]) > 1, info
        await pg.mouse.click(info["x"], info["y"]); await pg.wait_for_timeout(500)
        after = await pg.evaluate("() => ({tk: lines[0].tk, at: lines[0].at})")
        assert after["tk"] != info["tk"], (info, after)
        want = info["tk"].split(" "); want[info["ti"]] = info["alts"][1]
        assert after["tk"] == " ".join(want), (info, after)
        print("Tap-to-correct (runner-up token swapped in, reading and answer redone): PASS")
        await b.close()
asyncio.run(main())
