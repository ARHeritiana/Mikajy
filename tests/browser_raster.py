#!/usr/bin/env python3
"""The MathWriting converter (training/mathwriting_to_npz.py) must draw strokes the way the app's feat() does,
or a model trained on its output would see different images from the ones it is given on the phone."""
import asyncio
import sys
from pathlib import Path

import numpy as np
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "training"))
import mathwriting_to_npz as M  # noqa: E402

PAGE = (ROOT / "android/assets/index.html").as_uri()
CASES = {
    "two bars": [[(10, 30), (30, 30), (50, 30)], [(10, 48), (30, 48), (50, 48)]],
    "curve": [[(0, 0), (20, -10), (40, 10), (30, 40), (5, 60), (45, 62)]],
    "dot and stem": [[(20, 20)], [(20, 35), (20, 80)]],
}

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(PAGE)
        for name, strokes in CASES.items():
            js = np.array(await page.evaluate("ss => Array.from(feat(ss))", [[list(q) for q in s] for s in strokes]))
            py = M.rasterize(strokes)
            corr, err = np.corrcoef(js, py)[0, 1], np.abs(js - py).mean()
            assert corr > .99 and err < .015, f"{name}: converter differs from feat() (corr {corr:.4f}, mean error {err:.4f})"
        await browser.close()
    print("MathWriting converter draws like the app's feat(): PASS")

if __name__ == "__main__":
    asyncio.run(main())
