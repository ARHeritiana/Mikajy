"""Dump reference tokens from torch for a few samples so tests/seq-core.test.cjs can check the JS port against them.
python3 training/parity_seq.py CKPT FILE.jsonl OUT.json [n]   (uses the packed JSON model given as argument 5 only by the JS side)"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eval_seq import load_model, predict
m, itos = load_model(sys.argv[1], 'cuda')
rows = [json.loads(l) for l in open(sys.argv[2])][:int(sys.argv[4]) if len(sys.argv) > 4 else 8]
preds = predict(m, itos, rows)
json.dump([dict(strokes=[s['pts'] for s in r['strokes']], tokens=p) for r, p in zip(rows, preds)], open(sys.argv[3], 'w'))
print('wrote', len(rows))
