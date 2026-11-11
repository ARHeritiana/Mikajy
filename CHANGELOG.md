# Changelog

All notable changes to Mikajy. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow `MAJOR.MINOR` or `MAJOR.MINOR.PATCH` (the Android `versionName`).

## [Unreleased]

## [5.4] - 2026-11-11

Rewritten handwriting editing and in-app updates. Numbered 5.4 because the names 5.1–5.3 were already used by
earlier, since-reverted builds of `com.mikajy.app` (versionCodes 16–18): the updater compares version names, so a
lower name would never be offered to phones still on 5.3. `versionCode` 20.

### Added
- **In-app updates.** *Get Mikajy Spark x.y* now downloads the release APK inside the app (with progress), keeps it only if
  its SHA-256 matches the release's `SHA256SUMS.txt` and it is a newer `com.mikajy.app`, and hands it to Android's installer.
  Android asks once for *Install unknown apps* for Mikajy Spark, then shows its own update confirmation (Android 12+ may
  let the app update itself without it). On any failure the button offers the browser download instead.
  New permission `REQUEST_INSTALL_PACKAGES` (the build fails on any other permission besides `INTERNET`).
  Apps up to 5.0.1 still update through the browser once, to the first version that has this.
- Optional MathWriting InkML importer (`training/mathwriting_to_npz.py`) and opt-in mixing of real pen strokes into
  `train4.py`, with a CI smoke test on synthetic fixtures and a check that the converter draws strokes like the
  app's `feat()` (`tests/browser_raster.py`). No data is downloaded and the shipped model is unchanged;
  MathWriting is CC BY-NC-SA 4.0, so derived weights need a licence review before release
  (see `training/REAL_INK_EXPERIMENT.md`).

### Changed
- **Editing core rewritten around an expression tree** (`web/ink.js`). Every edit is now decided against what is on the
  screen (typeset symbols), not against ink that has already been replaced: new symbols, exponents written later,
  additions to a fraction or a root land where they were written.
- **Square roots keep their bar.** The pending ink keeps the bar; the typeset root keeps the reach it was drawn with
  before anything is written under it, and the bar bounds the radicand. Symbols after the root are placed after its bar.
  A root drawn around an existing number takes it as radicand; a bar added to a bare root sign takes what is under it.
- **Erasing is targeted**: a symbol is erased only when the scribble passes over its middle, with a reach scaled to the
  symbol's size (small exponents next to the scribble survive). The whole line goes only when most of its answer is
  scribbled out. Scribbling out a root sign keeps its radicand; a fraction goes with its bar.
- **Symbols finished after a pause** (second bar of `=`, stem of `+`, dot of `i`, …) complete the symbol instead of
  becoming a second one.
- Strokes of a numerator, a denominator and an exponent are never merged into one symbol.
- Smoother pen: the live stroke is drawn up to the pen tip (latest raw point plus the browser's predicted points);
  text widths are measured once per character; the recognition pause is 550 ms (was 650 ms).
- History stores the expression tree (validated by `Store.cleanTree`); older history entries still open.
- **Strokes are grouped into symbols by place, not by drawing order.** The two bars of = may be drawn with other
  symbols in between, the dot of an i before its stem, the dots of ÷ before their bar (`Recognizer.groupStrokes`).
- **A typeset symbol can be completed later.** After the 1.8 s reopen window, a stroke that unmistakably finishes the
  symbol on screen still does: a second bar under or over a typeset − makes =, a dot over a typeset 1 or l makes i.
  Other strokes that cross an older symbol are left alone, and corrections chosen by tapping are never reopened.

### Removed
- `Recognizer.assignSup` (superseded by tree placement; its fixtures now run through `web/ink.js`).

## [5.0.1] - 2026-11-09

First Mikajy Spark release: everything below up to the `v5.0` entry (rebrand, MIT licence alignment, menu tabs, English / Français, square-root fix). `versionCode` 19 so it installs over any earlier 5.x build.

### Branding
- Update the release checker and URL allowlist to the renamed `ARHeritiana/Mikajy-Spark` repository. Existing signed APKs retain their historical update code; only future builds incorporate this correction.
- Rename the lightweight edition to **Mikajy Spark** in the Android launcher, web page and update messages. Package ID, signing identity and release channel stay unchanged. Previously published v5.0 assets keep their historical names.
- New launcher icon / logo for Spark (`branding/logo-spark.svg`): three white chevrons fading in from left to right across a black / red split, still black / red / white. Sources and renderer are in `branding/`.

### Licensing clarification (2026-11-09)
- The original project's first-party code on `main` is now licensed under MIT; `LICENSE`, `package.json` and `README.md` agree. This does not change the published `v5.0` tag or signed APK, which remain under their existing GPL-3.0-or-later release terms.
- Rights in third-party fonts and recogniser weights must still be verified independently, especially before commercial distribution.

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
