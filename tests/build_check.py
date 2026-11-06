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
assert "<canvas id=\"pad\">" in page
assert "const MathCore" in page and "const Calculator" in page and "const SettingsStore" in page
assert "CAS.special(" not in page
assert "--canvas:#000000" in page and "--canvas:#ffffff" in page
assert len(page) > 100_000  # CNN weights actually included
script = re.search(r"<script>\s*(.*?)\s*</script>", page, flags=re.DOTALL)
assert script, "Missing application script"
with tempfile.TemporaryDirectory() as temp:
    path = pathlib.Path(temp) / "bundle.js"
    path.write_text(script.group(1), encoding="utf-8")
    subprocess.run(["node", "--check", str(path)], check=True)
print("Offline HTML build, theme assets, and assembled JavaScript syntax: PASS")
