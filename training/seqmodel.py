"""Stroke-sequence -> LaTeX token transformer (encoder over strokes, autoregressive decoder).  Pre-LN, GELU(tanh), no biases in attention
projections' shapes beyond what web/seq-core.js implements.  Inputs are the normalised stroke arrays from strokefeat.featurise."""
import math, torch, torch.nn as nn, torch.nn.functional as F
from strokefeat import K

FREQS = 6
NFEAT = K * 2 + 6 + 3 + 4 * FREQS
MAXS, MAXT = 160, 136


def stroke_features(P, T):
    """P [B,S,K,2], T [B,S,3] -> [B,S,NFEAT]"""
    mn, mx = P.min(2).values, P.max(2).values
    wh = mx - mn
    c = (mn + mx) / 2
    sz = wh.max(-1, keepdim=True).values.clamp_min(.05)
    shape = ((P - c[:, :, None]) / sz[..., None]).flatten(2)
    fr = 2.0 ** torch.arange(FREQS, device=P.device, dtype=P.dtype) * (math.pi / 8)
    ang = c[..., None] * fr
    four = torch.cat([ang.sin(), ang.cos()], -1).flatten(2)
    return torch.cat([shape, mn, mx, wh, T, four], -1)


class MHA(nn.Module):
    def __init__(s, d, h):
        super().__init__(); s.h = h; s.q = nn.Linear(d, d); s.k = nn.Linear(d, d); s.v = nn.Linear(d, d); s.o = nn.Linear(d, d)

    def forward(s, x, m, mask=None, causal=False):
        B, Tq, D = x.shape; Tk = m.shape[1]
        sp = lambda t, n: t.view(B, n, s.h, D // s.h).transpose(1, 2)
        y = F.scaled_dot_product_attention(sp(s.q(x), Tq), sp(s.k(m), Tk), sp(s.v(m), Tk), attn_mask=mask, is_causal=causal and mask is None)
        return s.o(y.transpose(1, 2).reshape(B, Tq, D))


class Block(nn.Module):
    def __init__(s, d, h, ff, cross):
        super().__init__()
        s.n1 = nn.LayerNorm(d); s.a1 = MHA(d, h)
        s.cross = cross
        if cross: s.n2 = nn.LayerNorm(d); s.a2 = MHA(d, h)
        s.n3 = nn.LayerNorm(d); s.f1 = nn.Linear(d, ff); s.f2 = nn.Linear(ff, d)

    def forward(s, x, enc=None, self_mask=None, enc_mask=None, causal=False):
        n = s.n1(x); x = x + s.a1(n, n, self_mask, causal)
        if s.cross: x = x + s.a2(s.n2(x), enc, enc_mask)
        return x + s.f2(F.gelu(s.f1(s.n3(x)), approximate='tanh'))


class StrokeSeq(nn.Module):
    def __init__(s, nvocab, d=256, h=8, ff=1024, ne=4, nd=4):
        super().__init__()
        s.d = d
        s.in1 = nn.Linear(NFEAT, d); s.in2 = nn.Linear(d, d); s.idx = nn.Embedding(MAXS, d)
        s.enc = nn.ModuleList(Block(d, h, ff, False) for _ in range(ne)); s.encn = nn.LayerNorm(d)
        s.emb = nn.Embedding(nvocab, d); s.pos = nn.Embedding(MAXT, d)
        s.dec = nn.ModuleList(Block(d, h, ff, True) for _ in range(nd)); s.decn = nn.LayerNorm(d)
        s.out = nn.Linear(d, nvocab, bias=False); s.out.weight = s.emb.weight
        for e in (s.emb, s.pos, s.idx): nn.init.normal_(e.weight, std=.05)   # tied output layer: N(0,1) would give huge logits

    def encode(s, P, T, valid):
        x = stroke_features(P, T)
        x = s.in2(F.gelu(s.in1(x), approximate='tanh')) + s.idx(torch.arange(P.shape[1], device=P.device).clamp_max(MAXS - 1))
        m = valid[:, None, None, :]
        for b in s.enc: x = b(x, self_mask=m)
        return s.encn(x), m

    def decode(s, tok, enc, m):
        x = s.emb(tok) + s.pos(torch.arange(tok.shape[1], device=tok.device))
        for b in s.dec: x = b(x, enc, None, m, causal=True)
        return s.out(s.decn(x))

    def forward(s, P, T, valid, tok):
        enc, m = s.encode(P, T, valid)
        return s.decode(tok, enc, m)

    @torch.no_grad()
    def greedy(s, P, T, valid, bos, eos, maxlen=MAXT - 1):
        enc, m = s.encode(P, T, valid)
        B = P.shape[0]
        tok = torch.full((B, 1), bos, device=P.device, dtype=torch.long)
        done = torch.zeros(B, dtype=torch.bool, device=P.device)
        for _ in range(maxlen):
            nxt = s.decode(tok, enc, m)[:, -1].argmax(-1)
            nxt = torch.where(done, torch.full_like(nxt, eos), nxt)
            tok = torch.cat([tok, nxt[:, None]], 1); done |= nxt == eos
            if done.all(): break
        return tok[:, 1:]
