"""Expression trees, their LaTeX, and a 2-D handwriting layout (fractions, exponents, roots, matrices, ...)."""
import numpy as np
from .glyphs import Glyph
from . import proc

XH = 1.0
AXIS = .55          # height of the fraction bar / minus sign above the baseline (x-heights)


# ---- tree: tuples ('kind', ...) ----
def num(s): return ('num', s)
def var(s): return ('var', s)
def op(s): return ('op', s)
def seq(*items): return ('seq', list(items))
def frac(n, d): return ('frac', n, d)
def sup(b, e): return ('sup', b, e)
def sub(b, s): return ('sub', b, s)
def sqrt(a): return ('sqrt', a)
def paren(a, l='(', r=')'): return ('paren', a, l, r)
def func(name, a): return ('func', name, a)
def mat(rows, l='[', r=']'): return ('mat', rows, l, r)
def over(a): return ('over', a)

GREEK = {'π': r'\pi', "'": r'\prime'}
OPS = {'+': '+', '-': '-', '=': '=', '×': r'\times', '÷': r'\div', '≡': r'\equiv', '/': '/', ',': ',', '.': '.', '!': '!', '~': r'\sim', '≤': r'\le', '≥': r'\ge', '<': '<', '>': '>'}
FUNCS = ('sin', 'cos', 'tan', 'ln', 'log', 'exp', 'det', 'gcd', 'mod', 'lcm')


def latex(n):
    k = n[0]
    if k in ('num', 'var'): return GREEK.get(n[1], n[1])
    if k == 'op': return OPS[n[1]]
    if k == 'seq': return ' '.join(latex(x) for x in n[1])
    if k == 'frac': return r'\frac{%s}{%s}' % (latex(n[1]), latex(n[2]))
    if k == 'sup': return '{%s}^{%s}' % (latex(n[1]), latex(n[2]))
    if k == 'sub': return '{%s}_{%s}' % (latex(n[1]), latex(n[2]))
    if k == 'sqrt': return r'\sqrt{%s}' % latex(n[1])
    if k == 'paren': return {'(': r'\left(', '[': r'\left[', '|': r'\left|'}[n[2]] + ' ' + latex(n[1]) + ' ' + {')': r'\right)', ']': r'\right]', '|': r'\right|'}[n[3]]
    if k == 'func': return r'\%s %s' % (n[1], latex(n[2])) if n[1] != 'mod' else r'\bmod ' + latex(n[2])
    if k == 'mat':
        env = {'[': 'bmatrix', '(': 'pmatrix', '|': 'vmatrix'}[n[2]]
        return r'\begin{%s} %s \end{%s}' % (env, r' \\ '.join(' & '.join(latex(c) for c in row) for row in n[1]), env)
    if k == 'over': return r'\overline{%s}' % latex(n[1])
    raise ValueError(k)


class Box:
    """Layout result: atoms placed relative to the box origin (x from the left, y DOWN from the baseline)."""
    def __init__(self):
        self.atoms, self.w, self.asc, self.desc = [], 0.0, 0.0, 0.0

    def add(self, other, dx, dy, tag=None, role=None):
        for a in other.atoms:
            a = dict(a); a['x'] += dx; a['y'] += dy
            if 'x1' in a: a['x1'] += dx; a['y1'] += dy
            if 'pts' in a: a['pts'] = [(px + dx, py + dy) for px, py in a['pts']]
            if tag: a['path'] = tag + '/' + a['path'] if a['path'] else tag
            if role and 'role' not in a: a['role'] = role
            self.atoms.append(a)
        self.asc = max(self.asc, other.asc - dy); self.desc = max(self.desc, other.desc + dy)
        self.w = max(self.w, dx + other.w)


