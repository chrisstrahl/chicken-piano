// Free play with the microphone. The fake mic plays test/freeplay.wav on a loop (piano samples):
//   C4 held 1.2 s (a half note at free play's 90 beats a minute), silence,
//   G4 A4 G4 A4 struck 0.16 s apart (sixteenths), silence, E4 E4 E4 struck 0.3 s apart (eighths).
// A browser's timer jitter can still drop one note of a run that fast, so the run checks allow one miss.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + __dirname + '/freeplay.wav', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, permissions: ['microphone'] });
  let errors = 0;
  page.on('pageerror', (e) => { errors++; console.log('PAGEERROR', e.message); });
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
  await page.evaluate(() => window.__cp.show('free'));
  await page.click('#mic', { force: true });
  // free play keeps only the last 8 notes, so keep every note object we see (their lengths settle later)
  await page.evaluate(() => { window.__seen = []; setInterval(() => window.__cpFree().forEach((n) => { if (!window.__seen.includes(n)) window.__seen.push(n); }), 30); });
  await page.waitForTimeout(21000);
  const seen = await page.evaluate(() => window.__seen.map((n) => n.label.replace(/\d/, '') + ':' + n.d));
  console.log(seen.join(' '));
  // look at whole loops: from one long C to the next
  const s = seen.join(' ');
  const loops = s.split(/(?=C:)/).filter((x) => x.startsWith('C:')).slice(0, -1);
  let ok = 0, fails = 0;
  const check = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); cond ? ok++ : fails++; };
  check(`heard at least two whole loops (${loops.length})`, loops.length >= 2);
  // the timer in a test browser jitters by tens of ms, so lengths are checked over all loops together
  const runs = [], es = [];
  for (const l of loops) {
    const ns = l.trim().split(' ');
    check(`long C is a half note (${ns[0]})`, ns[0] === 'C:h');
    const run = ns.filter((x) => /^[GA]:/.test(x));
    check(`fast run heard (${run.join(' ')})`, run.length >= 3 && run.length <= 4);
    runs.push(...run.slice(0, -1));
    const e = ns.filter((x) => /^E:/.test(x));
    check(`quick E's heard (${e.join(' ')})`, e.length >= 2 && e.length <= 3);
    es.push(...e.slice(0, -1));
  }
  const share = (xs, d) => xs.filter((x) => x.endsWith(':' + d)).length / Math.max(1, xs.length);
  check(`fast run comes out as sixteenths (${Math.round(share(runs, '16') * 100)}%)`, share(runs, '16') >= 0.8);
  check(`quick E's come out as eighths (${Math.round(share(es, '8') * 100)}%)`, share(es, '8') >= 0.75);
  check('no page errors', errors === 0);
  console.log(fails ? `${fails} failed` : 'all passed');
  await browser.close();
})();
