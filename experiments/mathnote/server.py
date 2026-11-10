#!/usr/bin/env python3
"""Mikajy Spark × MathNote OCR: fully local stroke-recognition experiment.

This is a DESKTOP validation harness, not an Android recognizer or a network service.
The pretrained model and all inference run in this machine's Python process.
Only http://127.0.0.1 is bound; no handwriting is uploaded or stored on disk.
"""
from __future__ import annotations

import argparse
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import re
import threading
import time
from uuid import uuid4

BASE = Path(__file__).resolve().parent
MAX_BODY = 512_000
MAX_STROKES = 160
MAX_POINTS = 500
MAX_SESSIONS = 6
SESSION_TTL = 30 * 60
SESSION_ID = re.compile(r"^[a-f0-9]{32}$")
CSP = (
    "default-src 'none'; script-src 'self'; style-src 'self'; "
    "connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'"
)


class InvalidInput(ValueError):
    pass


def validate_strokes(value):
    """Validate the entire snapshot *before* mutating the session."""
    if not isinstance(value, list) or len(value) > MAX_STROKES:
        raise InvalidInput("strokes must be an array of at most 160 strokes")
    result = OrderedDict()
    for item in value:
        if not isinstance(item, dict):
            raise InvalidInput("each stroke must be an object")
        sid = item.get("id")
        pts = item.get("points")
        if type(sid) is not int or not 0 <= sid <= 2**31 - 1 or sid in result:
            raise InvalidInput("stroke ids must be unique nonnegative integers")
        if not isinstance(pts, list) or not 1 <= len(pts) <= MAX_POINTS:
            raise InvalidInput("each stroke needs 1–500 points")
        clean = []
        for p in pts:
            if not isinstance(p, list) or len(p) < 2:
                raise InvalidInput("points must be [x,y] arrays")
            x, y = p[:2]
            if any(type(v) not in (float, int) or not math.isfinite(v) or abs(v) > 100_000
                   for v in (x, y)):
                raise InvalidInput("point coordinates must be finite and reasonably bounded")
            clean.append([float(x), float(y)])
        result[sid] = clean
    return result


class InkSession:
    """One MathNote Session with id-stable stroke diffs and cached classification."""

    def __init__(self, model):
        self.source_model = model
        self.model = model.session()
        self.ink = OrderedDict()
        self.lock = threading.Lock()
        self.touched = time.monotonic()
        self.last_revision = -1
        self.last_reply = None

    def run(self, snapshot, revision):
        if type(revision) is not int or revision < 0:
            raise InvalidInput("revision must be a nonnegative integer")
        # Reject obsolete responses/requests before changing the model's stroke state.
        if revision < self.last_revision:
            raise InvalidInput("stale revision")
        if revision == self.last_revision:
            if snapshot != self.ink:
                raise InvalidInput("a revision cannot describe different strokes")
            return self.last_reply

        start = time.perf_counter()
        try:
            for sid in list(self.ink):
                if sid not in snapshot:
                    self.model.remove_stroke(sid)
            for sid, points in snapshot.items():
                if sid not in self.ink:
                    self.model.add_stroke(points, id=sid, width=2.0)
                elif points != self.ink[sid]:
                    self.model.move_stroke(sid, points)
            if not snapshot:
                self.model.clear()
                reading = {"latex": "", "confidence": 0.0, "symbols": [],
                           "unexplained_stroke_ids": [], "alternatives": []}
            else:
                expr = self.model.detect(top_k=3, seed=0)
                reading = expr.to_dict()
                reading["alternatives"] = [
                    {"latex": a.latex, "confidence": round(float(a.confidence), 4)}
                    for a in expr.alternatives
                ]
        except Exception:
            # Never expose a partial model state or pretend that recognition succeeded.
            self.model = self.source_model.session()
            self.ink = OrderedDict()
            self.last_revision = -1
            self.last_reply = None
            raise
        elapsed = round((time.perf_counter() - start) * 1000)
        reply = {"revision": revision, "reading": reading,
                 "elapsed_ms": elapsed, "stroke_count": len(snapshot)}
        self.ink = snapshot
        self.last_revision = revision
        self.last_reply = reply
        self.touched = time.monotonic()
        return reply


