// Private songs in the real app: a grown-up enters a repo and token on the grown-ups' page, the songs download
// (GitHub is faked), show up open at the end of their level, survive a relaunch with GitHub unreachable, and go
// when removed. usage: node test/privatesongs.cjs [shotsDir]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
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
  const songs = [
    { id: 'hook', level: 2, emoji: '🎤', title: 'Pop Hook', sub: 'A hit', key: 'C', time: '4/4', tempo: 100, notes: 'C D E F G:w', lyrics: 'la la la la la' },
    { id: 'bad', level: 3, title: 'Bad', notes: 'C Q9' },
  ];
  let calls = [], up = true;
  await page.route('https://api.github.com/**', (r) => {
    calls.push({ url: r.request().url(), auth: r.request().headers().authorization });
    if (!up) return r.abort();
    r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(songs) });
  });
  const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
  const start = async () => {
    await page.goto('file://' + process.cwd() + '/dist/index.html');
    await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
  };
  await start();
  await page.evaluate(() => window.__cp.show('parent')); await page.waitForTimeout(300);
  check(await page.locator('#privCard').count() === 1, 'grown-ups page has a Private songs card');
  await page.fill('#privRepo', 'https://github.com/chrisstrahl/chicken-piano-songs');
  await page.fill('#privToken', 'github_pat_test');
  await page.click('#btnPrivLoad'); await page.waitForTimeout(600);
  const card = await page.locator('#privCard').innerText();
  check(calls.length === 1 && calls[0].url.endsWith('/repos/chrisstrahl/chicken-piano-songs/contents/songs.json') && calls[0].auth === 'Bearer github_pat_test', 'asks GitHub for songs.json with the token');
  check(/1 song ready/.test(card) && /Skipped 1: bad/.test(card), 'says what it added and skipped');
  await page.screenshot({ path: `${out}/private-songs.png` });
  const lv2 = await page.evaluate(() => window.__cp.SONGS.filter((s) => s.level === 2).map((s) => s.id));
  check(lv2.at(-1) === 'priv-hook', 'the song is last in level 2');
  await page.evaluate(() => window.__cp.show('songs')); await page.waitForTimeout(300);
  check(await page.evaluate(() => { const c = document.querySelector('#songCards [data-song="priv-hook"]'); return !!c && !c.classList.contains('locked'); }), 'it is open in the song list (no lessons done)');
  await page.evaluate(() => window.__cp.openSong('priv-hook')); await page.waitForTimeout(400);
  check(await page.evaluate(() => window.__cp.P.song.id === 'priv-hook'), 'it plays');

  up = false;
  await start();
  check(await page.evaluate(() => !!window.__cp.SONGS.find((s) => s.id === 'priv-hook')), 'GitHub unreachable: the saved copy is used');
  await page.evaluate(() => window.__cp.show('parent')); await page.waitForTimeout(400);
  const card2 = await page.locator('#privCard').innerText();
  check(/Couldn't reach GitHub/.test(card2) && /copy from last time/.test(card2) && /saved; leave empty to keep/.test(card2), 'says it used the copy from last time; token kept');
  check(await page.evaluate(() => !/github_pat_test/.test(document.body.innerHTML)), 'the token is never shown');
  await page.click('#btnPrivForget'); await page.waitForTimeout(300);
  check(await page.evaluate(() => !window.__cp.SONGS.find((s) => s.id === 'priv-hook') && !localStorage.getItem('chicken-piano-private-songs')), 'Remove takes the songs and token off the device');
  check(!errs.length, `no page errors ${errs.join(' | ')}`);
  await browser.close();
})();
