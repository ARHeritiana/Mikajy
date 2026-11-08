"""Procedural pen strokes for glyphs the font tracer gets "wrong" for real hands (units: x-height = 1, y DOWN, baseline y = 0, like glyphs.Glyph).
 nine():   a 9 written the usual way: start at the top of the circle, curve round and back to the top, then the tail down (one stroke or two);
           a few come out bottom-up or clockwise, so the model sees every habit.
 x_arcs(): the variable x written as two arcs back to back, ")(" , i.e. a mirrored c and a c side by side (never used for the times sign)."""
import numpy as np
from .glyphs import Glyph


def _smooth(rng, n, amp, k=5):
    z = rng.normal(0, amp, (n, 2)); w = np.ones(k) / k
    return np.stack([np.convolve(np.pad(z[:, i], k, mode='edge'), w, 'same')[k:-k] for i in range(2)], 1)


def nine(rng):
    rx, ry = rng.uniform(.24, .33), rng.uniform(.30, .38)
    cx, cy = rx + .05, -1.30 + ry + .02
    ccw = rng.random() < .72                                  # visually counter-clockwise: the pen goes left first
    a0 = -np.pi / 2 + rng.uniform(-.45, .45)
    sweep = (2 * np.pi + rng.uniform(-.1, .6)) * (-1 if ccw else 1)
    th = a0 + np.linspace(0, sweep, 36)
    loop = np.stack([cx + rx * np.cos(th), cy + ry * np.sin(th)], 1)
    t = np.linspace(0, 1, 16)[:, None]
    top = loop[-1]
    lean, hook = rng.uniform(-.12, .08), rng.uniform(0, .12)
    ex, ey = cx + rx + lean, -rng.uniform(.0, .07)            # where the tail ends
    side = np.array([cx + rx, cy])
    tail = (1 - t) ** 2 * top + 2 * (1 - t) * t * side + t ** 2 * np.array([ex, ey])
    tail[:, 0] -= hook * np.clip((t[:, 0] - .65) / .35, 0, 1) ** 1.5
    loop = loop + _smooth(rng, len(loop), .012); tail = tail + _smooth(rng, len(tail), .012)
    r = rng.random()
    if r < .55: strokes = [np.vstack([loop, tail])]           # top, circle, tail: one stroke
    elif r < .92: strokes = [loop, tail]                      # circle, then the tail from its top-right
    else: strokes = [loop, tail[::-1]]                        # rare: tail written bottom-up
    return Glyph(strokes, cx + rx + .38)


def x_arcs(rng):
    h = rng.uniform(.78, .95); w = rng.uniform(.17, .28); g = rng.uniform(-.02, .12)
    t = np.linspace(0, 1, 18)
    bulge = np.sin(np.pi * t) ** rng.uniform(.7, 1.0)
    ys = -h + h * t * .96 - .02
    left = np.stack([w * bulge * rng.uniform(.8, 1.1), ys], 1)                  # ")" : the mirrored c
    x0 = w + g
    right = np.stack([x0 + w - w * bulge * rng.uniform(.8, 1.1), ys], 1)       # "(" : the c
    for s in (left, right): s += _smooth(rng, len(s), .01)
    if rng.random() < .1: left = left[::-1]
    if rng.random() < .1: right = right[::-1]
    strokes = [left, right] if rng.random() < .8 else [right, left]
    return Glyph(strokes, x0 + w + .2)


# ---- continental / school digit habits (the owner writes: a 7 with a crossbar, a 1 with a long flag, an open 4) ----
def _bez(p0, p1, p2, n=14):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * np.asarray(p0, float) + 2 * (1 - t) * t * np.asarray(p1, float) + t ** 2 * np.asarray(p2, float)


def _line(a, b, n=10):
    t = np.linspace(0, 1, n)[:, None]
    return np.asarray(a, float) * (1 - t) + np.asarray(b, float) * t


def _wob(rng, strokes, amp=.012):
    return [s + _smooth(rng, len(s), amp) for s in strokes]


