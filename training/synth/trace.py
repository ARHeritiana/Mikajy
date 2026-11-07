"""Turn a filled glyph (font rendering) into pen strokes: skeletonise, walk the skeleton graph, chain edges into strokes."""
import math
import numpy as np
from skimage.morphology import skeletonize

N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def _rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    d = b - a
    n = np.hypot(*d)
    dist = np.abs(d[0] * (pts[:, 1] - a[1]) - d[1] * (pts[:, 0] - a[0])) / n if n > 1e-9 else np.hypot(*(pts - a).T)
    i = int(np.argmax(dist))
    if dist[i] <= eps:
        return np.array([a, b])
    return np.vstack([_rdp(pts[:i + 1], eps)[:-1], _rdp(pts[i:], eps)])


def skeleton_edges(mask):
    """Edges of the skeleton graph as lists of (y, x) pixels, plus node set."""
    sk = skeletonize(mask)
    ys, xs = np.nonzero(sk)
    pix = set(zip(ys.tolist(), xs.tolist()))
    nb = {p: [(p[0] + dy, p[1] + dx) for dy, dx in N8 if (p[0] + dy, p[1] + dx) in pix] for p in pix}
    ring = [(-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1)]
    def crossings(p):                           # 0->1 transitions around the pixel: >=3 means a real junction
        v = [(p[0] + dy, p[1] + dx) in pix for dy, dx in ring]
        return sum(1 for i in range(8) if not v[i] and v[(i + 1) % 8]) + (1 if all(v) else 0)
    nodes = {p for p, n in nb.items() if len(n) == 1 or len(n) == 0 or crossings(p) >= 3}
    edges, seen = [], set()
    def walk(start, nxt):
        path = [start, nxt]
        prev, cur = start, nxt
        while cur not in nodes:
            step = [q for q in nb[cur] if q not in path and max(abs(q[0] - prev[0]), abs(q[1] - prev[1])) > 1]
            step = step or [q for q in nb[cur] if q not in path]
            if not step:
                break
            prev, cur = cur, step[0]
            path.append(cur)
            if cur == start:
                break
        return path
    for s in sorted(nodes):
        for n in nb[s]:
            if (s, n) in seen:
                continue
            path = walk(s, n)
            seen.add((path[0], path[1])); seen.add((path[-1], path[-2]))
            edges.append(path)
    if not edges and pix:                       # a pure loop (like "o"): no nodes at all
        s = min(pix)
        edges.append(walk(s, nb[s][0]))
    dots = [p for p in pix if not nb[p]]
    return edges, dots


def trace(mask, spur=0.07):
    """Polylines (x, y) in pixel units, one per pen stroke, in plausible writing order."""
    edges, dots = skeleton_edges(mask)
    h = mask.shape[0]
    dot_strokes = [np.array([(x, y), (x + 0.4, y + 0.4)], float) for y, x in dots]
    if not edges:
        return dot_strokes
    deg = {}
    for e in edges:
        for p in (e[0], e[-1]):
            deg[p] = deg.get(p, 0) + 1
    # prune short spurs hanging off a junction
    keep = [e for e in edges if not (len(e) < spur * h and (deg[e[0]] == 1) != (deg[e[-1]] == 1))]
    edges = keep or edges
    inc = {}
    for i, e in enumerate(edges):
        inc.setdefault(e[0], []).append(i)
        inc.setdefault(e[-1], []).append(i)
    used, strokes = set(), []
    def key(p):
        return p[0] + 0.3 * p[1]                # topmost-leftmost first
    while len(used) < len(edges):
        free = [i for i in range(len(edges)) if i not in used]
        ends = [p for i in free for p in (edges[i][0], edges[i][-1]) if len(inc[p]) == 1 or all(j in used or j == i for j in inc[p])]
        start_pt = min(ends or [edges[free[0]][0]], key=key)
        cur_edge = next(i for i in free if start_pt in (edges[i][0], edges[i][-1]))
        pts, node = [], start_pt
        while True:
            e = edges[cur_edge]
            seq = e if e[0] == node else e[::-1]
            pts += seq if not pts else seq[1:]
            used.add(cur_edge)
            node = seq[-1]
            cand = [j for j in inc.get(node, []) if j not in used]
            if not cand:
                break
            def turn(j):
                f = edges[j] if edges[j][0] == node else edges[j][::-1]
                back = pts[max(0, len(pts) - 6)]
                a1 = math.atan2(node[0] - back[0], node[1] - back[1])
                a2 = math.atan2(f[min(5, len(f) - 1)][0] - node[0], f[min(5, len(f) - 1)][1] - node[1])
                return abs((a2 - a1 + math.pi) % (2 * math.pi) - math.pi)
            cur_edge = min(cand, key=turn)
        a = np.array([(x, y) for y, x in pts], float)
        a = _rdp(a, 0.004 * h)
        if len(a) >= 2 or len(pts) >= 2:
            strokes.append(a if len(a) >= 2 else np.array([(x, y) for y, x in pts[:2]], float))
    strokes = [t for t in strokes if np.hypot(*np.diff(t, axis=0).T).sum() >= 0.05 * h]   # spur remnants
    return strokes + dot_strokes
