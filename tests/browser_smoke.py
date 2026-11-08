#!/usr/bin/env python3
"""Smoke test of the assembled offline page (the same HTML the APK ships), without a device.

Checks: UI/themes, CNN inference through the Web Worker AND through the main-thread fallback
(with the Content-Security-Policy enforced, i.e. without eval), no network requests, and that
corrupted localStorage cannot break start-up.
"""
import asyncio
import tempfile
from pathlib import Path
from playwright.async_api import async_playwright

PAGE_PATH = Path(__file__).resolve().parents[1] / "android/assets/index.html"
PAGE = PAGE_PATH.as_uri()
RECOGNIZE = """async () => {
  const stroke = [[[50,20],[50,35],[50,50],[50,65],[50,80]]];
  const x = feat(stroke), p = await predictAsync(x), guesses = classifyP(p, x);
  return {len: x.length, classes: p.length, n: guesses.length, ok: guesses.every(q => Number.isFinite(q.p)),
          top: guesses[0].c, sum: p.reduce((a, b) => a + b, 0)};
}"""
CORRUPT = """
  localStorage.setItem('inkhist', '[{"id":5,"syms":"nope"},null,{"id":"ok","ts":1,"syms":[{"c":"1"}],"ans":"=<img src=x onerror=alert(1)>","text":"<img src=x onerror=alert(2)>"}]');
  localStorage.setItem('inkmem', '["1e+21","<b>x</b>",5,"42"]');
  localStorage.setItem('ink4', '[{"c":"1","v":"AAAA"},"junk",{"c":"nope","v":[]}]');
  localStorage.setItem('ink3', '[{"c":"1","v":[1,2,3]},"junk",{"c":"nope","v":[]}]');
  localStorage.setItem('inkset', '{"theme":"neon","angle":"deg","__proto__":{"x":1}}');
"""

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 412, "height": 840})
        errors, requests, console = [], [], []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: console.append(m.text) if m.type in ("error", "warning") else None)
        page.on("request", lambda r: requests.append(r.url))
        await page.add_init_script(CORRUPT)
        await page.goto(PAGE)
        await page.locator("#pad").wait_for()

        # --- the CSP is really enforced (otherwise the checks below prove nothing). Probe with a real
        # inline script in a copy of the page: DevTools-driven evaluation would bypass the policy.
        with tempfile.TemporaryDirectory() as tmp:
            probe = Path(tmp) / "probe.html"
            probe.write_text(PAGE_PATH.read_text(encoding="utf-8").replace(
                "<body>", "<body><script>try{eval('1');window.__p='allowed'}catch(e){window.__p='blocked'}</script>", 1),
                encoding="utf-8")
            probe_page = await browser.new_page()
            await probe_page.goto(probe.as_uri())
            assert await probe_page.evaluate("window.__p") == "blocked", "CSP is not enforced"
            await probe_page.close()
        console.clear()

        # --- corrupted storage is sanitised, never rendered as HTML
        state = await page.evaluate("({hist: HIST.length, mem: MEMV, samples: MEM.length, theme: SET.theme, angle: SET.angle})")
        assert state == {"hist": 1, "mem": ["42"], "samples": 0, "theme": "dark", "angle": "deg"}, state
        await page.locator("#mb").click()
        await page.locator("button.tool[data-a='hist']").click()
        assert await page.locator("#panel img").count() == 0, "stored text was interpreted as HTML"
        await page.locator("button.iconbtn[data-a='back']").click()
        await page.locator("button[data-a='done']").click()

        # --- calculator + UI
        value = await page.evaluate("""() => ({
            result: Calculator.compute(['1','/','3'],{fmt:'frac'}).text,
            repeat: Calculator.compute(['(','x','-','1',')','^','(','2',')','=','0']).text,
            sin180: Calculator.compute(['sin','(','180',')'],{angle:'deg'}).text,
            hasCanvas: !!document.querySelector('#pad').getContext('2d')})""")
        assert value == {"result": "=1/3", "repeat": "x=1", "sin180": "=0", "hasCanvas": True}, value
        await page.locator("#mb").click()
        await page.locator("button[data-tab='app']").click()
        await page.locator("button.opt[data-k='theme'][data-v='light']").click()
        assert await page.evaluate("document.documentElement.dataset.theme") == "light"
        await page.locator("button[data-tab='math']").click()
        await page.locator("button.opt[data-k='angle'][data-v='deg']").click()
        assert await page.evaluate("SET.angle") == "deg"
        await page.locator("button[data-a='done']").click()

        # --- CNN through the worker
        worker = await page.evaluate(RECOGNIZE)
        assert worker["len"] == 784 and worker["classes"] >= 20 and worker["n"] >= 1 and worker["ok"], worker
        assert abs(worker["sum"] - 1) < 1e-3, worker
        assert await page.evaluate("!!wk"), "worker should be running"

        # --- CNN through the main-thread fallback (no eval allowed by the CSP)
        await page.evaluate("stopCNN()")
        assert await page.evaluate("!wk")
        fallback = await page.evaluate(RECOGNIZE)
        assert fallback["top"] == worker["top"], (fallback, worker)
        assert abs(fallback["sum"] - 1) < 1e-3, fallback

        assert not errors, errors
        csp = [m for m in console if "Content Security Policy" in m or "Refused to" in m]
        assert not csp, csp
        remote = [u for u in requests if not u.startswith(("file:", "data:", "blob:"))]
        assert not remote, remote
        await browser.close()
    print("Offline UI, themes, worker + eval-free fallback inference, CSP, hostile storage, no network: PASS")

asyncio.run(main())
