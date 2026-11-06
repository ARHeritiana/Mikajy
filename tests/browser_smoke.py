#!/usr/bin/env python3
"""Smoke test of the actual assembled offline page, without an Android device."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

PAGE = (Path(__file__).resolve().parents[1] / "android/assets/index.html").as_uri()

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 412, "height": 840})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        await page.goto(PAGE)
        await page.locator("#pad").wait_for()
        value = await page.evaluate("""() => ({
            result: Calculator.compute(['1','/','3'],{fmt:'frac'}).text,
            repeat: Calculator.compute(['(','x','-','1',')','^','(','2',')','=','0']).text,
            hasCanvas: !!document.querySelector('#pad').getContext('2d')
        })""")
        assert value == {"result": "=1/3", "repeat": "x=1", "hasCanvas": True}, value

        await page.locator("#mb").click()
        await page.locator("button.opt[data-k='theme'][data-v='light']").click()
        assert await page.evaluate("document.documentElement.dataset.theme") == "light"
        await page.locator("button.opt[data-k='angle'][data-v='deg']").click()
        assert await page.evaluate("SET.angle") == "deg"
        await page.locator("button.tool[data-a='hist']").click()
        assert await page.locator("#panel h2").inner_text() == "History"
        await page.locator("button.iconbtn[data-a='back']").click()
        await page.locator("button[data-a='done']").click()

        # Actual classifier/feature extraction without relying on a particular guess.
        recognition = await page.evaluate("""async () => {
          const stroke = [[[50,20],[50,35],[50,50],[50,65],[50,80]]];
          const x = feat(stroke);
          const p = await predictAsync(x);
          const guesses = classifyP(p,x);
          return {probabilityLength:p.length, sampleLength:x.length,
                  candidateCount:guesses.length, valid:guesses.every(q=>Number.isFinite(q.p))};
        }""")
        assert recognition["sampleLength"] == 784, recognition
        assert recognition["probabilityLength"] >= 20, recognition
        assert recognition["candidateCount"] >= 1 and recognition["valid"], recognition
        assert not errors, errors
        await browser.close()
    print("Offline browser UI, themes, angle setting and CNN inference: PASS")

asyncio.run(main())
