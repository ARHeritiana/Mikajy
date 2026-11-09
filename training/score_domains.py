"""Score a stroke-sequence checkpoint: held-out sets per domain (synthetic fonts never seen in training),
plus a file of real finger-written samples.  python3 score_domains.py RUN_NAME DATA_NAME [REAL_SAMPLES.jsonl]
RUN_NAME is a directory under $MIKAJY_DATA/runs (ckpt.pt inside); DATA_NAME a directory under $MIKAJY_DATA holding held.npz.  MIKAJY_DATA defaults to ~/mikajy-data."""
import collections, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from train_seq import load, evaluate, edit
from eval_seq import load_model, predict
from strokefeat import tokenize

root = os.environ.get('MIKAJY_DATA', os.path.expanduser('~/mikajy-data'))
run, data = sys.argv[1], sys.argv[2]
ckpt = run if run.endswith('.pt') else f'{root}/runs/{run}/ckpt.pt'
real = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('MIKAJY_REAL_SAMPLES', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'real_data', 'mikajy-samples-Heritiana-2026-11-07.jsonl'))
m, itos = load_model(ckpt); vocab = {t: i for i, t in enumerate(itos)}


def show(tag, items):
    for h in items: h['tok'] = [t if t in vocab else itos[3] for t in h['tok']]
    r, _, _ = evaluate(m, items, vocab, itos, 'cuda')
    print(f'  {tag:36s} n={len(items):5d}  exact={100 * r["exact"]:5.1f}%  TER={100 * r["ter"]:5.1f}%')


print(os.path.basename(os.path.dirname(ckpt)) or ckpt)
held = load(f'{root}/{data}/held.npz')
synth = list(held)
show('synthetic, unseen fonts (all)', synth)
doms = collections.defaultdict(list)
for h in synth: doms[h['dom']].append(h)
for d in sorted(doms):
    if len(doms[d]) >= 30: show('  domain: ' + d, doms[d])
if os.path.exists(real):
    rows = [json.loads(l) for l in open(real)]; preds = predict(m, itos, rows); ex = ed = tot = 0
    for r_, p in zip(rows, preds):
        ref = tokenize(r_['latex']); e = edit(p, ref); ed += e; tot += len(ref); ex += e == 0
    print(f'  {"real finger samples":36s} n={len(rows):5d}  exact={100 * ex / len(rows):5.1f}%  TER={100 * ed / tot:5.1f}%')
