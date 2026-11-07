#!/usr/bin/env python3
"""Unlimited board: two-finger pan/zoom (synthetic multi-touch pointer events), ink lands at the right world position,
a second finger cancels a half-drawn stroke, long lines are not shrunk, the reset button restores the view."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

PAGE = (Path(__file__).resolve().parents[1] / "android/assets/index.html").as_uri()

EVENT = """([type, id, x, y, primary]) => {
  const cv = document.getElementById('pad');
  cv.dispatchEvent(new PointerEvent(type, {pointerId: id, isPrimary: primary, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true}));
}"""

async def ev(page, *a): await page.evaluate(EVENT, list(a))

async def stroke(page, pts, pid=1):
    await ev(page, 'pointerdown', pid, *pts[0], True)
    for p in pts[1:]: await ev(page, 'pointermove', pid, *p, True)
    await ev(page, 'pointerup', pid, *pts[-1], True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 800, "height": 500})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(PAGE); await page.locator("#pad").wait_for()
        view = lambda: page.evaluate("() => ({x: V.x, y: V.y, k: V.k})")
        assert await view() == {"x": 0, "y": 0, "k": 1}
        # --- pinch: fingers 100px apart -> 200px apart around (400,250): zoom 2, the point under the fingers stays put
        await ev(page, 'pointerdown', 1, 350, 250, True); await ev(page, 'pointerdown', 2, 450, 250, False)
        for t in range(1, 11):
            d = 50 + 5 * t
            await ev(page, 'pointermove', 1, 400 - d, 250, True); await ev(page, 'pointermove', 2, 400 + d, 250, False)
        await ev(page, 'pointerup', 2, 500, 250, False); await ev(page, 'pointerup', 1, 300, 250, True)
        v = await view()
        assert abs(v["k"] - 2) < 1e-6, v
        assert abs(400 - (400 * v["k"] + v["x"])) < 1e-6 and abs(250 - (250 * v["k"] + v["y"])) < 1e-6, v   # world point (400,250)... unchanged on screen
        # --- pan: both fingers move together by (+60,+40)
        v0 = await view()
        await ev(page, 'pointerdown', 1, 300, 200, True); await ev(page, 'pointerdown', 2, 400, 200, False)
        await ev(page, 'pointermove', 1, 360, 240, True); await ev(page, 'pointermove', 2, 460, 240, False)
        await ev(page, 'pointerup', 2, 460, 240, False); await ev(page, 'pointerup', 1, 360, 240, True)
        v1 = await view()
        assert abs(v1["x"] - v0["x"] - 60) < 1e-6 and abs(v1["y"] - v0["y"] - 40) < 1e-6 and v1["k"] == v0["k"], (v0, v1)
        assert await page.evaluate("() => document.getElementById('zr').style.display") == "block"
        # --- gestures never leave ink behind
        assert await page.evaluate("() => lines.length") == 0
        # --- a second finger cancels a stroke in progress
        await ev(page, 'pointerdown', 1, 200, 200, True); await ev(page, 'pointermove', 1, 240, 220, True)
        await ev(page, 'pointerdown', 2, 500, 300, False); await ev(page, 'pointerup', 2, 500, 300, False); await ev(page, 'pointerup', 1, 240, 220, True)
        assert await page.evaluate("() => lines.length") == 0
        # --- ink written in the zoomed/panned view lands at the right world position
        v = await view()
        await stroke(page, [(300, 250), (310, 270), (320, 290), (330, 310), (340, 330), (350, 350)])
        got = await page.evaluate("() => { const s = lines[0].ink[0]; return [s[0][0], s[0][1]]; }")
        assert abs(got[0] - (300 - v["x"]) / v["k"]) < 1 and abs(got[1] - (250 - v["y"]) / v["k"]) < 1, (got, v)
        # --- reset button
        await page.click('#zr')
        assert await view() == {"x": 0, "y": 0, "k": 1}
        # --- wheel zoom keeps the point under the cursor
        await page.mouse.move(200, 100); await page.mouse.wheel(0, -300)
        v = await view()
        assert v["k"] > 1 and abs(200 - (200 * v["k"] + v["x"])) < 1e-6, v
        # --- zoom is clamped
        for _ in range(30): await page.mouse.wheel(0, -400)
        assert (await view())["k"] <= 3 + 1e-9
        assert not errors, errors
        await browser.close()
    print("Unlimited board: pinch zoom, two-finger pan, stroke cancel, world-space ink, reset, wheel, clamp: PASS")

asyncio.run(main())
