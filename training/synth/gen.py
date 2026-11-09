"""Random expression grammars: arithmetic, algebra, fractions, powers, roots, trigonometry, complex numbers, matrices, modular arithmetic."""
from .layout import *

DOMAINS = ('arith', 'algebra', 'fraction', 'power', 'root', 'trig', 'complex', 'matrix', 'modular', 'equation', 'function', 'prob', 'ode')
VARS = ['x', 'x', 'x', 'y', 'z', 'a', 'b', 'n', 't']


class Gen:
    def __init__(self, rng):
        self.r = rng

    def pick(self, xs): return xs[self.r.integers(len(xs))]
    def n(self, lo=1, hi=9): return num(str(int(self.r.integers(lo, hi + 1))))
    vars = None                                          # set to ['x'] while generating a function body or an ODE side
    def v(self): return var(self.pick(self.vars or VARS))
    def atom(self, vars_ok=True): return self.v() if vars_ok and self.r.random() < .5 else self.n()
    def bop(self): return op(self.pick(['+', '-', '+', '-', '×']))

    def term(self, depth):
        r = self.r.random()
        if depth <= 0 or r < .45: return self.atom()
        if r < .6: return sup(self.atom(), self.n(2, 5) if self.r.random() < .7 else self.v())
        if r < .72: return seq(self.n(2, 9), self.v())
        if r < .85: return frac(self.expr(depth - 1, 2), self.expr(depth - 1, 2))
        if r < .93: return sqrt(self.expr(depth - 1, 2))
        return paren(self.expr(depth - 1, 3))

    def expr(self, depth=2, terms=None):
        k = terms or int(self.r.integers(2, 4))
        items = [self.term(depth)]
        for _ in range(k - 1):
            items += [self.bop(), self.term(depth)]
        return seq(*items)

    # ---- domains ----
    def arith(self): return seq(self.n(1, 99), op(self.pick(['+', '-', '×', '÷'])), self.n(1, 99), *( [op(self.pick(['+', '-'])), self.n(1, 99)] if self.r.random() < .5 else []))
    def algebra(self): return self.expr(2, int(self.r.integers(2, 5)))
    def fraction(self):
        d = int(self.r.integers(1, 4))
        return seq(frac(self.expr(d - 1 if d > 1 else 0, 2), self.expr(d - 1 if d > 1 else 0, 2))) if self.r.random() < .6 else seq(frac(self.n(1, 20), self.n(2, 20)), self.bop(), frac(self.n(1, 20), self.n(2, 20)))
    def power(self):
        c = self.r.random()
        if c < .3: return seq(sup(var('e'), seq(op('-'), self.v()) if self.r.random() < .3 else self.expr(0, 2)))
        if c < .6: return seq(sup(self.atom(), self.expr(1, 2)))
        return seq(self.n(), self.v(), op('+'), sup(self.atom(), seq(op('-'), self.n(1, 4))))
    def root(self): return seq(sqrt(self.expr(1, 2)), *([self.bop(), sqrt(self.n(1, 99))] if self.r.random() < .4 else []))
    def trig(self):
        f = self.pick(['sin', 'cos', 'tan', 'ln', 'log'])
        return seq(func(f, paren(self.expr(0, 2))) if self.r.random() < .6 else func(f, self.v()), *([op('+'), self.term(1)] if self.r.random() < .4 else []))
    def cnum(self): return seq(self.n(), op(self.pick(['+', '-'])), self.n(), var('i'))
    def complex(self):
        c = self.r.random()
        if c < .3: return seq(paren(self.cnum()), op('×'), paren(self.cnum()))
        if c < .5: return seq(sup(var('e'), seq(var('i'), var('π'))), op('+'), num('1'), op('='), num('0'))
        if c < .7: return seq(paren(self.cnum(), '|', '|'), op('='), self.n())
        if c < .8: return seq(over(var('z')), op('='), self.cnum())
        if c < .88: return seq(over(self.cnum()))
        if c < .92: return seq(func('arg', paren(self.cnum())))
        return seq(sup(var('i'), self.n(2, 9)))
    def matrix(self):
        n = int(self.pick([2, 2, 3]))
        mk = lambda: mat([[self.mval() for _ in range(n)] for _ in range(n)], self.pick(['[', '(']), None)
        c = self.r.random()
        def fix(m): return mat(m[1], m[2], {'[': ']', '(': ')'}[m[2]])
        if c < .3: return seq(fix(mk()), fix(mk()))
        if c < .5: return seq(func('det', fix(mk())))
        if c < .65: return seq(sup(fix(mk()), self.pick([num('-1'), var('T'), num('2')])))
        if c < .8: return seq(fix(mk()), op('+'), fix(mk()))
        return seq(mat([[self.mval() for _ in range(n)] for _ in range(n)], '|', '|'))
    def mval(self): return seq(op('-'), self.n(1, 9)) if self.r.random() < .2 else self.atom(self.r.random() < .15)
    def modular(self):
        c = self.r.random()
        if c < .35: return seq(self.n(1, 99), op('≡'), self.n(0, 12), paren(func('mod', self.n(2, 13))))
        if c < .6: return seq(self.n(10, 99), func('mod', self.n(2, 13)))
        if c < .8: return seq(sup(self.n(2, 9), self.n(2, 20)), func('mod', self.n(2, 13)))
        return seq(self.n(2, 9), var('x'), op('≡'), self.n(1, 9), paren(func('mod', self.n(2, 13))))
    # ---- 6.1 notation: function definitions and calls, probability lines, differential equations ----
    def _xexpr(self, depth=1, terms=None):
        self.vars = ['x']
        try: return self.expr(depth, terms)
        finally: self.vars = None
    def function(self):
        f, g = self.pick(['f', 'f', 'g', 'h']), self.pick(['g', 'h', 'f'])
        c = self.r.random()
        if c < .4: return seq(var(f), paren(var('x')), op('='), *self._xexpr(1, int(self.r.integers(2, 4)))[1])
        arg = lambda: self.pick([lambda: self.n(1, 9), lambda: seq(op('-'), self.n(1, 9)), lambda: frac(self.n(1, 5), self.n(2, 6)), lambda: self.n(10, 30)])()
        if c < .75: return seq(var(f), paren(arg()), *([op('=')] if self.r.random() < .5 else []))
        return seq(var(f), paren(seq(var(g), paren(arg()))), *([op('=')] if self.r.random() < .4 else []))
    def _prob(self):
        p = self.pick([lambda: frac(num('1'), self.n(2, 6)), lambda: frac(self.n(1, 3), self.n(4, 9)), lambda: num('0.' + str(int(self.r.integers(1, 10)))), lambda: num('0.' + str(int(self.r.integers(1, 10))) + str(int(self.r.integers(1, 10))))])
        return p()
    def prob(self):
        X = var(self.pick(['X', 'X', 'X', 'Y', 'Z']))
        c = self.r.random()
        if c < .16: return seq(X, op('~'), var('B'), paren(seq(self.n(3, 30), op(','), self._prob())))
        if c < .26: return seq(X, op('~'), var('N'), paren(seq(self.n(0, 120), op(','), self.n(1, 20))))
        if c < .31: return seq(X, op('~'), var('P'), paren(self.n(1, 9)))
        if c < .35: return seq(X, op('~'), var('G'), paren(self._prob()))
        if c < .38: return seq(X, op('~'), var('U'), paren(seq(self.n(0, 5), op(','), self.n(6, 20))))
        if c < .41: return seq(X, op('~'), var('E'), paren(self.n(1, 6)))
        if c < .47: return seq(var('C'), paren(seq(self.n(3, 20), op(','), self.n(1, 8))), *([op('=')] if self.r.random() < .3 else []))
        if c < .52: return seq(var('E'), paren(X), *([op('=')] if self.r.random() < .5 else []))
        if c < .57: return seq(var('V'), paren(X), *([op('=')] if self.r.random() < .5 else []))
        rel = lambda: op(self.pick(['≤', '<', '≥', '>']))
        k = lambda: self.n(0, 25)
        if c < .66: return seq(var('P'), paren(seq(X, op('='), k())), *([op('=')] if self.r.random() < .5 else []))
        if c < .88: return seq(var('P'), paren(seq(X, rel(), k())), *([op('=')] if self.r.random() < .5 else []))
        return seq(var('P'), paren(seq(self.n(0, 10), op('≤'), X, op('≤'), self.n(11, 30))), *([op('=')] if self.r.random() < .5 else []))
    def _y(self, k=1): return sup(var('y'), var("'") if k == 1 else seq(var("'"), var("'")))
    def _ode_rhs(self):
        self.vars = ['x']
        try:
            c = self.r.random()
            if c < .3: return seq(sup(var('e'), self.pick([var('x'), seq(op('-'), var('x')), seq(self.n(2, 3), var('x'))])))
            if c < .45: return seq(func(self.pick(['sin', 'cos']), var('x')))
            if c < .6: return seq(self.n(1, 9))
            if c < .8: return self.expr(0, 2)
            return seq(sup(var('x'), self.n(2, 3)))
        finally: self.vars = None
    def ode(self):
        c = self.r.random(); tail = []
        ic = lambda: [op(','), var('y'), paren(self.n(0, 2)), op('='), self.n(0, 5)]
        if c < .22: body = [frac(seq(var('d'), var('y')), seq(var('d'), var('x'))), op('='), *self._ode_rhs()[1]]
        elif c < .62: body = [self._y(1), op(self.pick(['+', '-'])), self.n(2, 5), var('y'), op('='), *self._ode_rhs()[1]]
        elif c < .72: body = [self._y(1), op('='), var('x') if self.r.random() < .5 else self.n(2, 5), var('y')]
        else:
            body = [self._y(2), op(self.pick(['+', '-'])), self.n(1, 5), self._y(1), op(self.pick(['+', '-'])), self.n(1, 6), var('y'), op('='), *self._ode_rhs()[1]]
            if self.r.random() < .5: tail = ic() + [op(','), sup(var('y'), var("'")), paren(self.n(0, 2)), op('='), self.n(0, 5)]
            return seq(*body, *tail)
        if self.r.random() < .55: tail = ic()
        return seq(*body, *tail)

    def equation(self): return seq(*self.expr(1, 3)[1], op('='), *self.expr(1, 2)[1])

    def make(self, domain):
        return getattr(self, domain)()