class Layout:
    def __init__(self, writer, rng):
        self.wr, self.rng = writer, rng

    def jit(self, a=.06): return float(self.rng.normal(0, a))

    # ---- leaves ----
    def text(self, s, scale, role=None, cursive_ok=False, var_x=False):
        """Characters of s as glyph atoms (or one whole-word atom for cursive writers)."""
        wr, b = self.wr, Box()
        font = wr.font_for(s)
        if font is None:
            return None
        if cursive_ok and len(s) > 1 and wr.mode == 'cursive':
            g = wr.bank.render(font, s)
            if g is not None:
                b.atoms.append(dict(kind='glyph', ch=s, glyph=g, x=-g.x0 * scale, y=0.0, s=scale, path='', word=True))
                b.w, b.asc, b.desc = g.w * scale, max(0, -g.y0) * scale, max(0, g.y1) * scale
                return b
        x = 0.0
        for i, ch in enumerate(s):
            g = self.proc_glyph(ch, var_x)           # habits the font tracer lacks: a 9 written from the top, an x written as two arcs
            if g is None:
                f = wr.font_for(ch)
                g = wr.bank.render(f, ch) if f else None
            if g is None:
                return None
            sc = scale * (1 + self.jit(wr.size_jitter))
            b.atoms.append(dict(kind='glyph', ch=ch, glyph=g, x=x - g.x0 * sc, y=self.jit(.03) * scale, s=sc, path='', word=len(s) > 1, join=(wr.mode != 'print' and i > 0)))
            x += g.w * sc + (.06 if len(s) > 1 else .12) * scale * wr.width + self.jit(.03)
            b.asc = max(b.asc, -g.y0 * sc); b.desc = max(b.desc, g.y1 * sc)
        b.w = x
        return b

    def proc_glyph(self, ch, var_x):
        if ch == '9' and self.rng.random() < .6: return proc.nine(self.rng)
        if ch in proc.HABITS and self.rng.random() < proc.HABITS[ch][1]: return proc.HABITS[ch][0](self.rng)
        if ch == 'x' and var_x and self.rng.random() < .4: return proc.x_arcs(self.rng)
        return None

    def line(self, x0, y0, x1, y1, kind='line'):
        return dict(kind=kind, x=x0, y=y0, x1=x1, y1=y1, path='', ch='')

    # ---- layout ----
    def lay(self, n, s=1.0, depth=0):
        k = n[0]
        fn = getattr(self, 'l_' + k)
        return fn(n, s, depth)

    def l_num(self, n, s, d): return self.text(n[1], s)
    def l_var(self, n, s, d): return self.text(n[1], s, var_x=True)

    def l_op(self, n, s, d):
        ch = n[1]
        if ch == '≡':
            b = Box(); w = .9 * s
            for i, y in enumerate((-.25, -.55, -.85)):
                b.atoms.append(self.line(0, y * s + self.jit(.03), w, y * s + self.jit(.03) + self.jit(.03), 'bar'))
            b.w, b.asc, b.desc = w, .9 * s, 0
            return self.pad(b, .25 * s)
        if ch in '≤≥':                                  # drawn, like ≡: a chevron with a bar under it (few handwriting fonts have these glyphs)
            b = Box(); w = .75 * s; j = lambda: self.jit(.04)
            ch_ = self.line(0, 0, 0, 0, 'poly'); xs = (w, 0, w) if ch == '≤' else (0, w, 0)
            ch_['pts'] = [(xs[0] + j() * s, -.85 * s + j() * s), (xs[1] + j() * s, -.55 * s + j() * s), (xs[2] + j() * s, -.25 * s + j() * s)]
            ch_['role'] = 'term'; ch_['path'] = 'cmp'; ch_['ch'] = ch
            b.atoms.append(ch_)
            b.atoms.append(self.line(0, .02 * s + j() * s, w, .02 * s + j() * s, 'bar'))
            b.w, b.asc, b.desc = w, .9 * s, .05 * s
            return self.pad(b, .22 * s)
        b = self.text(ch, s) or self.text({'×': 'x', '÷': '/'}.get(ch, ch), s)
        return self.pad(b, .22 * s) if b else None

    def pad(self, b, p):
        o = Box(); o.add(b, p, 0); o.w = b.w + 2 * p; return o

    def l_seq(self, n, s, d):
        b, x = Box(), 0.0
        for i, it in enumerate(n[1]):
            c = self.lay(it, s, d)
            if c is None: return None
            b.add(c, x, 0, tag='i%d' % i)
            x += c.w + (.08 + self.jit(.03)) * s
        b.w = max(0, x - .08 * s)
        return b

    def l_frac(self, n, s, d):
        sc = s * (1.0 if d == 0 else .85)
        top, bot = self.lay(n[1], sc, d + 1), self.lay(n[2], sc, d + 1)
        if top is None or bot is None: return None
        w = max(top.w, bot.w) + (.3 + self.jit(.08)) * s
        gap = .25 * s
        b = Box()
        b.add(top, (w - top.w) / 2 + self.jit(.08), -(AXIS * s + gap + top.desc), tag='num', role='num')
        b.add(bot, (w - bot.w) / 2 + self.jit(.08), -(AXIS * s) + gap + bot.asc, tag='den', role='den')
        bar = self.line(0, -AXIS * s + self.jit(.04), w, -AXIS * s + self.jit(.04), 'bar'); bar['role'] = 'fracbar'; bar['path'] = 'bar'
        b.atoms.append(bar)
        b.w = w; b.asc = max(b.asc, AXIS * s); b.desc = max(b.desc, 0)
        return b

    def l_sup(self, n, s, d):
        base, e = self.lay(n[1], s, d), self.lay(n[2], s * .68, d + 1)
        if base is None or e is None: return None
        b = Box(); b.add(base, 0, 0, tag='base', role='base')
        rise = max(.75 * s, base.asc * .8 if n[1][0] in ('paren', 'frac', 'sqrt', 'mat') else .75 * s) + e.desc
        b.add(e, base.w + .05 * s, -rise, tag='exp', role='sup')
        return b

    def l_sub(self, n, s, d):
        base, e = self.lay(n[1], s, d), self.lay(n[2], s * .68, d + 1)
        if base is None or e is None: return None
        b = Box(); b.add(base, 0, 0, tag='base', role='base'); b.add(e, base.w + .05 * s, .3 * s + e.asc * .3, tag='sub', role='sub')
        return b

    def l_sqrt(self, n, s, d):
        a = self.lay(n[1], s, d + 1)
        if a is None: return None
        h = a.asc + a.desc + .25 * s
        top = -(a.asc + .2 * s)
        w = a.w + .5 * s
        b = Box()
        hook = self.line(0, 0, 0, 0, 'poly'); hook['pts'] = [(0, -.45 * s), (.12 * s, -.5 * s), (.28 * s, a.desc), (.5 * s, top), (w + .1 * s, top + self.jit(.04))]
        hook['role'] = 'radical'; hook['path'] = 'rad'
        b.atoms.append(hook)
        b.add(a, .55 * s, 0, tag='arg', role='radicand')
        b.w = w + .1 * s; b.asc = -top + .1 * s; b.desc = max(a.desc, 0)
        return b

    def bracket(self, kind, x, top, bot, left):
        b = dict(kind='poly', x=0, y=0, x1=0, y1=0, path='br', ch=kind, role='bracket', left=left)
        w = .22 if kind == '(' else .2
        sgn = 1 if left else -1
        if kind == '|':
            pts = [(x, top), (x + self.jit(.02), bot)]
        elif kind == '(':
            mid = (top + bot) / 2
            pts = [(x + sgn * w * .0, top), (x - sgn * w, top + (bot - top) * .25), (x - sgn * w * 1.1, mid), (x - sgn * w, top + (bot - top) * .75), (x, bot)]
            pts = [(px, py) for px, py in pts]
        else:
            pts = [(x + sgn * w, top), (x, top), (x, bot), (x + sgn * w, bot)]
        b['pts'] = pts
        return b

    def l_paren(self, n, s, d):
        a = self.lay(n[1], s, d + 1)
        if a is None: return None
        pad = .12 * s
        top, bot = -(a.asc + pad), a.desc + pad
        b = Box()
        bw = .3 * s
        b.atoms.append(self.bracket(n[2], bw * .8, top, bot, True))
        b.add(a, bw + .06 * s, 0, tag='in', role='inner')
        b.atoms.append(self.bracket(n[3], bw + a.w + .12 * s + bw * .2, top, bot, False))
        b.w = a.w + 2 * bw + .12 * s; b.asc = -top; b.desc = bot
        return b

    def l_func(self, n, s, d):
        name = self.text(n[1], s, cursive_ok=True)
        arg = self.lay(n[2], s, d)
        if name is None or arg is None: return None
        b = Box(); b.add(name, 0, 0, tag='name', role='func'); b.add(arg, name.w + .2 * s, 0, tag='arg', role='arg')
        return b

    def l_over(self, n, s, d):
        a = self.lay(n[1], s, d)
        if a is None: return None
        b = Box(); b.add(a, 0, 0, tag='base', role='base')
        y = -(a.asc + .2 * s)
        bar = self.line(0, y, a.w, y + self.jit(.03), 'bar'); bar['role'] = 'overbar'; bar['path'] = 'bar'
        b.atoms.append(bar); b.asc = a.asc + .25 * s
        return b

    def l_mat(self, n, s, d):
        rows = n[1]
        cells = [[self.lay(c, s * .9, d + 1) for c in row] for row in rows]
        if any(c is None for r in cells for c in r): return None
        nc = max(len(r) for r in cells)
        cw = [max((r[j].w for r in cells if j < len(r)), default=0) for j in range(nc)]
        rh = [(max(c.asc for c in r), max(c.desc for c in r)) for r in cells]
        gap, rowgap = .6 * s, .35 * s
        b = Box(); x0 = .35 * s
        y = 0.0
        ys = []
        for i, (a, de) in enumerate(rh):
            y += a if i == 0 else a + rowgap
            ys.append(y); y += de
        total = y; mid = total / 2
        for i, r in enumerate(cells):
            x = x0
            for j, c in enumerate(r):
                b.add(c, x + (cw[j] - c.w) / 2, ys[i] - mid, tag='r%dc%d' % (i, j), role='cell:%d,%d' % (i, j))
                x += cw[j] + gap
        W = x0 + sum(cw) + gap * (nc - 1) + .35 * s
        top, bot = -(mid + .15 * s), mid + .15 * s
        b.atoms.append(self.bracket(n[2], .15 * s, top, bot, True))
        b.atoms.append(self.bracket(n[3], W - .15 * s, top, bot, False))
        b.w, b.asc, b.desc = W, mid + .15 * s, mid + .15 * s
        return b
