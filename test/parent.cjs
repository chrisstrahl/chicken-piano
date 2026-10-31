// Grown-ups' page: holding 📊 in the coop opens it (a tap doesn't), one card per kid with lessons, songs,
// game eggs and the notes missed most; wrong keys in a song are counted once per note.
// usage: node test/parent.cjs [shotsDir]
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

  // a song: two wrong keys on the first note count once, one on the next note counts again
  await page.evaluate(() => window.__cp.openSong(window.__cp.SONGS[0].id)); await page.waitForTimeout(400);
  const first = await page.evaluate(() => window.__cp.P.events[0].need[0]);
  const wrong = first.m === 62 ? 64 : 62;
  await page.evaluate((w) => { window.__cp.noteIn(w, 'tap'); window.__cp.noteIn(w, 'tap'); }, wrong);
  check(await page.evaluate((l) => window.__cp.progress.missed[l] === 1, first.label), `a wrong key is counted once per note (${first.label})`);
  await page.evaluate(() => {
    const p = window.__cp.progress;
    p.lessons = { [window.__cp.LEVELS[0].lessons[0].id]: true, [window.__cp.LEVELS[0].lessons[1].id]: true };
    p.songs[window.__cp.SONGS[0].id] = 3;
    p.games = { ...(p.games || {}), rush1: 2, ft1: 3 };
    p.missed = { ...p.missed, 'F♯': 7 };
  });
  // a second kid
  await page.evaluate(() => { const k = window.__cp.players.add('sunny', 'Robin'); window.__cp.players.save({ songs: {}, lessons: {}, days: {} }, k.id); });

  await page.evaluate(() => window.__cp.show('nest')); await page.waitForTimeout(300);
  await page.click('#btnParent'); await page.waitForTimeout(300);
  check(await page.evaluate(() => !document.querySelector('#parent').classList.contains('active')), 'a tap does not open it');
  const box = await page.locator('#btnParent').boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10); await page.mouse.down(); await page.waitForTimeout(1700); await page.mouse.up();
  await page.waitForTimeout(300);
  check(await page.evaluate(() => document.querySelector('#parent').classList.contains('active')), 'holding 1.5 s opens it');
  await page.screenshot({ path: `${out}/parent.png` });
  const cards = await page.evaluate(() => [...document.querySelectorAll('#parentCards .pcard')].map((c) => c.textContent.replace(/\s+/g, ' ')));
  check(cards.length === 2, `one card per kid (${cards.length})`);
  check(/Lessons ?2 \/ 40/.test(cards[0]) && /Songs played ?1 \//.test(cards[0]) && /Perfect \(3 eggs\) ?1/.test(cards[0]), 'lessons and songs counted');
  check(/Egg Rush ?2 \//.test(cards[0]) && /Fresh Tunes ?3 \//.test(cards[0]), 'game eggs per game');
  check(/F♯ 7×/.test(cards[0]) && cards[0].indexOf('F♯') < cards[0].indexOf(first.label + ' 1×'), 'notes missed most, most first');
  check(/Nothing yet/.test(cards[1]), 'second kid: nothing missed yet');
  check(!errs.length, `no page errors ${errs.join(' | ')}`);
  await browser.close();
})();
