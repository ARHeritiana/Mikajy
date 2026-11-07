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
`branding/logo-512.png` / `logo-1024.png` are store-size copies. Package id is `com.mikajy.app` (Android v4.5, versionCode 14).

## Layout
```
web/                       the app (one HTML page, HTML5 canvas, no dependencies)
  core_cnn.js              CNN inference (runs in a Web Worker; falls back to main thread)
  math-core.js             strict parser, AST, real evaluation and rational polynomial solver
  calculator.js            formatting and UI-facing calculation adapter
  settings.js              validated local preferences
  storage.js               validated, size-bounded access to localStorage (history, memory, personalisation)
  app.js                   canvas, animation, interaction, editing, history and memory
  core_main.js             stroke grouping, personalisation and classification
  model/model4.f16.json    shipped float16 weights (packed from training/model4.json by training/pack_model.py)
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

Run `node --test tests/*.test.cjs` (Node 20+) for deterministic mathematical,
settings and storage-validation tests. Then run `python3 web/build_web.py` to generate
the self-contained offline WebView page. CI runs these checks on each push.
The build script also supports `MIKAJY_UNSIGNED_ONLY=1 ./build_apk.sh` to
compile and package an **unsigned, non-installable verification APK** with the
Android SDK tools. CI exercises this unsigned build on a Linux runner.
An installable release APK requires the persistent private release-signing key,
generated once in a GitHub Codespace and stored as encrypted GitHub Actions
environment secrets; no signing key is stored in this repository.

## Build
```
sudo apt install openjdk-21-jdk-headless aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange python3
./tools_make_keystore.sh ~/keys/mikajy-release.jks   # once; prints the MIKAJY_* variables to export
# Export MIKAJY_KEYSTORE, MIKAJY_ALIAS, MIKAJY_STOREPASS and MIKAJY_KEYPASS.
./build_apk.sh            # -> Mikajy.apk (minSdk 21, targetSdk 34)
```
The build fails on any compiler warning, and checks that the APK has the expected package id,
contains the page and `classes.dex`, and requests **no permissions**.
To iterate on the UI without Android, open `android/assets/index.html` in desktop Chrome after
`python3 web/build_web.py` (the Java bridge calls fall back to clipboard/new tab).

## Recogniser
Input: every group of strokes is rendered (4x supersampled, bbox scaled to 20 px, centred in 28x28,
pen ~2.9 px). Model: conv3x3(24)-pool-conv3x3(48)-pool-fc(192)-fc, with legacy advanced classes filtered at inference.
Supported classes include `0-9 + - * / ( ) =`, function-name letters, `π √ ! %`.
Fractions, exponents, roots, dots (`.`, `i`, `!`) and function words are resolved geometrically and by a
word matcher over each symbol's top-5 candidates, not by the CNN.
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
* The page is the only content the WebView loads (`file:///android_asset/`); every other navigation is refused,
  network loads are blocked and the app declares no `INTERNET` permission.
* The page carries a strict Content-Security-Policy (`default-src 'none'`, no `eval`, no remote origins).
* The JavaScript bridge has three methods (`copy`, `shareText`, `shareImage`); each validates type and size.
* Everything read back from `localStorage` is treated as untrusted and re-validated (`web/storage.js`).
* Backups are disabled; the shared PNG lives in the app cache and is removed on the next start.
See `AUDIT.md` for the full review and the remaining known debt.

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

## Automated signed releases (GitHub Actions)

The tag-triggered workflow `.github/workflows/release.yml` reruns all
mathematical, browser and unsigned Android tests **before** signing. On success,
it builds and signs an APK using the *same* key on every future release,
verifies the pinned public certificate fingerprint and publishes the APK with
`SHA256SUMS.txt` on GitHub Releases.

### First-time setup: generate a new key inside GitHub Codespaces

**This intentionally replaces the old Mikajy 4.5 signing identity.** A new APK
signed with this key cannot ordinarily update an installed 4.5 APK in place.
Uninstalling the old app may erase its locally saved history and training data.

1. On [Mikajy](https://github.com/ARHeritiana/Mikajy), choose **Code →
   Codespaces → Create codespace on main**.
2. In the Codespaces terminal, run:
   ```bash
   bash scripts/setup-release-signing.sh
   ```
   The script creates the GitHub Actions `release` environment if necessary,
   generates a **new** 4096-bit RSA signing key and a random 256-bit password,
   and uploads the keystore and credentials to GitHub as *encrypted environment
   secrets*. It stores the new certificate fingerprint as the environment
   variable `MIKAJY_CERT_SHA256`, required by the release workflow.
   The script asks you to explicitly confirm creating/replacing the key.
   It is safe to rerun after an interrupted upload: **it reuses the local key**
   instead of generating another one.
3. If the GitHub CLI reports insufficient permissions, authenticate your
   personal account inside the Codespace (do not paste tokens into this repo):
   ```bash
   unset GH_TOKEN GITHUB_TOKEN
   gh auth login --web -s repo,workflow
   bash scripts/setup-release-signing.sh
   ```
   Grant access only if you recognize the GitHub authorization prompt.
4. **Before deleting your Codespace, download both private backup files**
   from the file explorer and store them securely:
   `release-key-backup/mikajy-release.jks` and
   `release-key-backup/signing-password.txt`. The backup folder is
   git-ignored, not committed, and locally permission-restricted. The password
   file is sensitive; never paste it into issues, commits or chat.
   GitHub Actions secrets cannot be read back in plaintext if lost.
5. Consider requiring approval and protecting the release tags using
   [GitHub's release environment settings](https://github.com/ARHeritiana/Mikajy/settings/environments).
   The script will not silently reset any existing environment rules.

The setup creates:
- Environment secrets: `MIKAJY_KEYSTORE_B64`, `MIKAJY_ALIAS`,
  `MIKAJY_STOREPASS`, `MIKAJY_KEYPASS`.
- Environment variable: `MIKAJY_CERT_SHA256` (a public fingerprint, not a secret).


### Import an existing keystore instead of generating one

If you already have `mikajy-release.jks` and `PASSWORD.txt`, you do **not**
need to generate another signing key. Upload both files privately into the
root of your existing **GitHub Codespace** using the Codespaces file explorer
(**Upload Files**); never upload them through GitHub's repository file editor,
a public release, or a Git commit. They are covered by `.gitignore`.

Run:

```bash
git pull --ff-only
bash scripts/import-release-signing.sh
```

The import script reads the credentials **only inside your Codespace**, validates
the keystore locally, and sends the bytes directly to encrypted GitHub Actions
`release` environment secrets. Neither the assistant nor the repository
receives the contents. If GitHub requires authorization, follow the one-time
device-login prompt. The imported key is retained for later releases, and its
public certificate fingerprint is pinned. Keep private backups and remove
temporary uploads after successful import. If secrets were already configured
with a different certificate, the script requests explicit confirmation before
replacing them.

### Publishing later versions

Increment `android:versionCode` above 14 and update
`android:versionName` (e.g. `4.6`) in
`android/AndroidManifest.xml`. After merging and testing the changes,
push the matching tag (e.g. `v4.6`). GitHub Actions then verifies, signs,
and publishes `Mikajy-4.6.apk` and its SHA-256 checksum to
[GitHub Releases](https://github.com/ARHeritiana/Mikajy/releases).

**Do not rerun the setup in a fresh Codespace to make ordinary releases.**
That could create a different identity. The encrypted secrets persist across
releases. Keep the backup safely for disaster recovery.
