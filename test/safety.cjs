// Page safety and the two "no extra layout" changes, in a real browser:
// 1. Text from outside (names, song and recording titles already saved on the device, and a doctored backup
//    file loaded on the grown-ups' page) must show up as text, never as markup that runs.
// 2. The staff keeps fitting its card when the card changes size (the tablet turns, the note lane closes).
// 3. The chicken and the speech bubble still start their little animations over on every note.
// usage: node test/safety.cjs   (after node build.mjs)
const { chromium } = require('playwright');
(async () => {
  let fails = 0;
  const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const EVIL = '<img src=x onerror="window.__pwned=(window.__pwned||0)+1">';
  // what a tampered device (or an old build's unchecked backup) could have left in storage
  await ctx.addInitScript((EVIL) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('chicken-piano-schema', '2');
    localStorage.setItem('chicken-piano-players', JSON.stringify({ current: 'p1', list: [{ id: 'p1', avatar: 'sunny', name: EVIL }, { id: 'p2', avatar: `x" onmouseover="window.__pwned=1`, name: 'Ivy' }] }));
    localStorage.setItem('chicken-piano-v1:p1', JSON.stringify({ songs: {}, lessons: {}, days: {}, missed: { [EVIL]: 3 } }));
    localStorage.setItem('chicken-piano-recordings-v1', JSON.stringify({ p1: [{ id: 'r1', at: Date.now(), title: EVIL, emoji: EVIL, song: null, notes: [[0, 60, 300, 0.8], [400, 62, 300, 0.8]] }] }));
    localStorage.setItem('chicken-piano-mysongs-v1', JSON.stringify({ p1: [{ id: 'u1', at: 1, emoji: EVIL, title: EVIL, notes: 'C4:q E4:q G4:h' }] }));
  }, EVIL);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.locator('#start').dispatchEvent('pointerdown');
  await page.waitForTimeout(1000);
  const injected = () => page.evaluate(() => ({ pwned: window.__pwned || 0, imgs: document.querySelectorAll('img[src="x"]').length, handlers: document.querySelectorAll('[onerror],[onmouseover],[onload]').length }));
  const clean = (r) => r.pwned === 0 && r.imgs === 0 && r.handlers === 0;

  for (const screen of ['who', 'home', 'songs', 'recs', 'nest', 'parent']) {
    await page.evaluate((s) => window.__cp.show(s), screen);
    await page.waitForTimeout(250);
    const r = await injected();
    check(clean(r), `${screen}: saved names and titles show as text (${JSON.stringify(r)})`);
  }
  await page.evaluate(() => window.__cp.show('who'));
  check(await page.evaluate((EVIL) => document.querySelector('#players .nm').textContent === EVIL, EVIL), 'the odd name is shown letter for letter');
  await page.evaluate(() => window.__cp.recs.openRec('r1')); await page.waitForTimeout(300);
  await page.evaluate(() => window.__cp.openSong('u1')); await page.waitForTimeout(300);
  await page.evaluate(() => window.__cp.write.open('u1')); await page.waitForTimeout(300);
  check(clean(await injected()), 'opening the odd recording and the odd written song adds no markup');

  // a doctored backup through the grown-ups' page
  const backup = JSON.stringify({ app: 'chicken-piano', schema: 2, at: EVIL, data: {
    'chicken-piano-players': JSON.stringify({ current: 'p7', list: [{ id: 'p7', avatar: 'rosie', name: EVIL }, { id: EVIL, avatar: 'rosie', name: 'x' }] }),
    'chicken-piano-v1:p7': JSON.stringify({ songs: { [EVIL]: 3 }, missed: { [EVIL]: 9 } }),
    'chicken-piano-recordings-v1': JSON.stringify({ p7: [{ id: 'r9', at: 5, title: EVIL, emoji: EVIL, song: EVIL, notes: [[0, 60, 300, 0.8]] }] }),
    'chicken-piano-mysongs-v1': JSON.stringify({ p7: [{ id: 'u9', at: 5, title: EVIL, emoji: EVIL, notes: 'C4:q D4:q' }] }),
  } });
  await page.evaluate(() => window.__cp.show('parent'));
  const res = await page.evaluate((b) => window.__cp.parent.loadBackup(b), backup);
  await page.waitForTimeout(300);
  check(res && res.added.length === 1, 'the doctored backup loads (its one usable player is added)');
  const stored = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('chicken-piano-players')).list.find((x) => x.id === 'p7'); return { name: p && p.name, rec: JSON.parse(localStorage.getItem('chicken-piano-recordings-v1')).p7, n: JSON.parse(localStorage.getItem('chicken-piano-players')).list.length }; });
  check(stored.n === 3 && !/[<>"]/.test(stored.name) && stored.rec.length === 1 && !/[<>"]/.test(stored.rec[0].title + stored.rec[0].emoji) && stored.rec[0].song === null, 'what it saved is plain text');
  for (const screen of ['parent', 'who', 'recs', 'songs']) {
    await page.evaluate((s) => window.__cp.show(s), screen);
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => { window.__cp.usePlayer('p7'); window.__cp.show('recs'); }); await page.waitForTimeout(200);
  await page.evaluate(() => window.__cp.show('songs')); await page.waitForTimeout(200);
  await page.evaluate(() => window.__cp.show('parent')); await page.waitForTimeout(200);
  check(clean(await injected()), 'after loading it, no screen runs or shows its markup');

  // 2. the staff follows its card
  const fit = () => page.evaluate(() => { const c = document.querySelector('#playStaff'), s = c.querySelector('svg'); return { card: c.clientHeight, svg: Math.round(parseFloat(s.style.height)), w: parseFloat(s.style.width) }; });
  await page.evaluate(() => { window.__cp.usePlayer('p1'); window.__cp.openSong(window.__cp.SONGS[0].id); });
  await page.waitForTimeout(400);
  let f = await fit();
  check(f.card > 50 && Math.abs(f.card - f.svg) <= 1 && f.w > 0, `song opens with the staff filling its card (${f.card} / ${f.svg})`);
  await page.setViewportSize({ width: 768, height: 1024 }); await page.waitForTimeout(400);
  const f2 = await fit();
  check(Math.abs(f2.card - f2.svg) <= 1, `turning the tablet: the staff fits again (${f2.card} / ${f2.svg})`);
  await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(400);
  await page.evaluate(() => window.__cp.startBeatMode());
  await page.waitForSelector('#playLane.on', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(500);
  const lane = await page.evaluate(() => document.querySelector('#playLane').classList.contains('on'));
  const f3 = await fit();
  check(lane && Math.abs(f3.card - f3.svg) <= 1, `note lane open: the staff fits its smaller card (${f3.card} / ${f3.svg})`);
  await page.click('#btnBeat'); await page.waitForTimeout(500);
  const f4 = await fit();
  check(Math.abs(f4.card - f4.svg) <= 1 && f4.card !== f3.card, `note lane closed: the staff grows back (${f4.card} / ${f4.svg})`);
  await page.evaluate(() => window.__cp.show('home')); await page.waitForTimeout(200);
  await page.evaluate(() => window.__cp.openSong(window.__cp.SONGS[3].id)); await page.waitForTimeout(400);
  const f5 = await fit();
  check(Math.abs(f5.card - f5.svg) <= 1 && f5.w > 0, `coming back to a song from another screen: the staff fits (${f5.card} / ${f5.svg})`);

  // 3. animations start over on every note
  const anim = () => page.evaluate(() => ({ chicken: getComputedStyle(document.querySelector('#playChicken .ck-all')).animationName, bubble: getComputedStyle(document.querySelector('#playBubble')).animationName }));
  const play = () => page.evaluate(() => { const { P, noteIn } = window.__cp; P.events[P.e].need.forEach((k) => noteIn(k.m, 'midi')); });
  await play(); await page.waitForTimeout(40);
  const a1 = await anim();
  await play(); await page.waitForTimeout(40);
  const a2 = await anim();
  check(/^peck/.test(a1.chicken) && /^peck/.test(a2.chicken) && a1.chicken !== a2.chicken, `the chicken pecks afresh on each note (${a1.chicken} then ${a2.chicken})`);
  check(/^bpop/.test(a1.bubble) && /^bpop/.test(a2.bubble) && a1.bubble !== a2.bubble, `the bubble pops afresh on each note (${a1.bubble} then ${a2.bubble})`);
  await page.waitForTimeout(600);
  check((await anim()).chicken === 'none' || !/^peck/.test((await anim()).chicken), 'and the peck ends');

  check(errs.length === 0, `no page errors or pop-ups ${errs.join(' | ')}`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
