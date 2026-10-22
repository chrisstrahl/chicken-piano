// Mic on in free play, then open a song, a lesson, another song and free play again:
// notes must keep registering on every screen.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + __dirname + '/edc.wav', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, permissions: ['microphone'] });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
  await page.evaluate(() => window.__cp.show('free'));
  await page.click('#mic', { force: true });
  const steps = [
    ['free', () => window.__cp.show('free')],
    ['song eggs', () => window.__cp.openSong('eggs', 'level')],
    ['lesson findc', () => window.__cp.openLesson(1, 0)],
    ['song twinkle', () => window.__cp.openSong('twinkle', 'songs')],
    ['free again', () => window.__cp.show('free')],
  ];
  let fails = 0;
  for (const [name, fn] of steps) {
    await page.evaluate(fn);
    const before = await page.evaluate(() => window.__cpHeard());
    await page.waitForTimeout(7000);
    const after = await page.evaluate(() => window.__cpHeard());
    const ok = after > before;
    if (!ok) fails++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: heard ${after - before} notes`);
  }
  console.log(fails ? `${fails} screens deaf` : 'mic works on every screen');
  await browser.close();
})();
