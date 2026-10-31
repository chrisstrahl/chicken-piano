// Retakes the README screenshots in shots/ from the built app (iPad landscape), with a little progress seeded
// so the coop and level map look lived in.
// usage: node build.mjs && node tools/readme-shots.cjs [shotsDir]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const out = process.argv[2] || 'shots';
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('PAGEERROR: ' + e.message); process.exitCode = 1; });
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.evaluate(() => {
    localStorage.clear();
    const key = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const days = {};
    for (const n of [1, 2, 3, 4, 6, 7, 9, 10, 11, 14, 15]) days[key(n)] = 2;
    const songs = {};
    window.__cp.SONGS.slice(0, 6).forEach((s, i) => { songs[s.id] = 3 - (i % 2); });
    const lessons = {};
    window.__cp.LEVELS[0].lessons.forEach((l) => { lessons[l.id] = 1; });
    localStorage.setItem('chicken-piano-v1', JSON.stringify({ songs, lessons, days }));
  });
  await page.reload();
  await page.waitForTimeout(800);
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(1200);
  const shot = async (name, wait = 600) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}.png` }); console.log(name); };
  const close = () => page.evaluate(() => document.querySelector('#party').classList.remove('show'));

  await shot('ipad-home');
  await page.click('[data-go=learn]'); await shot('ipad-learn');

  // a song with the staff and keyboard, a few notes in
  await page.evaluate(() => { window.__cp.progress.hands = 'rh'; window.__cp.openSong('peck', 'songs'); });
  await page.waitForTimeout(1500);
  for (const m of [64, 62]) { await page.evaluate((m) => window.__cp.noteIn(m, 'tap'), m); await page.waitForTimeout(450); }
  await page.click('#btnHint'); await shot('ipad-song', 350);

  // Egg Rush
  await page.evaluate(() => window.__cp.show('learn'));
  await page.evaluate(() => { document.querySelector('#learn [data-pick="rush"]').click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#gameCards [data-game="rush"][data-i="0"]').click());
  await page.waitForFunction(() => window.__cp.games.R.ready, null, { timeout: 15000 });
  const notes = await page.evaluate(() => window.__cp.games.R.notes);
  for (const m of notes.slice(0, 4)) { await page.evaluate((m) => window.__cp.noteIn(m, 'tap'), m); await page.waitForTimeout(250); }
  await shot('ipad-egg-rush', 200);

  // Find it (ear game)
  await page.evaluate(() => window.__cp.show('learn'));
  await page.click('#learn [data-go=ears]'); await shot('ipad-find-it', 400);

  // the coop calendar and streak
  await page.evaluate(() => window.__cp.show('home'));
  await close();
  await page.click('#coop'); await shot('ipad-coop');

  // level map
  await page.evaluate(() => window.__cp.show('learn'));
  await page.evaluate(() => document.querySelector('#learn [data-go=map]')?.click());
  await shot('ipad-map');

  // Record a Song (free play lives here)
  await page.evaluate(() => window.__cp.show('home'));
  await page.evaluate(() => window.__cp.show('free'));
  await page.waitForTimeout(800);
  for (const m of [60, 64, 67, 72]) { await page.evaluate((m) => window.__cp.noteIn(m, 'tap'), m); await page.waitForTimeout(500); }
  await shot('ipad-free-play', 300);
  await browser.close();
})();
