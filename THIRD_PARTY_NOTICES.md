# Third-party notices

What is **inside the shipped app** (the APK):

| Component | Licence | Notes |
|-----------|---------|-------|
| Mikajy source (everything under `web/`, `android/src/`) | MIT (see [LICENSE](LICENSE)) | Written by the repository owner; see [docs/LICENSING.md](docs/LICENSING.md) for what that means commercially |
| Caveat font, subset in `web/fonts/hand.woff2` | SIL Open Font License 1.1 — [licenses/OFL-Caveat.txt](licenses/OFL-Caveat.txt) | © 2014 The Caveat Project Authors. The licence text must travel with the font |
| CNN weights `web/model/model4.f16.json` | Own work, trained as described in [docs/LICENSING.md](docs/LICENSING.md) | Training-data provenance is documented there |
| Nerdamer 2.0.1 CAS, `web/vendor/nerdamer.js` (630 KB, with decimal.js 10.6.0 bundled inside) | Apache-2.0 ([licenses/Apache-2.0-nerdamer.txt](licenses/Apache-2.0-nerdamer.txt)); decimal.js: MIT ([licenses/MIT-decimal.js.txt](licenses/MIT-decimal.js.txt)) | © Martin Donk and contributors; © Michael Mclaughlin. Unmodified build from npm (`nerdamer@2.0.1`, `dist/bundle.js`, sha256 f90572c1…2a78). Used only through `web/calculus.js`, whose answers are audited numerically |
| Android platform classes | Apache-2.0 (Android Open Source Project) | Linked at build time through `android.jar`; no third-party library is bundled |

The app's only JavaScript runtime dependency is the vendored Nerdamer bundle above (no npm install at build time, no CDN, no SDK, no Java library).

Used only to build, test or train (never shipped): Node.js (MIT), Playwright (Apache-2.0), JAX and Optax (Apache-2.0),
NumPy, SciPy and scikit-image (BSD-3-Clause), OpenCV (Apache-2.0), Pillow (HPND), fontTools (MIT).
