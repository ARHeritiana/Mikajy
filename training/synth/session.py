"""One simulated writing session: expressions, a writer, and realistic behaviour (late additions, extending, several lines)."""
import numpy as np
from . import layout as L
from .draw import render
from .gen import Gen, DOMAINS
from .style import Writer


def _order(atoms, wr, late_prefix=None):
    """Writing order of atoms: natural layout order, optional bar-first fractions, optional late-added group."""
    idx = list(range(len(atoms)))
    key = {i: float(i) for i in idx}
    if wr.bar_first:
        for i, a in enumerate(atoms):
            if a.get('role') == 'fracbar':
                parent = a['path'].rsplit('bar', 1)[0]
                first = [j for j, b in enumerate(atoms) if b['path'].startswith(parent) and j != i and b['path'].startswith(parent + 'num')]
                if first: key[i] = min(first) - .5
    if late_prefix:
        for i, a in enumerate(atoms):
            if a['path'] == late_prefix or a['path'].startswith(late_prefix + '/'):
                key[i] += 10000
    return sorted(idx, key=lambda i: key[i])


def _late_target(atoms, rng):
    """A structural group that people typically come back to: an exponent, a denominator, a cell or a middle term."""
    groups = set()
    for a in atoms:
        parts = a['path'].split('/')
        for k in range(1, len(parts) + 1):
            if parts[k - 1] in ('exp', 'den', 'num', 'sub') or (parts[k - 1].startswith('r') and 'c' in parts[k - 1]) or (k == 1 and parts[0].startswith('i')):
                groups.add('/'.join(parts[:k]))
    groups = sorted(groups)
    return groups[rng.integers(len(groups))] if len(groups) > 1 else None


def _bbox(strokes):
    pts = np.vstack([s['pts'][:, :2] for s in strokes])
    return [float(pts[:, 0].min()), float(pts[:, 1].min()), float(pts[:, 0].max()), float(pts[:, 1].max())]


def _line(rng, wr, lay, tree, late, origin, t0, line_no, prev_desc=None):
    box = lay.lay(tree)
    if box is None:
        return None
    if prev_desc is not None:                      # place this line below the previous one's descenders, plus a ragged gap
        origin = (origin[0], origin[1] + (prev_desc + box.asc + float(rng.uniform(.5, 1.1))) * wr.px)
    atoms = box.atoms
    target = _late_target(atoms, rng) if late else None
    order = _order(atoms, wr, target)
    strokes, t = render(atoms, wr, order, origin, t0)
    syms = []
    by_atom = {}
    for s in strokes:
        by_atom.setdefault(s['atom'], []).append(s)
    for i, a in enumerate(atoms):
        if i in by_atom:
            syms.append({'text': a['ch'] if a['kind'] != 'poly' else (a['ch'] or 'sqrt'), 'role': a.get('role', 'term'), 'path': a['path'],
                         'line': line_no, 'bbox': _bbox(by_atom[i]), 'atom': i, 'late': bool(target and (a['path'] == target or a['path'].startswith(target + '/')))})
    return dict(strokes=strokes, syms=syms, asc=box.asc, desc=box.desc, y=origin[1], w=box.w, target=target, t_end=t, tree=tree)


def make_sample(rng, bank, domain=None, behaviour=None):
    """Returns a JSON-able dict, or None when the chosen glyphs are unavailable (caller retries)."""
    wr = Writer(rng, bank)
    gen, lay = Gen(rng), L.Layout(wr, rng)
    behaviour = behaviour or rng.choice(['plain', 'plain', 'late', 'extend', 'lines', 'lines_late'])
    domain = domain or rng.choice(DOMAINS)
    ox, oy0 = float(rng.uniform(20, 80)), float(rng.uniform(100, 200))
    trees, stage_cut = [], None
    if behaviour == 'extend':
        base = gen.make(domain)
        ext = gen.expr(1, 2)
        glue = L.op(rng.choice(['+', '-', '=']))
        full = L.seq(*base[1], glue, *ext[1])
        trees, stage_cut = [full], len(base[1])
    elif behaviour.startswith('lines'):
        n = int(rng.integers(2, 4))
        trees = [gen.make(rng.choice(DOMAINS) if domain is None else domain) for _ in range(n)]
    else:
        trees = [gen.make(domain)]
    lines, t, y, prev = [], 0.0, oy0, None
    for k, tree in enumerate(trees):
        late = behaviour in ('late', 'lines_late') and (k == 0 or rng.random() < .4)
        res = _line(rng, wr, lay, tree, late, (ox + rng.normal(0, 10 if k else 0), y), t, k, prev)
        if res is None:
            return None
        lines.append(res)
        t, y, prev = res['t_end'] + float(rng.uniform(300, 1200)), res['y'], res['desc']
    # visual order of lines is k; writing order may differ when a line was added afterwards
    if behaviour == 'lines_late' and len(lines) >= 3 and rng.random() < .6:
        mid = lines[1]
        shift = lines[-1]['t_end'] + 800
        for s in mid['strokes']:
            s['pts'][:, 2] += shift - mid['strokes'][0]['pts'][0, 2]
    strokes, syms = [], []
    for ln in lines:
        base_id = len(strokes)
        for s in ln['strokes']:
            strokes.append(s)
        syms += ln['syms']
    # stable stroke ids ordered by time; symbols reference strokes through atom ids per line
    order = sorted(range(len(strokes)), key=lambda i: strokes[i]['pts'][0, 2])
    new_pos = {old: new for new, old in enumerate(order)}
    out_strokes = [{'pts': np.round(strokes[i]['pts'], 1).tolist()} for i in order]
    offset = 0
    sym_out = []
    # map each symbol to its stroke indexes
    pos = {}
    for li, ln in enumerate(lines):
        for old_i, s in enumerate(ln['strokes']):
            pos.setdefault((li, s['atom']), []).append(new_pos[sum(len(l['strokes']) for l in lines[:li]) + old_i])
    for sy in syms:
        sy = dict(sy); sy['strokes'] = pos[(sy['line'], sy.pop('atom'))]; sym_out.append(sy)
    sample = {'domain': str(domain), 'behaviour': str(behaviour), 'writer': wr.summary(),
              'latex': [L.latex(l['tree']) for l in lines], 'strokes': out_strokes, 'symbols': sym_out,
              'late_groups': [l['target'] for l in lines if l['target']]}
    if stage_cut is not None:
        sample['stages'] = [L.latex(L.seq(*trees[0][1][:stage_cut])), L.latex(trees[0])]
        sample['stage_strokes'] = int(sum(1 for sy in sym_out if sy['path'].split('/')[0] in ['i%d' % j for j in range(stage_cut)] for _ in sy['strokes']))
    return sample
