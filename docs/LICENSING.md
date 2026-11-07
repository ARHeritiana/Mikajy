# Licensing and commercial use

*Engineering notes, not legal advice. Have a lawyer confirm before you sell the app.*

## 1. Is commercial use possible?
Yes. The shipped app contains only code written for this project plus one OFL font, so there is no third-party
licence that forbids selling it. Every tool added to the maths engine in 5.1 is **our own code** (`web/poly-core.js`);
nothing was pulled in from a library.

## 2. Licence of Mikajy's own code: MIT
Mikajy is released under the **MIT licence**: anyone, including you, may use, sell, modify and embed it in closed-source
products, provided the copyright and licence notice are kept. Versions published before this change were GPL-3.0-or-later;
copies already distributed under the GPL stay under it, but all new releases are MIT. This was possible because the
repository has a single author (`git shortlog -sne`: two names, one GitHub id). If anyone else contributes code, get their
agreement (a CLA or a DCO sign-off) so the MIT grant stays valid.

## 3. Third-party material and why it is safe
* **Caveat font** — SIL OFL 1.1 allows commercial use and embedding; the licence text is in `licenses/`. Keep it with any redistribution.
* **Libraries** — none shipped (see `THIRD_PARTY_NOTICES.md`).
* **Maths engine** — in-house exact arithmetic (BigInt rationals, Sturm sequences). Deliberately *not* used, because their
  licences would force your whole app open or restrict sale: Maxima and Giac (GPL), anything AGPL, and SDKs with proprietary terms.
  Permissive options if you ever want a bigger CAS: mathjs (Apache-2.0), Nerdamer (MIT), Algebrite (MIT) — note each
  would need a review against the app's no-`eval` Content-Security-Policy.

## 4. Training data — the part that needs care
The recogniser weights are derived from training data, so the data's terms matter.

| Source | Status | Action |
|--------|--------|--------|
| Synthetic strokes (`training/train.py`) | Own work | OK |
| **Stroke-sequence model** (`training/gen_corpus.py`, `train_seq.py`) | Trained only on strokes our own generator makes from OFL handwriting fonts (`training/synth/`): no MNIST, no third-party handwriting corpus, no user data. Four fonts are held out of training and used only for testing | OK |
| Your 29 real finger-written samples (`training/real_data/`) | Collected from you with `tools/collect/`; gitignored. Used **only** as a test set, never to train | Keep out of the repository |
| OFL handwriting fonts (`fetch_assets.sh`) | OFL does not restrict what you render from a font; fonts are not redistributed | OK; keep the font list in this repo |
| **MNIST** | Terms are not stated clearly by its distributors (derived from NIST data; some mirrors say CC BY-SA 3.0, which has share-alike implications) | **Recommended: retrain without it** (digits from fonts + synthetic strokes + data you collect), or get counsel's opinion. See `training/train4.py` `--no-mnist` |
| IAM-OnDB, CROHME, MathWriting and similar handwriting corpora | Typically research / non-commercial terms (verify each licence text) | **Do not train on them** for a commercial product without written permission |
| Your own users' strokes | Ideal source for real handwriting | Only with explicit opt-in consent and a privacy notice; the app is offline today and should stay so unless you add this deliberately |

## 5. Google ML Kit / Play Services handwriting
Free for commercial use and very good at cursive text, but it is a proprietary SDK that downloads models at run time:
it would break the "fully offline, no SDK" design and tie the app to Google Play Services. Not used.
