const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  for (const [w,h,tag] of [[1024,768,'ipad'],[844,390,'phone']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    await page.goto('file://' + process.cwd() + '/dist/index.html');
    await page.evaluate(() => window.__cp.show('songs')); await page.waitForTimeout(300);
    await page.screenshot({ path: 'test/shots/' + tag + '-songs10.png' });
    for (const id of ['moon','hens','jingle','march','coop','farm','roll']) {
      await page.evaluate(id => window.__cp.openSong(id), id); await page.waitForTimeout(250);
      if (tag === 'ipad' && (id === 'march' || id === 'roll')) await page.screenshot({ path: 'test/shots/ipad-' + id + '.png' });
    }
    console.log(tag, errs.length ? errs : 'no errors');
  }
  await browser.close();
})();
