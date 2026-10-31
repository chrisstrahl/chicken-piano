// Write a Song: keys add notes in the chosen length, rests and take-back work, saving puts the song in Play
// Songs (✏️ row), it plays in the song player without coop eggs, ✏️ on its card edits it, 🗑️ throws it away,
// and each kid has their own songs.
// usage: node test/write.cjs [shotsDir]
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
  const note = (m, src = 'tap') => page.evaluate(([m, src]) => window.__cp.noteIn(m, src), [m, src]);
  const tokens = () => page.evaluate(() => window.__cp.write.W.tokens.join(' '));

  await page.click('[data-go=learn]'); await page.waitForTimeout(300);
  await page.click('#learn [data-write]'); await page.waitForTimeout(400);
  check(await page.evaluate(() => document.querySelector('#write').classList.contains('active')), 'Write a Song opens from Learn');
  await note(60); await note(64, 'mic');
  await page.click('#write [data-len=h]'); await note(67);
  await page.click('#writeRest');
  await page.click('#write [data-len=w]'); await note(72); await note(71);
  await page.click('#writeUndo');
  check(await tokens() === 'C4:q E4:q G4:h R:h C5:w', `notes, lengths, rest, take back: ${await tokens()}`);
  check(await page.locator('#writeStaff .vf-stavenote').count() >= 5, 'written on the staff');
  await page.screenshot({ path: `${out}/write.png` });
  await page.click('#writeSave'); await page.waitForTimeout(300);
  const id = await page.evaluate(() => window.__cp.write.W.id);
  check(!!id, 'saved');

  await page.evaluate(() => window.__cp.show('songs')); await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/write-songs.png` });
  check(await page.locator(`#songCards [data-song="${id}"]`).count() === 1, 'shows up in Play Songs');
  await page.click(`#songCards [data-song="${id}"] .t`); await page.waitForTimeout(500);
  check(await page.evaluate((id) => window.__cp.P.song.id === id && window.__cp.P.events.length === 4, id), 'plays in the song player');
  for (const m of [60, 64, 67, 72]) { await note(m); await page.waitForTimeout(80); }
  await page.waitForFunction(() => document.querySelector('#party.show'), null, { timeout: 10000 });
  check(await page.evaluate((id) => !(id in window.__cp.progress.songs), id), 'no coop eggs for your own song');
  await page.click('#partyNext'); await page.waitForTimeout(400);
  check(await page.evaluate(() => document.querySelector('#songs').classList.contains('active')), 'next goes back to Play Songs');

  await page.click(`#songCards [data-editsong="${id}"]`); await page.waitForTimeout(400);
  check(await page.evaluate((id) => window.__cp.write.W.id === id && document.querySelector('#write').classList.contains('active'), id), '✏️ on the card opens it to edit');
  await note(62); await page.click('#writeSave'); await page.waitForTimeout(200);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chicken-piano-mysongs-v1')));
  const mine = Object.values(saved)[0];
  check(mine.length === 1 && mine[0].notes.endsWith('C5:w D4:q'), 'edit saves over the same song');

  // another kid doesn't see it
  await page.evaluate(() => { const k = window.__cp.players.add('sunny', 'Robin'); window.__cp.usePlayer(k.id); window.__cp.show('songs'); }); await page.waitForTimeout(300);
  check(await page.locator(`#songCards [data-song="${id}"]`).count() === 0, 'other kids have their own songs');
  await page.evaluate(() => { window.__cp.usePlayer(window.__cp.players.list()[0].id); }); await page.waitForTimeout(100);

  await page.evaluate((id) => { window.__cp.write.open(id); }, id); await page.waitForTimeout(300);
  await page.click('#writeDel'); await page.waitForTimeout(200); await page.click('#askYes'); await page.waitForTimeout(300);
  check(await page.locator(`#songCards [data-song="${id}"]`).count() === 0, '🗑️ throws it away');
  check(!errs.length, `no page errors ${errs.join(' | ')}`);
  await browser.close();
})();
