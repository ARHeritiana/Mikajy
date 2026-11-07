"""A simulated writer: one consistent hand (font family, slant, size, speed, habits) that turns atoms into timed pen strokes."""
import math
import numpy as np

MODES = ('print', 'semi', 'cursive')


def smooth_noise(rng, n, scale, k=6):
    """Low-frequency noise of length n (smooth wobble)."""
    knots = rng.normal(0, 1, max(2, n // k + 2))
    return np.interp(np.linspace(0, len(knots) - 1, n), np.arange(len(knots)), knots) * scale


class Writer:
    def __init__(self, rng, bank):
        self.rng, self.bank = rng, bank
        self.mode = rng.choice(MODES, p=[.4, .3, .3])
        self.slant = float(np.clip(rng.normal(0.12, 0.22), -0.35, 0.75))          # shear (tan of angle)
        self.px = float(rng.uniform(22, 58))                                       # pixels per x-height
        self.width = float(rng.uniform(.8, 1.3))
        self.size_jitter = float(rng.uniform(.02, .12))
        self.wobble = float(rng.uniform(0, .07))                                   # baseline wobble (x-heights)
        self.tremor = float(rng.uniform(0, .012))
        self.warp = float(rng.uniform(0, .05))
        self.speed = float(rng.uniform(.8, 3.5))                                   # x-heights per 100 ms
        self.pause = float(rng.uniform(60, 400))                                   # ms between strokes
        self.delay_marks = bool(rng.random() < .5)                                 # i-dots / t-bars after the word
        self.bar_first = bool(rng.random() < .35)                                  # fraction bar before numerator
        self.fonts = list(rng.choice(bank.fonts, size=min(2, len(bank.fonts)), replace=False))
        self.sym_font = {}                                                         # a writer keeps one hand per symbol class
        self.tilt = float(rng.normal(0, .02))                                      # line slope

    def font_for(self, text):
        ok = [f for f in self.fonts if self.bank.has(f, text)] or self.bank.candidates(text)
        if not ok:
            return None
        key = tuple(sorted(set(text)))
        if key not in self.sym_font or self.sym_font[key] not in ok:
            self.sym_font[key] = ok[0] if self.rng.random() < .85 else ok[self.rng.integers(len(ok))]
        return self.sym_font[key]

    def summary(self):
        return {'mode': str(self.mode), 'slant': round(self.slant, 3), 'px': round(self.px, 1), 'fonts': [f.split('/')[-1][:-4] for f in self.fonts]}

    # ---- geometry helpers ----
    def distort(self, pts):
        """Per-glyph elastic warp and tremor on (N,2) points in x-height units."""
        r = self.rng
        if self.warp > 0 and len(pts) > 3:
            pts = pts + np.stack([smooth_noise(r, len(pts), self.warp), smooth_noise(r, len(pts), self.warp)], axis=1)
        if self.tremor > 0:
            pts = pts + r.normal(0, self.tremor, pts.shape)
        return pts

    def densify(self, pts, step=.07):
        d = np.hypot(*np.diff(pts, axis=0).T)
        s = np.concatenate([[0], np.cumsum(d)])
        if s[-1] < 1e-6:
            return pts
        n = max(2, int(s[-1] / step) + 1)
        t = np.linspace(0, s[-1], n)
        out = np.stack([np.interp(t, s, pts[:, 0]), np.interp(t, s, pts[:, 1])], axis=1)
        if len(out) > 4:                                                           # round the polygon corners left by simplification
            k = np.array([.25, .5, .25])
            inner = np.stack([np.convolve(out[:, c], k, mode='same') for c in (0, 1)], axis=1)
            out[1:-1] = inner[1:-1]
        return out

    def timed(self, pts, t0):
        """Add timestamps with a bell-shaped speed profile; returns ((N,3) array, end time)."""
        d = np.hypot(*np.diff(pts, axis=0).T) if len(pts) > 1 else np.array([.01])
        base = self.speed * self.rng.uniform(.7, 1.3) / 100.0                      # x-heights per ms
        u = np.linspace(0, 1, len(d))
        v = base * (.45 + .55 * np.sin(np.pi * u) ** .7 + 1e-3)
        dt = d / v
        t = t0 + np.concatenate([[0], np.cumsum(dt)])
        return np.column_stack([pts, t]), float(t[-1])
