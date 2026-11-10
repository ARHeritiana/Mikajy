# Real-stroke recognition experiments (Mikajy Spark)

## Status and scope

This branch repairs **input grouping and late editing** independently of machine learning.
The shipped offline CNN and APK are unchanged. The optional experiment below imports
**real online pen trajectories** from MathWriting and trains a compatible 28×28 glyph
classifier with the existing `training/train4.py` architecture.

**Do not confuse symbol accuracy with interactive editing accuracy.** A CNN reads a
complete rasterized symbol. The recognizer's spatial grouping, cross-time reopening,
and insertion order are separate behaviors; regression tests cover them.

## Dataset and license

Source: https://github.com/google-research/google-research/tree/master/mathwriting

Download the **original InkML archive**, not an image-only Hugging Face conversion.
It contains `symbols/*.inkml` alongside expression-level datasets. The symbols
directory has ~6,423 individual glyphs, many with multiple strokes. See the archive
README for exact dataset and annotation formats.

**MathWriting data are licensed CC BY-NC-SA 4.0.** The existing code is MIT; the
license of model weights trained with this data needs explicit review before any
APK or public model release. The converter never commits the raw data or new weights.
CROHME can be evaluated separately when its license is checked.

## Local experiment (or Google Colab/Kaggle with GPU)

From the repository root:

```bash
python3 -m pip install numpy pillow
python3 training/mathwriting_to_npz.py /path/to/unpacked/mathwriting --augment 2
# Produces ignored files under training/cache/mathwriting/
# Smoke-run with a bounded subset:
python3 training/mathwriting_to_npz.py /path/to/unpacked/mathwriting --max-files 500 --augment 1
```

For the **complete existing training procedure**, first inspect
`training/fetch_assets.sh` (MNIST / OFL font downloads), then install the dependencies
required by `train4.py` (`numpy pillow opencv-python scikit-image fonttools jax optax`).
The original training script uses /tmp resources and must run from `training/`.

```bash
bash training/fetch_assets.sh
cd training
MIKAJY_MATHWRITING_TRAIN_NPZ=cache/mathwriting/mathwriting_train.npz \
MIKAJY_MATHWRITING_VALID_NPZ=cache/mathwriting/mathwriting_valid.npz \
python3 train4.py 6
```

Compare against a baseline trained with no MathWriting additions and inspect the
`mathwriting-valid` value logged at each epoch. Holdout is by individual **symbol ink**,
not by writer: the archive does not publish writer IDs. Consequently, do not describe
this validation number as writer-independent accuracy.

**Do not call `pack_model.py`, replace `web/model/model4.f16.json`, or publish
a trained APK until evaluation and licensing are approved.**

## Interaction regression tests

Run:

```bash
npm test
npm run check:build
npm run test:browser
```

Specific conditions:
- Two equals bars, even with a pause or other characters written between them, must produce a single updated glyph.
- Placing a dot over a written stem must not create a separate character.
- Insert a symbol spatially between two typeset symbols without losing either neighbor.
- Preserve fraction bars, numerators, denominators and user-locked corrections.
- Measure both classification accuracy and touch-to-response latency on an actual Android phone.

## Limitations before production

- The existing model sees only 28×28 rasterized symbols: it cannot learn true
  stroke ordering or edit intention by itself. Late-edit recovery is deterministic.
- Multi-stroke symbol data are scarce and the examples include handwriting
  variability not necessarily representative of finger input.
- Grouping heuristics can still merge overlapping symbols or miss unusual strokes.
  Collect consented, anonymized stroke fixtures, with per-user opt-in; never
  silently transmit written mathematics.
- GPU training and on-device benchmarks are **not** performed by this branch.
