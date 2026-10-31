// Beat timing: the tap-along check measures this device's delay and every game played in time takes it off;
// key presses are timed from their own event stamps; the sustain pedal keeps USB-keyboard notes held.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const FAKE = () => {
  const input = { name: 'CASIO USB-MIDI', state: 'connected', onmidimessage: null };
  const access = { inputs: new Map([['in1', input]]), outputs: new Map(), onstatechange: null };
  navigator.requestMIDIAccess = (async () => access).bind(null);
  const q = navigator.permissions.query.bind(navigator.permissions);
  navigator.permissions.query = async (d) => (d.name === 'midi' ? { state: 'granted' } : q(d));
  const send = (...d) => input.onmidimessage && input.onmidimessage({ data: new Uint8Array(d), timeStamp: performance.now() });
  window.__fake = { on: (m) => send(0x90, m, 100), off: (m) => send(0x80, m, 64), pedal: (down) => send(0xb0, 64, down ? 127 : 0) };
};

let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  let errors = 0;
  page.on('pageerror', (e) => { errors++; console.log('PAGEERROR', e.message); });
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.addInitScript(FAKE);
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
  await page.evaluate(() => window.__cp.show('free'));
  await page.waitForTimeout(300);

  // 1. tap-along check: tap 250 ms after every peck
  await page.locator('#btnFreeBeat').dispatchEvent('pointerdown');
  await page.waitForTimeout(2200);
  await page.locator('#btnFreeBeat').dispatchEvent('pointerup');
  check(await page.locator('.calib').count() === 1, 'holding 🥁 opens the tap-along check');
  await page.evaluate(() => {
    const ov = document.querySelector('.calib'), dots = ov.querySelector('.dots');
    new MutationObserver(() => setTimeout(() => ov.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), 250)).observe(dots, { childList: true, characterData: true, subtree: true });
  });
  await page.waitForTimeout(11000);
  check(await page.locator('.calib').count() === 0, 'the check closes by itself');
  const lag = await page.evaluate(() => JSON.parse(localStorage.getItem('chicken-piano-lag') || '{}'));
  check(lag.tap >= 230 && lag.tap <= 290, `screen delay measured about 250 ms (${lag.tap})`);
  const toastTxt = await page.evaluate(() => document.querySelector('#toast').textContent);
  check(/✅/.test(toastTxt), `grown-up sees the result (${toastTxt.trim()})`);

  // 2. play with the beat, tapping 250 ms after each note's moment: with the delay taken off, it's on the beat
  await page.evaluate(() => { window.__cp.openSong('twinkle', 'songs'); });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__cp.startBeatMode());
  const res = await page.evaluate(async () => {
    const P = window.__cp.P;
    const until = (f) => new Promise((ok) => { const iv = setInterval(() => { if (f()) { clearInterval(iv); ok(); } }, 10); });
    await until(() => P.judge);
    const j = P.judge;
    const kb = document.querySelector('#playKb');
    for (let k = 0; k < 6; k++) {
      const it = j.items[k];
      await until(() => performance.now() >= it.t + 250);
      const m = j.notes[it.i].keys[0].m;
      const key = kb.querySelector(`[data-m="${m}"]`);
      key.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      key.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    }
    return j.items.slice(0, 6).map((it) => it.result);
  });
  check(res.every((r) => r === 'good'), `taps 250 ms late count as on the beat after the check (${res.join(' ')})`);

  // 3. USB keyboard + sustain pedal in free play: a key let go while the pedal is down stays held
  await page.evaluate(() => window.__cp.show('free'));
  await page.waitForTimeout(400);
  const lens = await page.evaluate(async () => {
    const w = (ms) => new Promise((ok) => setTimeout(ok, ms));
    window.__fake.pedal(true);
    window.__fake.on(60); await w(150); window.__fake.off(60); // quick key, pedal holds it
    await w(1350);
    window.__fake.pedal(false);
    await w(100);
    window.__fake.on(64); await w(150); window.__fake.off(64); // quick key, no pedal
    await w(900);
    window.__fake.on(67); await w(100); window.__fake.off(67);
    await w(200);
    return window.__cpFreeTokens();
  });
  check(/^C4:(qd|h) E4:16 R:/.test(lens), `pedal keeps a quick key ringing (a long C), without it the key is short and a rest follows (${lens})`);
  check(errors === 0, 'no page errors');
  console.log(fails ? `${fails} failed` : 'all passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
