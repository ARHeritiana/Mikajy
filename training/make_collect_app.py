"""Build tools/collect/mikajy-collect.html: an offline page that shows prompts and records your real pen strokes.
   python3 training/make_collect_app.py [--n 300] [--seed 1]"""
import argparse, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
import numpy as np
from synth.gen import Gen, DOMAINS
from synth.layout import latex, seq, op

ap = argparse.ArgumentParser(); ap.add_argument('--n', type=int, default=300); ap.add_argument('--seed', type=int, default=1)
a = ap.parse_args()
rng = np.random.default_rng(a.seed); g = Gen(rng)
STYLES = ['neat print', 'normal everyday', 'fast and messy', 'joined-up cursive', 'fancy / decorative', 'small and cramped', 'big and loose']


def groups(node, path=''):
    """Structural groups people come back to (same path scheme as the app page)."""
    k, out = node[0], []
    def sub(child, name):
        p = (path + '/' + name) if path else name
        if name in ('exp', 'den', 'num', 'sub'): out.append(p)
        out.extend(groups(child, p))
    if k == 'seq':
        for i, c in enumerate(node[1]):
            p = (path + '/' if path else '') + 'i%d' % i
            if c[0] != 'op' and len(node[1]) > 2: out.append(p)
            out.extend(groups(c, p))
    elif k == 'frac': sub(node[1], 'num'); sub(node[2], 'den')
    elif k == 'sup': sub(node[1], 'base'); sub(node[2], 'exp')
    elif k == 'sub': sub(node[1], 'base'); sub(node[2], 'sub')
    elif k in ('sqrt', 'func'): sub(node[-1] if k == 'func' else node[1], 'arg')
    elif k == 'paren': sub(node[1], 'in')
    elif k == 'over': sub(node[1], 'base')
    elif k == 'mat':
        for i, r in enumerate(node[1]):
            for j, c in enumerate(r): sub(c, 'r%dc%d' % (i, j))
    return out


prompts = []
kinds = ['plain'] * 4 + ['late'] * 2 + ['extend'] * 2 + ['lines']
for i in range(a.n):
    domain = DOMAINS[i % len(DOMAINS)]; kind = kinds[int(rng.integers(len(kinds)))]
    p = {'id': i, 'domain': domain, 'style': STYLES[i % len(STYLES)], 'kind': kind}
    if kind == 'lines':
        trees = [g.make(domain) for _ in range(int(rng.integers(2, 4)))]
    else:
        trees = [g.make(domain)]
    if kind == 'late':
        gs = sorted(set(groups(trees[0])))
        if not gs: kind = p['kind'] = 'plain'
        else: p['target'] = gs[int(rng.integers(len(gs)))]
    if kind == 'extend':
        base = g.make(domain); ext = g.expr(1, 2); glue = op(str(rng.choice(['+', '-', '='])))
        trees = [seq(*base[1], glue, *ext[1])]; p['cut'] = len(base[1])
    p['trees'] = trees; p['latex'] = [latex(t) for t in trees]
    prompts.append(p)
here = os.path.dirname(os.path.abspath(__file__))
tpl = open(os.path.join(here, '..', 'tools', 'collect', 'template.html'), encoding='utf-8').read()
out = os.path.join(here, '..', 'tools', 'collect', 'mikajy-collect.html')
open(out, 'w', encoding='utf-8').write(tpl.replace('/*PROMPTS*/[]', json.dumps(prompts, ensure_ascii=False)))
print('wrote', os.path.normpath(out), len(prompts), 'prompts')
