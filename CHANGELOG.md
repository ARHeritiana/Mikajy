# Changelog

All notable changes to Mikajy. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow `MAJOR.MINOR` (the Android `versionName`).

## [Unreleased]

### Added
- **Menu in three tabs** — *Actions* (history, copy, share, memory, clear), *Math* (results, angles, instant/on demand) and *App* (language, theme, updates) — instead of one long sheet, in the style of the later 6.x builds.
- **English / Français** (App → Language; follows the device language until chosen): the whole interface, toasts, update texts and calculator words (`undefined` / `indéfini`, `unsupported` / `non géré`). `web/i18n.js`, `tests/i18n.test.cjs`.
- The handwriting font subset now includes French accents; `tests/build_check.py` fails if an interface string uses a character the font lacks.

### Fixed
- **Square roots were often not recognised.** A root sign was only split from its bar when written in one pen-down with a long, flat bar; with a short, slanted or separate bar its strokes merged with the radicand and were read as `π`, `5`, … Now the sign is found for any bar (flat, slanted, short, absent), for a root written in several strokes (hook then bar; tick-and-down then rise-and-bar), and for a bar drawn after a pause (it extends the already-recognised sign). Two ordinary strokes (a `1` and a `/`) are never fused. `tests/browser_strokes.py` covers six ways of writing `√4 =`.

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
