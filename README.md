# Mikajy — handwriting calculator for Android

A blank screen: write maths with your finger, it turns into a handwritten-style typeset line and the
answer appears next to it. Everything runs on the device (no network, no permissions).

## What it does
* **Recognises** digits, `+ − × ÷ ( ) = . %`, stacked **fractions**, **powers** (small raised text),
  **roots** (`√`, with or without the bar), `π`, `e`, `!`, and function names written as words:
  `sin cos tan asin acos atan sinh cosh tanh ln log abs` (also `sin⁻¹`, `sin²x`).
* **Instant** results as you write, or **on demand** (the answer appears when you write a trailing `=`).
* **Interactive editing**: scribble over something to erase it (only the covered symbols go), write a new
  symbol on top of an old one to replace it, write in the gap of a fraction to fix a numerator/denominator,
  add terms to the end/middle of a line. Tap a symbol to cycle through the recogniser's alternatives.
* **Single-unknown polynomial equations of degree 1 or 2** with rational coefficients: `2x+3=7` → `x=2`, `(x−1)²=0` → `x=1` (including repeated roots). Non-polynomial equations are explicitly unsupported.
* **Follow-ups on a finished line**: draw a bar *under* an existing expression and write a number below it —
  the part of the expression the bar covers becomes the numerator (`2−4`, bar, `5` → (2−4)/5; a bar under only
  the `4` → 2−4/5). Works in any order (bar first or denominator first) and with multi-digit denominators.
* **Several lines / independent calculations** anywhere on the canvas.
* **Drag & drop**: long-press a number or a result, drag it into another expression, a new spot, or onto the
  **memory bar** (bottom; it appears when it has content or while dragging). Memory chips can be dragged out.
* **History** (auto-saved, reopen / copy / delete / export), **result display** (decimal approximation clearly marked `≈` unless exact, or exact rational/mixed number when mathematically justified), **degrees / radians**.
* **Export**: copy a result, share a PNG of the canvas, share history as text (through the Android share sheet).
* Small sliders button (top-right, faint) opens the settings sheet: a paper-styled page in the app's own
  handwriting, the chosen option circled in red; History is a second page. Hardware Back closes sheets.
  In landscape the sheet docks to the right edge so it never covers the whole canvas.

Notation notes: use the angle setting for degrees or radians; a raised `0` is the exponent zero,
**not** a degree sign. `%` means /100; after a sum or difference, `50+10%` is the explicitly
supported percentage-increase convention (55). Ambiguous expressions such as `2/3x` must use
parentheses. A `×`-shaped handwritten glyph may denote the unknown `x` when it appears in
variable position; check recognition before trusting a result.

## Mathematical scope (correctness-first)

**Retained:** real arithmetic, parentheses, powers, factorials of nonnegative integers up to 170,
percentages, roots, `π`, `e`, named elementary functions, exact rational arithmetic when
representable, approximate transcendental values, and linear/quadratic polynomial equations.

**Restricted:** equations require a single variable `x`, degree at most two, rational
coefficients, and no variable-dependent denominators or non-polynomial functions. Exact
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
Logo: the user-selected white **M** over a black-and-red rounded square, extracted from the supplied reference screenshot (not redesigned), stored in `branding/logo-512.png`. Run `branding/make_icon.py` to resize it for Android;
`branding/logo-512.png` / `logo-1024.png` are store-size copies. Package id is `com.mikajy.app` (Android v4.4, versionCode 13).

## Layout
```
web/                       the app (one HTML page, HTML5 canvas, no dependencies)
  core_cnn.js              CNN inference (runs in a Web Worker; falls back to main thread)
  math-core.js             strict parser, AST, real evaluation and rational polynomial solver
  calculator.js            formatting and UI-facing calculation adapter
  settings.js              validated local preferences
  app.js                   canvas, animation, interaction, editing, history and memory
  core_main.js             stroke grouping, personalisation and classification
  model/model4.json        trained weights (legacy classification model)
  fonts/hand.woff2         Caveat subset (SIL OFL) used to typeset the handwriting
  build_web.py             assembles android/assets/index.html
android/                   WebView shell
  src/.../MainActivity.java   immersive WebView + JS bridge (copy, share text, share image, Back)
  src/.../ShareProvider.java  tiny ContentProvider used to share the PNG
  AndroidManifest.xml, res/ (signing keys excluded from source)
training/                  how the recogniser was trained (see below)
tests/                     asserted Node regression suite and optional browser smoke tests
build_apk.sh               javac + dx + aapt + zipalign + apksigner (no Gradle)
```

