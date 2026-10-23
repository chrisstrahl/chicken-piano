// One tap on an on-screen key must count as exactly one press (touch and mouse).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
  await page.evaluate(() => window.__cp.openSong('peck', 'songs')); // starts E E E
  await page.waitForTimeout(400);
  const key = page.locator('#playKb [data-m="64"]');
  const box = await key.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height * 0.85;
  await page.touchscreen.tap(x, y); await page.waitForTimeout(500);
  const afterTouch = await page.evaluate(() => window.__cp.P.e);
  await page.mouse.click(x, y); await page.waitForTimeout(500);
  const afterMouse = await page.evaluate(() => window.__cp.P.e);
  const ok = afterTouch === 1 && afterMouse === 2;
  console.log(`${ok ? 'PASS' : 'FAIL'} touch tap -> note ${afterTouch} (want 1), mouse click -> note ${afterMouse} (want 2)`);
  // free play: how long a key is held becomes the written note length (90 beats a minute)
  await page.evaluate(() => window.__cp.show('free'));
  await page.waitForTimeout(300);
  const fk = await page.locator('#freeKb [data-m="67"]').boundingBox();
  const fx = fk.x + fk.width / 2, fy = fk.y + fk.height * 0.85;
  for (const ms of [200, 600, 1500, 3200]) { await page.mouse.move(fx, fy); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); await page.waitForTimeout(150); }
  const lens = await page.evaluate(() => window.__cpFree().map((n) => n.d).join(' '));
  console.log(`${lens === '8 q h w' ? 'PASS' : 'FAIL'} held lengths -> ${lens} (want 8 q h w)`);
  await page.screenshot({ path: (process.argv[2] || '.') + '/free-lengths.png' });
  await browser.close();
})();
