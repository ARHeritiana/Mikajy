"""Train the stroke-sequence model.  python3 train_seq.py --data DIR [--minutes 90] [--out DIR]   DIR holds train.npz val.npz held.npz (gen_corpus.py)."""
import argparse, collections, json, math, os, sys, time
import numpy as np, torch, torch.nn.functional as F
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seqmodel import StrokeSeq, MAXS, MAXT
from strokefeat import featurise, tokenize

SPECIAL = ['<pad>', '<bos>', '<eos>']


def load(path):
    z = np.load(path)
    P, T, lens, tok, beh, dom = (z[k] for k in ('P', 'T', 'lens', 'tok', 'beh', 'dom'))   # each npz access decompresses: read once
    off = np.r_[0, np.cumsum(lens)]
    return [dict(P=P[off[i]:off[i + 1]], T=T[off[i]:off[i + 1]], tok=str(tok[i]).split(' '), beh=str(beh[i]), dom=str(dom[i])) for i in range(len(lens))]


AUG2 = False


def _resample(a, k=24):
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(a, axis=0).T))]
    if d[-1] < 1e-6: return np.repeat(a[:1], k, axis=0)
    u = np.linspace(0, d[-1], k)
    return np.stack([np.interp(u, d, a[:, 0]), np.interp(u, d, a[:, 1])], 1).astype(np.float32)


def stroke_aug(P, T, rng, pm=.12, ps=.08, pr=.12):
    """Real hands join strokes (a 7 with its bar, a cursive x) or break them (a 5 and its hat): randomly merge consecutive quick strokes and split long ones."""
    n = len(P); outP, outT = [], []; i = 0
    P = np.array(P, copy=True)
    for k in range(n):                      # people draw bars right to left and circles either way round: reverse some strokes
        if rng.random() < pr: P[k] = P[k][::-1]
    while i < n:
        p, t = P[i].astype(np.float32), T[i].astype(np.float32).copy()
        if i + 1 < n and T[i + 1][0] < 1.2 and rng.random() < pm:
            q = P[i + 1]
            t[1] = np.log1p(np.expm1(t[1]) + np.expm1(T[i + 1][0]) + np.expm1(T[i + 1][1]))
            p = _resample(np.concatenate([p, q.astype(np.float32)])); i += 1
        elif np.ptp(p, axis=0).max() > .35 and rng.random() < ps:
            j = int(rng.integers(8, 17)); half = max(t[1] - .35, 0) * .5
            ta, tb = t.copy(), t.copy(); ta[1] = tb[1] = half; tb[0] = 0.0
            outP += [_resample(p[:j + 1]), _resample(p[j:])]; outT += [ta, tb]; i += 1; continue
        outP.append(p); outT.append(t); i += 1
    T2 = np.stack(outT); T2[:, 2] = np.arange(len(outT)) / max(len(outT) - 1, 1)
    # finger writing is slower than pen writing: random global time scaling of stroke durations and pauses
    fd, fg = np.exp(rng.uniform(np.log(.6), np.log(4.5))), np.exp(rng.uniform(np.log(.6), np.log(3)))
    T2[:, 1] = np.log1p(fd * np.expm1(T2[:, 1])); T2[:, 0] = np.log1p(fg * np.expm1(T2[:, 0]))
    return np.stack(outP), T2


