# Contributing to Mikajy

Thanks for helping. Mikajy is a small, dependency-free app; the bar for changes is **correctness first** —
an unsupported answer is always better than a convincing wrong one.

## Setup
Node 20+ and Python 3.11+ are enough for everything except the APK build.

```bash
npm test                 # unit tests (maths, recogniser, settings, storage, updates)
npm run check:build      # assemble android/assets/index.html + CSP / no-eval / syntax checks
python3 -m pip install playwright && python3 -m playwright install chromium
npm run test:browser     # smoke, drawn-stroke end-to-end and update-UI tests in headless Chromium
npm run test:java        # compiles and tests the update parser with -Werror (needs a JDK)
```
Android builds need the tools listed in the README; CI does this on every push.

## Where things live
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). In short: `web/math-core.js` (maths), `web/recognizer.js`
(handwriting heuristics), `web/app.js` (canvas, UI), `android/` (shell + update check).

## Rules of thumb
- Every behaviour change comes with a test. Maths: add cases to `tests/math-*.test.cjs`, including the
  *refusal* cases. Recogniser: build glyph fixtures like those in `tests/recognizer.test.cjs`.
- Do not widen the page's Content-Security-Policy and do not add network access to the WebView.
  The only network code is `UpdateChecker.java`.
- Keep `web/` free of dependencies and `eval`. `tests/build_check.py` enforces this.
- Never commit keystores, passwords or tokens. See [SECURITY.md](SECURITY.md).
- Commit messages: imperative mood, one logical change each (`Add …`, `Fix …`).
- Update `CHANGELOG.md` under *Unreleased*.

## Pull requests
Open an issue first for anything big. Run `npm run check` before pushing; CI repeats it plus the Android build.
