// Browser test for the ear game (👂 on the home screen): every nest finishes, wrong keys replay and then
// light up the right key, eggs reach the coop, and the mic can't answer with the chicken's own notes.
// usage: node test/ears.cjs [shotsDir]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const out = process.argv[2] || 'shots';
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
  const E = () => page.evaluate(() => { const e = window.__cp.ears.E; return { ready: e.ready, notes: e.notes, pos: e.pos, round: e.round, misses: e.misses, si: e.si }; });
  const ready = () => page.waitForFunction(() => window.__cp.ears.E.ready || document.querySelector('#party.show'), null, { timeout: 15000 });
  const tap = (m) => page.locator(`#earKb [data-m="${m}"]`).dispatchEvent('pointerdown').then(() => page.locator(`#earKb [data-m="${m}"]`).dispatchEvent('pointerup'));
  const partyEggs = () => page.evaluate(() => document.querySelector('#party.show') ? document.querySelectorAll('#partyEggs span:not([style])').length : null);
  const closeParty = () => page.evaluate(() => document.querySelector('#party').classList.remove('show'));

  await page.screenshot({ path: `${out}/ears-home.png` });
  await page.click('[data-go=learn]'); await page.waitForTimeout(300); await page.click('#learn [data-go=ears]'); await page.waitForTimeout(400);
  check(await page.locator('#earCards .earcard').count() === 8, 'eight nests');
  await page.screenshot({ path: `${out}/ears-nests.png` });

  // every nest, played perfectly with taps: three eggs each
  for (let i = 0; i < 8; i++) {
    await page.evaluate((i) => document.querySelector(`#earCards [data-ear="${i}"]`).click(), i);
    for (let r = 0; r < 5; r++) {
      await ready();
      const e = await E();
      if (i === 6 && r === 1) { await tap(e.notes[0]); await page.waitForTimeout(100); await page.screenshot({ path: `${out}/ears-play.png` }); for (const m of e.notes.slice(1)) await tap(m); }
      else for (const m of e.notes) await tap(m);
      if (r < 4) await page.waitForFunction((r) => window.__cp.ears.E.round === r + 1 && !window.__cp.ears.E.ready, r, { timeout: 5000 });
    }
    await page.waitForFunction(() => document.querySelector('#party.show'), null, { timeout: 5000 });
    check(await partyEggs() === 3, `nest ${i + 1} perfect: 3 eggs`);
    await closeParty();
    await page.evaluate(() => window.__cp.show('ears'));
  }
  check(await page.evaluate(() => Object.values(window.__cp.progress.ears).reduce((a, b) => a + b, 0)) === 24, '24 eggs saved');
  await page.evaluate(() => window.__cp.show('home'));
  check((await page.textContent('#coop')).includes('24'), 'coop counts ear eggs');

  // wrong keys: each one replays the puzzle; after three the right key glows; misses lower the eggs
  await page.evaluate(() => window.__cp.show('ears'));
  await page.evaluate(() => document.querySelector('#earCards [data-ear="0"]').click());
  await ready();
  let e = await E();
  const wrong = [60, 62, 64].find((m) => m !== e.notes[0]);
  for (let k = 0; k < 3; k++) {
    await tap(wrong);
    check(!(await E()).ready, `wrong key ${k + 1} replays (keys wait)`);
    await ready();
  }
  check(await page.evaluate(() => document.querySelector('#earKb .target')?.dataset.m) === String(e.notes[0]), 'after 3 wrong keys the right key glows');
  await page.screenshot({ path: `${out}/ears-hint.png` });
  for (let r = 0; r < 5; r++) {
    await ready();
    e = await E();
    if (r > 0) { await tap([60, 62, 64].find((m) => m !== e.notes[0])); await ready(); e = await E(); }
    for (const m of e.notes) await tap(m);
    if (r < 4) await page.waitForFunction((r) => window.__cp.ears.E.round === r + 1, r, { timeout: 5000 });
  }
  await page.waitForFunction(() => document.querySelector('#party.show'), null, { timeout: 5000 });
  check(await partyEggs() === 1, '7 wrong keys: 1 egg');
  check(await page.evaluate(() => window.__cp.progress.ears.ear1) === 3, 'best eggs kept');
  await closeParty();

  // the mic can't answer while the chicken plays or its notes still ring; it can a second later
  await page.evaluate(() => document.querySelector('#earCards [data-ear="1"]').click());
  await page.waitForFunction(() => window.__cp.ears.E.stopPlay, null, { timeout: 15000 });
  e = await E();
  await page.evaluate((m) => window.__cp.noteIn(m, 'mic'), e.notes[0]);
  check((await E()).pos === 0 && (await E()).misses === 0, 'mic note during playback ignored');
  await ready();
  await page.evaluate((m) => window.__cp.noteIn(m, 'mic'), e.notes[0]);
  check((await E()).round === 0, 'mic note right after playback ignored');
  await page.waitForTimeout(1100);
  await page.evaluate((m) => window.__cp.noteIn(m + 12, 'mic'), e.notes[0]);
  check((await E()).round === 1, 'mic note a second later counts (any octave)');
  // MIDI answers right away
  await ready();
  e = await E();
  await page.evaluate((m) => window.__cp.noteIn(m - 12, 'midi'), e.notes[0]);
  check((await E()).round === 2, 'MIDI note counts');

  // leaving mid-puzzle stops the chicken
  await page.evaluate(() => window.__cp.show('home'));
  check(!(await E()).ready && !(await page.evaluate(() => window.__cp.ears.E.stopPlay)), 'leaving stops the game');

  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: `${out}/ears-home-phone.png` });
  await page.evaluate(() => document.querySelector('#learn [data-go=ears]').click()); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/ears-nests-phone.png` });
  await page.evaluate(() => document.querySelector('#earCards [data-ear="7"]').click()); await ready();
  await page.screenshot({ path: `${out}/ears-play-phone.png` });
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await browser.close();
})();
