// Record and share, in a real browser: record free play and a song (screen keys, mic and MIDI-style input),
// play it back, render the sound file, share it (and the download fallback), make a video, delete.
// Usage: node test/record.cjs [shotsDir]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const out = process.argv[2] || 'shots';
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, acceptDownloads: true });
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined });
    // a share sheet that records what it was given
    window.__shared = [];
    window.__shareOn = true;
    navigator.canShare = (d) => window.__shareOn && !!d.files;
    navigator.share = async (d) => { window.__shared.push({ name: d.files[0].name, type: d.files[0].type, size: d.files[0].size, text: d.text }); };
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/voice\/|Failed to load resource/.test(m.text()) && errs.push('console: ' + m.text())); // voice clips can't load from file://
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  let fails = 0;
  const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };
  const wait = (ms) => page.waitForTimeout(ms);
  await page.locator('#start').dispatchEvent('pointerdown'); await wait(1500);
  await page.screenshot({ path: `${out}/rec-home.png` });

  // 1. Free play: hold keys for different lengths, plus a heard (mic) note and a MIDI-style note with velocity
  await page.click('#home [data-go=recs]'); await wait(300);
  await page.click('#recs [data-go=free]'); await wait(300);
  await page.click('#freeRec'); await wait(200);
  check(await page.evaluate(() => window.__cp.recs.on), 'red button starts recording');
  check((await page.textContent('#freeRec .ic')) === '⏹️', 'button turns into stop');
  const key = async (m, ms) => {
    const b = await page.locator(`#freeKb [data-m="${m}"]`).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.85); await page.mouse.down(); await wait(ms); await page.mouse.up(); await wait(100);
  };
  await key(60, 300); await key(62, 300); await key(64, 700);
  await page.evaluate(() => window.__cp.noteIn(67, 'mic')); await wait(500);
  await page.evaluate(() => window.__cp.noteIn(72, 'midi', 0.4)); await wait(400);
  await page.evaluate(() => { window.__cp.noteIn(72, 'never'); }); // unknown sources still count
  await wait(300);
  await page.screenshot({ path: `${out}/rec-recording.png` });
  check(/0:0\d/.test(await page.textContent('#freeRec .tm')), 'a running clock shows while recording');
  await page.click('#freeRec'); await wait(600);
  const cur = await page.evaluate(() => document.querySelector('.screen.active').id);
  check(cur === 'rec', `stop opens the recording (${cur})`);
  const rec = await page.evaluate(() => window.__cp.recs.R.rec);
  check(rec && rec.notes.length === 6, `6 notes recorded (${rec && rec.notes.length})`);
  check(rec.notes.map((n) => n[1]).join(' ') === '60 62 64 67 72 72', 'right keys in order');
  check(rec.notes[0][0] === 300 && Math.abs(rec.notes[2][2] - 700) < 150, `timing kept (first at ${rec.notes[0][0]}, E held ${rec.notes[2][2]}ms)`);
  check(rec.notes[4][3] === 0.4, 'MIDI velocity kept');
  const drawn = await page.evaluate(() => window.__cp.recs.R.drawn.noteEls.filter(Boolean).length);
  check(drawn >= 5, `recording drawn as music (${drawn} notes)`);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chicken-piano-recordings-v1')));
  check(saved.p1 && saved.p1.length === 1, 'saved under the first player');

  // 2. Playback lights keys and moves along the music
  await page.click('#recPlay');
  const lit = await page.waitForFunction(() => document.querySelectorAll('#recKb .down').length, null, { timeout: 3000 }).then((h) => h.jsonValue(), () => 0);
  await wait(700);
  const x = await page.evaluate(() => document.querySelector('#recStaff .cur').getAttribute('x'));
  await page.screenshot({ path: `${out}/rec-playback.png` });
  check(lit >= 1, `keys light up during playback (${lit})`);
  check(+x > 0, 'the music highlight moves');
  check((await page.textContent('#recPlay')) === '⏹️', 'play turns into stop');
  await page.click('#recPlay'); await wait(200);
  check((await page.textContent('#recPlay')) === '▶️', 'stop ends playback');

  // 3. The sound file: a real wav with sound where the notes are
  await page.waitForFunction(() => window.__cp.recs.R.file.ready, null, { timeout: 15000 });
  const wav = await page.evaluate(async () => {
    const f = window.__cp.recs.R.file.ready;
    const buf = await f.arrayBuffer();
    const ac = new AudioContext();
    const a = await ac.decodeAudioData(buf.slice(0));
    const d = a.getChannelData(0);
    const rms = (t0, t1) => { let s = 0, n = 0; for (let i = Math.floor(t0 * a.sampleRate); i < t1 * a.sampleRate; i++, n++) s += d[i] * d[i]; return Math.sqrt(s / n); };
    // strongest pitch in the first note, by autocorrelation
    const seg = d.slice(Math.floor(0.35 * a.sampleRate), Math.floor(0.55 * a.sampleRate));
    let best = 0, lag = 0;
    for (let L = 100; L < 250; L++) { let c = 0; for (let i = 0; i + L < seg.length; i++) c += seg[i] * seg[i + L]; if (c > best) { best = c; lag = L; } }
    let peak = 0; for (const v of d) peak = Math.max(peak, Math.abs(v));
    return { name: f.name, type: f.type, size: f.size, dur: a.duration, before: rms(0, 0.25), during: rms(0.35, 0.6), hz: a.sampleRate / lag, peak };
  });
  check(wav.type === 'audio/wav' && wav.name === 'My song - Chicken Piano.wav', `file ${wav.name} (${wav.type}, ${Math.round(wav.size / 1024)} KB)`);
  check(wav.before < 0.001 && wav.during > 0.02, `silent before the first note, sound during it (${wav.before.toFixed(4)} / ${wav.during.toFixed(3)})`);
  check(Math.abs(wav.hz - 261.6) < 8, `first note sounds like middle C (${wav.hz.toFixed(1)} Hz)`);
  check(wav.peak > 0.8 && wav.peak <= 1, `loudness evened out (peak ${wav.peak.toFixed(2)})`);
  check(Math.abs(wav.dur - (rec.notes.reduce((m, n) => Math.max(m, n[0] + n[2]), 0) / 1000 + 1.6)) < 0.05, `length ${wav.dur.toFixed(2)}s`);

  // 4. Share sheet, then the download fallback when the device can't share files
  await page.click('#recShare'); await wait(300);
  const shared = await page.evaluate(() => window.__shared);
  check(shared.length === 1 && shared[0].type === 'audio/wav' && /Chicken Piano/.test(shared[0].text), `📤 opens the share sheet with the wav (${JSON.stringify(shared[0])})`);
  await page.evaluate(() => { window.__shareOn = false; });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#recShare')]);
  check(dl && dl.suggestedFilename() === 'My song - Chicken Piano.wav', `no share sheet: the file downloads (${dl && dl.suggestedFilename()})`);
  await page.evaluate(() => { window.__shareOn = true; });

  // 5. Video
  const canVideo = await page.isVisible('#recVideo');
  check(canVideo, '🎬 shown where the browser can film');
  if (canVideo) {
    await page.click('#recVideo'); await wait(1600);
    await page.screenshot({ path: `${out}/rec-video.png` });
    await page.waitForSelector('#filmSend', { state: 'visible', timeout: 20000 });
    await page.click('#filmSend'); await wait(300);
    const v = (await page.evaluate(() => window.__shared))[1];
    check(v && /^video\//.test(v.type) && v.size > 20000, `video shared (${v && v.name}, ${v && v.type}, ${v && Math.round(v.size / 1024)} KB)`);
    await page.click('#filmClose'); await wait(200);
  }

  // 6. A song: recording stops by itself when the song is done, and the celebration offers it
  await page.evaluate(() => window.__cp.openSong('peck', 'songs')); await wait(400);
  await page.click('#playRec'); await wait(200);
  const song = await page.evaluate(() => window.__cp.P.song.notes.filter((n, i, a) => !n.r && !(i > 0 && a[i - 1].tie)).map((n) => n.m));
  for (const m of song) { await page.evaluate((m) => { window.__cp.noteIn(m, 'tap'); }, m); await wait(60); await page.evaluate((m) => document.dispatchEvent(new KeyboardEvent('keyup', { key: 'x' })), m); }
  await wait(1500);
  check(!(await page.evaluate(() => window.__cp.recs.on)), 'finishing the song stops the recording');
  check(await page.isVisible('#partyRec'), 'celebration shows the 🎙️ button');
  await page.screenshot({ path: `${out}/rec-party.png` });
  await page.click('#partyRec'); await wait(500);
  const r2 = await page.evaluate(() => window.__cp.recs.R.rec);
  check(r2.song === 'peck' && r2.notes.length === song.length, `song recording opens (${r2.title}, ${r2.notes.length} notes)`);
  await page.screenshot({ path: `${out}/rec-song.png` });

  // 7. Leaving a screen while recording saves it
  await page.click('#rec [data-go=recs]'); await wait(200);
  await page.click('#recs [data-go=home]'); await wait(200);
  await page.click('#home [data-go=recs]'); await wait(200);
  await page.click('#recs [data-go=free]'); await wait(200);
  await page.click('#freeRec'); await wait(100);
  await key(65, 200);
  await page.click('#free [data-go=recs]'); await wait(400);
  const cards = await page.locator('#recCards [data-rec]').count();
  check(cards === 3, `the shelf shows all 3 recordings (${cards})`);
  await page.screenshot({ path: `${out}/rec-shelf.png` });

  // 8. Delete asks first
  await page.locator('#recCards [data-rec]').first().click(); await wait(400);
  await page.click('#recDelete'); await wait(200);
  check(await page.isVisible('#ask'), 'delete asks first');
  await page.click('#askYes'); await wait(300);
  check((await page.locator('#recCards [data-rec]').count()) === 2, 'deleted');

  // 9. Each player has their own shelf; removing a player removes their recordings
  const per = await page.evaluate(() => {
    const { players, recs } = window.__cp;
    const first = players.current().id;
    const kid2 = players.add(players.list()[0].avatar, 'Kid two');
    window.__cp.usePlayer ? window.__cp.usePlayer(kid2.id) : players.use(kid2.id);
    window.__cp.show('recs');
    const shelf2 = document.querySelectorAll('#recCards [data-rec]').length;
    window.__cp.show('free');
    document.querySelector('#freeRec').click();
    window.__cp.noteIn(60, 'tap');
    document.querySelector('#freeRec').click();
    const mine2 = JSON.parse(localStorage.getItem('chicken-piano-recordings-v1'))[kid2.id].length;
    players.use(first);
    players.remove(kid2.id);
    const all = JSON.parse(localStorage.getItem('chicken-piano-recordings-v1'));
    return { first, shelf2, mine2, gone: !(kid2.id in all), kept: all[first].length };
  });
  check(per.shelf2 === 0 && per.mine2 === 1, `a second player starts with an empty shelf and saves their own (${per.shelf2}, ${per.mine2})`);
  check(per.gone && per.kept === 2, `removing a player removes only their recordings (kept ${per.kept})`);

  check(!errs.length, `no page errors ${errs.join(' | ')}`);
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
