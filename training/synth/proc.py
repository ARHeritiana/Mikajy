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
