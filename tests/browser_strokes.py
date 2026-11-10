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
    "4": [[(.7, 0), (0, .65), (1, .65)], [(.7, 0), (.7, 1)]],
}

def dense(points, per=8):
    out = []
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        out += [(ax + (bx - ax) * j / per, ay + (by - ay) * j / per) for j in range(per)]
    return out + [points[-1]]

def root_hook(x, base, h):
    """Tick, down-stroke, rise: a root sign without its bar."""
    return dense([(x, base - .4 * h), (x + .12 * h, base - .48 * h), (x + .3 * h, base), (x + .55 * h, base - h)])

async def pen(page, pts):
    await page.mouse.move(*pts[0])
    await page.mouse.down()
    for p in pts[1:]:
        await page.mouse.move(*p)
    await page.mouse.up()

async def write(page, glyphs):
    for ch, x, base, h in glyphs:
        for stroke in GLYPHS[ch]:
            pts = [(x + px * h * .6, base - h + py * h) for px, py in stroke]
            await page.mouse.move(*pts[0])
            await page.mouse.down()
            for p in pts[1:]:
                await page.mouse.move(*p)
            await page.mouse.up()

async def root(page, style):
    """sqrt(4) = written the ways people really write a root sign. The radicand sits under the bar (y 200)."""
    hook = root_hook(100, 300, 100)
    top = hook[-1]
    if style == "one stroke, long bar":
        await pen(page, hook + dense([top, (top[0] + 110, top[1])]))
    elif style == "one stroke, short bar":
        await pen(page, hook + dense([top, (top[0] + 45, top[1])]))
    elif style == "one stroke, slanted bar":
        await pen(page, hook + dense([top, (top[0] + 110, top[1] - 14)]))
    elif style == "hook, then bar":
        await pen(page, hook)
        await pen(page, dense([(top[0] + 4, top[1] + 1), (top[0] + 110, top[1] + 1)]))
    elif style == "tick+down, then rise+bar":
        await pen(page, dense([(100, 260), (112, 252), (130, 300)]))
        await pen(page, dense([(130, 300), top, (top[0] + 100, top[1])]))
    elif style == "bar after a pause":
        await pen(page, hook)
        await page.wait_for_timeout(1500)   # longer than the recognition delay: the sign is already recognised
        await pen(page, dense([(top[0] + 4, top[1] + 1), (top[0] + 110, top[1] + 1)]))
    await write(page, [("4", 175, 295, 70)])

ROOT_STYLES = ["one stroke, long bar", "one stroke, short bar", "one stroke, slanted bar", "hook, then bar",
               "tick+down, then rise+bar", "bar after a pause"]

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
        for style in ROOT_STYLES:   # a root sign must be read as one, whatever the hand
            page = await browser.new_page(viewport={"width": 800, "height": 500})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            await page.goto(PAGE)
            await page.locator("#pad").wait_for()
            await root(page, style)
            await write(page, [("=", 300, 300, 80)])
            answer = None
            for _ in range(40):
                answer = await page.evaluate("() => (lines.length && lines[0].at) || null")
                if answer:
                    break
                await page.wait_for_timeout(200)
            glyphs = await page.evaluate("() => lines[0].syms.map(g => g.c[g.i].c).join('')")
            assert answer and answer.lstrip("=") == "2" and glyphs.startswith("√4"), f"root ({style}): read {glyphs!r} = {answer!r}"
            assert not errors, errors
            await page.close()
        # Recognition must remain revisable AFTER the 650 ms timeout.
        page = await browser.new_page(viewport={"width": 800, "height": 500})
        await page.goto(PAGE)
        await pen(page, dense([(120, 250), (175, 250)]))
        await page.wait_for_timeout(1500)
        early = await page.evaluate("() => lines[0]?.syms.length || 0")
        assert early == 1, f"First bar not recognized as one glyph: {early}"
        await pen(page, dense([(120, 270), (175, 270)]))
        await page.wait_for_timeout(1500)
        recovered = await page.evaluate("""() => lines[0]?.syms.map(g => ({
            originalStrokes: g.raw?.length || 0, type: g.c[g.i].c
        })) || []""")
        assert len(recovered) == 1 and recovered[0]["originalStrokes"] == 2, (
            f"Late second stroke must revise a single glyph: {recovered}"
        )
        await page.close()

        # When a term is written between two already typeset terms, neither neighbor is deleted.
        page = await browser.new_page(viewport={"width": 800, "height": 500})
        await page.goto(PAGE)
        await write(page, [("1", 110, 300, 75), ("3", 320, 300, 75)])
        await page.wait_for_timeout(1700)
        await write(page, [("2", 210, 300, 75)])
        await page.wait_for_timeout(1700)
        positions = await page.evaluate("""() => lines[0]?.syms
            .filter(g => !g.fp).map(g => (g.b.x0 + g.b.x1) / 2) || []""")
        assert len(positions) == 3 and positions == sorted(positions), (
            f"Mid-line insertion must preserve all three glyphs in their spatial order: {positions}"
        )
        await page.close()
        await browser.close()
    print("Handwriting end to end (drawn strokes -> recogniser -> exponent / root -> answer): PASS")

asyncio.run(main())
