# Architecture

Mikajy is one self-contained HTML page shown by a thin Android WebView shell. There is no server, no framework
and no runtime dependency.

```
 pen strokes ──► core_main.group()      cluster strokes into symbols (dots, fraction bars, roots)
              └► recognizer.segmentStroke()  cut joined-up cursive strokes into letters      ┐
 symbols ─────► core_cnn.predict()      CNN (Web Worker, main-thread fallback) → class probabilities
              └► core_main.classifyP()  blend with kNN over the user's confirmed corrections │ recognition
 candidates ──► recognizer.wordfix()    function words, look-alike letters, cursive e         │
              └► recognizer.assignSup() exponents and their extent                            ┘
 glyph list ──► app.tokSeq()            tokens: numbers, ^( ), fractions, √( ), words
 tokens ──────► Calculator.compute()    ──► MathCore.parse/evaluate/solve ──► typeset answer pieces
```

## Modules (`web/`)
| File | Responsibility | Tested by |
|------|----------------|-----------|
| `math-core.js` | Strict recursive-descent parser → AST; exact rational arithmetic (BigInt, bounded); real evaluation with domain checks; polynomial solver; invertible single-`x` solver | `math-core.test.cjs`, `math-extended.test.cjs` |
| `calculator.js` | Chooses equation vs expression, renders exact/approximate results (`≈` only for inexact) | `calculator.test.cjs` |
| `recognizer.js` | Pure heuristics over `{c:[{c,p}], i, b}` glyph objects | `recognizer.test.cjs` |
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
2. **Heuristics are pure and fixture-tested.** Anything that decides what the user *meant* belongs in `recognizer.js`,
   not in event handlers.
3. **The page never talks to the network.** Anything online goes through a validated bridge method.

## Known debt
`app.js` and `core_main.js` remain dense (see [AUDIT.md](AUDIT.md)); the recogniser heuristics have been moved out
incrementally into `recognizer.js` behind tests. Next candidates: stroke grouping (`group`), fraction detection
(`findFractions`) and tokenisation (`tokSeq`).
