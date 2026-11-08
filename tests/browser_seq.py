#!/usr/bin/env python3
"""End-to-end for the stroke-sequence recogniser, on the page exactly as shipped (Settings -> Recogniser -> Sequence).
 1. Token lines (what the model emits) become board glyphs and are evaluated by the same engine as typed input.
 2. Recorded pen strokes (tests/fixtures/seq_strokes.json: synthetic hand, font not used in training) are read by the real model in
    its Web Worker; the ink stays where it was written, the typeset reading and the answer appear below it, and a late stroke
    re-reads the whole line.  Skipped when web/model/seq1.json is not part of the build."""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
PAGE = (ROOT / "android/assets/index.html").as_uri()
FIX = json.loads((ROOT / "tests/fixtures/seq_strokes.json").read_text()) if (ROOT / "tests/fixtures/seq_strokes.json").exists() else None

TOKENS = [
    (r"\frac { 1 } { 2 } + 3", "=3.5"),
    (r"\sqrt { 9 + \sqrt { 9 \times 8 } }", "=≈4.18154055"),                 # two roots closing on the same glyph
    (r"{ 2 } ^ { 3 \times 2 }", "=64"),                                       # a product inside an exponent
    (r"\sin \left ( 0 \right ) + 1", "=1"),
    (r"{ 3 } ^ { - 1 } \times 3", "=1"),
]


async def stroke(page, pts, t0, t1):
    await page.evaluate("t => window.__ck = t", t0)
    await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down()
    for q in pts[1:]: await page.mouse.move(q[0], q[1])
    await page.evaluate("t => window.__ck = t", t1)
    await page.mouse.up(); await page.wait_for_timeout(40)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 800, "height": 700})
        errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
        await page.add_init_script("(() => { const r = performance.now.bind(performance); window.__ck = null; performance.now = () => window.__ck === null ? r() : window.__ck; localStorage.setItem('inkset', JSON.stringify({recogniser: 'seq', fmt: 'dec'})) })()")
        await page.goto(PAGE); await page.locator("#pad").wait_for()
        for latex, want in TOKENS:
            got = await page.evaluate("""t => { const s = [[100, 100, 0], [120, 100, 50]]; s.t0 = 0; s.t1 = 50; const L = {syms: [], ans: [], ink: [s], x0: 0, base: 0, F: 80, at: null};
                lines.push(L); applyReading(L, t.split(' ')); const a = L.at; lines.splice(lines.indexOf(L), 1); return a }""", latex)
            assert got == want, (latex, got, want)
        print("token lines -> glyphs -> engine: PASS")
        if FIX is None or not (ROOT / "web/model/seq1.json").exists():
            print("model read-back: SKIPPED (no model in the build)")
        else:
            await page.evaluate("lines.length = 0; kick()")
            for s in FIX["strokes"][:FIX["first"]]:
                await stroke(page, [(x, y) for x, y, _ in s], s[0][2], s[-1][2])
            await page.evaluate("() => window.__ck = null")
            try:
                await page.wait_for_function("() => lines.length && lines.every(L => L.kidOf || !L.ink.length || L.sk) && !recBusy", timeout=30000)
            except Exception:
                print(await page.evaluate("() => ({dead: swDead, busy: recBusy, lines: lines.map(L => [L.ink.length, L.sk, L.tk, !!L.kidOf])})")); raise
            first = await page.evaluate("() => ({tk: lines[0].tk, at: lines[0].at, ink: lines[0].ink.length, syms: lines[0].syms.length})")
            assert first["tk"] == FIX["tokens_first"] and first["ink"] == FIX["first"], first
            assert first["at"] == FIX["answer_first"], first
            for s in FIX["strokes"][FIX["first"]:]:
                await stroke(page, [(x, y) for x, y, _ in s], s[0][2], s[-1][2])
            await page.evaluate("() => window.__ck = null")
            try:
                await page.wait_for_function("(n) => lines.length && lines.every(L => L.kidOf || !L.ink.length || L.sk) && !recBusy && lines[0].ink.length === n && lines[0].sk && lines[0].sk.startsWith(n + ':')", arg=len(FIX["strokes"]), timeout=40000)
            except Exception:
                print(await page.evaluate("() => lines.map(L => [L.ink.length, L.sk, L.tk, !!L.kidOf])"), len(FIX["strokes"])); raise
            full = await page.evaluate("() => ({tk: lines[0].tk, at: lines[0].at, lines: lines.length})")
            assert full["tk"] == FIX["tokens"] and full["lines"] == 1, full
            assert full["at"] == FIX["answer"], full
            print("pen strokes -> worker model -> reading -> answer, then a late stroke re-reads the line: PASS")
        assert not errors, errors
        await browser.close()
    print("Sequence recogniser end to end: PASS")

asyncio.run(main())
