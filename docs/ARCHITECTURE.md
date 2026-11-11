# Architecture

Mikajy is one self-contained HTML page shown by a thin Android WebView shell. There is no server, no framework
and no runtime dependency.

```
 pen strokes ──► recognizer.segmentStroke()  cut joined-up cursive strokes into letters
              └► app.zoneOf + core_main.group()  strokes → symbols, per zone (line, numerator, denominator, exponent)
 symbols ─────► core_cnn.predict()      CNN (Web Worker, main-thread fallback) → class probabilities
              └► core_main.classifyP()  blend with kNN over the user's confirmed corrections
 symbols ─────► Ink.addFraction / addRoot / overwritten / insert   edit the line's expression tree
 tree ────────► Ink.readAll()           context weights, function words (recognizer.wordfix), cursive e
              └► Ink.layoutSeq()        typeset targets: every node gets the box the user will see
              └► Ink.tokens()           numbers, ^( ), ((n)/(d)), √( ), words
 tokens ──────► Calculator.compute()    ──► MathCore.parse/evaluate/solve ──► typeset answer (also a tree)
```

The single invariant: **every editing decision compares new ink with what is on the screen** (`box` of typeset nodes,
`raw` ink box of nodes not typeset yet). A root owns its radicand, a fraction its numerator and denominator, an
exponent its base's superscript, so there are no index-based "cover" counts or flags to keep in sync.

## Modules (`web/`)
| File | Responsibility | Tested by |
|------|----------------|-----------|
| `math-core.js` | Strict recursive-descent parser → AST; exact rational arithmetic (BigInt, bounded); real evaluation with domain checks; polynomial solver; invertible single-`x` solver | `math-core.test.cjs`, `math-extended.test.cjs` |
| `calculator.js` | Chooses equation vs expression, renders exact/approximate results (`≈` only for inexact) | `calculator.test.cjs` |
| `recognizer.js` | Function words, cursive segmentation, glyph metrics over `{c:[{c,p}], i, b}` glyph objects | `recognizer.test.cjs` |
| `ink.js` | Expression tree: placement, exponents, fractions, roots, overwrite, erasing, layout, tokens, (de)serialisation | `ink.test.cjs`, `recognizer.test.cjs`, `browser_strokes.py` |
| `core_cnn.js` | conv-pool-conv-pool-fc-fc inference on float16 weights | `cnn.test.cjs` |
| `core_main.js` | Stroke grouping, rendering to 28×28, personalisation | `recogniser-memory.test.cjs` |
| `i18n.js` | English / French interface strings and result words (pure; missing French keys fall back to English) | `i18n.test.cjs` |
| `settings.js`, `storage.js` | Validated persistence; `localStorage` is untrusted input | `settings.test.cjs`, `storage.test.cjs` |
| `updates.js` | Version comparison, answer interpretation, check scheduling | `updates.test.cjs` |
| `app.js` | Canvas, animation, editing, history, memory, settings sheet, update UI | `browser_*.py` (headless Chromium) |

`web/build_web.py` concatenates these (plus the font and model) into `android/assets/index.html`. Load order matters:
`storage → core_main → recognizer → math-core → i18n → calculator → settings → updates → app`.

## Android shell (`android/`)
- `MainActivity` – immersive WebView, bridge (`copy`, `shareText`, `shareImage`, `version`, `checkForUpdates`, `openUpdate`).
  Network loads are blocked inside the WebView and navigation outside `file:///android_asset/` is refused.
- `UpdateChecker` – the only network code; see [SECURITY.md](../SECURITY.md). Returns a tiny JSON answer to
  `window.onUpdateResult`; the page decides what it means (`updates.js`).
- `ShareProvider` – content provider for the shared PNG.

## Design rules
1. **Prefer "unsupported" to a plausible wrong answer.** Domains are checked, equations are solved only by sound methods,
   exactness is claimed only for exact rationals.
2. **Heuristics are pure and fixture-tested.** Anything that decides what the user *meant* belongs in `ink.js` or
   `recognizer.js`, not in event handlers.
3. **The page never talks to the network.** Anything online goes through a validated bridge method.

## Known debt
Editing structure, layout and tokenisation are in `ink.js` behind unit and drawn-stroke tests. Still dense: stroke
grouping (`core_main.group`) and the root-sign shape test (`app.radical`). The thresholds were validated on synthetic
strokes, not yet on recorded finger-written samples.
