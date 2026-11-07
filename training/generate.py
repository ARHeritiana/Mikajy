"""Generate synthetic handwriting samples (JSON lines).  python3 -I training/generate.py --fonts DIR --n 1000 --out samples.jsonl [--seed 1]"""
import argparse, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from synth.glyphs import GlyphBank
from synth.session import make_sample

ap = argparse.ArgumentParser()
ap.add_argument('--fonts', required=True); ap.add_argument('--n', type=int, default=100); ap.add_argument('--seed', type=int, default=0)
ap.add_argument('--out', default='samples.jsonl'); ap.add_argument('--domain'); ap.add_argument('--behaviour')
ap.add_argument('--holdout-fonts', default='', help='comma list of font names kept out of training (used only with --only-holdout)')
ap.add_argument('--only-holdout', action='store_true')
a = ap.parse_args()
bank = GlyphBank(a.fonts)
held = set(filter(None, a.holdout_fonts.split(',')))
names = bank.names()
use = [n for n in names if (n in held) == a.only_holdout] if held else names
bank = GlyphBank(a.fonts, fonts=set(use))
rng = np.random.default_rng(a.seed)
made = tries = 0
with open(a.out, 'w') as f:
    while made < a.n and tries < a.n * 20:
        tries += 1
        try:
            s = make_sample(rng, bank, a.domain, a.behaviour)
        except (ValueError, IndexError):
            s = None
        if s and s['strokes']:
            s['id'] = made; f.write(json.dumps(s) + '\n'); made += 1
print('wrote', made, 'samples from', tries, 'attempts,', len(use), 'fonts')
