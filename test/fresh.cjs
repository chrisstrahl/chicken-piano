// Fresh Tunes (Learn → Reading): tunes are made right (in the nest's keys, small moves, end on home), the game
// takes the notes in order, a wrong key twice lights the right one, the mic's ringing note isn't a miss, and
// four tunes give eggs.
// usage: node test/fresh.cjs [shotsDir]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const out = process.argv[2] || 'shots';
  require('fs').mkdirSync(out, { recursive: true });
  const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };

  const { parse } = await import('../src/music.ts');
  const S = await import('../src/sightread.ts');
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let ok = true, why = '';
  for (const st of S.FRESH_STAGES) for (let i = 0; i < 200; i++) {
    const notes = parse(S.freshTune(st, rnd));
    const ms = notes.map((n) => n.keys[0].m);
    const idx = ms.map((m) => st.pool.indexOf(m));
    const bad = notes.length !== st.len ? 'length' : idx.some((x) => x < 0) ? 'outside pool'
      : idx.some((x, k) => k && Math.abs(x - idx[k - 1]) > st.leaps) ? 'big leap'
      : idx[idx.length - 1] !== 0 ? 'not home' : idx.some((x, k) => k > 1 && x === idx[k - 1] && x === idx[k - 2]) ? 'three in a row' : '';
    if (bad) { ok = false; why = `${st.id} ${bad} ${ms}`; }
  }
  check(ok, `tunes: right length, nest keys, small moves, end home ${why}`);

  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  await ctx.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
  const F = () => page.evaluate(() => { const f = window.__cp.fresh.F; return { ms: f.ms, pos: f.pos, misses: f.misses, ready: f.ready, round: f.round }; });
  const note = (m, src = 'tap') => page.evaluate(([m, src]) => window.__cp.noteIn(m, src), [m, src]);

  await page.click('[data-go=learn]'); await page.waitForTimeout(300);
  await page.click('#learn [data-go=freshes]'); await page.waitForTimeout(300);
  check(await page.locator('#freshCards [data-fi]').count() === 5, 'five nests');
  await page.click('#freshCards [data-fi="1"]');
  await page.waitForFunction(() => window.__cp.fresh.F.ready, null, { timeout: 20000 });
  let f = await F();
  await page.screenshot({ path: `${out}/fresh.png` });
  check(await page.locator('#freshStaff .vf-stavenote').count() === f.ms.length, 'the tune is on the staff');
  await note(f.ms[0]);
  const wrong = [60, 62, 64, 65, 67].find((m) => m % 12 !== f.ms[1] % 12 && m % 12 !== f.ms[0] % 12);
  // the mic still hearing the first note ring: only tellable apart when the second note is a different key
  if (f.ms[1] % 12 !== f.ms[0] % 12) await note(f.ms[0], 'mic');
  f = await F();
  check(f.pos === 1 && f.misses === 0, 'right note moves on; the mic hearing it ring is not a miss');
  await note(wrong); await note(wrong);
  check(await page.evaluate(() => !!document.querySelector('#freshKb .target')), 'two wrong keys: the right key glows');
  for (let r = 0; r < 4; r++) {
    await page.waitForFunction(() => window.__cp.fresh.F.ready, null, { timeout: 30000 });
    f = await F();
    for (let i = f.pos; i < f.ms.length; i++) { await note(f.ms[i]); await page.waitForTimeout(60); }
  }
  await page.waitForFunction(() => document.querySelector('#party.show'), null, { timeout: 60000 });
  const eggs = await page.evaluate(() => document.querySelectorAll('#partyEggs span:not([style])').length);
  check(eggs === 2, `two misses: two eggs (${eggs})`);
  check(await page.evaluate(() => window.__cp.progress.games.ft2 === 2), 'eggs saved');
  check(!errs.length, `no page errors ${errs.join(' | ')}`);
  await browser.close();
})();
