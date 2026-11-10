#!/usr/bin/env python3
"""Real pretrained MathNote OCR smoke test. Needs mathnote-ocr==0.2.1 installed.

This verifies installation, bundled weights, incremental API, and result shape.
It is deliberately not an accuracy benchmark on real finger-writing.
"""
from __future__ import annotations
import math
import time

import torch
from mathnote_ocr import MathOCR


def run():
    torch.set_num_threads(min(4, torch.get_num_threads()))
    t0 = time.perf_counter()
    model = MathOCR()
    load_ms = round((time.perf_counter() - t0) * 1000)
    session = model.session()
    one = [(30, 35), (32, 28), (36, 26), (36, 44), (36, 68), (37, 86)]
    bar_a = [(95, 45), (112, 45), (140, 45)]
    bar_b = [(95, 59), (113, 59), (140, 59)]
    t1 = time.perf_counter()
    session.add_stroke(one, id=1, width=2.0)
    first = session.detect(top_k=2, seed=0)
    session.add_stroke(bar_a, id=2, width=2.0)
    second = session.detect(top_k=2, seed=0)
    # Late completion: bar two is appended after earlier symbols were already read.
    session.add_stroke(bar_b, id=3, width=2.0)
    third = session.detect(top_k=2, seed=0)
    last_ms = round((time.perf_counter() - t1) * 1000)
    session.remove_stroke(2)
    after_delete = session.detect(top_k=2, seed=0)
    for expr in (first, second, third, after_delete):
        assert isinstance(expr.latex, str)
        assert math.isfinite(expr.confidence)
        exported = expr.to_dict()
        assert isinstance(exported["symbols"], list)
        assert isinstance(exported["latex"], str)
    assert len(session.strokes) == 2
    print({
        "model_load_ms": load_ms,
        "three_incremental_detections_ms": last_ms,
        "stage_1_latex": first.latex,
        "stage_2_latex": second.latex,
        "stage_3_latex": third.latex,
        "post_removal_latex": after_delete.latex,
        "pretrained_model_api": "PASS",
    })


if __name__ == "__main__":
    run()
