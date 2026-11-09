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
    (r"\frac { \frac { 2 } { 3 } } { \frac { 5 } { 9 } }", "=1.2"),          # a fraction over a fraction
    (r"1 + \frac { 3 } { 2 + \frac { 1 } { 2 } }", "=2.2"),
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
        # nested fractions are laid out stacked: the inner bars sit above / below the outer bar, narrower than it
        geo = await page.evaluate("""t => { const s = [[100, 100, 0], [120, 100, 50]]; s.t0 = 0; s.t1 = 50; const L = {syms: [], ans: [], ink: [s], x0: 0, base: 300, F: 80, at: null};
            lines.push(L); applyReading(L, t.split(' ')); layout(L); const bars = L.syms.filter(g => g.fp == 'bar'); const out = bars.map(g => ({ty: g.ty, w: g.w, nested: !!g.pfid, pfp: g.pfp})); lines.splice(lines.indexOf(L), 1); return out }""",
            r"\frac { \frac { 2 } { 3 } } { \frac { 5 } { 9 } }")
        outer = [g for g in geo if not g["nested"]][0]; above = [g for g in geo if g["pfp"] == "n"][0]; below = [g for g in geo if g["pfp"] == "d"][0]
        assert above["ty"] < outer["ty"] < below["ty"] and above["w"] < outer["w"] and below["w"] < outer["w"], geo
        print("nested fractions stacked: PASS")
        # the board remembers: f(x) = ... above, f(3) below; changing the definition updates the answer below; X ~ B(...) above P(X = 5) below
        board = await page.evaluate("""() => {
            const mk = (t, base) => { const s = [[40, base - 40, 0], [60, base - 40, 50]]; s.t0 = 0; s.t1 = 50; const L = {syms: [], ans: [], ink: [s], x0: 40, base, F: 60, at: null}; lines.push(L); applyReading(L, t.split(' ')); return L };
            lines.length = 0;
            const def = mk('f \\\\left ( x \\\\right ) = { x } ^ { 2 } + 1', 200), call = mk('f \\\\left ( 3 \\\\right )', 400);
            const first = call.at;
            applyReading(def, 'f \\\\left ( x \\\\right ) = 2 x'.split(' '));
            const second = call.at;
            const rv = mk('X \\\\sim B \\\\left ( 1 0 , \\\\frac { 1 } { 2 } \\\\right )', 600), q = mk('P \\\\left ( X = 5 \\\\right )', 800);
            const ode = mk('{ y } ^ { \\\\prime } + 2 y = { e } ^ { x } , y \\\\left ( 0 \\\\right ) = 1', 1000);
            return {first, second, defAns: def.at, prob: q.at, ode: ode.at}; }""")
        assert board["first"] == "=10" and board["second"] == "=6" and board["defAns"] is None, board
        assert board["prob"] == "=0.24609375" and board["ode"].startswith("y="), board
        print("board memory (functions, random variables), probability and ODE on the page: PASS")
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
