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
  // free play: a quick next note makes a short note (16th, 8th); holding a key makes a long one (90 beats a minute)
  await page.evaluate(() => window.__cp.show('free'));
  await page.waitForTimeout(300);
  const fk = await page.locator('#freeKb [data-m="67"]').boundingBox();
  const fx = fk.x + fk.width / 2, fy = fk.y + fk.height * 0.85;
  // [hold, then wait before the next note] in ms
  const plan = [[50, 30], [80, 250], [120, 480], [1200, 150], [2400, 150], [1800, 150], [100, 300]];
  for (const [hold, gap] of plan) { await page.mouse.move(fx, fy); await page.mouse.down(); await page.waitForTimeout(hold); await page.mouse.up(); await page.waitForTimeout(gap); }
  const want = '16 8 q h w hd q';
  const lens = await page.evaluate(() => window.__cpFree().map((n) => n.d).join(' '));
  console.log(`${lens === want ? 'PASS' : 'FAIL'} note lengths -> ${lens} (want ${want})`);
  await page.screenshot({ path: (process.argv[2] || '.') + '/free-lengths.png' });
  await browser.close();
})();
