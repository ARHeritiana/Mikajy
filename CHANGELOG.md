# Changelog

All notable changes to Mikajy. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow `MAJOR.MINOR` (the Android `versionName`).

## [Unreleased]

### Added
- **Matrices** (exact): `det`, `|A|`, `A⁻¹`, `Aᵀ`, `Aⁿ`, `A+B`, `AB`, `kA`; singular or mismatched matrices are refused. **Modular arithmetic**: `a mod m`, `aᵇ mod m` without forming `aᵇ`, `gcd`, `lcm`; **congruences**: `a ≡ b (mod m)` → True/False, `ax ≡ b (mod m)` → `x ≡ r (mod m')`, or `S=∅`. `web/linalg-core.js`, `web/modular-core.js`, `web/latex-eval.js`, `tests/latex-eval.test.cjs`.
- **Matrices look like they do on paper:** a bracketed grid (square, round or bars) whose brackets grow with the entries, entries aligned in columns and rows, stacked fractions allowed inside entries; answers are drawn the same way. Matrix readings no longer print their environment name (`bmatrix`) on the board.
- **Menu in three tabs** — *Actions* (history, copy, share, memory, clear), *Math* (results exact/decimal, angles, ℝ/ℂ, instant/on demand) and *App* (language, theme, updates) — instead of one long sheet. The rarely useful *Mixed* result format and the *Classic* recogniser are hidden unless they were already selected.
- **English / Français** (App → Language; follows the device language until chosen): the whole interface, toasts, the update texts and calculator words (`True/Vrai`, `unsupported/non géré`, `undefined/indéfini`). `web/i18n.js`, `tests/i18n.test.cjs`.
- Font: the Caveat subset in `web/fonts/hand.woff2` was regenerated (OFL, same weight, no Reserved Font Name) to include French accents; `tests/build_check.py` now fails if an interface string uses a character the font lacks.
- **Symbolic first:** irrational results show their closed form with the decimal second (`√8` → `2√2 ≈2.828…`, `sin(π/4)` → `√2/2`), and irrational equation roots show radicals (`x²=2` → `±√2`) when the CAS form matches the certified numeric roots. The default number format is now exact (`frac`); `dec` still gives decimals.
- **`4 = 2` is `False`** (and `4 = 4`, `1/3+1/6 = 1/2`, `√2·√2 = 2` are `True`): statements about constants are decided exactly, or symbolically, never by rounding.
- **Periodic equations:** `sin x = 0` → `x = nπ, n ∈ ℤ`; every family is verified by substituting several integers `n`.
- **Calculus engine** (`web/calculus.js`, bundled Nerdamer, Apache-2.0): derivatives, antiderivatives, definite integrals and limits, each audited against an independent numeric check of the original expression (finite differences, differentiating the answer back, Gauss–Legendre quadrature with a divergence guard, one-sided limits). The recogniser does not emit `∫`/`lim` yet, so this is an API (`Calculus.*`, `Calculator`) without handwriting input.
- `tests/calculus.test.cjs`.
- **Stroke-sequence recogniser** (default; Settings → Recogniser, Classic still available): a transformer reads all the strokes of a line and emits LaTeX tokens — late additions, extended lines, multiple lines, exponents, denominators, matrices, complex numbers and `mod` are read without grouping rules. Ink stays on the board with the typeset reading and answer below it. `web/seq-core.js`, `web/model/seq1.json`, `training/{strokefeat,seqmodel,gen_corpus,train_seq,eval_seq,pack_seq,parity_seq}.py`, `tests/seq-core.test.cjs`, `tests/browser_seq.py`. Trained on synthetic strokes only.
- `training/eval_app.py --rec`, a recorded-clock replay and a viewport that contains all the ink.
- **ℝ / ℂ number domain** (Settings → Numbers): complex arithmetic with exact Gaussian rationals, all complex roots of polynomial and rational-function equations (`complexRoots` in `poly-core.js`), `tests/complex.test.cjs`.
- **Licence changed from GPL-3.0-or-later to MIT.**
- **Maths engine:** `web/poly-core.js` — exact polynomials and rational functions over ℚ and certified real-root finding
  (Sturm sequences, exact bisection). Equations in `x` now return *every* real root for polynomials up to degree 32
  and for fractions with `x` in the denominator (excluded points are removed). `|u|` and even powers invert to both branches.