def batchify(items, vocab, dev, aug=False, rng=None):
    if aug and AUG2:
        items = [dict(it, **dict(zip(('P', 'T'), stroke_aug(it['P'], it['T'], rng)))) for it in items]
    S = max(len(i['P']) for i in items); L = max(len(i['tok']) for i in items) + 2
    B = len(items)
    P = np.zeros((B, S, 24, 2), np.float32); T = np.zeros((B, S, 3), np.float32); V = np.zeros((B, S), bool); Y = np.zeros((B, L), np.int64)
    for b, it in enumerate(items):
        n = len(it['P']); P[b, :n] = it['P']; T[b, :n] = it['T']; V[b, :n] = True
        ids = [1] + [vocab[t] for t in it['tok']] + [2]; Y[b, :len(ids)] = ids
    P, T, V, Y = [torch.from_numpy(a).to(dev) for a in (P, T, V, Y)]
    if aug:
        g = torch.Generator(device=dev); g.manual_seed(int(rng.integers(1 << 30)))
        r = lambda *s: torch.rand(*s, device=dev, generator=g)
        th = (r(B) - .5) * 2 * math.radians(7); sh = (r(B) - .5) * .3; sx = .8 + .45 * r(B); sy = sx * (.85 + .3 * r(B))
        A = torch.stack([torch.stack([sx * th.cos(), -sy * th.sin() + sh * sy], -1), torch.stack([sx * th.sin(), sy * th.cos()], -1)], 1)
        mn = P[V].reshape(-1, 2).min(0).values if False else 0
        P = torch.einsum('bij,bskj->bski', A, P)
        mnb = P.masked_fill(~V[:, :, None, None], 1e9).amin((1, 2))
        P = P - mnb[:, None, None]
        P = P + torch.randn_like(P) * .01 * (r(B)[:, None, None, None] * 2)
        T = T.clone(); T[..., :2] += torch.randn_like(T[..., :2]) * .1
        if AUG2:   # per-stroke placement/size error and smooth wobble, like an imprecise finger
            sk = lambda *sh: torch.randn(*sh, device=dev, generator=g)
            ctr = P.mean(2, keepdim=True)
            P = (P - ctr) * (1 + .06 * sk(B, P.shape[1], 1, 1)) + ctr + .04 * sk(B, P.shape[1], 1, 2)
            w = sk(B, P.shape[1], 6, 2) * .02
            P = P + torch.nn.functional.interpolate(w.flatten(0, 1).transpose(1, 2), size=24, mode='linear', align_corners=True).transpose(1, 2).view_as(P)
    return P, T, V, Y


def edit(a, b):
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return d[-1]


