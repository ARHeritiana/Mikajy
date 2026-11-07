"""Stroke featurisation shared by corpus generation, training, evaluation (and mirrored line by line in web/seq-core.js).
A sample is a list of strokes, each a list of [x, y, t_ms].  Every stroke is resampled to K points by arc length;
coordinates are normalised per sample (origin = top-left of the ink, unit = median stroke extent)."""
import numpy as np
import re

K = 24
TOKEN_RE = re.compile(r'\\\\|\\[A-Za-z]+|[^\s]')


def tokenize(lines):
    out = []
    for i, l in enumerate(lines):
        if i: out.append('<nl>')
        out += TOKEN_RE.findall(l)
    return out


def resample(pts, k=K):
    p = np.asarray(pts, dtype=np.float64)[:, :2]
    if len(p) == 1:
        return np.repeat(p, k, axis=0)
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    if d[-1] < 1e-6:
        return np.repeat(p[:1], k, axis=0)
    u = np.linspace(0, d[-1], k)
    return np.stack([np.interp(u, d, p[:, 0]), np.interp(u, d, p[:, 1])], 1)


def featurise(strokes):
    """-> (pts [S,K,2] float32 normalised, time [S,3] float32: log gap since previous stroke end, log duration, start rank fraction)"""
    rs = [resample(s['pts'] if isinstance(s, dict) else s) for s in strokes]
    raw = [np.asarray(s['pts'] if isinstance(s, dict) else s, dtype=np.float64) for s in strokes]
    P = np.stack(rs)
    mn = P.reshape(-1, 2).min(0)
    ext = np.maximum(P.max(1) - P.min(1), 1e-3).max(1)
    unit = max(float(np.median(ext)), 4.0)
    P = (P - mn) / unit
    t0 = np.array([r[0, 2] for r in raw]); t1 = np.array([r[-1, 2] for r in raw])
    gap = np.r_[0, np.maximum(t0[1:] - t1[:-1], 0)]
    T = np.stack([np.log1p(gap / 100.0), np.log1p(np.maximum(t1 - t0, 0) / 100.0), np.arange(len(raw)) / max(len(raw) - 1, 1)], 1)
    return P.astype(np.float32), T.astype(np.float32)
