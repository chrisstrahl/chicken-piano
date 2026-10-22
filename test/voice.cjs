// Checks the chicken talks with the recorded clips (not device speech), over a local web server:
//   (cd dist && python3 -m http.server 8765 &) ; node test/voice.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const logs = [];
  const clips = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && logs.push(m.text()));
  page.on('response', (r) => r.url().includes('/voice/') && clips.push(r.status() + ' ' + r.url().split('/').pop()));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.addInitScript(() => {
    window.__tts = [];
    window.__ended = [];
    if (window.speechSynthesis) speechSynthesis.speak = (u) => window.__tts.push(u.text);
  });
  await page.goto('http://localhost:8765/index.html');
  await page.locator('#start').dispatchEvent('pointerdown');
  await page.waitForTimeout(1500);
  await page.click('#coop', { force: true });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__cp.openSong('eggs'));
  await page.waitForTimeout(800);
  // onEnd fires after a clip, and after the device-speech fallback for a line with no clip
  const timed = (text) => page.evaluate((t) => new Promise((res) => {
    const t0 = performance.now();
    window.__cp.say(t, () => res(Math.round(performance.now() - t0)));
    if (window.__tts.includes(t)) setTimeout(() => speechSynthesis.cancel(), 50);
  }), text);
  console.log('clip "Perfect! Three eggs!" ended after ms:', await timed('Perfect! Three eggs!'));
  console.log('no-clip line ended after ms:', await timed('This sentence has no recording.'));
  console.log('clips fetched:', clips.join(', '));
  console.log('device speech used for:', JSON.stringify(await page.evaluate(() => window.__tts)));
  console.log(logs.join('\n') || 'no errors');
  await browser.close();
})();
