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
for name in ("MathCore", "Calculator", "SettingsStore", "Store"):
    assert f"const {name}" in page, name
assert "CAS.special(" not in page
assert "--canvas:#000000" in page and "--canvas:#ffffff" in page
assert len(page) > 100_000  # CNN weights actually included

# Security properties of the shipped page.
assert "Content-Security-Policy" in page and "default-src 'none'" in page and "connect-src 'none'" in page
assert "unsafe-eval" not in page, "the page must not need eval"
assert not re.search(r"\bnew Function\b|\beval\(", page), "eval / new Function must not be used"
assert not re.search(r"""(?:src|href)\s*=\s*["']https?://""", page), "no remote resources"

script = re.search(r"<script>\s*(.*?)\s*</script>", page, flags=re.DOTALL)
assert script, "Missing application script"
with tempfile.TemporaryDirectory() as temp:
    path = pathlib.Path(temp) / "bundle.js"
    path.write_text(script.group(1), encoding="utf-8")
    subprocess.run(["node", "--check", str(path)], check=True)
print("Offline HTML build, CSP, no-eval and assembled JavaScript syntax: PASS")
