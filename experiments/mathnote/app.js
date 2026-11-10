/* Mikajy × MathNote: local-only input and incremental recognition.
 * No remote URLs, no eval, no upload, no persistent handwriting storage. */
"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const canvas = $("pad"), ctx = canvas.getContext("2d", {alpha: false});
  const state = {
    strokes: [], current: null, nextId: 0, tool: "ink", showBoxes: false,
    symbols: [], latex: "", sessionId: null, revision: 0,
    pending: Promise.resolve(), timer: null, pointerId: null, theme: "dark"
  };
  let redrawQueued = false;
  const setStatus = (message, error = false) => {
    $("status").textContent = message;
    $("status").classList.toggle("error", error);
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint();
  }
  const point = e => {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };
  const color = () => state.theme === "light" ? "#18181b" : "#f4f4f4";
  const paper = () => state.theme === "light" ? "#ffffff" : "#0e0e0f";

  function inkPath(points, alpha = 1) {
    if (!points.length) return;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color();
    ctx.fillStyle = color();
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (points.length === 1) {
      ctx.beginPath(); ctx.arc(points[0][0], points[0][1], 2.1, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last[0], last[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paint() {
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = paper();
    ctx.fillRect(0, 0, rect.width, rect.height);
    for (const s of state.strokes) inkPath(s.points);
    if (state.current) inkPath(state.current.points, .9);
    if (state.showBoxes) {
      ctx.strokeStyle = "#f02d3f";
      ctx.fillStyle = "#f02d3f";
      ctx.lineWidth = 1.2;
      ctx.font = "11px system-ui";
      for (const s of state.symbols) {
        const b = s.bbox;
        if (!b) continue;
        ctx.strokeRect(b.x, b.y, Math.max(1, b.w), Math.max(1, b.h));
        ctx.fillText(s.name || "?", b.x, Math.max(10, b.y - 5));
      }
    }
    $("hint").hidden = state.strokes.length > 0 || !!state.current;
    $("stroke-count").textContent = state.strokes.length + " stroke" +
      (state.strokes.length === 1 ? "" : "s");
    $("undo").disabled = state.strokes.length === 0;
    $("clear").disabled = state.strokes.length === 0;
  }
  function schedulePaint() {
    if (redrawQueued) return;
    redrawQueued = true;
    requestAnimationFrame(() => {redrawQueued = false; paint();});
  }

  function showReading(response) {
    const reading = response.reading || {};
    state.latex = reading.latex || "";
    state.symbols = reading.symbols || [];
    $("latex").textContent = state.latex || "—";
    $("confidence").textContent = Number.isFinite(reading.confidence)
      ? Math.round(reading.confidence * 100) + "%" : "—";
    $("latency").textContent = response.elapsed_ms + " ms";
    $("symbol-count").textContent = String(state.symbols.length);
    const parent = $("alternatives");
    parent.replaceChildren();
    if (!reading.alternatives?.length) {
      const item = document.createElement("span");
      item.className = "muted";
      item.textContent = "No alternatives";
      parent.appendChild(item);
    } else {
      for (const option of reading.alternatives.slice(0, 3)) {
        const item = document.createElement("div");
        item.className = "alt";
        item.textContent = option.latex || "—";
        parent.appendChild(item);
      }
    }
    schedulePaint();
  }

  function requestRecognition() {
    clearTimeout(state.timer);
    const revision = ++state.revision;
    const strokes = state.strokes.map(s => ({id: s.id, points: s.points.map(p => p.slice())}));
    setStatus("Recognizing locally…");
    state.pending = state.pending.catch(() => {}).then(async () => {
      const response = await fetch("/api/recognize", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({session_id: state.sessionId, revision, strokes})
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Recognition unavailable");
      state.sessionId = body.session_id;
      if (revision === state.revision) {
        showReading(body);
        setStatus("Ready · Offline model");
      }
    }).catch(error => {
      if (revision === state.revision) {
        setStatus("Recognition error: " + error.message, true);
      }
    });
  }
  function debouncedRecognition() {
    clearTimeout(state.timer);
    state.timer = setTimeout(requestRecognition, 140);
  }

  function distanceToSegment(point, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len)) : 0;
    return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
  }
  function eraseNear(p) {
    let best = Infinity, chosen = -1;
    state.strokes.forEach((stroke, i) => {
      let d = Math.hypot(p[0] - stroke.points[0][0], p[1] - stroke.points[0][1]);
      for (let k = 1; k < stroke.points.length; k++) {
        d = Math.min(d, distanceToSegment(p, stroke.points[k - 1], stroke.points[k]));
      }
      if (d < best) {best = d; chosen = i;}
    });
    if (best <= 18 && chosen >= 0) {
      state.strokes.splice(chosen, 1);
      schedulePaint();
      debouncedRecognition();
    }
  }
  function setTool(which) {
    state.tool = which;
    for (const name of ["ink", "erase"]) {
      $(name).classList.toggle("active", name === which);
      $(name).setAttribute("aria-pressed", name === which ? "true" : "false");
    }
    canvas.classList.toggle("erasing", which === "erase");
  }

  canvas.addEventListener("pointerdown", e => {
    if (!e.isPrimary || state.pointerId !== null) return;
    e.preventDefault();
    state.pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    const p = point(e);
    if (state.tool === "erase") {eraseNear(p); return;}
    if (state.strokes.length >= 160) {
      setStatus("160-stroke safety limit reached", true);
      state.pointerId = null;
      return;
    }
    state.current = {id: state.nextId++, points: [p]};
    clearTimeout(state.timer);
    schedulePaint();
  });

  canvas.addEventListener("pointermove", e => {
    if (e.pointerId !== state.pointerId || !state.current) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events) {
      const p = point(ev), a = state.current.points.at(-1);
      if (state.current.points.length < 500 && Math.hypot(p[0] - a[0], p[1] - a[1]) >= 1.5) {
        state.current.points.push(p);
      }
    }
    schedulePaint();
  });
  function finish(e, cancelled = false) {
    if (e.pointerId !== state.pointerId) return;
    state.pointerId = null;
    if (!state.current) return;
    if (!cancelled) {
      const p = point(e), last = state.current.points.at(-1);
      if (state.current.points.length < 500 && Math.hypot(p[0] - last[0], p[1] - last[1]) > 1.5) {
        state.current.points.push(p);
      }
      state.strokes.push(state.current);
      debouncedRecognition();
    }
    state.current = null;
    schedulePaint();
  }
  canvas.addEventListener("pointerup", e => finish(e));
  canvas.addEventListener("pointercancel", e => finish(e, true));

  $("ink").addEventListener("click", () => setTool("ink"));
  $("erase").addEventListener("click", () => setTool("erase"));
  $("undo").addEventListener("click", () => {
    if (!state.strokes.length) return;
    state.strokes.pop(); schedulePaint(); debouncedRecognition();
  });
  $("clear").addEventListener("click", () => {
    state.strokes = []; state.current = null; state.symbols = [];
    schedulePaint(); requestRecognition();
  });
  $("rerun").addEventListener("click", requestRecognition);
  $("copy").addEventListener("click", async () => {
    if (!state.latex) return;
    try {
      await navigator.clipboard.writeText(state.latex);
      setStatus("Copied LaTeX");
    } catch (_) {setStatus("Clipboard access unavailable", true);}
  });
  $("boxes").addEventListener("click", () => {
    state.showBoxes = !state.showBoxes;
    $("boxes").setAttribute("aria-pressed", String(state.showBoxes));
    $("boxes").classList.toggle("active", state.showBoxes);
    schedulePaint();
  });
  $("theme").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = state.theme;
    document.querySelector('meta[name="theme-color"]').content = state.theme === "dark" ? "#111113" : "#f8f8f9";
    schedulePaint();
  });
  window.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault(); $("undo").click();
    }
  });

  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
  fetch("/api/health").then(r => r.json()).then(h => {
    setStatus(h.ready ? "Ready · Offline model" : "Engine unavailable", !h.ready);
  }).catch(() => setStatus("Local engine unavailable", true));
})();
