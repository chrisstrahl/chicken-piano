// Players: old progress moves into player 1; a second kid gets their own eggs; the picker shows at launch.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const url = 'file://' + process.cwd() + '/dist/index.html';
  await page.goto(url);
  // a device that played before players existed: 2 lessons and a 3-egg song
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('chicken-piano-v1', JSON.stringify({ songs: { clucky: 3 }, lessons: { l1a: true, l1b: true }, letters: false })); });
  await page.reload();
  const hatch = () => page.locator('#start').dispatchEvent('pointerdown').then(() => page.waitForTimeout(900));
  await hatch();
  const coop = () => page.evaluate(() => document.querySelector('#coop .cnt').textContent.trim());
  const r = {};
  r.migrated = await coop(); // 🥚 5
  r.firstScreen1 = await page.evaluate(() => document.querySelector('.screen.active').id);
  r.letters = await page.evaluate(() => window.__cp.progress.letters);

  // add a second kid: avatar Sunny, no name typed
  await page.click('#btnWho'); await page.waitForTimeout(300);
  await page.click('#players [data-edit="new"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: (process.argv[2] || '.') + '/players-new.png' });
  await page.click('#edAvatars [data-av="sunny"]');
  await page.click('#edYes'); await page.waitForTimeout(400);
  r.secondName = await page.evaluate(() => window.__cp.players.current().name);
  r.secondEggs = await coop();
  r.secondColor = await page.evaluate(() => document.documentElement.style.getPropertyValue('--ck-body'));
  // the second kid wins a song
  await page.evaluate(() => { window.__cp.progress.songs.clucky = 2; });
  await page.evaluate(() => window.__cp.openSong('clucky'));
  await page.evaluate(() => window.__cp.show('home'));
  // typing a name doesn't play notes
  await page.click('#btnWho'); await page.waitForTimeout(300);
  const second = await page.evaluate(() => window.__cp.players.current().id);
  await page.click(`#players [data-edit="${second}"]`); await page.waitForTimeout(300);
  await page.fill('#edName', 'Max');
  await page.focus('#edName'); await page.keyboard.down('a');
  r.notesWhileTyping = await page.evaluate(() => document.querySelectorAll('.wkey.down').length);
  await page.keyboard.up('a');
  await page.fill('#edName', 'Max');
  await page.click('#edYes'); await page.waitForTimeout(300);
  await page.screenshot({ path: (process.argv[2] || '.') + '/players-who.png' });
  r.tiles = await page.evaluate(() => [...document.querySelectorAll('#players .pick .nm')].map((e) => e.textContent).join(','));

  // a new launch asks who is playing; picking player 1 shows their eggs again
  await page.reload();
  await hatch();
  r.firstScreen2 = await page.evaluate(() => document.querySelector('.screen.active').id);
  await page.click('#players [data-player="p1"]'); await page.waitForTimeout(400);
  r.backToFirst = await coop();
  await page.screenshot({ path: (process.argv[2] || '.') + '/players-home.png' });

  // removing the second kid deletes their progress and leaves player 1
  await page.click('#btnWho'); await page.waitForTimeout(300);
  await page.click(`#players [data-edit="${second}"]`); await page.waitForTimeout(300);
  await page.click('#edDel'); await page.waitForTimeout(300);
  await page.click('#askYes'); await page.waitForTimeout(300);
  r.left = await page.evaluate(() => window.__cp.players.list().map((p) => p.id).join(','));
  r.storedGone = await page.evaluate((id) => localStorage.getItem('chicken-piano-v1:' + id) === null, second);

  const ok = r.migrated === '🥚 5' && r.firstScreen1 === 'home' && r.letters === false && r.secondName === 'Sunny' && r.secondEggs === '🥚 0'
    && r.secondColor === '#ffe45c' && r.notesWhileTyping === 0 && r.tiles === 'Clucky,Max' && r.firstScreen2 === 'who'
    && r.backToFirst === '🥚 5' && r.left === 'p1' && r.storedGone && !errors.length;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(r)}${errors.length ? ' errors: ' + errors.join(' | ') : ''}`);
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