@torch.no_grad()
def evaluate(model, items, vocab, inv, dev, bs=96, limit=None):
    model.eval(); items = items[:limit] if limit else items
    order = sorted(range(len(items)), key=lambda i: len(items[i]['P']))
    ex = ed = tot = 0; by = collections.defaultdict(lambda: [0, 0]); preds = {}
    for k in range(0, len(order), bs):
        ch = [items[i] for i in order[k:k + bs]]
        P, T, V, Y = batchify(ch, vocab, dev)
        with torch.autocast('cuda', dtype=torch.bfloat16):
            out = model.greedy(P, T, V, 1, 2).cpu().numpy()
        for it, o, idx in zip(ch, out, order[k:k + bs]):
            seq = []
            for t in o:
                if t == 2: break
                seq.append(inv[t])
            preds[idx] = seq
            e = edit(seq, it['tok']); ed += e; tot += len(it['tok']); ex += e == 0
            for key in ('beh:' + it['beh'], 'dom:' + it['dom']): by[key][0] += e == 0; by[key][1] += 1
    return dict(exact=ex / len(items), ter=ed / tot), {k: v[0] / v[1] for k, v in by.items()}, [preds[i] for i in range(len(items))]


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--out', required=True); ap.add_argument('--minutes', type=float, default=90)
    ap.add_argument('--bs', type=int, default=48); ap.add_argument('--lr', type=float, default=6e-4); ap.add_argument('--d', type=int, default=256); ap.add_argument('--ff', type=int, default=1024)
    ap.add_argument('--layers', type=int, default=4); ap.add_argument('--max-steps', type=int, default=0)
    ap.add_argument('--init'); ap.add_argument('--aug2', action='store_true'); ap.add_argument('--warmup', type=int, default=500)
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True); dev = 'cuda'
    tr = load(a.data + '/train.npz'); va = load(a.data + '/val.npz'); he = load(a.data + '/held.npz')
    tr = [i for i in tr if len(i['P']) <= MAXS and len(i['tok']) <= MAXT - 3]
    words = sorted({t for i in tr for t in i['tok']})
    itos = SPECIAL + words
    if a.init:                                        # fine-tuning keeps the checkpoint's vocabulary; samples with other tokens are dropped
        itos = torch.load(a.init, map_location='cpu')['itos']; words = itos[len(SPECIAL):]
        tr = [i for i in tr if all(t in set(words) for t in i['tok'])]
    vocab = {t: k for k, t in enumerate(itos)}
    for s in (va, he):
        for i in s: i['tok'] = [t for t in i['tok']]
    unk = {t for s in (va, he) for i in s for t in i['tok']} - set(vocab)
    print('train', len(tr), 'vocab', len(itos), 'unk in val/held', unk, flush=True)
    json.dump(itos, open(a.out + '/vocab.json', 'w'))
    for s in (va, he):
        for i in s: i['tok'] = [t if t in vocab else words[0] for t in i['tok']]
    model = StrokeSeq(len(itos), d=a.d, h=a.d // 32, ff=a.ff, ne=a.layers, nd=a.layers).to(dev)
    AUG2 = a.aug2
    if a.init:
        ck = torch.load(a.init, map_location=dev); assert ck['itos'] == itos; model.load_state_dict(ck['model'])
    print('params', sum(p.numel() for p in model.parameters()) / 1e6, 'M', flush=True)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, betas=(.9, .98), weight_decay=.02)
    rng = np.random.default_rng(0); t0 = time.time(); budget = a.minutes * 60
    # length-bucketed batches
    def epoch_batches():
        idx = rng.permutation(len(tr)); chunks = [idx[i:i + a.bs * 50] for i in range(0, len(idx), a.bs * 50)]
        bs = []
        for c in chunks:
            c = sorted(c, key=lambda i: len(tr[i]['P']) * 4 + len(tr[i]['tok']))
            bs += [c[i:i + a.bs] for i in range(0, len(c), a.bs)]
        rng.shuffle(bs); return bs
    step = 0; ep = 0; best = 1e9; done = False; ema = None
    while not done:
        for b in epoch_batches():
            frac = min((time.time() - t0) / budget, 1.0)
            lr = a.lr * min(1, (step + 1) / a.warmup) * (.5 * (1 + math.cos(math.pi * frac)) * .98 + .02)
            for g in opt.param_groups: g['lr'] = lr
            model.train()
            P, T, V, Y = batchify([tr[i] for i in b], vocab, dev, True, rng)
            with torch.autocast('cuda', dtype=torch.bfloat16):
                lg = model(P, T, V, Y[:, :-1])
                loss = F.cross_entropy(lg.float().reshape(-1, lg.shape[-1]), Y[:, 1:].reshape(-1), ignore_index=0, label_smoothing=.05)
            opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step()
            ema = loss.item() if ema is None else .98 * ema + .02 * loss.item(); step += 1
            if step % 200 == 0: print(f'step {step} ep {ep} loss {ema:.4f} lr {lr:.2e} {int(time.time() - t0)}s', flush=True)
            if step % 3000 == 0 or frac >= 1 or (a.max_steps and step >= a.max_steps):
                m1, _, _ = evaluate(model, va, vocab, itos, dev, limit=600); m2, _, _ = evaluate(model, he, vocab, itos, dev, limit=600)
                print(f'  EVAL step {step}: val(train fonts) {m1}  heldout fonts {m2}', flush=True)
                torch.save(dict(model=model.state_dict(), itos=itos, cfg=dict(d=a.d, ff=a.ff, layers=a.layers)), a.out + '/ckpt.pt')
            if frac >= 1 or (a.max_steps and step >= a.max_steps): done = True; break
        ep += 1
    print('done', step, 'steps', int(time.time() - t0), 's', flush=True)
