"""Parallel synthetic corpus -> compact npz of featurised strokes + token strings.
python3 -I training/gen_corpus.py --fonts DIR --n 120000 --out corpus_train.npz [--heldout]  (fonts in HELD never appear in the training corpus)"""
import argparse, json, os, sys, time
import numpy as np
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from strokefeat import featurise, tokenize
from synth.glyphs import GlyphBank
from synth.session import make_sample

HELD = ['Kalam-Regular', 'Handlee-Regular', 'Mali-Regular', 'ReenieBeanie']   # same held-out fonts as train4.py
_bank = None


def init(fonts, heldout):
    global _bank
    probe = GlyphBank(fonts)
    use = [n for n in probe.names() if (n in HELD) == heldout]
    _bank = GlyphBank(fonts, fonts=set(use))


def work(args):
    seed, n = args
    rng = np.random.default_rng(seed)
    out = []
    while len(out) < n:
        try:
            s = make_sample(rng, _bank)
        except (ValueError, IndexError):
            s = None
        if not s or not s['strokes'] or len(s['strokes']) > 160:
            continue
        P, T = featurise(s['strokes'])
        out.append((P.astype(np.float16), T.astype(np.float16), ' '.join(tokenize(s['latex'])), s['behaviour'], s['domain']))
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--fonts', required=True); ap.add_argument('--n', type=int, default=1000)
    ap.add_argument('--seed', type=int, default=0); ap.add_argument('--out', required=True); ap.add_argument('--heldout', action='store_true'); ap.add_argument('--workers', type=int, default=12)
    a = ap.parse_args(); t0 = time.time()
    chunk = 200
    jobs = [(a.seed * 1000003 + i, chunk) for i in range((a.n + chunk - 1) // chunk)]
    rows = []
    with Pool(a.workers, init, (a.fonts, a.heldout)) as pool:
        for k, r in enumerate(pool.imap(work, jobs)):
            rows += r
            if k % 20 == 0: print(len(rows), int(time.time() - t0), 's', flush=True)
    rows = rows[:a.n]
    lens = np.array([len(r[0]) for r in rows])
    np.savez_compressed(a.out, P=np.concatenate([r[0] for r in rows]), T=np.concatenate([r[1] for r in rows]), lens=lens,
                        tok=np.array([r[2] for r in rows]), beh=np.array([r[3] for r in rows]), dom=np.array([r[4] for r in rows]))
    print('wrote', len(rows), 'samples,', int(lens.sum()), 'strokes,', int(time.time() - t0), 's')
