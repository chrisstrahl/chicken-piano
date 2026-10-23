// Practice days: two finished songs/lessons lay today's egg, days in a row make a streak, the coop shows the calendar.
// Run: node test/streaks.cjs [screenshot dir]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const out = process.argv[2] || '.';
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  // eggs laid yesterday and the day before (a 2-day streak), an older egg, a half day, and a year-old day to prune
  await page.evaluate(() => {
    localStorage.clear();
    const key = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const days = { [key(1)]: 3, [key(2)]: 2, [key(4)]: 2, [key(5)]: 1, [key(400)]: 5 };
    localStorage.setItem('chicken-piano-v1', JSON.stringify({ songs: {}, lessons: {}, days }));
  });
  await page.reload();
  await page.locator('#start').dispatchEvent('pointerdown');
  await page.waitForTimeout(900);
  const pill = () => page.evaluate(() => document.querySelector('#coop').textContent.replace(/\s+/g, ' ').trim());
  const r = {};
  r.pillBefore = await pill(); // streak 2 still going (yesterday)
  await page.click('#coop'); await page.waitForTimeout(500);
  r.screen = await page.evaluate(() => document.querySelector('.screen.active').id);
  r.calEggs = await page.evaluate(() => document.querySelectorAll('#nestCal .day.egg').length);
  r.calDays = await page.evaluate(() => document.querySelectorAll('#nestCal .day').length);
  r.streakShown = await page.evaluate(() => document.querySelector('#nestStreak .n').textContent);
  await page.screenshot({ path: out + '/nest-before.png' });

  // finish a song by playing every note
  const playSong = async (id) => {
    await page.evaluate((id) => window.__cp.openSong(id), id);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const P = window.__cp.P;
      for (const ev of P.events.slice()) for (const k of ev.need) { window.__cp.noteIn(k.m, 'tap'); }
    });
    await page.waitForTimeout(700);
  };
  await playSong('clucky');
  r.party1 = await page.evaluate(() => ({ show: document.querySelector('#party').classList.contains('show'), pips: document.querySelectorAll('#partyDay .pips i.on').length, laid: document.querySelector('#partyDay').classList.contains('laid') }));
  await page.click('#partyHome'); await page.waitForTimeout(200);
  await playSong('clucky'); // a replay counts too
  r.party2 = await page.evaluate(() => ({ pips: document.querySelectorAll('#partyDay .pips i.on').length, laid: document.querySelector('#partyDay').classList.contains('laid'), fire: document.querySelector('#partyDay .fire')?.textContent }));
  await page.waitForTimeout(1400);
  await page.screenshot({ path: out + '/nest-party.png' });
  await page.click('#partyHome'); await page.waitForTimeout(300);
  r.pillAfter = await pill();
  await page.click('#coop'); await page.waitForTimeout(500);
  r.streakAfter = await page.evaluate(() => document.querySelector('#nestStreak .n').textContent);
  r.todayEgg = await page.evaluate(() => !!document.querySelector('#nestCal .day.today.egg'));
  r.oldPruned = await page.evaluate(() => Object.keys(window.__cp.progress.days).length);
  await page.screenshot({ path: out + '/nest-after.png' });

  // a phone-sized screen still fits the calendar
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  r.fits = await page.evaluate(() => document.querySelector('#nestCal').getBoundingClientRect().bottom <= innerHeight + 1);
  await page.screenshot({ path: out + '/nest-phone.png' });
  console.log(JSON.stringify(r, null, 1));
  const ok = r.pillBefore.includes('🔥 2') && r.screen === 'nest' && r.calDays === 28 && r.streakShown === '2'
    && r.party1.show && r.party1.pips === 1 && !r.party1.laid
    && r.party2.pips === 2 && r.party2.laid && r.party2.fire === '🔥 3'
    && r.pillAfter.includes('🔥 3') && r.streakAfter === '3' && r.todayEgg && r.oldPruned === 5 && r.fits && !errors.length;
  if (errors.length) console.log('errors', errors);
  console.log(ok ? 'PASS' : 'FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