def one(rng):
    """1 with a long flag. Mostly one stroke: from the foot of the flag up to the apex, then straight (or slightly curved) down; sometimes stem first,
    flag second; sometimes with a foot bar."""
    top, w = -rng.uniform(1.25, 1.38), rng.uniform(.5, .7)
    ax, flag_y = w * rng.uniform(.55, .8), top + rng.uniform(.28, .5)
    flag_x = rng.uniform(0, .25) * w
    stem_end = (ax + rng.uniform(-.06, .08), -rng.uniform(.0, .06))
    flag = _line((flag_x, flag_y), (ax, top), 8)
    stem = _bez((ax, top), (ax + rng.uniform(-.04, .05), top / 2), stem_end, 14)
    r = rng.random()
    if r < .55: strokes = [np.vstack([flag, stem[1:]])]
    elif r < .8: strokes = [stem, flag[::-1][::-1]] if rng.random() < .5 else [flag, stem]
    else: strokes = [np.vstack([stem[::-1], flag[::-1][1:]])] if False else [stem, _line((ax - .3 * w, flag_y + .05), (ax, top), 8)]
    if rng.random() < .15: strokes.append(_line((ax - .3 * w, -.02), (ax + .3 * w, -.02), 8))      # foot bar
    return Glyph(_wob(rng, strokes), ax + .45)


def seven(rng):
    """7 with a crossbar through the stem (continental); the top bar and the diagonal in one stroke or two."""
    top, w = -rng.uniform(1.25, 1.36), rng.uniform(.55, .72)
    tl, tr = (rng.uniform(0, .08), top + rng.uniform(0, .05)), (w, top + rng.uniform(-.03, .06))
    foot = (w * rng.uniform(.2, .45), -rng.uniform(0, .05))
    diag = _bez(tr, ((tr[0] + foot[0]) / 2 + rng.uniform(-.05, .1), (top + foot[1]) / 2), foot, 14)
    bar = _line(tl, tr, 10)
    my = top * rng.uniform(.38, .55)                                           # the crossbar sits around the middle of the stem
    mx = tr[0] + (foot[0] - tr[0]) * (my - tr[1]) / (foot[1] - tr[1])
    cross = _line((mx - rng.uniform(.18, .3) * w, my + rng.uniform(-.03, .03)), (mx + rng.uniform(.18, .3) * w, my + rng.uniform(-.03, .03)), 8)
    strokes = [np.vstack([bar, diag[1:]]) if rng.random() < .6 else bar, cross] if True else None
    if len(strokes[0]) == len(bar): strokes = [bar, diag, cross]
    if rng.random() < .15: strokes = strokes[:-1]                              # not everybody crosses it
    if rng.random() < .2: strokes = strokes[::-1] if len(strokes) < 3 else strokes
    return Glyph(_wob(rng, strokes), w + .4)


def four(rng):
    """Open 4 (diagonal down to the left, across to the right as one stroke, then the stem) or the closed font-like 4."""
    top, w = -rng.uniform(1.25, 1.36), rng.uniform(.62, .78)
    sx = w * rng.uniform(.62, .78)                                              # the stem
    my = -rng.uniform(.38, .5)
    left = (rng.uniform(0, .08) * w, my)
    apex = (sx + rng.uniform(-.05, .02), top)
    diag = _line(apex, left, 10); across = _line(left, (w * rng.uniform(.95, 1.08), my + rng.uniform(-.03, .03)), 10)
    stem = _line((sx + rng.uniform(-.02, .03), top + rng.uniform(.0, .15)), (sx + rng.uniform(-.03, .03), -rng.uniform(0, .05)), 12)
    r = rng.random()
    if r < .5: strokes = [np.vstack([diag, across[1:]]), stem]                  # open 4: two strokes
    elif r < .8: strokes = [diag, across, stem]
    else: strokes = [np.vstack([stem[::-1], diag[::-1][1:], across[1:]])] if False else [np.vstack([diag, across[1:]]), stem[::-1]]
    return Glyph(_wob(rng, strokes), w + .4)


