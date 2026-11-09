# Mikajy Spark — lightweight handwriting calculator for Android

[![Checks](https://github.com/ARHeritiana/Mikajy-Spark/actions/workflows/checks.yml/badge.svg)](https://github.com/ARHeritiana/Mikajy-Spark/actions/workflows/checks.yml)
[![Latest release](https://img.shields.io/github/v/release/ARHeritiana/Mikajy-Spark)](https://github.com/ARHeritiana/Mikajy-Spark/releases/latest)
[![License: MIT (main)](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Mikajy Spark** is the fast, lightweight edition of the Mikajy handwriting-calculator family; the separate [Mikajy Atlas](https://github.com/Heritiana-Ankatso/Mikajy-Atlas) edition provides the expanded mathematical tools. The app keeps the existing `com.mikajy.app` package ID and release channel.

A blank screen: write maths with your finger, it turns into a handwritten-style typeset line and the
answer appears next to it. **It works fully offline** — the recogniser, the maths engine and the fonts are inside the
app. When the phone happens to be online it checks GitHub (at most once a day, optional) for a newer release and
tells you.

## Install and update
1. Download the APK (currently the previously published `Mikajy-5.0.apk`; future releases use the Spark name) from the [latest release](https://github.com/ARHeritiana/Mikajy-Spark/releases/latest) and open it
   (allow installing from your browser when Android asks). Check it with `SHA256SUMS.txt` if you like.
2. Later versions announce themselves: a red dot appears on the menu button and the **App** tab of the menu shows **Get Mikajy Spark x.y**.
   *App → Updates → Off* disables the automatic check; *Check for updates* does it on demand.
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
* **Equations in one unknown:** polynomials of degree 1–2 with rational coefficients (`2x+3=7` → `x=2`, `(x−1)²=0` → `x=1`)
  and one-to-one forms such as `2^x=8` → `x=3`, `e^x=5` → `x≈1.609…`, `ln x=1` → `x≈2.718…`.
  Anything else is explicitly unsupported.
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

**Retained:** real arithmetic, parentheses, powers (integer, rational and real exponents), `e^x`, factorials of nonnegative
integers up to 170, percentages, roots, `π`, `e`, named elementary functions, exact rational arithmetic when
representable (including rational roots such as `8^(2/3)=4`), approximate transcendental values, linear/quadratic
polynomial equations, and equations with a single `x` that can be inverted exactly (`2^x=8`, `e^x=5`, `ln x=1`, `√(x+1)=3`, `5/x=2`, `x³=8`).

**Restricted:** equations require a single variable `x`: polynomials of degree at most two with rational
coefficients, or a single occurrence of `x` under one-to-one operations. Trigonometric, absolute-value and even-power
equations with several solutions are refused. Exact
quadratic roots are shown when provable; irrational roots are marked `≈`. All
calculations use a finite real-number domain. Division by zero, invalid roots/logarithms,
`0^0` and undefined trigonometric values are rejected.

**Removed:** derivative/antiderivative calculation, definite and improper integration,
limits, infinite series, symbolic factorisation, unconstrained root scanning and
non-polynomial equation-solving. Their former numerical heuristics were not sound.
Legacy recogniser glyph classes for these operations are filtered out; their syntax is
not supported. We prefer **unsupported** to a convincing but invalid answer.

**Output:** an explicit `=` requests a result (or `undefined`/`unsupported`).
Incomplete expressions remain silent while being handwritten. Decimal approximations
are prefixed `≈`; fraction/mixed display is used only for known exact rationals.

## Look
Black-red-white identity with a **Dark / Light** option in Settings, saved locally. Dark mode shows white handwriting on a black canvas; Light mode shows black handwriting on a white canvas. Answers, active controls and selection rings remain red in both.
Logo: **light and fast**: three white chevrons fading in from left to right across a black / red split. Source: `branding/logo-spark.svg` (plain paths, no font); `node branding/render_logo.cjs` (needs Playwright + Chromium) renders `branding/logo-512.png`, `logo-1024.png` and the 192 px launcher icon `android/res/drawable/icon.png`. Package id is `com.mikajy.app`.


## Repository layout
```
web/                       the app (one HTML page, HTML5 canvas, no dependencies)
  core_cnn.js              CNN inference (runs in a Web Worker; falls back to main thread)
  core_main.js             stroke grouping, personalisation (kNN over your corrections), classification
  recognizer.js            exponent detection, function-word matching, cursive segmentation (pure, tested)
  math-core.js             strict parser, AST, real evaluation, exact rationals, equation solving
  calculator.js            formatting and UI-facing calculation adapter
  updates.js               what an update answer means and when to ask again
  settings.js, storage.js  validated, size-bounded local preferences / history / memory
  app.js                   canvas, animation, interaction, editing, history, memory, settings sheet
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

## Recogniser
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
* MNIST pickle at `/tmp/mnist.pkl.gz`, handwriting fonts in `/tmp/fonts/*.ttf` and Caveat as `/tmp/caveat.ttf`
  — `training/fetch_assets.sh` downloads all of them (SIL OFL fonts from github.com/google/fonts).
  `train4.py` runs from the `training/` folder and reads `train.py` (the synthetic-stroke generator) next to it.
`python3 training/train4.py 6` generates per-class data (cached in `./cache/`, safe to interrupt),
trains with checkpoints (`ckpt4.pkl`, resumable) and writes `model4.json` (float32 checkpoint, kept in `training/`); then run `python3 training/pack_model.py` to produce the
half-size `web/model/model4.f16.json` that the app ships (`tests/build_check.py` fails if the two are out of sync).
Synthetic strokes (`train.py`) cover digits/operators/π/√/!/%; letters come only from fonts
(skeletonised, warped, re-inked at pen width), so real handwriting is the main unknown.

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
* Equation solving is limited to polynomials of degree ≤2 with rational coefficients and to equations with a single, invertible `x`. Trigonometry uses the selected angle setting.
* Cursive segmentation and the exponent rules were validated on synthetic strokes and unit fixtures, **not yet on a large set of real finger-written samples**: expect misses on unusual hands, and use tap-to-cycle (your corrections are learnt).
* `1`/`7`/`l`, `0`/`o`, `4`/`h` confusions happen — tap a symbol to cycle alternatives.
* No physical-device benchmark or Android APK build is claimed by the Node test suite. The CNN fallback may run on the main thread when workers are unavailable; performance and battery use require device testing.

## Licences / data
Caveat font: SIL Open Font License. Training used MNIST and other OFL handwriting fonts; no font other than
Caveat ships in the app. Source licensing is governed by LICENSE; third-party fonts and datasets retain their own licences.


## Releases and signing
Releases are produced by GitHub Actions from a `vX.Y` tag, signed with a persistent key stored as encrypted
environment secrets. See [docs/RELEASING.md](docs/RELEASING.md) for the one-time key setup, importing an existing key
and the release procedure. A signing key must **never** be committed.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and the [changelog](CHANGELOG.md).

## Licensing

The Mikajy Spark (formerly Mikajy) project code on **main** is licensed under the [MIT License](LICENSE), beginning with the licensing correction on 2026-11-09. This is a grant for the code owned by the project; third-party assets and trained model weights require their own provenance and licence checks. The bundled Caveat font is subject to the SIL Open Font License 1.1. In particular, do not assume that the MIT code licence alone authorises commercial use of any weights trained on data with uncertain terms.

**Historical releases are unchanged:** the existing `v5.0` tag and its APK were published with GPL-3.0-or-later terms. Updating `main` does not retroactively relicense or rebuild that tagged release. A future release based on `main` can carry the new MIT code licence, after reviewing bundled assets and training provenance.

The separate [Mikajy Atlas](https://github.com/Heritiana-Ankatso/Mikajy-Atlas) edition (historically Mikajy Free) has **different terms**: PolyForm Noncommercial 1.0.0 for project code and CC BY-NC-SA 4.0 for its research model weights. Do not copy its restricted model/data artifacts into this project.
