#!/usr/bin/env python3
"""Update UI against a mocked Android bridge: badge, settings rows, manual and automatic checks, link hand-off."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

PAGE = (Path(__file__).resolve().parents[1] / "android/assets/index.html").as_uri()
R = "https://github.com/ARHeritiana/Mikajy/releases/"
BRIDGE = """
  window.__calls = [];
  window.__answer = %s;
  window.Android = {
    version: () => '5.0',
    checkForUpdates() { window.__calls.push('check'); setTimeout(() => window.onUpdateResult(JSON.stringify(window.__answer)), 10); },
    openUpdate(u) { window.__calls.push('open:' + u); },
    copy() {}, shareText() {}, shareImage() {}
  };
"""

async def scenario(browser, answer, stored=None):
    page = await browser.new_page(viewport={"width": 412, "height": 840})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    init = BRIDGE % json.dumps(answer)
    if stored is not None:
        init += f"localStorage.setItem('inkupd', {json.dumps(json.dumps(stored))});"
    await page.add_init_script(init)
    await page.goto(PAGE)
    await page.locator("#pad").wait_for()
    return page, errors

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        available = {"ok": True, "tag": "v5.1", "url": R + "tag/v5.1", "apk": R + "download/v5.1/Mikajy-5.1.apk"}

        page, errors = await scenario(browser, available)
        await page.click("#mb")
        await page.click("button[data-tab=app]")
        text = await page.inner_text("#panel")
        assert "Updates" in text and "Check for updates" in text and "Mikajy 5.0" in text, text
        await page.click("button[data-a=upd]")
        for _ in range(20):   # the page's CSP forbids eval, so poll instead of wait_for_function(string)
            if await page.evaluate("() => document.getElementById('mb').classList.contains('upd')"):
                break
            await page.wait_for_timeout(100)
        text = await page.inner_text("#panel")
        assert "Get Mikajy 5.1" in text and "version 5.1 is available" in text, text
        await page.click("button[data-a=getupd]")
        calls = await page.evaluate("window.__calls")
        assert calls == ["check", "open:" + available["apk"]], calls
        stored = json.loads(await page.evaluate("localStorage.getItem('inkupd')"))
        assert stored["version"] == "5.1", stored
        assert not errors, errors
        await page.close()

        # Already current: no badge. Offline: silent, nothing stored.
        for answer, badge in (({"ok": True, "tag": "v5.0", "url": R + "latest", "apk": ""}, False), ({"ok": False, "reason": "offline"}, False)):
            page, errors = await scenario(browser, answer)
            await page.click("#mb")
            await page.click("button[data-tab=app]")
            await page.click("button[data-a=upd]")
            await page.wait_for_timeout(300)
            assert await page.evaluate("document.getElementById('mb').classList.contains('upd')") == badge
            assert not errors, errors
            await page.close()

        # A stored update that is no longer newer than the installed version is ignored.
        page, errors = await scenario(browser, available, {"checked": 1, "version": "4.9", "url": R + "latest", "apk": ""})
        assert not await page.evaluate("document.getElementById('mb').classList.contains('upd')")
        await page.close()
        # Updates switched off: no automatic check is scheduled.
        page, errors = await scenario(browser, available, {"checked": 0, "version": "", "url": "", "apk": ""})
        await page.evaluate("localStorage.setItem('inkset', JSON.stringify({updates: 'off'}))")
        await page.reload()
        await page.wait_for_timeout(5600)
        assert await page.evaluate("window.__calls") == [], "auto check ran although switched off"
        await page.close()

        # Without the Android bridge (plain browser) the update UI is absent.
        page = await browser.new_page()
        await page.goto(PAGE)
        await page.click("#mb")
        await page.click("button[data-tab=app]")
        assert "Updates" not in await page.inner_text("#panel")
        await browser.close()
    print("Update UI (badge, settings, manual/auto check, link hand-off, off switch): PASS")

asyncio.run(main())