- Exact trigonometric values at 30°/45°/60°/90° and their `π` multiples (`sin 30°=0.5`, `tan 45°=1`, no `≈`); decimal
  arithmetic uses the exact rational (`0.1+0.2=0.3`).
- Licensing documentation: `docs/LICENSING.md`, `THIRD_PARTY_NOTICES.md`, `licenses/OFL-Caveat.txt`.
- Synthetic handwriting generator (`training/synth/`, `training/generate.py`) and an offline data-collection page (`tools/collect/`).
- Trainer: `MIKAJY_ASSETS` directory, `--no-mnist`, `--cursive` (ligature-stroke augmentation) and `training/eval_model.py`.

### Changed
- Fixed: `×` inside an exponent was read as the variable x, and two roots closing on the same symbol lost a bracket.
- Synthetic generator: `+`, `×` and `x` are now drawn with two strokes most of the time (the font tracer drew them in one).
- `sin(30°)`, `sin(180°)` and similar now display exactly instead of `≈0.5` / `≈0`.
- `x⁴=16`, `|x|=2`, `x²/(x−1)=0` are solved instead of refused.

## [5.0] - 2026-11-07

### Added
- **Automatic update check.** The Android shell asks GitHub for the newest published release (at most once a day,
  only when online, switchable in Settings) and shows a dot on the menu button plus a *Get Mikajy x.y* entry.
  Nothing about the user or device is sent; the WebView itself stays offline. `INTERNET` is the only permission.
- **Exponentials and powers:** `e^x`, `e^(2x)`, `e^-1`, `10^-3`, exponents of brackets and of lower-case letters
  (the x-height `e` used to defeat the exponent detector), and a cursive `e` read as `c`/`o` before an exponent.
- **Cursive function names.** A word written in one pen-down (`sin`, `ln`, `cos`) is cut into letters at its
  ligatures by scoring every segmentation with the recogniser's own confidence; look-alike letters (`5`→`s`,
  `1`→`i`) are accepted inside words. New words: `exp`, `sqrt`, `cot`, `sec`, `csc`.
- **Maths engine:** `exp`, `sqrt`, `cot`, `sec`, `csc`; `sin2x`/`sin2π` read as `sin(2x)`/`sin(2π)`;
  exact rational powers (`8^(2/3)=4`, `4^(1/2)=2`); exact `e^0`, `ln 1`, `ln e`, `log 10`;
  equations with one `x` solved by exact inversion: `2^x=8`, `e^x=5`, `ln x=1`, `√(x+1)=3`, `5/x=2`, `x³=8`.
  Non-injective forms (`sin x=0`, `x⁴=16`, `|x|=2`) are still refused rather than answered with one "principal" value.
- Recogniser heuristics moved into a tested, DOM-free module (`web/recognizer.js`).
- Professional repository layout: docs, contribution and security policies, issue/PR templates, Dependabot,
  `package.json` scripts, wider CI (stroke-level end-to-end test, update-UI test, Java parser test).

### Changed
- Package metadata: `versionName` 5.0, `versionCode` 15.
- The multiplication-shaped glyph is now accepted as the first symbol of an exponent (`e^x`), which the old
  rule never allowed.

### Security
- The release-link guard exists twice (Java and JavaScript) and accepts only `https://github.com/ARHeritiana/Mikajy/releases/…`.
- Update answers and the stored update record are re-validated field by field before use.

## [4.5] - 2026-11-07
Initial public release of the audited offline calculator. See [docs/AUDIT.md](docs/AUDIT.md).
