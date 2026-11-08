#!/usr/bin/env python3
"""Reproduce the offline HTML build and syntax-check its assembled application."""
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(ROOT / "web/build_web.py")], cwd=ROOT, check=True)
page = (ROOT / "android/assets/index.html").read_text(encoding="utf-8")
assert "<canvas id=\"pad\"" in page
for name in ("PolyCore", "MathCore", "Calculus", "LinalgCore", "ModularCore", "LatexEval", "Calculator", "I18n", "SettingsStore", "Store", "Recognizer", "Updates"):
    assert f"const {name}" in page, name
assert "CAS.special(" not in page
assert "--canvas:#000000" in page and "--canvas:#ffffff" in page
assert len(page) > 100_000  # CNN weights actually included

# Security properties of the shipped page.
assert "Content-Security-Policy" in page and "default-src 'none'" in page and "connect-src 'none'" in page
assert "unsafe-eval" not in page, "the page must not need eval"
# The vendored Nerdamer bundle (its own <script>, Apache-2.0, unmodified) contains exactly one `new Function`, in its
# buildFunction() helper. The CSP forbids eval, so it could only throw; our code must never call it, and nothing else may eval.
vendor = (ROOT / "web/vendor/nerdamer.js").read_text(encoding="utf-8")
assert len(re.findall(r"\bnew Function\b", vendor)) == 1 and not re.search(r"\beval\(", vendor), "unexpected eval in vendored CAS"
own = page.replace(vendor, "")
assert vendor in page and "buildFunction" not in own, "our code must not call the CAS's eval-based helper"
assert not re.search(r"\bnew Function\b|\beval\(", own), "eval / new Function must not be used"
assert not re.search(r"""(?:src|href)\s*=\s*["']https?://""", page), "no remote resources"

scripts = re.findall(r"<script>\s*(.*?)\s*</script>", page, flags=re.DOTALL)
assert len(scripts) >= 2, "Missing application script"
with tempfile.TemporaryDirectory() as temp:
    for n, code in enumerate(scripts):
        path = pathlib.Path(temp) / f"bundle{n}.js"
        path.write_text(code, encoding="utf-8")
        subprocess.run(["node", "--check", str(path)], check=True)
# The shipped float16 model must be exactly what training/pack_model.py produces from the checkpoint.
import base64, json, struct
# Python's IEEE 754 half-precision encoder validates the shipped model without NumPy.
src = json.loads((ROOT / "training/model4.json").read_text())
shipped = json.loads((ROOT / "web/model/model4.f16.json").read_text())
assert shipped["fmt"] == "f16" and shipped["cls"] == src["cls"], "model metadata out of sync"
for key in ("w1", "b1", "w2", "b2", "w3", "b3", "w4", "b4"):
    expect = b"".join(struct.pack("<e", values[0]) for values in struct.iter_unpack("<f", base64.b64decode(src[key])))
    assert base64.b64decode(shipped[key]) == expect, f"{key}: run training/pack_model.py"
# Every character of the interface strings must exist in the bundled handwriting font (French accents included),
# otherwise it silently falls back to a system font and the handwritten look breaks.
try:
    from fontTools.ttLib import TTFont
    cmap = TTFont(ROOT / "web/fonts/hand.woff2").getBestCmap()
    i18n = (ROOT / "web/i18n.js").read_text(encoding="utf-8")
    text = re.sub(r"<[^>]+>|\{\w+\}", "", "".join(re.findall(r"'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"", i18n) and [a or b for a, b in re.findall(r"'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"", i18n)]))
    missing = sorted({c for c in text if ord(c) < 0x250 and ord(c) not in cmap and not c.isspace()})   # math symbols (ℝ ℂ √ π) already fall back to the system font
    assert not missing, f"interface characters missing from web/fonts/hand.woff2: {missing}"
except ImportError:
    print("(fontTools not installed: skipping the font coverage check)")
print("Offline HTML build, CSP, no-eval and assembled JavaScript syntax: PASS")
