// Browser test for the ear quizzes (Learn → Ears): Mystery Melodies and Happy or Sad open from Learn, the
// chicken plays, a right pick moves on, a wrong pick replays and the second lights the answer, five rounds
// give eggs that reach the coop. Also checks the puzzle makers in Node.
// usage: node test/quizzes.cjs [shotsDir]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const out = process.argv[2] || 'shots';
  require('fs').mkdirSync(out, { recursive: true });
  const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };

  const { SONGS } = await import('../src/music.ts');
  const Q = await import('../src/quiz.ts');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const known = Q.knownSongs(SONGS);
  check(known.length > 40 && known.every((s) => !s.sub.startsWith('New song')), `known songs only (${known.length})`);
  let okCards = true, okRepeat = true, last = null;
  for (const st of Q.MYSTERY_STAGES) for (let i = 0; i < 40; i++) {
    const p = Q.mysteryPuzzle(st, SONGS, last, rnd);
    const emojis = new Set(p.cards.map((c) => c.emoji));
    if (p.cards.length !== st.choices || emojis.size !== st.choices || !p.cards.includes(p.answer) || p.answer.level < st.levels[0] || p.answer.level > st.levels[1]) okCards = false;
    if (p.answer.id === last) okRepeat = false;
    last = p.answer.id;
    if (Q.opening(Q.melodyOf(p.answer), 6).filter((n) => !n.r && !n.tie).length !== 6) okCards = false;
  }
  check(okCards, 'mystery cards: right count, different pictures, answer among them, six notes to play');
  check(okRepeat, 'mystery: never the same song twice in a row');
  const moods = { happy: 0, sad: 0 };
  let thirds = true;
  for (const st of Q.MOOD_STAGES) for (let i = 0; i < 60; i++) {
    const p = Q.moodPuzzle(st, null, rnd);
    moods[p.mood]++;
    const chord = p.steps[p.steps.length - 1][0];
    if (chord[1] - chord[0] !== (p.mood === 'happy' ? 4 : 3) || chord[2] - chord[0] !== 7) thirds = false;
  }
  check(thirds, 'happy = major third, sad = minor third');
  check(moods.happy > 50 && moods.sad > 50, `both moods come up ${JSON.stringify(moods)}`);

  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  await ctx.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
  const pick = (right) => page.evaluate((right) => {
    const q = window.__cp.quizzes;
    const ans = q.kind === 'mystery' ? q.Q.song.id : q.Q.mood;
    const b = [...document.querySelectorAll('#quizChoices [data-ans]')].find((x) => (x.dataset.ans === ans) === right);
    b.click();
  }, right);
  const ready = () => page.waitForFunction(() => window.__cp.quizzes.Q.ready, null, { timeout: 20000 });

  for (const kind of ['mystery', 'mood']) {
    await page.evaluate(() => window.__cp.show('learn')); await page.waitForTimeout(200);
    await page.click(`#learn [data-quiz=${kind}]`); await page.waitForTimeout(300);
    const nests = await page.locator('#quizCards [data-qi]').count();
    check(nests === (kind === 'mystery' ? 4 : 3), `${kind}: nests ${nests}`);
    await page.click('#quizCards [data-qi="0"]');
    await ready();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/quiz-${kind}.png` });
    // one wrong pick, then a second: the answer lights up
    await pick(false); await page.waitForTimeout(100);
    await ready(); await pick(false); await page.waitForTimeout(100);
    check(await page.evaluate(() => !!document.querySelector('#quizChoices .hint')), `${kind}: second wrong pick lights the answer`);
    for (let r = 0; r < 5; r++) { await ready(); await pick(true); await page.waitForTimeout(200); }
    await page.waitForFunction(() => document.querySelector('#party.show'), null, { timeout: 30000 });
    const eggs = await page.evaluate(() => document.querySelectorAll('#partyEggs span:not([style])').length);
    check(eggs === 2, `${kind}: two misses, two eggs (${eggs})`);
    await page.evaluate(() => document.querySelector('#party').classList.remove('show'));
  }
  const saved = await page.evaluate(() => window.__cp.progress.games);
  check(saved.mm1 === 2 && saved.hs1 === 2, `eggs saved ${JSON.stringify(saved)}`);
  check(!errs.length, `no page errors ${errs.join(' | ')}`);
  await browser.close();
})();