## Tests and build

Run `node --test tests/*.test.cjs` (Node 20+) for deterministic mathematical
and settings regression tests. Then run `python3 web/build_web.py` to generate
the self-contained offline WebView page. CI runs these checks on each push.
The build script also supports `MIKAJY_UNSIGNED_ONLY=1 ./build_apk.sh` to
compile and package an **unsigned, non-installable verification APK** with the
Android SDK tools. CI exercises this unsigned build on a Linux runner.
An installable release APK requires the existing private release-signing key;
no signing key is stored in this repository.

## Build
```
sudo apt install openjdk-21-jdk-headless aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange python3
# Export MIKAJY_KEYSTORE, MIKAJY_ALIAS, MIKAJY_STOREPASS and MIKAJY_KEYPASS first.
./build_apk.sh            # -> Mikajy.apk (minSdk 21, targetSdk 34)
```
To iterate on the UI without Android, open `android/assets/index.html` in desktop Chrome after
`python3 web/build_web.py` (the Java bridge calls fall back to clipboard/new tab).

## Recogniser
Input: every group of strokes is rendered (4x supersampled, bbox scaled to 20 px, centred in 28x28,
pen ~2.9 px). Model: conv3x3(24)-pool-conv3x3(48)-pool-fc(192)-fc, with legacy advanced classes filtered at inference.
Supported classes include `0-9 + - * / ( ) =`, function-name letters, `π √ ! %`.
Fractions, exponents, roots, dots (`.`, `i`, `!`) and function words are resolved geometrically and by a
word matcher over each symbol's top-5 candidates, not by the CNN.
Corrections you confirm are stored in `localStorage` and bias later predictions (cosine kNN, 400 samples).

Measured (not on a phone): MNIST test digits 98.8 %; synthetic stroke symbols 98.7 %; 4 handwriting fonts
unseen in training 89.7 % (all 33 classes, harder than real use); on those fonts 58/60 test strings such as
`sin30`, `tanh1`, `abs5`, `50%` read exactly.

### Retraining (`training/train4.py`)
Needs: python3, numpy, scipy, jax, optax, opencv-python-headless, scikit-image, fonttools, Pillow, and
* MNIST pickle at `/tmp/mnist.pkl.gz`, handwriting fonts in `/tmp/fonts/*.ttf` and Caveat as `/tmp/caveat.ttf`
  — `training/fetch_assets.sh` downloads all of them (SIL OFL fonts from github.com/google/fonts).
  `train4.py` runs from the `training/` folder and reads `train.py` (the synthetic-stroke generator) next to it.
`python3 training/train4.py 6` generates per-class data (cached in `./cache/`, safe to interrupt),
trains with checkpoints (`ckpt4.pkl`, resumable) and writes `model4.json`; copy it to `web/model/`.
Synthetic strokes (`train.py`) cover digits/operators/π/√/!/%; letters come only from fonts
(skeletonised, warped, re-inked at pen width), so real handwriting is the main unknown.

## Known limits
* No automatic line wrapping: a long expression shrinks to fit the width; start another line instead.
* Fractions inside fractions, nth roots, absolute-value bars `| |`, mixed numbers as input (`2 1/2` = 2 × ½),
  and variables other than a single `x` are not supported.
* Equation solving is limited to polynomial degree ≤2 with rational coefficients. Trigonometry uses the selected angle setting.
* `1`/`7`/`l`, `0`/`o`, `4`/`h` confusions happen — tap a symbol to cycle alternatives.
* No physical-device benchmark or Android APK build is claimed by the Node test suite. The CNN fallback may run on the main thread when workers are unavailable; performance and battery use require device testing.

## Licences / data
Caveat font: SIL Open Font License. Training used MNIST and other OFL handwriting fonts; no font other than
Caveat ships in the app. Source licensing is governed by LICENSE; third-party fonts and datasets retain their own licences.

## Release signing
A signing key must **not** be committed. Keep the signing keystore safely backed up; Android requires the same signing key for updates to an installed package. If you installed an APK signed with a different key or package ID, it cannot be updated in place.
