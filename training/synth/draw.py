"""Atoms (placed glyphs, bars, brackets) -> timed pen strokes in pixels, with the writer's habits applied."""
import numpy as np
from .style import smooth_noise


def _length(s): return float(np.hypot(*np.diff(s, axis=0).T).sum())


def atom_strokes(a, wr):
    """Raw strokes of one atom in layout units (x right, y down, baseline 0): list of (array, is_mark)."""
    r = wr.rng
    if a['kind'] == 'glyph':
        g, s = a['glyph'], a['s']
        out = []
        for st in g.strokes:
            p = st * s + np.array([a['x'], a['y']])
            mark = False
            if wr.delay_marks and a['ch'] in ('i', 'j', 't') and len(g.strokes) > 1:
                n = len(g.strokes)
                ext = st.max(axis=0) - st.min(axis=0)
                mark = (a['ch'] in 'ij' and st[:, 1].mean() == min(x[:, 1].mean() for x in g.strokes) and ext[0] < .6) or \
                       (a['ch'] == 't' and ext[0] > ext[1] * 1.5 and n > 1)
            if len(st) > 1 and not mark and r.random() < .06 and a['ch'] not in '+=-':
                p = p[::-1]
            out.append((p, mark))
        return out
    if a['kind'] == 'poly':
        p = np.array(a['pts'], float)
        if a['ch'] in ('(', '[', '|'):                       # tall brackets lean less than the writing itself
            p[:, 0] -= .6 * wr.slant * (-p[:, 1])
        return [(p, False)]
    # straight bar with a slight curve and overshoot
    p0, p1 = np.array([a['x'], a['y']]), np.array([a['x1'], a['y1']])
    n = max(3, int(np.hypot(*(p1 - p0)) / .15))
    t = np.linspace(0, 1, n)[:, None]
    bend = np.array([0, 1.0]) * r.normal(0, .04) * np.sin(np.pi * t)
    ext = (p1 - p0) / max(np.hypot(*(p1 - p0)), 1e-6) * r.uniform(-.03, .08)
    return [(p0 + (p1 - p0 + ext) * t + bend, False)]


def connect(prev, nxt, r):
    """Join the end of one stroke to the start of the next with a smooth ligature (cursive)."""
    a, b = prev[-1], nxt[0]
    d = b - a
    if np.hypot(*d) > 1.2 or np.hypot(*d) < .02:
        return None
    t = np.linspace(0, 1, 8)[1:-1, None]
    mid = (a + b) / 2 + np.array([0, r.uniform(-.2, .25)])
    mid_pts = (1 - t) ** 2 * a + 2 * t * (1 - t) * mid + t ** 2 * b
    return np.vstack([prev, mid_pts, nxt])


def render(atoms, wr, order, origin, t0=0.0):
    """Strokes in writing order. `order` lists atom indices; returns (strokes, end_time).
    A stroke is {'pts': (N,3) [x px, y px, t ms], 'atom': index}."""
    r = wr.rng
    raw, last_of = [], {}
    for idx in order:
        a = atoms[idx]
        pieces = atom_strokes(a, wr)
        join_p = {'print': 0, 'semi': .45, 'cursive': .85}[str(wr.mode)]
        for k, (p, mark) in enumerate(pieces):
            if a.get('join') and k == 0 and not mark and r.random() < join_p:
                prev = last_of.get('word')
                if prev is not None and raw[prev][2] == idx - 1 or (prev is not None and a.get('word') and raw[prev][2] in (idx - 1, idx)):
                    j = connect(raw[prev][0], p, r)
                    if j is not None:
                        raw[prev] = (j, raw[prev][1], idx, raw[prev][3])
                        continue
            raw.append((p, mark, idx, idx))
            if a.get('word') and not mark: last_of['word'] = len(raw) - 1
        if not a.get('word'): last_of.pop('word', None)
    # delayed marks (i-dots, t-bars) go after the rest of their word
    body = [s for s in raw if not s[1]] + [s for s in raw if s[1]]
    strokes, t = [], t0
    ox, oy = origin
    drift = smooth_noise(r, 400, wr.wobble)
    for p, mark, idx, _ in body:
        p = wr.densify(wr.distort(np.asarray(p, float)))
        if len(p) < 2:
            p = np.vstack([p, p + .01])
        X = (p[:, 0] * wr.width + wr.slant * (-p[:, 1]))
        Y = p[:, 1] + np.interp(p[:, 0] * 8 + 200, np.arange(400), drift) + X * wr.tilt
        pts, t_end = wr.timed(np.stack([X, Y], axis=1), t)
        pts[:, 0] = ox + pts[:, 0] * wr.px
        pts[:, 1] = oy + pts[:, 1] * wr.px
        strokes.append({'pts': pts, 'atom': idx})
        t = t_end + wr.pause * r.uniform(.4, 1.6)
    return strokes, t
