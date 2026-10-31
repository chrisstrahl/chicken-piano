// Tricky-spot loop (🔁 in the song player): loops the phrase you're on, slow then faster; a clean pass speeds
// up, misses repeat the speed, three tries move on anyway, a clean bunny pass goes back to normal playing
// at the start of the spot.
// usage: node test/spot.cjs [shotsDir]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const out = process.argv[2] || 'shots';
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  await ctx.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
  const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };

  await page.evaluate(() => window.__cp.openSong(window.__cp.SONGS.find((s) => s.sub === 'Twinkle Twinkle Little Star').id)); await page.waitForTimeout(500);
  // go to the second phrase by tapping the music
  await page.evaluate(() => window.__cp.jumpToBeat(8)); await page.waitForTimeout(200);
  await page.click('#btnSpot');
  await page.waitForFunction(() => window.__cp.P.judge, null, { timeout: 30000 });
  const spot = await page.evaluate(() => window.__cp.spot());
  check(spot && spot.a > 0 && spot.lvl === 0, `loops the phrase you are on, snail speed first ${JSON.stringify(spot)}`);
  await page.screenshot({ path: `${out}/spot.png` });
  // play each note on its moment
  const playPass = () => page.evaluate(() => new Promise((res) => {
    const j = window.__cp.P.judge;
    j.items.forEach((it) => setTimeout(() => window.__cp.noteIn(j.notes[it.i].keys[0].m, 'tap'), Math.max(0, it.t - performance.now())));
    const iv = setInterval(() => { if (window.__cp.P.judge !== j) { clearInterval(iv); res(); } }, 50);
  }));
  for (let lvl = 1; lvl <= 2; lvl++) {
    await playPass();
    await page.waitForFunction(() => window.__cp.P.judge, null, { timeout: 30000 });
    check(await page.evaluate(() => window.__cp.spot().lvl) === lvl, `clean pass: speed ${lvl}`);
  }
  // a pass with nothing played: same speed again
  await page.waitForFunction(() => window.__cp.spot()?.tries === 1, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__cp.P.judge, null, { timeout: 30000 });
  check(await page.evaluate(() => window.__cp.spot().lvl === 2 && window.__cp.spot().tries === 1), 'missed pass: same speed again');
  await playPass();
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({ mode: window.__cp.P.mode, spot: window.__cp.spot(), e: window.__cp.P.e }));
  check(!after.mode && !after.spot && after.e > 0, `clean bunny pass: fixed, back to playing from the spot ${JSON.stringify(after)}`);
  check(!errs.length, `no page errors ${errs.join(' | ')}`);
  await browser.close();
})();
