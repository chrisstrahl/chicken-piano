// Plays through every lesson and every song by feeding the right answers, and screenshots each new screen type.
// Usage: node test/levels.cjs [shotsDir]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const out = process.argv[2] || 'shots';
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h, tag] of [[1024, 768, 'ipad'], [844, 390, 'phone']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    await ctx.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
    await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
    await page.goto('file://' + process.cwd() + '/dist/index.html');
    await page.waitForTimeout(300);
    const shot = (n) => page.screenshot({ path: `${out}/${tag}-${n}.png` });
    await page.screenshot({ path: `${out}/${tag}-start.png` });
    await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
    await shot('home');
    await page.click('[data-go=learn]'); await page.waitForTimeout(200); await shot('learn'); await page.click('#learn [data-go=map]'); await page.waitForTimeout(200); await shot('map');
    await page.click('[data-level="1"]', { force: true }); await page.waitForTimeout(200); await shot('level1');
    if (tag === 'phone') { await page.evaluate(() => window.__cp.openSong('bday', 'level')); await page.waitForTimeout(400); await shot('song-bday'); await page.evaluate(() => window.__cp.openLesson(1, 0)); await page.waitForTimeout(500); await shot('lesson-findc'); await ctx.close(); continue; }

    // play every lesson in order without unlock-all: this also checks the unlock chain
    const seen = new Set();
    for (let n = 1; n <= 10; n++) {
      for (let li = 0; li < 4; li++) {
        await page.evaluate(([n, li]) => window.__cp.openLesson(n, li), [n, li]);
        await page.waitForTimeout(400);
        for (let guard = 0; guard < 400; guard++) {
          const st = await page.evaluate(() => {
            const { L } = window.__cp;
            if (document.querySelector('#party.show')) return { party: true };
            const s = L.lv.lessons[L.li].steps[L.step];
            return { type: s.type, step: L.step, sub: L.sub, done: L.done, locked: L.locked, id: L.lv.lessons[L.li].id };
          });
          if (st.party) break;
          const key = st.id + st.type;
          if (!seen.has(st.type + (st.type === 'choice' ? '' : '')) && st.sub === 0) { seen.add(st.type); await shot('step-' + st.type + '-' + st.id); }
          if (st.locked) { await page.waitForTimeout(300); continue; }
          const ok = await page.evaluate(() => {
            const { L, noteIn } = window.__cp;
            const s = L.lv.lessons[L.li].steps[L.step];
            const pc = (m) => ((m % 12) + 12) % 12;
            const btn = (ans) => { const b = [...document.querySelectorAll('#lessonChoices [data-ans]')].find((x) => x.dataset.ans === ans); if (!b) return false; b.click(); return true; };
            const mid = (tok) => window.__cpParse(tok);
            if (s.type === 'show') {
              if (L.done) { document.querySelector('#btnNext').click(); return true; }
              const g = window.__cpMs(s.goal);
              const missing = g.find((m) => !L.got.has(pc(m)));
              noteIn(missing ?? g[0], 'tap'); return true;
            }
            if (s.type === 'key') { noteIn(window.__cpMs(s.targets)[L.sub], 'tap'); return true; }
            if (s.type === 'seq') { noteIn(window.__cpMs(s.seqs[L.sub])[L.seqPos], 'tap'); return true; }
            if (s.type === 'name') { noteIn(window.__cpMs(s.notes)[L.sub], 'tap'); return true; }
            if (s.type === 'beats') { const b = { 8: '½', q: '1', h: '2', hd: '3', w: '4' }[s.durs[L.sub]]; return btn(b); }
            if (s.type === 'choice') return btn(s.rounds[L.sub].answer);
            if (s.type === 'rhythm') {
              if (L.done) { document.querySelector('#btnNext').click(); return true; }
              // once the chicken has counted in, play every note right on its beat
              if (L.judge && window.__fed !== L.judge) {
                const j = (window.__fed = L.judge);
                j.items.forEach((it) => setTimeout(() => noteIn(j.notes[it.i].keys[0].m, 'tap'), Math.max(0, it.t - performance.now() + 15)));
              }
              return true;
            }
          });
          if (!ok) errs.push(`no answer button in ${st.id} step ${st.step} sub ${st.sub}`);
          await page.waitForTimeout(st.type === 'show' ? 60 : st.type === 'rhythm' ? 250 : 1250);
        }
        const party = await page.evaluate(() => !!document.querySelector('#party.show'));
        if (!party) errs.push(`lesson ${n}.${li} did not finish`);
        if (n === 1 && li === 0) await shot('party');
        await page.evaluate(() => document.querySelector('#party').classList.remove('show'));
      }
    }
    const open = await page.evaluate(() => window.__cp.SONGS.filter((s) => !document.querySelector('x')).length);
    // every song: play it through with the right notes; test tapping a note to jump back
    await page.click('[data-go=songs]', { force: true }).catch(() => {});
    await page.evaluate(() => window.__cp.show('songs')); await page.waitForTimeout(200); await shot('songs');
    const ids = await page.evaluate(() => window.__cp.SONGS.map((s) => s.id));
    for (const id of ids) {
      await page.evaluate((id) => { window.__cp.progress.hands = ['rh', 'lh', 'both'][id.length % 3]; window.__cp.openSong(id, 'level'); }, id);
      await page.waitForTimeout(120);
      if (['bday', 'speedy', 'lheggs', 'minuet', 'silent', 'races'].includes(id)) { await page.waitForTimeout(400); await shot('song-' + id); }
      const r = await page.evaluate(() => {
        const { P, noteIn, jumpToBeat } = window.__cp;
        let steps = 0;
        // play 5 steps, jump back to step 1, then finish the song (every key of each step, like taps)
        for (let k = 0; k < 2000 && P.e < P.events.length; k++) {
          if (steps === 5) { jumpToBeat(P.events[1].beat); if (P.e !== 1) return 'jump failed: at ' + P.e; }
          const ev = P.events[P.e];
          ev.need.forEach((x) => noteIn(x.m, 'tap'));
          steps++;
        }
        return document.querySelector('#party.show') ? 'ok' : 'stuck at ' + P.e + '/' + P.events.length;
      });
      if (r !== 'ok') errs.push(`song ${id}: ${r}`);
      await page.evaluate(() => document.querySelector('#party').classList.remove('show'));
    }
    await page.evaluate(() => window.__cp.show('map')); await page.waitForTimeout(200); await shot('map-done');
    await page.evaluate(() => window.__cp.show('free'));
    for (const m of [60, 64, 67, 72, 62]) { await page.locator(`#freeKb [data-m="${m}"]`).dispatchEvent('pointerdown'); await page.waitForTimeout(80); }
    await page.waitForTimeout(300); await shot('free');
    console.log(tag, errs.length ? errs.join('\n') : 'no errors');
    await ctx.close();
  }
  await browser.close();
})();
