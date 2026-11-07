#!/usr/bin/env python3
"""Pack the float32 training checkpoint (training/model4.json) into the shipped float16 model.

float16 halves the weights (and the startup parse/decode cost) with no measurable effect on
recognition: on 2 460 glyph/stroke probes top-1 agreement is 100 % and the largest probability
change is < 0.001. (int8 was rejected: it altered the top-5 candidate lists in ~12 % of probes.)

    python3 training/pack_model.py            # -> web/model/model4.f16.json
"""
import base64, json, pathlib
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC, DST = ROOT / "training/model4.json", ROOT / "web/model/model4.f16.json"
TENSORS = ("w1", "b1", "w2", "b2", "w3", "b3", "w4", "b4")

def main():
    src = json.loads(SRC.read_text())
    out = {"fmt": "f16", "cls": src["cls"]}
    for k in TENSORS:
        w32 = np.frombuffer(base64.b64decode(src[k]), dtype="<f4")
        w16 = w32.astype("<f2")
        assert np.isfinite(w16).all(), f"{k}: value outside float16 range"
        out[k] = base64.b64encode(w16.tobytes()).decode()
    DST.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {DST.relative_to(ROOT)}  {DST.stat().st_size // 1024} KB (was {SRC.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    main()