def two(rng):
    """2: round top, diagonal, flat base; occasionally with a little loop at the bottom left."""
    w, top = rng.uniform(.55, .7), -rng.uniform(1.25, 1.36)
    rx, ry = w * .5 * rng.uniform(.8, 1.05), rng.uniform(.28, .38)
    th = np.linspace(np.pi * rng.uniform(1.0, 1.2), np.pi * rng.uniform(-.1, .1) + 0, 16)       # over the top, left to right
    arc = np.stack([w * .5 + rx * np.cos(th), top + ry + ry * np.sin(th) * -1], 1)
    arc[:, 1] = top + ry - ry * np.sin(th)
    end = (w * rng.uniform(0, .12), -rng.uniform(0, .04))
    diag = _bez(arc[-1], (arc[-1][0] - .05, (arc[-1][1] + end[1]) / 2 + .1), end, 12)
    base = _line(end, (w * rng.uniform(.95, 1.1), end[1] + rng.uniform(-.02, .02)), 10)
    if rng.random() < .3:
        loop = np.stack([end[0] + .08 * np.cos(np.linspace(0, 2 * np.pi, 12)) - .02, end[1] - .1 + .08 * np.sin(np.linspace(0, 2 * np.pi, 12))], 1)
        strokes = [np.vstack([arc, diag[1:], loop, base[1:]])]
    else: strokes = [np.vstack([arc, diag[1:]]), base] if rng.random() < .35 else [np.vstack([arc, diag[1:], base[1:]])]
    return Glyph(_wob(rng, strokes), w + .4)


def three(rng):
    """3 with two round bumps, or the flat-topped one."""
    w, top = rng.uniform(.5, .66), -rng.uniform(1.25, 1.36)
    mid = top / 2 + rng.uniform(-.04, .04)
    if rng.random() < .3:                                                       # flat top: bar, diagonal, lower bump
        bar = _line((0, top), (w * .9, top + rng.uniform(-.03, .03)), 8)
        diag = _line(bar[-1], (w * .35, mid), 8)
        bump = _bez((w * .35, mid), (w * 1.25, mid + .05), (w * .1, -rng.uniform(.0, .05)), 16)
        strokes = [np.vstack([bar, diag[1:], bump[1:]])]
    else:
        up = _bez((w * .05, top + .2), (w * .5, top - .12), (w * .75, top + .3), 12)
        up2 = _bez(up[-1], (w * .75, mid - .05), (w * .3, mid), 10)
        low = _bez(up2[-1], (w * 1.2, mid + .1), (w * .85, -.45), 12)
        low2 = _bez(low[-1], (w * .6, .1), (w * .02, -.12), 12)
        strokes = [np.vstack([up, up2[1:], low[1:], low2[1:]])]
    return Glyph(_wob(rng, strokes), w + .4)


def five(rng):
    """5: the top bar first or last; belly in one stroke."""
    w, top = rng.uniform(.52, .68), -rng.uniform(1.25, 1.36)
    bar = _line((w * .85, top), (w * .18, top + rng.uniform(-.02, .03)), 8) if rng.random() < .5 else _line((w * .2, top), (w * .88, top), 8)
    stem = _line((w * .18, top), (w * .1, top * .52), 8)
    belly = _bez((w * .1, top * .52), (w * 1.35, top * .55), (w * .75, -.4), 16)
    foot = _bez(belly[-1], (w * .5, .08), (w * .0, -.2), 12)
    body = np.vstack([stem, belly[1:], foot[1:]])
    strokes = [bar, body] if rng.random() < .5 else [body, bar]
    return Glyph(_wob(rng, strokes), w + .4)


def zero(rng):
    """0 from the top, counter-clockwise (usual) or clockwise, closing near the start."""
    rx, ry = rng.uniform(.26, .34), rng.uniform(.58, .66)
    cx, cy = rx + .04, -ry - .03
    a0 = -np.pi / 2 + rng.uniform(-.4, .4); sw = (2 * np.pi + rng.uniform(-.15, .45)) * (-1 if rng.random() < .75 else 1)
    th = a0 + np.linspace(0, sw, 30)
    return Glyph(_wob(rng, [np.stack([cx + rx * np.cos(th), cy + ry * np.sin(th)], 1)]), 2 * rx + .45)


HABITS = {'1': (one, .5), '7': (seven, .55), '4': (four, .5), '2': (two, .25), '3': (three, .2), '5': (five, .3), '0': (zero, .15)}
