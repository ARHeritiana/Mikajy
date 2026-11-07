#!/usr/bin/env python3
"""End-to-end: synthetic pen strokes are drawn on the real page; the recogniser, the exponent detection
and the maths engine must turn them into the right answer. Uses the page exactly as shipped."""
import asyncio
import math
from pathlib import Path
from playwright.async_api import async_playwright

PAGE = (Path(__file__).resolve().parents[1] / "android/assets/index.html").as_uri()

def bezier(points, n=14):
    k = len(points) - 1
    return [(sum((1 - u) ** (k - i) * u ** i * math.comb(k, i) * points[i][0] for i in range(k + 1)),
             sum((1 - u) ** (k - i) * u ** i * math.comb(k, i) * points[i][1] for i in range(k + 1)))
            for u in (t / n for t in range(n + 1))]

# Strokes in a unit box (x right, y down); each glyph is a list of strokes.
GLYPHS = {
    "1": [[(.3, .2), (.55, 0), (.55, 1)]],
    "2": [bezier([(0, .2), (.2, -.1), (.9, 0), (.8, .4), (0, 1), (0, 1), (1, 1)], 24)],
    "3": [bezier([(0, .1), (.5, -.1), (.9, .2), (.4, .48)], 12) + bezier([(.4, .48), (1, .6), (.9, 1.05), (0, .9)], 12)],
    "+": [[(0, .5), (1, .5)], [(.5, .1), (.5, .9)]],
    "=": [[(0, .35), (1, .35)], [(0, .65), (1, .65)]],
}

async def write(page, glyphs):
    for ch, x, base, h in glyphs:
        for stroke in GLYPHS[ch]:
            pts = [(x + px * h * .6, base - h + py * h) for px, py in stroke]
            await page.mouse.move(*pts[0])
            await page.mouse.down()
            for p in pts[1:]:
                await page.mouse.move(*p)
            await page.mouse.up()

SCENES = [
    ("2 raised 3 =  (power)", [("2", 100, 300, 100), ("3", 175, 255, 52), ("=", 250, 300, 80)], "8"),
    ("1 + 2 =       (sum)", [("1", 100, 300, 100), ("+", 160, 290, 70), ("2", 250, 300, 100), ("=", 330, 300, 80)], "3"),
]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for name, glyphs, expected in SCENES:
            page = await browser.new_page(viewport={"width": 800, "height": 500})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            await page.goto(PAGE)
            await page.locator("#pad").wait_for()
            await write(page, glyphs)
            answer = None
            for _ in range(40):   # the page's CSP forbids eval, so poll instead of wait_for_function(string)
                answer = await page.evaluate("() => (lines.length && lines[0].at) || null")
                if answer:
                    break
                await page.wait_for_timeout(200)
            assert answer.lstrip("=") == expected, f"{name}: got {answer!r}, expected {expected!r}"
            assert not errors, errors
            await page.close()
        await browser.close()
    print("Handwriting end to end (drawn strokes -> recogniser -> exponent -> answer): PASS")

asyncio.run(main())
