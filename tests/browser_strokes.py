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

def zigzag(x0, y0, x1, y1, passes=7):
    """A scribble across the box: the gesture that erases what it covers."""
    pts = []
    for k in range(passes + 1):
        x = x0 + (x1 - x0) * k / passes
        pts += [(x, y0), (x + (x1 - x0) / (2 * passes), y1)]
    return dense(pts, 4)

async def stroke_glyph(page, ch, x, base, h, pause_between=0):
    for k, stroke in enumerate(GLYPHS[ch]):
        if k and pause_between:
            await page.wait_for_timeout(pause_between)
        await pen(page, [(x + px * h * .6, base - h + py * h) for px, py in stroke])

async def answer_of(page):
    for _ in range(40):
        a = await page.evaluate("() => (lines.length && lines[0].at) || null")
        if a:
            return a
        await page.wait_for_timeout(200)
    return None

async def glyphs_of(page):
    return await page.evaluate("() => lines.length ? Ink.text(lines[0].seq) : ''")

PAUSE = 1500   # longer than the recognition delay: what was written is already typeset

async def scene_root_bar_kept(page):
    """A root with a bar, then a pause: the typeset sign keeps its bar; the radicand written under it is covered."""
    hook = root_hook(100, 300, 100)
    top = hook[-1]
    await pen(page, hook + dense([top, (top[0] + 110, top[1])]))
    await page.wait_for_timeout(PAUSE)
    reach = await page.evaluate("() => { const r = lines[0].seq[0]; return (r.tvx - r.tx - .5 * r.tsz) / r.tsz; }")
    assert reach > .5, f"root bar collapsed to {reach:.2f} font sizes before the radicand was written"
    x0 = await page.evaluate("() => { const r = lines[0].seq[0]; return r.tx + .5 * r.tsz; }")
    await stroke_glyph(page, "4", x0 + 10, 295, 70)
    await page.wait_for_timeout(PAUSE)
    await stroke_glyph(page, "=", x0 + 140, 300, 80)
    return "√(4)=", "2"

async def scene_plus_after_pause(page):
    await stroke_glyph(page, "1", 100, 300, 100)
    await stroke_glyph(page, "+", 160, 290, 70, pause_between=PAUSE)
    await page.wait_for_timeout(PAUSE)
    await stroke_glyph(page, "2", 250, 300, 100)
    await stroke_glyph(page, "=", 330, 300, 80)
    return "1+2=", "3"

async def scene_equals_after_pause(page):
    """The second bar of = drawn after a pause, under the typeset first bar (which is what is on screen by then)."""
    await write(page, [("1", 100, 300, 100), ("+", 160, 290, 70), ("2", 250, 300, 100)])
    await pen(page, dense([(330, 248), (378, 248)]))
    await page.wait_for_timeout(PAUSE)
    b = await typeset(page, 3)
    await pen(page, dense([(b["x0"], b["y1"] + 22), (b["x1"], b["y1"] + 22)]))
    return "1+2=", "3"

async def scene_equals_long_after(page):
    """The second bar of = drawn long after the first was read (beyond the reopen window) still completes it."""
    await write(page, [("1", 100, 300, 100), ("+", 160, 290, 70), ("2", 250, 300, 100)])
    await pen(page, dense([(330, 248), (378, 248)]))
    await page.wait_for_timeout(3500)
    b = await typeset(page, 3)
    await pen(page, dense([(b["x0"], b["y1"] + 22), (b["x1"], b["y1"] + 22)]))
    return "1+2=", "3"

async def scene_equals_bars_apart(page):
    """Strokes of one batch are grouped by place, not by order: the top bar of = first, then 1+2, then the bottom bar."""
    await pen(page, dense([(330, 248), (378, 248)]))
    await write(page, [("1", 100, 300, 100), ("+", 160, 290, 70), ("2", 250, 300, 100)])
    await pen(page, dense([(330, 272), (378, 272)]))
    return "1+2=", "3"

