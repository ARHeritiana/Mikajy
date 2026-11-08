# Mikajy — handwriting calculator for Android

[![Checks](https://github.com/ARHeritiana/Mikajy/actions/workflows/checks.yml/badge.svg)](https://github.com/ARHeritiana/Mikajy/actions/workflows/checks.yml)
[![Latest release](https://img.shields.io/github/v/release/ARHeritiana/Mikajy)](https://github.com/ARHeritiana/Mikajy/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A blank screen: write maths with your finger, it turns into a handwritten-style typeset line and the
answer appears next to it. **It works fully offline** — the recogniser, the maths engine and the fonts are inside the
app. When the phone happens to be online it checks GitHub (at most once a day, optional) for a newer release and
tells you.

## Install and update
1. Download `Mikajy-x.y.apk` from the [latest release](https://github.com/ARHeritiana/Mikajy/releases/latest) and open it
   (allow installing from your browser when Android asks). Check it with `SHA256SUMS.txt` if you like.
2. Later versions announce themselves: a red dot appears on the menu button and Settings shows **Get Mikajy x.y**.
   *Settings → Updates → Off* disables the automatic check; *Check for updates* does it on demand.
   The download opens in your browser and is installed by Android's installer — the app never installs anything itself.

Updates install over the old version only if both are signed with the same key (every release from 5.0 on is).

## What it does
* **Recognises** digits, `+ − × ÷ ( ) = . %`, stacked **fractions**, **powers and exponentials** (`x²`, `e^x`, `10⁻³`),
  **roots** (`√`, with or without the bar), `π`, `e`, `!`, and function names written as words — also in joined-up
  cursive: `sin cos tan cot sec csc asin acos atan sinh cosh tanh ln log exp sqrt abs` (also `sin⁻¹`, `sin²x`).
* **Instant** results as you write, or **on demand** (the answer appears when you write a trailing `=`).
* **Interactive editing**: scribble over something to erase it (only the covered symbols go), write a new
  symbol on top of an old one to replace it, write in the gap of a fraction to fix a numerator/denominator,
  add terms to the end/middle of a line. Tap a symbol to cycle through the recogniser's alternatives.
* **Equations in one unknown:** polynomials of degree up to 32 with rational coefficients — *every* real root, found with
  exact Sturm sequences (`x³−6x²+11x=6` → `x=1, 2, 3`, `x⁵+x=1` → `x≈0.7549`), fractions with `x` in the denominator,
  where values that make a denominator zero are excluded (`(x²−4)/(x−2)=0` → `x=−2`, `1/x+1/(x+1)=1`), and forms that can be undone
  step by step, including both branches of `|…|` and even powers: `2^x=8` → `x=3`, `e^x=5` → `x≈1.609…`,
  `|x−1|=2` → `x=−1, 3`, `(ln x)²=4`. Periodic equations (`sin x=0`) and anything else are explicitly unsupported.
* **Follow-ups on a finished line**: draw a bar *under* an existing expression and write a number below it —
  the part of the expression the bar covers becomes the numerator (`2−4`, bar, `5` → (2−4)/5; a bar under only
  the `4` → 2−4/5). Works in any order (bar first or denominator first) and with multi-digit denominators.
* **Several lines / independent calculations** anywhere on the canvas.
* **Drag & drop**: long-press a number or a result, drag it into another expression, a new spot, or onto the
  **memory bar** (bottom; it appears when it has content or while dragging). Memory chips can be dragged out.
* **History** (auto-saved, reopen / copy / delete / export), **result display** (decimal approximation clearly marked `≈` unless exact, or exact rational/mixed number when mathematically justified), **degrees / radians**.
* **Export**: copy a result, share a PNG of the canvas, share history as text (through the Android share sheet).
* Small sliders button (top-right, faint) opens the menu, in three tabs (**Actions**, **Math**, **App**; English or Français under App → Language): a paper-styled page in the app's own
  handwriting, the chosen option circled in red; History is a second page. Hardware Back closes sheets.
  In landscape the sheet docks to the right edge so it never covers the whole canvas.

Notation notes: use the angle setting for degrees or radians; a raised `0` is the exponent zero,
**not** a degree sign. `%` means /100; after a sum or difference, `50+10%` is the explicitly
supported percentage-increase convention (55). Ambiguous expressions such as `2/3x` must use
parentheses. A `×`-shaped handwritten glyph may denote the unknown `x` when it appears in
variable position (including as the start of an exponent); check recognition before trusting a result.
`sin 2x` is read as `sin(2x)`; a second function name always ends the argument (`sin x cos x`).

## Mathematical scope (correctness-first)

**ℝ or ℂ (Settings → Numbers):** in ℂ, write `i` — arithmetic is exact in the Gaussian rationals (`(1+2i)(3−i)=5+5i`, `i⁷=−i`, `√−4=2i`, `|3+4i|=5`),
transcendental results are marked `≈` (principal branch), and polynomial / rational-function equations return **every** complex root
(`x²+4x+5=0` → `x=−2−i, −2+i`). Equations with infinitely many complex solutions (`2^x=8`) and complex coefficients are unsupported. In ℝ mode `i` is refused.

**Exact special angles:** `sin 30°`, `cos 60°`, `tan 45°`, `sin(π/6)`, `cos π`, `tan(3π/4)`, `csc 30°`… are exact (no `≈`);
`sin 45°` is irrational and stays `≈0.7071…`. Decimal sums are exact too: `0.1+0.2` is `0.3`.

**Retained:** real arithmetic, parentheses, powers (integer, rational and real exponents), `e^x`, factorials of nonnegative
integers up to 170, percentages, roots, `π`, `e`, named elementary functions, exact rational arithmetic when
representable (including rational roots such as `8^(2/3)=4`), approximate transcendental values, linear/quadratic
polynomial equations, and equations with a single `x` that can be inverted exactly (`2^x=8`, `e^x=5`, `ln x=1`, `√(x+1)=3`, `5/x=2`, `x³=8`).

**Restricted:** equations require a single variable `x`: polynomials and rational functions of degree at most 32 with
rational coefficients (rational roots are shown exactly, irrational ones marked `≈`), or a single occurrence of `x`
under invertible operations (`|u|` and even powers give both branches). Trigonometric equations, which have infinitely many
solutions, are refused. An equation that is true everywhere *except* at excluded points (`x/x=1`) is refused too. All
calculations use a finite real-number domain. Division by zero, invalid roots/logarithms,
`0^0` and undefined trigonometric values are rejected.

**Calculus (engine only):** derivatives, antiderivatives, definite integrals and limits run through the bundled Nerdamer CAS in `web/calculus.js`,
but an answer is shown only when an independent numeric check of your original expression agrees; the recogniser cannot read `∫`/`lim` yet.
**Symbolic first:** exact closed forms (`2√2`, `√2/2`, `±√2`) lead and the decimal follows; `True`/`False` for statements about constants;
periodic equations as `x = nπ, n ∈ ℤ`.

**Removed:** infinite series, symbolic factorisation, unconstrained root scanning and
unverified non-polynomial equation-solving. Their former numerical heuristics were not sound.
Legacy recogniser glyph classes for these operations are filtered out; their syntax is
not supported. We prefer **unsupported** to a convincing but invalid answer.

**Output:** an explicit `=` requests a result (or `undefined`/`unsupported`).
Incomplete expressions remain silent while being handwritten. Decimal approximations
are prefixed `≈`; fraction/mixed display is used only for known exact rationals.

## Look
Black-red-white identity with a **Dark / Light** option in Settings, saved locally. Dark mode shows white handwriting on a black canvas; Light mode shows black handwriting on a white canvas. Answers, active controls and selection rings remain red in both.
Logo: a hand-lettered white **M** (Caveat Bold, SIL OFL) on the original black-and-red rounded square, lighter and drawn with a thin double sweep; `branding/make_logo.py` draws `branding/logo-512.png` / `logo-1024.png` and the launcher icon (the first artwork is kept as `branding/logo-original-512.png`).
Package id is `com.mikajy.app`.


## Repository layout
```
web/                       the app (one HTML page, HTML5 canvas, no dependencies)
  core_cnn.js              CNN inference (runs in a Web Worker; falls back to main thread)
  core_main.js             stroke grouping, personalisation (kNN over your corrections), classification
  seq-core.js              stroke-sequence recogniser: featurisation, int8 transformer inference, LaTeX → board glyphs
  recognizer.js            exponent detection, function-word matching, cursive segmentation (pure, tested)
  math-core.js             strict parser, AST, real evaluation, exact rationals, equation solving
  calculator.js            formatting and UI-facing calculation adapter
  updates.js               what an update answer means and when to ask again
  settings.js, storage.js  validated, size-bounded local preferences / history / memory
  app.js                   canvas, animation, interaction, editing, history, memory, settings sheet
  model/seq1.json          shipped int8 weights of the stroke-sequence model (training/pack_seq.py)
  model/model4.f16.json    shipped float16 weights (packed from training/model4.json by training/pack_model.py)
  fonts/hand.woff2         Caveat subset (SIL OFL) used to typeset the handwriting
  build_web.py             assembles android/assets/index.html
android/                   WebView shell (MainActivity, UpdateChecker, ShareProvider, manifest, icon)
training/                  how the recogniser was trained
tests/                     Node unit tests, headless-Chromium end-to-end tests, Java parser test
scripts/                   build / signing helpers
docs/                      ARCHITECTURE.md, RELEASING.md, AUDIT.md
.github/                   CI (checks.yml), signed releases (release.yml), templates, Dependabot
build_apk.sh               javac + d8 + aapt + zipalign + apksigner (no Gradle)
```
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together.

## Tests and build
```bash
npm test                 # node --test tests/*.test.cjs   (no dependencies)
npm run check:build      # builds the offline page; CSP / no-eval / model-sync / syntax checks
npm run test:browser     # needs: pip install playwright && playwright install chromium
npm run test:java        # update parser with -Werror (JDK + one pinned download)
MIKAJY_UNSIGNED_ONLY=1 ./build_apk.sh   # unsigned, non-installable verification APK
```
CI (`.github/workflows/checks.yml`) runs all of this on every push and pull request.

### Building a signed APK yourself
```bash
sudo apt install openjdk-21-jdk-headless aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange python3
./scripts/make-keystore.sh ~/keys/mikajy-release.jks   # once; prints the MIKAJY_* variables to export
# Export MIKAJY_KEYSTORE, MIKAJY_ALIAS, MIKAJY_STOREPASS and MIKAJY_KEYPASS.
./build_apk.sh            # -> Mikajy.apk (minSdk 21, targetSdk 34)
```
The build fails on any compiler warning and checks that the APK has the expected package id, contains the page and
`classes.dex`, and requests **no permission other than `INTERNET`**. To iterate on the UI without Android, open
`android/assets/index.html` in desktop Chrome after `python3 web/build_web.py` (bridge calls fall back to
clipboard/new tab; the update UI is hidden).

## Stroke-sequence recogniser (Settings → Recogniser → Sequence, the default)
Strokes in, LaTeX tokens out: a small transformer (encoder over strokes, autoregressive decoder, 7.6 M parameters, int8 weights, ~10 MB inside the page)
reads *everything written on a line at once*, so it handles late additions, extended lines, denominators written last, exponents, matrices, complex numbers, `mod`
and several lines without hand-written grouping rules. It runs fully offline in its own Web Worker (`web/seq-core.js`, plain JS, no `eval`, CSP unchanged);
if the worker cannot start the page falls back to the classic recogniser automatically.
* **What you see changes:** your ink stays where you wrote it and the typeset reading plus the answer appear *below* it (the model needs the ink in one
  coordinate frame, so it is not replaced by typeset glyphs). Add a stroke later and the line is re-read. Scribbling hard over ink erases it.
* **Known limits:** nested fractions and fractions inside exponents are shown inline as `(a)/(b)` (the board has one level of fraction parts); no tap-to-cycle
  alternatives (the model gives one reading); matrices, `mod`, `det` are *read* but the maths engine does not evaluate them; tested only in desktop Chromium, not on a phone.
* **Training data:** only strokes from our own generator (OFL handwriting fonts, `training/synth/`). No MNIST, no third-party corpus, no user data; four fonts are held out.

Measured through the shipped page (`training/eval_app.py --rec classic|seq`, same bag-of-symbols metric restricted to the classic CNN's symbol set; recall / precision):

| Test set | Classic | Sequence |
|---|---|---|
| 29 real finger-written samples (never trained on; 347 scored symbols) | 49.0 % / 54.5 % | 74.1 % / 60.5 % |
| 120 synthetic samples in 4 fonts unseen in training (1138 scored symbols) | 39.4 % / 50.7 % | 83.3 % / 60.1 % |

Model alone in PyTorch (`training/eval_seq.py`, whole LaTeX token sequences): real samples token error rate 28.9 %, exactly right 1/29; unseen-font synthetic token error rate 4.6 %, exactly right 61 %.
Be careful with these numbers: 29 samples is tiny (about ±5 points on recall); the real set was *used to diagnose* two generator flaws (one-stroke `+`/`×`/`x`, strokes written ~3× slower than the synthetic ones),
so later real-data gains are not independent evidence; the precision column is lowered by the extra letters the model sometimes reads (`a t i m`) in synthetic cursive.
The classic baseline was re-measured after fixing the harness (the browser cannot deliver pointer events outside the viewport; some real samples extend to x = 725).

Rebuild: `fetch_assets.sh`; `python3 -I training/gen_corpus.py --fonts $MIKAJY_ASSETS/fonts --n 130000 --out DIR/train.npz --seed 12` (plus `--heldout` / `--seed 2` for `held.npz`, `--seed 3` for `val.npz`);
`python3 training/train_seq.py --data DIR --out RUN --minutes 100` (CUDA PyTorch; `--init CKPT --aug2` fine-tunes with stroke merge/split, per-stroke wobble and time scaling);
`python3 training/pack_seq.py RUN/ckpt.pt web/model/seq1.json`; `python3 web/build_web.py`. `tests/seq-core.test.cjs` checks the JS port against PyTorch when `MIKAJY_SEQ_MODEL` / `MIKAJY_SEQ_PARITY` are set (`training/parity_seq.py`).

## Classic recogniser
Input: every group of strokes is rendered (4x supersampled, bbox scaled to 20 px, centred in 28x28,
pen ~2.9 px). Model: conv3x3(24)-pool-conv3x3(48)-pool-fc(192)-fc, with legacy advanced classes filtered at inference.
Supported classes include `0-9 + - * / ( ) =`, function-name letters, `π √ ! %`.
Fractions, exponents, roots, dots (`.`, `i`, `!`) and function words are resolved geometrically and by a
word matcher over each symbol's top-5 candidates, not by the CNN (`web/recognizer.js`):
* **Exponents** are raised, smaller glyphs measured against the base's *nominal* height, so the small `e` and `x`,
  brackets and descender letters carry exponents too (`e^x`, `e^{2x}`, `(x+1)^2`, `10^-3`).
* **Function words** (`sin cos tan cot sec csc asin acos atan sinh cosh tanh ln log exp sqrt abs`) are matched through
  look-alike letters (`5`→`s`, `1`→`i`, `(`→`c`); `x`, `p`, `q`, `r`, which the CNN has no class for, are read as `×`, `g`, `g`, `n`.
* **Cursive:** a stroke written in one pen-down that is much wider than tall is cut at its ligatures; every segmentation is
  scored with the CNN's own confidence (with a prior against splitting and a bonus when the pieces spell a function word).
Corrections you confirm are stored in `localStorage` (packed base64, ~1 KB each; the older array format is migrated automatically) and bias later predictions (cosine kNN, 400 samples).

Measured (not on a phone): MNIST test digits 98.8 %; synthetic stroke symbols 98.7 %; 4 handwriting fonts
unseen in training 89.7 % (all 33 classes, harder than real use); on those fonts 58/60 test strings such as
`sin30`, `tanh1`, `abs5`, `50%` read exactly.

### Retraining (`training/train4.py`)
Needs: python3, numpy, scipy, jax, optax, opencv-python-headless, scikit-image, fonttools, Pillow, and
* MNIST pickle, handwriting fonts and Caveat in `$MIKAJY_ASSETS` (default `/tmp`: `mnist.pkl.gz`, `fonts/*.ttf`, `caveat.ttf`)
  — `training/fetch_assets.sh` downloads all of them (SIL OFL fonts from github.com/google/fonts).
  Options: `--cursive` adds the entry/exit ligature strokes that cutting joined-up writing leaves on a letter (separate cache);
  `--no-mnist` trains without MNIST (see licensing). `training/eval_model.py` scores any model on the held-out sets.
  `train4.py` runs from the `training/` folder and reads `train.py` (the synthetic-stroke generator) next to it.
`python3 training/train4.py 6` generates per-class data (cached in `./cache/`, safe to interrupt),
trains with checkpoints (`ckpt4.pkl`, resumable) and writes `model4.json` (float32 checkpoint, kept in `training/`); then run `python3 training/pack_model.py` to produce the
half-size `web/model/model4.f16.json` that the app ships (`tests/build_check.py` fails if the two are out of sync).
Synthetic strokes (`train.py`) cover digits/operators/π/√/!/%; letters come only from fonts
(skeletonised, warped, re-inked at pen width), so real handwriting is the main unknown.

### Synthetic handwriting generator (`training/synth/`)
Makes pen-stroke samples — not images — of whole expressions, with labels, for training a stroke-sequence recogniser and for
testing the current one. `python3 -I training/generate.py --fonts $MIKAJY_ASSETS/fonts --n 1000 --out samples.jsonl`.
* **Hands:** each sample is written by one simulated writer (print, semi-joined or fully cursive; slant, size, speed, tremor,
  baseline wobble, pen-lift habits, delayed `i`-dots and `t`-bars, bar-before-numerator habit). Letterforms are traced from the
  open-licence handwriting fonts in `fetch_assets.sh` into pen strokes (`synth/trace.py`).
* **Content:** arithmetic, algebra, nested fractions, powers, roots, trigonometry, complex numbers (`i`, `z̄`, `|z|`, `e^{iπ}`),
  matrices (products, `det`, inverse, transpose), modular arithmetic (`≡ … (mod n)`, `a mod n`) and equations, each with its LaTeX.
* **Behaviour:** writing order differs from reading order — exponents, denominators and terms added *afterwards*, expressions
  *extended* on the same line (with a label for each stage), and several lines, one of which may be inserted later.
* **Labels:** per symbol: role (`num`, `den`, `sup`, `sub`, `radicand`, `cell:r,c`, …), structural path, bounding box and strokes.
* `python3 -I -m unittest discover -s training/synth -t training -p "test_synth.py"` (needs the fonts; skipped otherwise) checks
  stroke timing, geometry of fractions/exponents, late-addition ordering, diversity and reproducibility.

Limits: letter shapes come from fonts, so real pen dynamics (hesitation, overwriting) are only approximated.

### Your own handwriting (`tools/collect/`)
`python3 training/make_collect_app.py` builds `tools/collect/mikajy-collect.html`, an offline page (no network, CSP-locked) that shows
what to write — fractions, exponents and matrices laid out — in a rotating style (neat, messy, cursive, fancy, cramped, big), including
"add this part last" and "now add more on the same line" prompts. Strokes and timing are saved on the device; **⋯ → Export** writes a
`.jsonl` file in the same format as the generator. Real data is gitignored (`training/real_data/`); keep it out of the repository.

## Security model
* The page is the only content the WebView loads (`file:///android_asset/`); every other navigation is refused and
  the WebView's network loads are blocked. The app's only permission is `INTERNET`, used by the native update check
  (one HTTPS GET to GitHub's releases API; see [SECURITY.md](SECURITY.md)).
* The page carries a strict Content-Security-Policy (`default-src 'none'`, no `eval`, no remote origins).
* The JavaScript bridge has a few methods (`copy`, `shareText`, `shareImage`, `version`, `checkForUpdates`, `openUpdate`); each validates type, size and, for links, that they point into this project's GitHub releases.
* Everything read back from `localStorage` is treated as untrusted and re-validated (`web/storage.js`).
* Backups are disabled; the shared PNG lives in the app cache and is removed on the next start.
See [docs/AUDIT.md](docs/AUDIT.md) for the full review and the remaining known debt.

## Known limits
* No automatic line wrapping: a long expression shrinks to fit the width; start another line instead.
* Fractions inside fractions, nth roots, absolute-value bars `| |`, mixed numbers as input (`2 1/2` = 2 × ½),
  and variables other than a single `x` are not supported.
* Equation solving covers polynomials / rational functions in `x` and equations with a single, invertible `x` (see above); mixed forms such as `e^x=x+2` or `√x=x` are unsupported. Trigonometry uses the selected angle setting.
* Cursive segmentation and the exponent rules were validated on synthetic strokes and unit fixtures, **not yet on a large set of real finger-written samples**: expect misses on unusual hands, and use tap-to-cycle (your corrections are learnt).
* `1`/`7`/`l`, `0`/`o`, `4`/`h` confusions happen — tap a symbol to cycle alternatives.
* No physical-device benchmark or Android APK build is claimed by the Node test suite. The CNN fallback may run on the main thread when workers are unavailable; performance and battery use require device testing.

## Licences / data
The app ships one third-party library, the **Nerdamer** computer-algebra bundle used by `web/calculus.js` (Apache-2.0, with decimal.js, MIT; texts in `licenses/`), and one third-party asset, the Caveat font (SIL OFL 1.1, text in `licenses/`).
Mikajy is released under the MIT licence (LICENSE). **Read [docs/LICENSING.md](docs/LICENSING.md) before commercial use**: it
explains commercial use, the licence history, and which training data (MNIST) needs a decision.
See also [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).


## Releases and signing
Releases are produced by GitHub Actions from a `vX.Y` tag, signed with a persistent key stored as encrypted
environment secrets. See [docs/RELEASING.md](docs/RELEASING.md) for the one-time key setup, importing an existing key
and the release procedure. A signing key must **never** be committed.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and the [changelog](CHANGELOG.md).
