#!/usr/bin/env python3
"""Offline smoke tests for MathWriting InkML import and rasterization."""
import pathlib
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "training"))
import mathwriting_to_npz as M  # noqa: E402


def make_ink(path, label, xshift=0):
    # The trace format is exactly x y t, x y t, ...; multi-stroke preserved.
    path.write_text(
        '<ink xmlns="http://www.w3.org/2003/InkML">'
        '<annotation type="label">' + label + '</annotation>'
        f'<trace id="1">{10 + xshift} 30 0, {50 + xshift} 30 1</trace>'
        f'<trace id="2">{10 + xshift} 48 2, {50 + xshift} 48 3</trace>'
        '</ink>', encoding="utf-8")


class MathWritingImportTests(unittest.TestCase):
    def test_parse_multi_stroke_and_rasterize(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = pathlib.Path(tmp) / "eq.inkml"
            make_ink(p, "=")
            label, strokes = M.parse_inkml(p)
            self.assertEqual(label, "=")
            self.assertEqual(len(strokes), 2)
            arr = M.rasterize(strokes)
            self.assertEqual(arr.shape, (784,))
            self.assertTrue(0 < arr.max() <= 1)
            self.assertGreater(arr.sum(), 0)

    def test_converter_keeps_augmented_examples_in_training_split(self):
        import numpy as np
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp) / "dataset"
            symbols = root / "symbols"
            symbols.mkdir(parents=True)
            for i in range(100):
                make_ink(symbols / f"{i:016x}.inkml", "=", i % 7)
            out = pathlib.Path(tmp) / "cache"
            M.convert(root, out, 0, 2, 20261110)
            with np.load(out / "mathwriting_train.npz") as tr:
                with np.load(out / "mathwriting_valid.npz") as va:
                    self.assertGreater(len(tr["X"]), 0)
                    self.assertGreater(len(va["X"]), 0)
                    self.assertEqual(len(tr["X"]) % 3, 0)
                    self.assertEqual(len(set(tr["sample_ids"]).intersection(set(va["sample_ids"]))), 0)
                    self.assertEqual(tr["X"].shape[1], 784)
                    self.assertEqual(va["X"].shape[1], 784)


if __name__ == "__main__":
    unittest.main()
