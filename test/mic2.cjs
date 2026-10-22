const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=' + __dirname + '/cccc.wav'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  page.on('console', m => { if (m.type()==='warning'||m.type()==='error') console.log(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.evaluate(() => { window.__micDebug = []; window.__heard = []; });
  await page.evaluate(() => window.__cp.openSong('eggs'));
  await page.click('#mic', { force: true });
  await page.waitForTimeout(10000);
  const r = await page.evaluate(() => ({ i: window.__cp.P.i, mist: window.__cp.P.mistakes, n: window.__micDebug.length, sample: window.__micDebug.filter(x => typeof x === "string") }));
  console.log(JSON.stringify(r));
  await browser.close();
})();
