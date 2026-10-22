// Tapping a locked song asks to open the level's songs; yes opens them and starts the song.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
  await page.evaluate(() => window.__cp.show('map'));
  await page.click('[data-level="5"]', { force: true }); await page.waitForTimeout(300);
  await page.click('#levelSongs [data-song="yankee"]'); await page.waitForTimeout(400);
  await page.screenshot({ path: (process.argv[2] || '.') + '/unlock-ask.png' });
  const asked = await page.evaluate(() => document.querySelector('#ask').classList.contains('show'));
  await page.click('#askYes'); await page.waitForTimeout(400);
  const playing = await page.evaluate(() => document.querySelector('#play').classList.contains('active') && window.__cp.P.song.id);
  await page.evaluate(() => window.__cp.show('level')); await page.waitForTimeout(200);
  const locked = await page.evaluate(() => document.querySelectorAll('#levelSongs .locked').length);
  const ok = asked && playing === 'yankee' && locked === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} asked=${asked} playing=${playing} lockedLeft=${locked}`);
  await browser.close();
})();
