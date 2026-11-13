// Song upload on the grown-ups' page: pick a MusicXML file, check the draft, change the level, add it; the song
// shows up open at the end of that level, plays to the end, survives a reload and goes into backups; a MIDI
// file works too; a wrong file says so; 🗑 removes a song.
// usage: node test/upload.cjs [shotsDir]   (on the built dist/index.html)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || 'shots';
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  await ctx.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
  const open = async () => {
    await page.goto('file://' + process.cwd() + '/dist/index.html');
    await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
    await page.evaluate(() => window.__cp.show('parent')); await page.waitForTimeout(300);
  };
  const pick = async (file) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#btnUpPick')]);
    await chooser.setFiles(path.join(__dirname, 'fixtures', file));
    await page.waitForTimeout(400);
  };
  const card = () => page.evaluate(() => document.querySelector('#uploadCard').textContent.replace(/\s+/g, ' '));
  await open();

  await pick('lamb.musicxml');
  let text = await card();
  check(/Little Lamb/.test(await page.inputValue('#upTitle')), 'the song name comes from the file');
  check(await page.inputValue('#upLevel') === '2', 'level guessed (2: C to G, quarters and halves)');
  check(/Notes in the tune ?26/.test(text) && /C major · 4\/4/.test(text), `draft shows notes, key and time (${text.slice(0, 160)})`);
  await page.click('#btnUpHear'); await page.waitForTimeout(300);
  check(/Stop/.test(await page.textContent('#btnUpHear')), '▶️ Hear the start plays (button turns to stop)');
  await page.click('#btnUpHear'); await page.waitForTimeout(100);
  await page.fill('#upTitle', 'Lamb <b>Song</b>');
  await page.selectOption('#upLevel', '3');
  await page.screenshot({ path: `${out}/upload-draft.png` });
  await page.click('#btnUpAdd'); await page.waitForTimeout(300);
  text = await card();
  check(/Added Lamb bSong\/b to Level 3/.test(text), `added, with markup stripped from the name (${text.slice(0, 120)})`);
  check(/Added songs \(1 of 50\)/.test(text), 'listed under Added songs');
  await page.screenshot({ path: `${out}/upload-added.png` });

  const s = await page.evaluate(() => { const l = window.__cp.SONGS.filter((x) => x.level === 3); const u = l[l.length - 1]; return u && { id: u.id, title: u.title, priv: u.priv }; });
  check(s && /^up-/.test(s.id) && s.title === 'Lamb bSong/b' && s.priv, `last song in level 3 is the upload (${JSON.stringify(s)})`);
  // the kid's view: the level's song list shows it, open
  await page.evaluate(() => window.__cp.show('nest'));
  const played = await page.evaluate(async (id) => {
    const { P, noteIn, openSong } = window.__cp;
    openSong(id);
    await new Promise((r) => setTimeout(r, 400));
    for (let k = 0; k < 500 && P.e < P.events.length; k++) P.events[P.e].need.forEach((x) => noteIn(x.m, 'tap'));
    return document.querySelector('#party.show') ? 'ok' : `stuck at ${P.e}/${P.events.length}`;
  }, s.id);
  check(played === 'ok', `the uploaded song plays to the end (${played})`);
  await page.screenshot({ path: `${out}/upload-playing.png` });

  // a reload keeps it; a backup has it
  await open();
  check(await page.evaluate((id) => window.__cp.SONGS.some((x) => x.id === id), s.id), 'still there after a reload');
  check(await page.evaluate(() => /Lamb bSong/.test(localStorage.getItem('chicken-piano-uploads-v1') || '')), 'saved under chicken-piano-uploads-v1 (so backups include it)');

  // MIDI works too; a wrong file says what to pick
  await pick('lamb.mid');
  check(await page.inputValue('#upTitle') === 'lamb', `MIDI file read (name from the file name: ${await page.inputValue('#upTitle')})`);
  await page.click('#btnUpCancel'); await page.waitForTimeout(200);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#btnUpPick')]);
  await chooser.setFiles({ name: 'cat.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([255, 216, 255, 224, 0, 16]) });
  await page.waitForTimeout(300);
  check(/Pick a MusicXML/.test(await card()), 'a photo gets a helpful message');

  // 🗑 removes it from the list and the level
  await page.click(`[data-unsong="${s.id.replace(/^up-/, '')}"]`); await page.waitForTimeout(300);
  check(!/Added songs/.test(await card()) && !(await page.evaluate((id) => window.__cp.SONGS.some((x) => x.id === id), s.id)), '🗑 removes the song');
  check(!errs.length, `no page errors ${errs.join(' | ')}`);
  await browser.close();
})();
