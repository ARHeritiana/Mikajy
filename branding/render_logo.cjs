#!/usr/bin/env node
// Renders branding/logo-spark.svg to the PNGs the project uses (dev-only: needs Playwright + Chromium).
//   branding/logo-1024.png, branding/logo-512.png   transparent rounded corners (store / README size)
//   android/res/drawable/icon.png                   192 px launcher icon, flattened on black (legacy square-icon convention)
// No font is involved: the M and the spark are plain paths, so the output is the same on every machine.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const here = __dirname, svg = fs.readFileSync(path.join(here, 'logo-spark.svg'), 'utf8');
async function shot(browser, size, background) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:${background}">${svg.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body></html>`);
  const png = await page.screenshot({ omitBackground: background === 'transparent' });
  await page.close();
  return png;
}
(async () => {
  const browser = await chromium.launch();
  fs.writeFileSync(path.join(here, 'logo-1024.png'), await shot(browser, 1024, 'transparent'));
  fs.writeFileSync(path.join(here, 'logo-512.png'), await shot(browser, 512, 'transparent'));
  fs.writeFileSync(path.join(here, '..', 'android/res/drawable/icon.png'), await shot(browser, 192, '#000'));
  await browser.close();
  console.log('Mikajy Spark logo written');
})();
