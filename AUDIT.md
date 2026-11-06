# Mikajy 4.4 → 4.5 — code-quality & security audit

Scope: everything in the repository (Java shell, build/CI, JS app, maths core, tests, training scripts).
Method: full read-through, then every suspected defect was reproduced (or disproved) before being changed.
**Not done:** no run on a physical device or emulator; recognition accuracy was not re-measured (no MNIST/fonts offline).

## Verdict
The maths core (`math-core.js`, `calculator.js`, `settings.js`) is the best part: small, pure, strict about
domains, exact rational arithmetic with bounded size, and covered by tests. The Android shell was already
locked down sensibly (network blocked, no permissions, non-exported provider, PNG magic check).
The weak spots were: an unbounded trust in `localStorage`, `new Function()` (which made a CSP impossible),
a CI job that could never have passed, a few UX/maths artefacts, and a recogniser/UI file that is very hard to maintain.

## Fixed in 4.5
| # | Area | Finding | Fix |
|---|------|---------|-----|
| 1 | Security | No CSP; `new Function()` used for the worker fallback | Strict meta CSP (`default-src 'none'`, no `unsafe-eval`, `connect-src 'none'`); fallback now runs via an inline `<script>`. Browser test proves the CSP is enforced and both inference paths still work |
| 2 | Robustness | `localStorage` (history, memory chips, 400 handwriting samples) parsed with no validation → one corrupt entry could throw at start-up or inject markup | New `storage.js`: field-by-field rebuild, type/size/range limits, quota-safe writes; escape now covers quotes; unit + browser tests with hostile data |
| 3 | Correctness | `sin(180°)`, `cos(90°)`, `sin(π)` displayed `≈1.22e-16` | Argument-reduction noise snapped to 0 (only for \|arg\|≥0.5 and \|result\|<4e-16·\|arg\|); tests include a genuinely tiny `sin(1e-7)` that must survive |
| 4 | Bug | Dragging/saving a result such as `1e+21` inserted the symbols `1 e + 2 1` | Only plain decimals can be dragged/stored; otherwise a toast explains |
| 5 | Android | Activity restarted (canvas lost) on dark-mode switch, fold, font-scale change | `configChanges` extended |
| 6 | Android | File I/O on UI thread; stale shared PNG kept in cache; no null-safety in provider; WebView not paused in background | Single-thread executor, cache cleared at start, provider hardened (`getContext()` null, projection honoured), `onPause/onResume` |
| 7 | Android | File access enabled, debugging flag implicit | `setAllowFileAccess(false)` (assets unaffected), geolocation/form-save off, debugging explicitly off, `usesCleartextTraffic=false` |
| 8 | Input | A second finger/palm replaced the stroke in progress | Secondary pointers ignored |
| 9 | CI | Workflow ran `./build_apk.sh` on a runner with no Android tools → always red | Dedicated `android` job installs the toolchain; jobs have timeouts and concurrency control |
| 10 | Build | `-Werror` absent, APK never inspected, exec bit lost, no key helper | Warnings are errors; package id / no-permission / content checks; `tools_make_keystore.sh` |
| 11 | Quality | `throw 0`, duplicated number formatter, history actions trusted indices | Real `Error`s, single formatter, guarded actions |
| 12 | A11y | No language, unlabeled canvas | `lang="en"`, `role="img"` + label |
Tests: 10 → 18 unit tests, browser smoke test extended (CSP enforced, worker + fallback, hostile storage, zero network).

## Known debt (deliberately not "fixed" blind)
1. **`web/app.js` and `web/core_main.js` are dense, global-state, 300-character-per-line code.** They hold the
   recogniser heuristics (stroke grouping, fractions, roots, scribble-erase, drag & drop). They work, but cannot be
   reviewed or safely modified. A real rewrite needs characterisation tests built from recorded strokes and device
   testing; rewriting them untested would trade known behaviour for unknown bugs. Recommended next step: record
   stroke fixtures → split into modules (`geometry`, `layout`, `recognizer`, `history`, `ui`) one at a time behind those tests.
2. **Model size.** 2.5 MB of float32 weights are base64-embedded and parsed at every launch (and copied into the worker).
   int8/float16 quantisation would cut this 2–4× but must be validated against the training set.
3. **The same model is stored twice** (`training/model4.json`, `web/model/model4.json`).
4. **Compiled against API 23** (the only platform package in Ubuntu). Newer callbacks such as `onRenderProcessGone`
   (API 26) therefore cannot be overridden; with a newer `android.jar` it should be added.
5. **No on-device verification** of performance, battery or the share sheet. The PNG is not deleted right after sharing
   (cleared on next start instead), which is the safe choice when the receiving app reads it asynchronously.
6. `user-scalable=no` is a deliberate choice for a drawing surface but is an accessibility trade-off.
7. Recognition accuracy numbers in the README were measured by the original author and not reproduced here.
