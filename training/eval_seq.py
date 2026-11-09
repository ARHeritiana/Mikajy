"""Score a stroke-sequence checkpoint on raw sample files (the real finger-written set, or generated held-out samples).
python3 training/eval_seq.py CKPT FILE.jsonl [--dump preds.json]
Reports exact line-set match and token error rate on the full LaTeX tokens, and the same bag-of-symbols recall/precision that
training/eval_app.py reports for the shipped page (restricted to the symbols the shipped CNN has classes for, so the two are comparable)."""
import argparse, collections, json, os, sys
import numpy as np, torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seqmodel import StrokeSeq
from strokefeat import featurise, tokenize
from train_seq import batchify, edit
from eval_app import expected, score


def load_model(path, dev='cuda'):
    ck = torch.load(path, map_location=dev); c = ck['cfg']
    m = StrokeSeq(len(ck['itos']), d=c['d'], h=c['d'] // 32, ff=c['ff'], ne=c['layers'], nd=c['layers']).to(dev)
    m.load_state_dict(ck['model']); m.eval()
    return m, ck['itos']


def predict(model, itos, rows, dev='cuda'):
    vocab = {t: i for i, t in enumerate(itos)}; out = []
    for r in rows:
        P, T = featurise(r['strokes'])
        it = dict(P=P, T=T, tok=['0'])
        P, T, V, _ = batchify([it], vocab, dev)
        with torch.autocast('cuda', dtype=torch.bfloat16):
            o = model.greedy(P, T, V, 1, 2)[0].cpu().numpy()
        seq = []
        for t in o:
            if t == 2: break
            seq.append(itos[t])
        out.append(seq)
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('ckpt'); ap.add_argument('file'); ap.add_argument('--max', type=int, default=10**9); ap.add_argument('--dump')
    a = ap.parse_args()
    rows = [json.loads(l) for l in open(a.file)][:a.max]
    model, itos = load_model(a.ckpt)
    preds = predict(model, itos, rows)
    shipped = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../web/model/model4.f16.json')))
    vocab = set(shipped['cls']) | {'§'}
    ex = ed = tot = 0; groups = collections.defaultdict(lambda: [0, 0, 0]); miss = collections.Counter(); extra = collections.Counter(); bag_exact = 0; lines_ok = 0
    for r, p in zip(rows, preds):
        ref = tokenize(r['latex']); e = edit(p, ref); ed += e; tot += len(ref); ex += e == 0
        lines_ok += p.count('<nl>') == len(r['latex']) - 1
        got = [c for c in expected(' '.join(t for t in p if t != '<nl>')) if c in vocab]
        hit, ne, ng, m, x, _ = score(expected(' '.join(r['latex'])), got, vocab)
        miss.update(m); extra.update(x); bag_exact += (not m and not x)
        for key in ('all', 'style:' + r.get('style', '?'), 'domain:' + r['domain'], 'behaviour:' + r['behaviour']):
            g = groups[key]; g[0] += hit; g[1] += ne; g[2] += ng
    n = len(rows)
    print(f'{n} samples; exact LaTeX token match {ex}/{n} ({100 * ex / n:.1f}%); token error rate {100 * ed / tot:.1f}%; line count correct {lines_ok}/{n}; bag-of-symbols exact {bag_exact}/{n}')
    print(f"{'group (shipped-CNN symbol set)':34s} recall  precision")
    for k in sorted(groups, key=lambda k: (k != 'all', k)):
        h, ne, g = groups[k]; print(f'{k:34s} {100 * h / max(ne, 1):5.1f}%  {100 * h / max(g, 1):5.1f}%   (n={ne})')
    print('most often missed :', miss.most_common(12)); print('most often spurious:', extra.most_common(12))
    if a.dump: json.dump(preds, open(a.dump, 'w'))
