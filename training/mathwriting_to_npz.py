#!/usr/bin/env python3
"""Convert Google's MathWriting symbols/*.inkml into Spark's 28x28 CNN examples.

Only completed, labeled symbols are used. Partial strokes are *not* mislabeled as complete
characters. Splits happen BEFORE augmentation, avoiding augmented-copy leakage.
The copyrighted datasets and generated model weights must not be committed automatically.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import pathlib
import re
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODEL_CLASSES = set(json.loads((ROOT / "web/model/model4.f16.json").read_text())["cls"])
ALIASES = {
    r"\times": "*", "×": "*", r"\cdot": "*", r"\div": "/",
    r"\pi": "π", r"\sqrt": "√", r"\lparen": "(", r"\rparen": ")",
    r"\%": "%", r"\!": "!", r"\left(": "(", r"\right)": ")",
}

def parse_inkml(path: pathlib.Path):
    root = ET.parse(path).getroot()
    label = None
    strokes = []
    for node in root.iter():
        tag = node.tag.rsplit("}", 1)[-1]
        if tag == "annotation" and node.attrib.get("type") == "label":
            label = (node.text or "").strip()
        elif tag == "trace":
            pts = []
            for entry in (node.text or "").split(","):
                # InkML coordinates are x, y, optionally time. Reject nonnumeric marks.
                pieces = entry.split()
                if len(pieces) < 2:
                    continue
                try:
                    x, y = float(pieces[0]), float(pieces[1])
                except ValueError:
                    continue
                if np.isfinite(x) and np.isfinite(y):
                    pts.append((x, y))
            if pts:
                strokes.append(pts)
    return ALIASES.get(label, label), strokes

def rasterize(strokes, pen_width=11.6, stretch=(1.0, 1.0)):
    """Match web/core_main.js feat(): 112px canvas, 80px bbox, 4x downsampling."""
    points = [p for stroke in strokes for p in stroke]
    xs, ys = zip(*points)
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    scale = 80 / max(max(xs) - min(xs), max(ys) - min(ys), 1.0)
    sx, sy = stretch
    im = Image.new("L", (112, 112), 0)
    draw = ImageDraw.Draw(im)
    diameter = max(1, int(round(pen_width)))
    rad = pen_width / 2
    for stroke in strokes:
        p = [((x - cx) * scale * sx + 56, (y - cy) * scale * sy + 56) for x, y in stroke]
        if len(p) > 1:
            draw.line(p, fill=255, width=diameter, joint="curve")
        for x, y in (p if len(p) == 1 else (p[0], p[-1])):
            draw.ellipse((x - rad, y - rad, x + rad, y + rad), fill=255)
    return np.asarray(im.resize((28, 28), Image.Resampling.BOX), dtype=np.float32).reshape(784) / 255

def convert(folder: pathlib.Path, outdir: pathlib.Path, max_files: int, augment: int, seed: int):
    rng = np.random.default_rng(seed)
    counts = {"train": 0, "valid": 0}
    data = {"train": ([], [], []), "valid": ([], [], [])}
    files = sorted((folder / "symbols").rglob("*.inkml"))
    if max_files:
        files = files[:max_files]
    if not files:
        raise SystemExit(f"No *.inkml files found under {folder / 'symbols'}")
    unsupported = {}
    for path in files:
        try:
            label, strokes = parse_inkml(path)
        except (ET.ParseError, OSError, ValueError):
            continue
        if not strokes or label not in MODEL_CLASSES:
            unsupported[str(label)] = unsupported.get(str(label), 0) + 1
            continue
        # Stable ink-level validation split, BEFORE augmenting this sample.
        bucket = int(hashlib.sha256((str(seed) + path.stem).encode()).hexdigest()[:8], 16) % 100
        split = "valid" if bucket < 15 else "train"
        X, y, ids = data[split]
        X.append(rasterize(strokes)); y.append(label); ids.append(path.stem)
        counts[split] += 1
        if split == "train":
            for _ in range(augment):
                X.append(rasterize(strokes, pen_width=float(rng.uniform(9.5, 14.0)),
                                   stretch=(float(rng.uniform(.90, 1.10)), float(rng.uniform(.90, 1.10)))))
                y.append(label); ids.append(path.stem)
    outdir.mkdir(parents=True, exist_ok=True)
    for split, (X, y, ids) in data.items():
        if not X:
            raise SystemExit(f"Empty {split} split: check dataset and class labels")
        np.savez_compressed(outdir / f"mathwriting_{split}.npz",
                            X=np.stack(X).astype(np.float32),
                            labels=np.asarray(y), sample_ids=np.asarray(ids))
        print(f"{split}: {counts[split]} original symbols -> {len(X)} examples")
    print("Unsupported / skipped labels:", dict(sorted(unsupported.items(), key=lambda p: -p[1])[:25]))
    print("Reminder: MathWriting data is CC BY-NC-SA 4.0. Do not ship derived weights without license review.")

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("dataset", type=pathlib.Path, help="Unpacked MathWriting directory with symbols/*.inkml")
    p.add_argument("--out", type=pathlib.Path, default=ROOT / "training/cache/mathwriting")
    p.add_argument("--max-files", type=int, default=0, help="Optional bounded smoke experiment")
    p.add_argument("--augment", type=int, default=2, help="Extra TRAIN examples per original")
    p.add_argument("--seed", type=int, default=20261110)
    args = p.parse_args()
    if args.augment < 0 or args.max_files < 0:
        p.error("augment and max-files must be nonnegative")
    convert(args.dataset, args.out, args.max_files, args.augment, args.seed)

if __name__ == "__main__":
    main()
