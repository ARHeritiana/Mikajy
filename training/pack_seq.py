#!/usr/bin/env python3
"""Pack a train_seq.py checkpoint into the shipped JSON model for web/seq-core.js (int8 per output row for matrices, float16 for the rest).
python3 training/pack_seq.py ckpt.pt web/model/seq1.json"""
import base64, json, sys
import numpy as np, torch

ck = torch.load(sys.argv[1], map_location='cpu'); sd = ck['model']
b = lambda a: base64.b64encode(a.tobytes()).decode()
T = {}
for k, v in sd.items():
    if k == 'out.weight': continue                      # tied to emb.weight
    a = v.float().numpy()
    if a.ndim == 2:
        s = np.maximum(np.abs(a).max(1), 1e-8) / 127
        s16 = s.astype(np.float16)
        q = np.clip(np.round(a / s16.astype(np.float32)[:, None]), -127, 127).astype(np.int8)
        T[k] = dict(shape=list(a.shape), fmt='i8', data=b(q), scale=b(s16))
    else:
        T[k] = dict(shape=list(a.shape), fmt='f16', data=b(a.astype(np.float16)))
json.dump(dict(cfg=ck['cfg'], vocab=ck['itos'], tensors=T), open(sys.argv[2], 'w'), separators=(',', ':'))
print('wrote', sys.argv[2], sum(len(t['data']) + len(t.get('scale', '')) for t in T.values()) // 1024, 'KiB base64')