async def scene_equals_after_other(page):
    """1+2-3 is typeset; a bar drawn later under the − turns it into =, with the 3 written in between."""
    await write(page, [("1", 100, 300, 100), ("+", 160, 290, 70), ("2", 250, 300, 100)])
    await pen(page, dense([(330, 248), (378, 248)]))
    await page.wait_for_timeout(PAUSE)
    b = await typeset(page, 3)
    await write(page, [("3", b["x1"] + 25, 300, 100)])
    await page.wait_for_timeout(2500)
    b = await typeset(page, 3)
    await pen(page, dense([(b["x0"], b["y1"] + 22), (b["x1"], b["y1"] + 22)]))
    return "1+2=3", None

async def scene_insert_between(page):
    """A + written in the gap between two typeset digits is inserted; neither neighbour is replaced."""
    await write(page, [("1", 100, 300, 100), ("3", 300, 300, 100)])
    await page.wait_for_timeout(PAUSE)
    a, b = await typeset(page, 0), await typeset(page, 1)
    gap = (a["x1"] + b["x0"]) / 2
    await write(page, [("+", gap - 14, a["y1"] - 20, 40)])
    await page.wait_for_timeout(PAUSE)
    b = await page.evaluate("() => lines[0].box")
    await stroke_glyph(page, "=", b["x1"] + 30, b["y1"], 70)
    return "1+3=", "4"

async def scene_dot_long_after(page):
    """A dot put over a typeset stem long after it was read makes an i (not an exponent)."""
    await pen(page, dense([(150, 240), (150, 300)]))
    await page.wait_for_timeout(3500)
    b = await typeset(page, 0)
    cx = (b["x0"] + b["x1"]) / 2
    await pen(page, [(cx, b["y0"] - 14), (cx + 2, b["y0"] - 12)])
    return "i", None

async def scene_erase_one(page):
    """Scribbling over the 2 of 1+2 removes the 2 only, not the + next to it."""
    await write(page, [("1", 100, 300, 100), ("+", 160, 290, 70), ("2", 250, 300, 100)])
    await page.wait_for_timeout(PAUSE)
    box = await page.evaluate("() => nowBox(lines[0].seq[2])")
    await pen(page, zigzag(box["x0"] + 2, box["y0"] + 4, box["x1"] - 2, box["y1"] - 4))
    await page.wait_for_timeout(PAUSE)
    return "1+", None

async def typeset(page, k):
    """Target box of the k-th top-level node of the first line (what the user sees once it settles)."""
    return await page.evaluate(f"() => lines[0].seq[{k}].box")

async def scene_power_later(page):
    """2, pause, then a raised 3 next to the typeset 2."""
    await stroke_glyph(page, "2", 100, 300, 100)
    await page.wait_for_timeout(PAUSE)
    b = await typeset(page, 0)
    h = b["y1"] - b["y0"]
    await stroke_glyph(page, "3", b["x1"] + 8, b["y0"] + .35 * h, .5 * h)
    await page.wait_for_timeout(PAUSE)
    await stroke_glyph(page, "=", b["x1"] + 80, b["y1"], .8 * h)
    return "2³=", "8"

async def scene_append_later(page):
    await write(page, [("1", 100, 300, 100), ("2", 160, 300, 100)])
    await page.wait_for_timeout(PAUSE)
    b = await typeset(page, 1)
    await stroke_glyph(page, "+", b["x1"] + 20, b["y1"] - 10, 70)
    await page.wait_for_timeout(PAUSE)
    b = await typeset(page, 2)
    await write(page, [("3", b["x1"] + 20, 300, 100), ("=", b["x1"] + 100, 300, 80)])
    return "12+3=", "15"

async def scene_fraction(page):
    await stroke_glyph(page, "1", 130, 230, 70)
    await pen(page, dense([(100, 250), (220, 250)]))
    await stroke_glyph(page, "4", 130, 340, 70)
    await stroke_glyph(page, "=", 250, 280, 60)
    return "(1)/(4)=", "0.25"

async def scene_bar_under(page):
    """2+4 is typeset; a bar drawn under it, then a 3 below: (2+4)/3."""
    await write(page, [("2", 100, 300, 90), ("+", 180, 290, 60), ("4", 250, 300, 90)])
    await page.wait_for_timeout(PAUSE)
    b = await page.evaluate("() => lines[0].box")
    await pen(page, dense([(b["x0"] - 5, b["y1"] + 18), (b["x1"] - 40, b["y1"] + 18)]))
    await page.wait_for_timeout(PAUSE)
    bar = await page.evaluate("() => lines[0].seq[0].bar")
    await stroke_glyph(page, "3", (bar["x0"] + bar["x1"]) / 2 - 20, bar["y"] + 85, 70)
    await page.wait_for_timeout(PAUSE)
    bar = await page.evaluate("() => lines[0].seq[0].bar")
    await stroke_glyph(page, "=", bar["x1"] + 30, bar["y"] + 25, 60)
    return "(2+4)/(3)=", "2"