class Engine:
    """Server lifecycle and per-browser state, with a single pretrained MathOCR object."""

    def __init__(self, model):
        self.model = model
        self.sessions = OrderedDict()
        self.lock = threading.Lock()

    def get_session(self, supplied):
        if supplied is not None and (
            not isinstance(supplied, str) or SESSION_ID.fullmatch(supplied) is None
        ):
            raise InvalidInput("invalid session id")
        now = time.monotonic()
        with self.lock:
            for sid, state in list(self.sessions.items()):
                if now - state.touched > SESSION_TTL:
                    del self.sessions[sid]
            if supplied is not None and supplied in self.sessions:
                state = self.sessions[supplied]
                self.sessions.move_to_end(supplied)
                return supplied, state
            if supplied is not None:
                raise InvalidInput("expired or unknown session id; reload the page")
            if len(self.sessions) >= MAX_SESSIONS:
                self.sessions.popitem(last=False)
            sid = uuid4().hex
            state = InkSession(self.model)
            self.sessions[sid] = state
            return sid, state

    def recognize(self, payload):
        if not isinstance(payload, dict):
            raise InvalidInput("expected JSON object")
        snapshot = validate_strokes(payload.get("strokes"))
        revision = payload.get("revision")
        sid, state = self.get_session(payload.get("session_id"))
        with state.lock:
            data = state.run(snapshot, revision)
        return {"session_id": sid, **data}


def make_handler(engine: Engine):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, _format, *_args):
            # Avoid putting user-supplied data and expression content into server logs.
            return

        def send_data(self, raw, mime, status=200):
            self.send_response(status)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Security-Policy", CSP)
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.end_headers()
            self.wfile.write(raw)

        def send_json(self, payload, status=200):
            self.send_data(json.dumps(payload, ensure_ascii=False, allow_nan=False).encode(),
                           "application/json; charset=utf-8", status)

        def do_GET(self):
            resources = {
                "/": ("index.html", "text/html; charset=utf-8"),
                "/app.js": ("app.js", "text/javascript; charset=utf-8"),
                "/style.css": ("style.css", "text/css; charset=utf-8"),
            }
            if self.path == "/api/health":
                return self.send_json({"ready": True, "engine": "mathnote-ocr",
                                       "offline": True, "android": False})
            if self.path not in resources:
                return self.send_json({"error": "not found"}, 404)
            filename, mime = resources[self.path]
            try:
                return self.send_data((BASE / filename).read_bytes(), mime)
            except OSError:
                return self.send_json({"error": "resource missing"}, 500)

        def do_POST(self):
            if self.path != "/api/recognize":
                return self.send_json({"error": "not found"}, 404)
            try:
                size = int(self.headers.get("Content-Length", "-1"))
                if size <= 0 or size > MAX_BODY:
                    raise InvalidInput("request body must be between 1 and 512000 bytes")
                payload = json.loads(self.rfile.read(size))
                return self.send_json(engine.recognize(payload))
            except (InvalidInput, json.JSONDecodeError, ValueError) as exc:
                return self.send_json({"error": str(exc)}, 400)
            except Exception:
                # Fail closed, never manufacture a valid-looking mathematical result.
                return self.send_json({"error": "recognition failed; check local server"}, 500)

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("--port must be between 1024 and 65535")
    try:
        import torch
        from mathnote_ocr import MathOCR
    except ImportError as exc:
        parser.error("Install pretrained MathNote OCR dependencies first (see README.md): " + str(exc))
    torch.set_num_threads(min(4, torch.get_num_threads()))
    print("Loading bundled pretrained MathNote OCR weights (CPU)…", flush=True)
    model = MathOCR()
    http = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(Engine(model)))
    print(f"Open http://127.0.0.1:{args.port} (local-only; Ctrl-C to stop)", flush=True)
    try:
        http.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        http.server_close()


if __name__ == "__main__":
    main()
