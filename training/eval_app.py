"""Replay real (or generated) stroke samples through the SHIPPED page and score the recognised symbols.
   python3 training/eval_app.py training/real_data/FILE.jsonl [--max N]
Metric: bag-of-symbols precision/recall against the prompt's LaTeX, counted only for symbols the recogniser has a class for.
(The prompt is known only as LaTeX, so order/structure is checked separately by the line count.)"""
import argparse, asyncio, collections, json, re, sys
from pathlib import Path
from playwright.async_api import async_playwright

PAGE = (Path(__file__).resolve().parents[1] / "android/assets/index.html").as_uri()
CMD = {'frac': ['§'], 'sqrt': ['√'], 'times': ['*'], 'div': ['/'], 'ln': list('ln'), 'sin': list('sin'), 'cos': list('cos'),
       'tan': list('tan'), 'log': list('log'), 'det': list('det'), 'bmod': list('mod'), 'pi': ['π'], 'equiv': ['≡'], 'exp': list('exp'), 'gcd': list('gcd')}
IGNORE = {'left', 'right', 'begin', 'end', 'overline', 'pmatrix', 'bmatrix', 'vmatrix'}


def expected(latex):
    out = []
    latex = re.sub(r'\\(begin|end)\{[a-z]+\}', '', latex)
    for m in re.finditer(r'\\([A-Za-z]+)|(.)', latex):
        if m.group(1):
            if m.group(1) in CMD: out += CMD[m.group(1)]
        else:
            c = m.group(2)
            if c in ' {}^_&\\': continue
            out.append('*' if c == 'x' else c)
    return out


async def run(rows, vocab, zoom=1.0):
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for r in rows:
            page = await browser.new_page(viewport={"width": int(r['width'] * zoom), "height": int(560 * zoom)})
            await page.goto(PAGE); await page.locator("#pad").wait_for()
            for s in r['strokes']:
                pts = [(x * zoom, y * zoom) for x, y, *_ in s['pts']]
                await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down()
                for q in pts[1:]: await page.mouse.move(q[0], q[1])
                await page.mouse.up(); await page.wait_for_timeout(60)
            await page.wait_for_timeout(2500)
            got = await page.evaluate("() => ({lines: lines.length, chars: lines.flatMap(L => L.syms.map(g => g.c[g.i].c))})")
            await page.close()
            exp = expected(' '.join(r['latex']))
            results.append((r, exp, got))
        await browser.close()
    return results


def score(exp, got, vocab):
    ev = [c for c in exp if c in vocab]
    ec, gc = collections.Counter(ev), collections.Counter(got)
    hit = sum((ec & gc).values())
    return hit, len(ev), len(got), ec - gc, gc - ec, len(exp) - len(ev)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('file'); ap.add_argument('--max', type=int, default=10**9); ap.add_argument('--zoom', type=float, default=1.0)
    a = ap.parse_args()
    rows = [json.loads(l) for l in open(a.file)][:a.max]
    model = json.load(open(Path(__file__).resolve().parents[1] / 'web/model/model4.f16.json'))
    vocab = set(model['cls']) | {'§'}
    res = asyncio.run(run(rows, vocab, a.zoom))
    groups = collections.defaultdict(lambda: [0, 0, 0]); miss = collections.Counter(); extra = collections.Counter(); oov = 0; tot = 0
    line_ok = exact = 0
    for r, exp, got in res:
        hit, ne, ng, m, x, o = score(exp, got['chars'], vocab)
        miss.update(m); extra.update(x); oov += o; tot += len(exp)
        line_ok += got['lines'] == len(r['latex']); exact += (not m and not x)
        for key in ('all', 'style:' + r['style'], 'domain:' + r['domain'], 'behaviour:' + r['behaviour']):
            g = groups[key]; g[0] += hit; g[1] += ne; g[2] += ng
    print(f"{len(res)} samples; line count correct: {line_ok}/{len(res)}; symbol bag exactly right: {exact}/{len(res)}")
    print(f"{oov}/{tot} symbols in the prompts have NO recogniser class (e.g. y z, brackets, ≡) and are excluded below\n")
    print(f"{'group':34s} recall  precision")
    for k in sorted(groups, key=lambda k: (k != 'all', k)):
        h, n, g = groups[k]; print(f"{k:34s} {100 * h / max(n, 1):5.1f}%  {100 * h / max(g, 1):5.1f}%   (n={n})")
    print('\nmost often missed :', miss.most_common(12))
    print('most often spurious:', extra.most_common(12))
