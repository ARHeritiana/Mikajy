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
* **Single-unknown equations**: write the unknown as `x` (`2x+3=7` → `x=2`). The solver is numeric
  (roots in [-100, 100], up to 4 roots; linear equations are solved exactly).
* **Follow-ups on a finished line**: draw a bar *under* an existing expression and write a number below it —
  the part of the expression the bar covers becomes the numerator (`2−4`, bar, `5` → (2−4)/5; a bar under only
  the `4` → 2−4/5). Works in any order (bar first or denominator first) and with multi-digit denominators.
* **Several lines / independent calculations** anywhere on the canvas.
* **Drag & drop**: long-press a number or a result, drag it into another expression, a new spot, or onto the
  **memory bar** (bottom; it appears when it has content or while dragging). Memory chips can be dragged out.
* **History** (auto-saved, reopen / copy / delete / export), **result display** (decimal, exact fraction,
  mixed number — fractions only when the value is a small rational), **degrees / radians**.
* **Export**: copy a result, share a PNG of the canvas, share history as text (through the Android share sheet).
* Small sliders button (top-right, faint) opens the settings sheet: a paper-styled page in the app's own
  handwriting, the chosen option circled in red; History is a second page. Hardware Back closes sheets.
  In landscape the sheet docks to the right edge so it never covers the whole canvas.

Notation notes: a raised `0` after a number is a degree sign (`30°`); `%` is "/100" (and `50+10%` = 55);
a `×`-shaped symbol is read as the variable `x` when it cannot be a multiplication (followed by `+ − = )`
or by a raised exponent, or at the start of a side), otherwise as multiplication.

## Advanced maths (handwritten, no extra UI)
Write these directly; the answer appears like any other result (`web/cas.js` is the engine):
* **Derivative**: `d/dx` as a stacked fraction (or `d/dx` inline) followed by the expression; `d²/dx²` with raised 2s.
* **Integral**: `∫ f dx` gives the antiderivative `+ C`; `∫(a→b) f dx` is definite, bounds may be `π`, `-∞`, `∞`.
* **Limit**: `lim(x→a) f`, with `a` a number, `π`, `∞` or `-∞`.
* **Sum**: `Σ(x=1→10) f`, upper bound may be `∞` (convergence is checked).
* **Algebra**: an expression in `x` ending in `=` is expanded, factored and its roots listed; `2x+3=7` still solves.
Recogniser now has 39 classes (added `d m ∫ Σ → ∞`); `lim` is read as a word.

## Look
Black-red-white identity with a **Dark / Light** option in Settings, saved locally. Dark mode shows white handwriting on a black canvas; Light mode shows black handwriting on a white canvas. Answers, active controls and selection rings remain red in both.
Logo: the user-selected white **M** over a black-and-red rounded square, extracted from the supplied reference screenshot (not redesigned), stored in `branding/logo-512.png`. Run `branding/make_icon.py` to resize it for Android;
`branding/logo-512.png` / `logo-1024.png` are store-size copies. Package id is `com.mikajy.app` (Android v4.4, versionCode 13).

## Layout
```
web/                       the app (one HTML page, HTML5 canvas, no dependencies)
  core_cnn.js              CNN inference (runs in a Web Worker; falls back to main thread)
  core_main.js             stroke grouping, feature rendering (28x28), kNN personalisation
  app.js                   UI: ink, morph animation, layout, parser/evaluator, equations, editing,
                           scribble detection, fractions, drag&drop, history, memory, settings sheet
  model/model4.json        trained weights (33 classes, base64 float32)
  fonts/hand.woff2         Caveat subset (SIL OFL) used to typeset the handwriting
  build_web.py             assembles android/assets/index.html
android/                   WebView shell
  src/.../MainActivity.java   immersive WebView + JS bridge (copy, share text, share image, Back)
  src/.../ShareProvider.java  tiny ContentProvider used to share the PNG
  AndroidManifest.xml, res/ (signing keys excluded from source)
training/                  how the recogniser was trained (see below)
tests/                     headless-browser tests (Playwright) used during development
build_apk.sh               javac + dx + aapt + zipalign + apksigner (no Gradle)
```

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
pen ~2.9 px). Model: conv3x3(24)-pool-conv3x3(48)-pool-fc(192)-fc(33), ~0.6 M MACs.
Classes: `0-9 + - * / ( ) =`, letters `a c e g i l n o s t h b`, `π √ !`, `%`.
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
* Numeric equation solving only searches [-100, 100]; trig is radians unless set to degrees.
* `1`/`7`/`l`, `0`/`o`, `4`/`h` confusions happen — tap a symbol to cycle alternatives.
* Not tested on physical devices; timing figures come from a CPU-throttled desktop Chromium.

## Licences / data
Caveat font: SIL Open Font License. Training used MNIST and other OFL handwriting fonts; no font other than
Caveat ships in the app. Code in this archive: use freely.

## Release signing
A signing key must **not** be committed. Keep the signing keystore safely backed up; Android requires the same signing key for updates to an installed package. If you installed an APK signed with a different key or package ID, it cannot be updated in place.
