// Turn the ears on, off and on again, and check notes are still heard.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=' + __dirname + '/edc.wav'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, permissions: ['microphone'] });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
  await page.evaluate(() => window.__cp.show('free'));
  const heard = () => page.evaluate(() => document.querySelector('#mic .heard').textContent + '|' + document.querySelectorAll('#freeStaff .vf-stavenote').length);
  await page.click('#mic', { force: true }); await page.waitForTimeout(6000);
  const a = await heard();
  await page.click('#mic', { force: true }); await page.waitForTimeout(500);
  await page.evaluate(() => window.__cp.show('free'));
  await page.click('#mic', { force: true }); await page.waitForTimeout(6000);
  const b = await heard();
  console.log('first on:', a, ' after off/on:', b, ' mic class:', await page.evaluate(() => document.querySelector('#mic').className));
  await browser.close();
})();
