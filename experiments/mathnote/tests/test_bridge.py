"""Contract tests for the offline MathNote OCR bridge. No torch dependency."""
import http.client
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server as S  # noqa: E402


class DummyExpression:
    def __init__(self, count):
        self.latex = str(count)
        self.confidence = 0.9
        self.alternatives = []
        self.count = count

    def to_dict(self):
        return {
            "latex": self.latex,
            "confidence": self.confidence,
            "symbols": [{"name": "1", "bbox": {"x": 0, "y": 0, "w": 10, "h": 10}}] * self.count,
            "unexplained_stroke_ids": [],
        }


class DummySession:
    def __init__(self):
        self.ink = {}
        self.operations = []

    def add_stroke(self, pts, *, id, width):
        assert id not in self.ink
        self.ink[id] = pts
        self.operations.append(("add", id))

    def remove_stroke(self, id):
        del self.ink[id]
        self.operations.append(("remove", id))

    def move_stroke(self, id, pts):
        self.ink[id] = pts
        self.operations.append(("move", id))

    def clear(self):
        self.ink.clear()
        self.operations.append(("clear", None))

    def detect(self, *, top_k, seed):
        assert top_k == 3 and seed == 0
        self.operations.append(("detect", None))
        return DummyExpression(len(self.ink))


class DummyModel:
    def session(self):
        return DummySession()


def snap(ids, position=None):
    return [
        {"id": i, "points": [[float(i * 22 if position is None else position), 1.0], [float(i * 22 + 10 if position is None else position + 10), 2.0]]}
        for i in ids
    ]


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.engine = S.Engine(DummyModel())

    def test_insertion_after_earlier_recognition_keeps_all_raw_strokes(self):
        first = self.engine.recognize({"revision": 0, "strokes": snap([1, 3])})
        second = self.engine.recognize({
            "session_id": first["session_id"], "revision": 1,
            "strokes": snap([1, 3, 2]),
        })
        self.assertEqual(second["reading"]["latex"], "3")
        self.assertEqual(second["stroke_count"], 3)
        self.assertEqual(list(self.engine.sessions[first["session_id"]].model.ink), [1, 3, 2])
        self.assertEqual(second["revision"], 1)

    def test_late_stroke_undo_and_move_are_incremental(self):
        first = self.engine.recognize({"revision": 0, "strokes": snap([4])})
        sid = first["session_id"]
        second = self.engine.recognize({"session_id": sid, "revision": 1, "strokes": snap([4, 5])})
        self.assertEqual(second["reading"]["latex"], "2")
        changed = snap([4, 5], position=22)
        self.engine.recognize({"session_id": sid, "revision": 2, "strokes": changed})
        self.engine.recognize({"session_id": sid, "revision": 3, "strokes": snap([4])})
        operations = self.engine.sessions[sid].model.operations
        self.assertEqual(operations.count(("add", 4)), 1)
        self.assertEqual(operations.count(("add", 5)), 1)
        self.assertEqual(operations.count(("move", 4)), 1)
        self.assertEqual(operations.count(("move", 5)), 1)
        self.assertIn(("remove", 5), operations)

    def test_revision_replay_and_stale_requests(self):
        first = self.engine.recognize({"revision": 5, "strokes": snap([0])})
        sid = first["session_id"]
        again = self.engine.recognize({"session_id": sid, "revision": 5, "strokes": snap([0])})
        self.assertEqual(first["reading"], again["reading"])
        with self.assertRaises(S.InvalidInput):
            self.engine.recognize({"session_id": sid, "revision": 4, "strokes": []})
        with self.assertRaises(S.InvalidInput):
            self.engine.recognize({"session_id": sid, "revision": 5, "strokes": snap([1])})

    def test_erase_and_clear(self):
        first = self.engine.recognize({"revision": 0, "strokes": snap([0, 1])})
        sid = first["session_id"]
        erased = self.engine.recognize({"session_id": sid, "revision": 1, "strokes": snap([1])})
        self.assertEqual(erased["reading"]["latex"], "1")
        clear = self.engine.recognize({"session_id": sid, "revision": 2, "strokes": []})
        self.assertEqual(clear["reading"]["latex"], "")
        self.assertEqual(clear["reading"]["symbols"], [])

    def test_input_validation(self):
        bad = [
            [{"id": 1, "points": [[float("nan"), 1]]}],
            [{"id": 1, "points": [[1, 2]]}, {"id": 1, "points": [[1, 3]]}],
            [{"id": -1, "points": [[1, 2]]}],
            [{"id": 4, "points": []}],
            [{"id": 4, "points": [["1", 2]]}],
        ]
        for sample in bad:
            with self.subTest(sample=str(sample)), self.assertRaises(S.InvalidInput):
                S.validate_strokes(sample)

    def test_sessions_isolated(self):
        a = self.engine.recognize({"revision": 0, "strokes": snap([1])})
        b = self.engine.recognize({"revision": 0, "strokes": snap([2, 3])})
        self.assertNotEqual(a["session_id"], b["session_id"])
        self.assertEqual(a["reading"]["latex"], "1")
        self.assertEqual(b["reading"]["latex"], "2")

    def test_http_is_local_and_does_not_expose_strokes(self):
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), S.make_handler(self.engine))
        worker = threading.Thread(target=httpd.serve_forever, daemon=True)
        worker.start()
        try:
            conn = http.client.HTTPConnection("127.0.0.1", httpd.server_port, timeout=5)
            conn.request("GET", "/api/health")
            resp = conn.getresponse()
            self.assertEqual(resp.status, 200)
            self.assertIn("connect-src 'self'", resp.headers["Content-Security-Policy"])
            self.assertTrue(json.loads(resp.read())["offline"])
            conn.request("POST", "/api/recognize", body=json.dumps({"revision": 0, "strokes": snap([3])}),
                         headers={"Content-Type": "application/json"})
            resp = conn.getresponse()
            self.assertEqual(resp.status, 200)
            reply = json.loads(resp.read())
            self.assertEqual(reply["reading"]["latex"], "1")
            self.assertNotIn("points", str(reply))
            conn.close()
        finally:
            httpd.shutdown()
            httpd.server_close()


if __name__ == "__main__":
    unittest.main()
