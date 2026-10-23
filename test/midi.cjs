// USB keyboard (Web MIDI) with a fake MIDI device: auto-connect, exact notes, held lengths, mic fallback.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

// A fake navigator.requestMIDIAccess with one keyboard that the test can play, unplug and plug back in.
const FAKE = ({ perm, native = true }) => {
  const input = { name: 'CASIO USB-MIDI', state: 'connected', onmidimessage: null };
  const access = { inputs: new Map([['in1', input]]), outputs: new Map(), onstatechange: null };
  window.__midiAsked = 0;
  const ask = async () => { window.__midiAsked++; return access; };
  // a bound function prints as [native code], like the browser's own; a plain one looks like an iPad MIDI-browser app's
  navigator.requestMIDIAccess = native ? ask.bind(null) : ask;
  const q = navigator.permissions.query.bind(navigator.permissions);
  navigator.permissions.query = async (d) => (d.name === 'midi' ? { state: perm } : q(d));
  window.__fake = {
    on: (m, v = 100) => input.onmidimessage && input.onmidimessage({ data: new Uint8Array([0x90, m, v]) }),
    off: (m, zero) => input.onmidimessage && input.onmidimessage({ data: new Uint8Array(zero ? [0x90, m, 0] : [0x80, m, 64]) }),
    unplug: () => { input.state = 'disconnected'; access.inputs.delete('in1'); access.onstatechange && access.onstatechange({ port: input }); },
    plug: () => { input.state = 'connected'; access.inputs.set('in1', input); access.onstatechange && access.onstatechange({ port: input }); },
  };
};

let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); };

async function open(browser, init, arg) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  if (init) await page.addInitScript(init, arg);
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
  return page;
}
const btn = (page) => page.evaluate(() => { const b = document.querySelector('#midi'); return getComputedStyle(b).display === 'none' ? 'hidden' : b.classList.contains('on') ? 'on' : 'dim'; });

(async () => {
  const browser = await chromium.launch();

  // already allowed: connects by itself, no tap needed
  let page = await open(browser, FAKE, { perm: 'granted' });
  check(await btn(page) === 'on', `allowed before -> 🎹 lit on load (${await btn(page)})`);

  // song: each key from the keyboard counts once; the mic is ignored while the keyboard is in
  await page.evaluate(() => window.__cp.openSong('peck', 'songs')); // starts E E E
  await page.waitForTimeout(400);
  await page.evaluate(() => { __fake.on(64); __fake.off(64); });
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.__cp.P.i) === 1, 'MIDI E -> song moves to note 2');
  await page.evaluate(() => { __fake.on(64); __fake.off(64, true); }); // note-on velocity 0 = note-off
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.__cp.P.i) === 2, 'second MIDI E (velocity-0 release) -> note 3');
  await page.evaluate(() => window.__cp.noteIn(64, 'mic'));
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.__cp.P.i) === 2, 'mic note ignored while the keyboard is plugged in');
  await page.evaluate(() => { __fake.on(62); __fake.off(62); }); // wrong note: no move
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.__cp.P.i) === 2, 'wrong MIDI note does not advance');

  // free play: how long the real key is held becomes the note length
  await page.evaluate(() => window.__cp.show('free'));
  await page.waitForTimeout(300);
  for (const ms of [200, 600, 1500, 3200]) { await page.evaluate(() => __fake.on(67)); await page.waitForTimeout(ms); await page.evaluate(() => __fake.off(67)); await page.waitForTimeout(150); }
  const lens = await page.evaluate(() => window.__cpFree().map((n) => n.d).join(' '));
  check(lens === '8 q h w', `MIDI held lengths -> ${lens} (want 8 q h w)`);
  // a chord: three keys at once arrive as three notes
  await page.evaluate(() => { __fake.on(60); __fake.on(64); __fake.on(67); });
  await page.waitForTimeout(100);
  check(await page.evaluate(() => window.__cpFree().slice(-3).map((n) => n.m).join(' ')) === '60 64 67', 'chord C E G -> three notes');
  await page.evaluate(() => { __fake.unplug(); });
  await page.waitForTimeout(100);
  check(await btn(page) === 'dim', 'unplugged -> 🎹 dim');
  check(await page.evaluate(() => window.__cpFree().slice(-3).map((n) => n.d).join(' ')) === '8 8 8', 'unplugged mid-chord -> held notes are let go');
  await page.evaluate(() => window.__cp.noteIn(65, 'mic'));
  check(await page.evaluate(() => window.__cpFree().slice(-1)[0].m) === 65, 'unplugged -> mic notes count again');
  await page.evaluate(() => __fake.plug());
  await page.waitForTimeout(100);
  check(await btn(page) === 'on', 'plugged back in -> 🎹 lit again');
  await page.screenshot({ path: (process.argv[2] || '.') + '/midi-on.png' });
  await page.close();

  // never allowed: no prompt on load; tapping 🎹 asks, then connects
  page = await open(browser, FAKE, { perm: 'prompt' });
  check(await btn(page) === 'dim' && await page.evaluate(() => window.__midiAsked) === 0, 'not allowed yet -> 🎹 dim, no prompt on load');
  await page.click('#midi'); await page.waitForTimeout(300);
  check(await btn(page) === 'on', 'tap 🎹 -> asks once and connects');
  await page.close();

  // iPad Web MIDI browser app (adds its own requestMIDIAccess, no permission prompt): connects by itself
  page = await open(browser, FAKE, { perm: 'prompt', native: false });
  check(await btn(page) === 'on', 'iPad MIDI browser app -> 🎹 lit on load');
  await page.close();

  // no Web MIDI (iPad Safari): button hidden, everything else unchanged
  page = await open(browser, () => { delete Navigator.prototype.requestMIDIAccess; });
  check(await btn(page) === 'hidden', 'browser without Web MIDI -> no 🎹 button');
  await page.close();

  await browser.close();
  process.exit(fails ? 1 : 0);
})();
