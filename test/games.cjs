// Browser test for the barnyard games (🎪 on the home screen): Egg Rush finishes with eggs and a best time,
// wrong keys light the right key, the mic's ringing last note isn't a wrong key; Copy Cluck takes any key
// in time and shows the notes after; Twinkle Twist needs the right keys; eggs reach the coop.
// usage: node test/games.cjs [shotsDir]
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
  const R = () => page.evaluate(() => { const r = window.__cp.games.R; return { ready: r.ready, notes: r.notes, pos: r.pos, misses: r.misses, done: r.done }; });
  const note = (m, src = 'tap') => page.evaluate(([m, src]) => window.__cp.noteIn(m, src), [m, src]);
  const partyEggs = () => page.evaluate(() => document.querySelector('#party.show') ? document.querySelectorAll('#partyEggs span:not([style])').length : null);
  const waitParty = () => page.waitForFunction(() => document.querySelector('#party.show'), null, { timeout: 150000 });
  const closeParty = () => page.evaluate(() => document.querySelector('#party').classList.remove('show'));
  const open = (kind, i) => page.evaluate(([k, i]) => { document.querySelector(`#learn [data-pick="${k}"]`).click(); document.querySelector(`#gameCards [data-game="${k}"][data-i="${i}"]`).click(); }, [kind, i]);

  await page.screenshot({ path: `${out}/games-home.png` });
  check(await page.locator('#home .menu .tile').count() === 3, 'home: Learn, Play Songs, Record a Song');
  await page.click('[data-go=learn]'); await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/games-learn.png` });
  const nests = {};
  for (const k of ['rush', 'cluck', 'twinkle']) { await page.click(`#learn [data-pick=${k}]`); await page.waitForTimeout(300); nests[k] = await page.locator('#gameCards .gamecard').count(); if (k === 'rush') await page.screenshot({ path: `${out}/games-pick.png` }); await page.click('#games [data-go=learn]'); await page.waitForTimeout(200); }
  check(nests.rush === 8 && nests.cluck === 6 && nests.twinkle === 5, `nests per game ${JSON.stringify(nests)}`);
  await page.click('#learn [data-pick=rush]'); await page.waitForTimeout(300);

  /* Egg Rush */
  await open('rush', 0);
  await page.waitForFunction(() => window.__cp.games.R.ready, null, { timeout: 15000 });
  let r = await R();
  check(r.notes.length === 10 && r.notes.every((m, i) => !i || m % 12 !== r.notes[i - 1] % 12), 'ten notes, no letter twice in a row');
  await page.screenshot({ path: `${out}/games-rush.png` });
  for (const m of r.notes) await note(m);
  await waitParty();
  check(await partyEggs() === 3, 'quick perfect rush: 3 eggs');
  check(await page.evaluate(() => window.__cp.progress.rushBest.rush1 > 0), 'best time saved');
  await closeParty();

  await page.evaluate(() => window.__cp.show('games'));
  check((await page.textContent('#gameCards')).includes('⏱️'), 'best time on the nest card');
  await open('rush', 7);
  await page.waitForFunction(() => window.__cp.games.R.ready, null, { timeout: 15000 });
  r = await R();
  const wrong = [48, 50, 52, 53, 55, 57, 59, 60].find((m) => m % 12 !== r.notes[0] % 12);
  await note(wrong); await note(wrong);
  check(await page.evaluate(() => document.querySelector('#rushKb .target')?.dataset.m) === String(r.notes[0]), 'two wrong keys: the right key glows');
  check((await R()).misses === 2, 'wrong keys counted');
  await page.screenshot({ path: `${out}/games-rush-hint.png` });
  await note(r.notes[0], 'mic');
  await note(r.notes[0] + 12, 'mic');
  check((await R()).pos === 1 && (await R()).misses === 2, 'mic: the note still ringing is not a wrong key');
  for (const m of r.notes.slice(1)) await note(m, 'midi');
  await waitParty();
  check(await partyEggs() === 2, 'two wrong keys: 2 eggs');
  await closeParty();

  /* Copy Cluck and Twinkle Twist: play every note on its moment */
  await page.evaluate(() => {
    setInterval(() => {
      const B = window.__cp.games.B, j = B.judge;
      if (!j || window.__fed === j) return;
      window.__fed = j;
      const any = window.__anyKey;
      j.items.forEach((it) => setTimeout(() => window.__cp.noteIn(any || j.notes[it.i].keys[0].m, 'tap'), Math.max(0, it.t - performance.now() + 15)));
    }, 50);
  });
  await page.evaluate(() => { window.__anyKey = 64; window.__cp.show('games'); });
  await open('cluck', 0);
  await page.waitForFunction(() => window.__cp.games.B.judge, null, { timeout: 20000 });
  check(await page.evaluate(() => document.querySelectorAll('#beatStaff .vf-stavenote').length) === 0, 'cluck: no notes on the staff while listening');
  await page.waitForFunction(() => window.__cp.games.B.round === 1, null, { timeout: 20000 });
  check(await page.evaluate(() => document.querySelectorAll('#beatStaff .vf-stavenote').length) > 0, 'cluck: the notes appear after your turn (any key counts)');
  await page.screenshot({ path: `${out}/games-cluck.png` });
  await waitParty();
  check(await partyEggs() === 3, 'cluck nest 1 perfect: 3 eggs');
  await closeParty();

  // twinkle with the wrong key: no good; with the right keys it passes
  await page.evaluate(() => { window.__anyKey = 0; window.__cp.show('games'); });
  await open('twinkle', 3);
  await page.waitForFunction(() => window.__cp.games.B.judge, null, { timeout: 20000 });
  await page.screenshot({ path: `${out}/games-twinkle.png` });
  await waitParty();
  check(await partyEggs() === 3, 'twinkle nest 4 perfect: 3 eggs');
  await closeParty();

  await page.evaluate(() => { window.__anyKey = 61; window.__cp.show('games'); });
  await open('twinkle', 0);
  await page.waitForFunction(() => window.__cp.games.B.round === 1, null, { timeout: 60000 });
  check(await page.evaluate(() => window.__cp.games.B.fails) === 2, 'twinkle: wrong keys fail (twice, then moves on)');
  await page.evaluate(() => window.__cp.show('home'));
  check(!(await page.evaluate(() => window.__cp.games.B.judge)), 'leaving stops the game');
  const eggs = await page.evaluate(() => Object.values(window.__cp.progress.games).reduce((a, b) => a + b, 0));
  check(eggs === 11, `games eggs saved (${eggs})`);
  check((await page.textContent('#coop')).includes(String(eggs)), 'coop counts game eggs');

  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: `${out}/games-home-phone.png` });
  await page.evaluate(() => window.__cp.show('games')); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/games-pick-phone.png` });
  await open('rush', 6); await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/games-rush-phone.png` });
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await browser.close();
})();
