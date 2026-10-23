// Browser test for play-with-the-beat (🥁), echo (🦜) and the speed button, using on-screen key taps.
// usage: node test/practice.cjs [shotsDir]
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
  const partyEggs = () => page.evaluate(() => document.querySelector('#party.show') ? document.querySelectorAll('#partyEggs span:not([style])').length : null);
  const closeParty = () => page.evaluate(() => document.querySelector('#party').classList.remove('show'));
  const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };

  // speed: bunny → turtle → snail → bunny
  await page.evaluate(() => window.__cp.openSong('eggs', 'level')); await page.waitForTimeout(300);
  const icons = [];
  for (let k = 0; k < 3; k++) { await page.click('#btnSpeed'); icons.push(await page.textContent('#btnSpeed')); }
  check(icons.join('') === '🐢🐌🐇', `speed button cycles ${icons.join(' ')}`);

  // play with the beat: tap every note on its moment (a little off, like a person), at bunny and snail speed
  for (const [spd, jitter, skip, want] of [[1, 60, [], 3], [1, 60, [2, 5, 9, 12], 2], [0.5, 120, [], 3], [1, 330, [], 2]]) {
    await page.evaluate((spd) => { window.__cp.progress.speed = spd; window.__cp.openSong('eggs', 'level'); window.__cp.startBeatMode(); }, spd);
    await page.waitForFunction(() => window.__cp.P.judge, null, { timeout: 5000 });
    if (spd === 1 && !skip.length) { await page.waitForTimeout(500); await page.screenshot({ path: `${out}/beat-countin.png` }); }
    const plan = await page.evaluate(([jitter, skip]) => {
      const { P, noteIn } = window.__cp;
      const j = P.judge;
      j.items.forEach((it, k) => {
        if (skip.includes(k)) return;
        const off = (k % 2 ? 1 : -1) * jitter;
        setTimeout(() => noteIn(P.song.notes[it.i].m, 'tap'), Math.max(0, it.t + off - performance.now()));
      });
      return { n: j.items.length, last: j.items[j.items.length - 1].t - performance.now() };
    }, [jitter, skip]);
    if (spd === 1 && !skip.length) { await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/beat-playing.png` }); }
    await page.waitForFunction(() => document.querySelector('#party.show'), null, { timeout: plan.last + 6000 });
    const eggs = await partyEggs();
    check(eggs === want, `beat mode speed ${spd}, ${jitter} ms off, ${skip.length} skipped: ${eggs} eggs`);
    await closeParty();
  }
  // a wrong key doesn't count; no taps at all → every note missed, still finishes with 1 egg
  await page.evaluate(() => { window.__cp.progress.speed = 1; window.__cp.openSong('peck', 'level'); window.__cp.startBeatMode(); });
  await page.waitForFunction(() => window.__cp.P.judge, null, { timeout: 5000 });
  const last = await page.evaluate(() => { const j = window.__cp.P.judge; return j.items[j.items.length - 1].t - performance.now(); });
  await page.waitForFunction(() => document.querySelector('#party.show'), null, { timeout: last + 6000 });
  check(await partyEggs() === 1, 'beat mode with no playing ends with 1 egg');
  await closeParty();

  // echo: wait for the chicken's turn, play the phrase back; one phrase gets three wrong notes (replays it)
  for (const id of ['eggs', 'twinkle', 'henny']) {
    await page.evaluate((id) => { window.__cp.progress.speed = 1; window.__cp.openSong(id, 'level'); window.__cp.startEcho(); }, id);
    let phrasesDone = 0, replays = 0;
    for (let guard = 0; guard < 400; guard++) {
      const st = await page.evaluate(() => { const { P } = window.__cp; return { turn: P.turn, ph: P.ph, n: P.phrases.length, i: P.i, party: !!document.querySelector('#party.show') }; });
      if (st.party) break;
      if (!st.turn) { await page.waitForTimeout(150); continue; }
      if (id === 'eggs' && st.ph === 1 && replays === 0) {
        replays++;
        await page.evaluate(() => { const { noteIn, P } = window.__cp; for (let k = 0; k < 3; k++) noteIn(P.song.notes[P.i].m + 1, 'tap'); });
        if (phrasesDone === 1) await page.screenshot({ path: `${out}/echo-oops.png` });
        continue;
      }
      if (st.ph === 0 && id === 'eggs') await page.screenshot({ path: `${out}/echo-turn.png` });
      await page.evaluate(() => { const { noteIn, P } = window.__cp; const [, b] = P.phrases[P.ph]; while (P.turn && P.i < b) noteIn(P.song.notes[P.i].m, 'tap'); });
      phrasesDone++;
    }
    const eggs = await partyEggs();
    const want = id === 'eggs' ? 2 : 3;
    check(eggs === want, `echo ${id}: ${phrasesDone} phrases played back, ${eggs} eggs (want ${want})`);
    await closeParty();
  }

  // free play metronome turns on and off
  await page.evaluate(() => window.__cp.show('free'));
  await page.click('#btnFreeBeat'); await page.waitForTimeout(1500);
  const on = await page.evaluate(() => document.querySelector('#btnFreeBeat').classList.contains('on'));
  await page.evaluate(() => window.__cp.show('home'));
  const off = await page.evaluate(() => !document.querySelector('#btnFreeBeat').classList.contains('on'));
  check(on && off, 'free play metronome on, and off when leaving');
  check(!errs.length, 'no page errors ' + errs.join(' '));
  await browser.close();
})();
