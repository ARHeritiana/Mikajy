# Mikajy Spark × MathNote OCR — pretrained recognition experiment

**Status:** runnable **offline desktop prototype**, not an Android APK or a replacement for
Spark's shipped recognition engine. This experiment is deliberately isolated from
`main` and the public Android release.

## What is built

- A full-page responsive pen canvas in Spark's red/black/white visual identity.
- **Real pretrained MathNote OCR 0.2.1** via its public Python `MathOCR().session()` API.
- Multiple strokes per symbol and nonsequential insertion, retaining all the original
  pen coordinates rather than interpreting a pause as the end of a character.
- Session caching: snapshot updates call `add_stroke`, `remove_stroke`, or
  `move_stroke` using stable stroke ids, rather than recreating the whole engine.
- Pen, eraser, undo, clear, symbol bounding boxes, LaTeX, alternatives, confidence
  and recognition latency; mobile-sized browser interface.
- Completely **local processing** after the one-time dependency installation:
  server binds **127.0.0.1**, scripts are local, no CDN, no analytics and no
  handwriting file logging/upload. Handwriting is in memory only.

No model training is required. The MathNote package already includes its default
classifier, subset parser and GNN pretrained weights.

## Run it (Linux, macOS or Windows; Python 3.10+)

From the repository root, after cloning the experiment branch:

```bash
python3 -m venv .venv-mathnote
source .venv-mathnote/bin/activate
python -m pip install --upgrade pip
# Optional, but strongly recommended for a smaller Linux installation:
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r experiments/mathnote/requirements.txt
python experiments/mathnote/server.py
```

On Windows activate with `.venv-mathnote\\Scripts\\activate` instead.
Open **http://127.0.0.1:8765** on the same computer. The first startup loads
bundled weights from the installed Python package. Subsequent runs need no Internet.
This is not a hosted web service; a browser on a different device cannot connect
to the loopback-only server.

If you need another port, pass `--port 8766`. The server will refuse to start
without the real MathNote Python package; it will never substitute the old CNN.

## Verify

Unit tests need only the Python standard library:

```bash
python -m unittest discover -s experiments/mathnote/tests -v
node --check experiments/mathnote/app.js
```

With dependencies installed, test the **actual bundled model**:

```bash
python experiments/mathnote/smoke_model.py
```

The smoke test checks loading, multi-stage detection, late strokes, deletion and
the response schema. It is **not** a recognition-accuracy measurement.

## Why not simply ship it as Spark's offline Android recognizer?

MathNote OCR's current production code uses **PyTorch and Python** for the
grouping search, symbol classifier, Transformer, evidence GNN, and tree
reconstruction. None of those components is presently integrated into Spark's
Android WebView runtime. An Android APK that includes only the Python source
or the `.pth` files cannot perform inference. A laptop-based localhost
recognizer cannot honestly be called an entirely offline *Android* app either.

For an Android-native release, the remaining engineering work is:

1. Export and validate every neural component in an Android inference runtime
   (e.g., ONNX Runtime Mobile or LiteRT, as compatible); exporting just the CNN
   would not provide complete mathematical-expression recognition.
2. Port the candidate stroke grouping, cached inference orchestration, graph
   construction, beam decoding and LaTeX generation to native Kotlin/Java or JS.
3. Adapt the recognizer to Spark's exact-math parser with conservative
   rejection on unsupported or ambiguous LaTeX. **Never** fabricate calculations.
4. Test with actual finger-written strokes, insertions and erasures on Android;
   benchmark touch latency, inference p50/p95, memory and APK size.
5. Keep both the model and all dependencies **inside the app**, with no
   on-demand download; preserve responsiveness on the UI thread.

Until those steps are verified, this experiment is desktop-only and must
not replace the released Spark recognizer.

## Security and privacy

The service is restricted to loopback, imposes body, stroke and point limits,
returns controlled errors instead of false answers and does not persist input.
It is a local development tool, not an internet-facing HTTP service.

## Attribution / licensing

Upstream: [Yonatan Nemtsov / MathNote OCR](https://github.com/YonatanNemtsov/mathnote-ocr),
**Apache License 2.0**. The prototype's integration code is part of Mikajy
Spark (MIT) and does not vendor or relicense upstream code/weights. Before
shipping a redistributed model, inspect the training-data provenance and
any third-party weight restrictions.

This branch builds on the earlier
`feature/ink-spatial-edits-20261110` work. Neither branch changes `main`.
