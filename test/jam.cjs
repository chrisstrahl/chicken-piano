// Browser test for the Learn screen columns and Black-key Jam: five columns with their games, the jam groove
// starts and records by itself, notes go into the recording, stopping saves it into My Songs, and the
// groove leaves out the chords while the microphone is listening.
// usage: node test/jam.cjs [shotsDir]
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

  await page.click('[data-go=learn]'); await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/learn-columns.png` });
  const cols = await page.evaluate(() => [...document.querySelectorAll('#learn .cat')].map((c) => c.querySelectorAll('.tile').length));
  check(cols.length === 5 && cols.every((n) => n >= 1), `five columns, each with a game ${JSON.stringify(cols)}`);
  const fits = await page.evaluate(() => [...document.querySelectorAll('#learn .tile')].every((t) => { const r = t.getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth && r.height > 60; }));
  check(fits, 'every tile is on screen and big enough to tap');

  await page.click('#learn [data-go=jam]'); await page.waitForTimeout(500);
  check(await page.evaluate(() => document.querySelector('#jam').classList.contains('active')), 'jam opens');
  check(await page.evaluate(() => document.querySelector('#jamKb').classList.contains('bgroups')), 'black keys are colored');
  await page.click('#jam [data-groove=slow]'); await page.waitForTimeout(800);
  check(await page.evaluate(() => window.__cp.jam.J.groove?.id === 'slow' && window.__cp.recs.on), 'groove plays and recording started by itself');
  for (const m of [66, 68, 70, 73, 75]) { await page.evaluate((m) => window.__cp.noteIn(m, 'tap'), m); await page.waitForTimeout(150); }
  await page.screenshot({ path: `${out}/jam.png` });
  check(await page.evaluate(() => window.__cp.jam.J.notes === 5), 'notes reach the jam');
  await page.click('#jam [data-groove=slow]'); await page.waitForTimeout(300);
  check(await page.evaluate(() => !window.__cp.jam.J.groove && !window.__cp.recs.on), 'tapping the groove again stops it');
  await page.click('#jam [data-go=learn]'); await page.waitForTimeout(200);
  await page.evaluate(() => window.__cp.show('recs')); await page.waitForTimeout(300);
  const saved = await page.evaluate(() => [...document.querySelectorAll('#recCards .reccard .t')].map((e) => e.textContent));
  check(saved.includes('Black-key Jam'), `jam saved in My Songs ${JSON.stringify(saved)}`);

  // leaving mid-jam saves too
  await page.evaluate(() => window.__cp.show('jam')); await page.waitForTimeout(200);
  await page.click('#jam [data-groove=fast]'); await page.waitForTimeout(300);
  await page.evaluate(() => window.__cp.noteIn(66, 'tap')); await page.waitForTimeout(200);
  await page.evaluate(() => window.__cp.show('learn')); await page.waitForTimeout(300);
  check(await page.evaluate(() => !window.__cp.jam.J.beat && !window.__cp.recs.on), 'leaving stops the groove and saves');

  check(!errs.length, `no page errors ${errs.join(' | ')}`);
  await browser.close();
})();