async def scene_root_over(page):
    """A 9 is typeset; a root sign drawn around it takes it as its radicand."""
    await stroke_glyph(page, "9" if "9" in GLYPHS else "4", 200, 300, 90)
    await page.wait_for_timeout(PAUSE)
    b = await typeset(page, 0)
    h = b["y1"] - b["y0"]
    hook = root_hook(b["x0"] - 70, b["y1"] + 5, h + 30)
    top = hook[-1]
    await pen(page, hook + dense([top, (b["x1"] + 25, top[1])]))
    await page.wait_for_timeout(PAUSE)
    b = await page.evaluate("() => lines[0].box")
    await stroke_glyph(page, "=", b["x1"] + 30, b["y1"], 70)
    return "√(4)=", "2"

async def scene_erase_sign(page):
    """Scribbling over the + of 1+2 leaves 12."""
    await write(page, [("1", 100, 300, 100), ("+", 160, 290, 70), ("2", 250, 300, 100)])
    await page.wait_for_timeout(PAUSE)
    box = await page.evaluate("() => nowBox(lines[0].seq[1])")
    cx, cy = (box["x0"] + box["x1"]) / 2, (box["y0"] + box["y1"]) / 2
    await pen(page, zigzag(cx - 12, cy - 16, cx + 12, cy + 16, 5))
    await page.wait_for_timeout(PAUSE)
    return "12", None

async def scene_erase_root_sign(page):
    """Scribbling over a root sign keeps what was under it."""
    await root(page, "one stroke, long bar")
    await page.wait_for_timeout(PAUSE)
    r = await page.evaluate("() => { const r = lines[0].seq[0]; return [r.tx, r.ttop, r.tx + .5 * r.tsz, r.ty]; }")
    await pen(page, zigzag(r[0] + 2, r[1] + 20, r[2], r[3] - 4, 4))
    await page.wait_for_timeout(PAUSE)
    return "4", None

EDIT_SCENES = [("exponent written later", scene_power_later), ("terms appended later", scene_append_later),
               ("fraction", scene_fraction), ("bar drawn under an expression", scene_bar_under),
               ("root drawn around a number", scene_root_over), ("erase an operator", scene_erase_sign),
               ("erase a root sign", scene_erase_root_sign),
               ("root keeps its bar", scene_root_bar_kept), ("+ written with a pause", scene_plus_after_pause),
               ("= written with a pause", scene_equals_after_pause), ("erase one symbol", scene_erase_one),
               ("= completed long after", scene_equals_long_after), ("= bars drawn apart", scene_equals_bars_apart),
               ("= completed after the next term", scene_equals_after_other), ("+ inserted between digits", scene_insert_between),
               ("dot of i added long after", scene_dot_long_after)]

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
            glyphs = await page.evaluate("() => Ink.text(lines[0].seq)")
            assert answer and answer.lstrip("=") == "2" and glyphs.startswith("√(4)"), f"root ({style}): read {glyphs!r} = {answer!r}"
            assert not errors, errors
            await page.close()
        for name, scene in EDIT_SCENES:   # editing: pauses inside a symbol, root bars, erasing
            page = await browser.new_page(viewport={"width": 800, "height": 500})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            await page.goto(PAGE)
            await page.locator("#pad").wait_for()
            want_glyphs, want = await scene(page)
            await page.wait_for_timeout(PAUSE)   # let the last strokes be read
            answer = await answer_of(page) if want else None
            glyphs = await glyphs_of(page)
            assert glyphs == want_glyphs, f"{name}: read {glyphs!r}, expected {want_glyphs!r}"
            if want:
                assert answer and answer.lstrip("=") == want, f"{name}: got {answer!r}, expected {want!r}"
            assert not errors, errors
            await page.close()
        await browser.close()
    print("Handwriting end to end (drawn strokes -> recogniser -> exponent / root -> answer): PASS")

if __name__ == "__main__":
    asyncio.run(main())
