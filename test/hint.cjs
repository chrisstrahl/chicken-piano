// The 🐔 hint: plays and lights the next note without moving on, and bounces when the child is stuck.
// Usage: node test/hint.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(800);
  let ok = true;
  const check = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'} ${msg}`); ok = ok && c; };

  await page.evaluate(() => { window.__cp.progress.hands = 'rh'; window.__cp.openSong('peck', 'songs'); }); // starts E
  await page.waitForTimeout(400);
  await page.click('#btnHint');
  await page.waitForTimeout(100);
  const hop = await page.evaluate(() => [...document.querySelectorAll('#playKb .hint')].map((k) => +k.dataset.m));
  check(hop.length === 1 && hop[0] % 12 === 4, `song hint lights E (got ${hop})`);
  check(await page.evaluate(() => window.__cp.P.e) === 0, 'song hint does not move on');
  check(await page.evaluate(() => !document.querySelector('#btnHint').classList.contains('nudge')), 'no bounce right after a hint');
  await page.waitForTimeout(8600);
  check(await page.evaluate(() => document.querySelector('#btnHint').classList.contains('nudge')), 'hint bounces after 8 s stuck');
  await page.evaluate(() => window.__cp.noteIn(64, 'tap'));
  await page.waitForTimeout(100);
  check(await page.evaluate(() => !document.querySelector('#btnHint').classList.contains('nudge')), 'a right note stops the bounce');
  await page.evaluate(() => { window.__cp.noteIn(61, 'tap'); window.__cp.noteIn(61, 'tap'); });
  await page.waitForTimeout(100);
  check(await page.evaluate(() => document.querySelector('#btnHint').classList.contains('nudge')), 'two wrong notes make it bounce');

  // lesson "find the key" step: the hint lights the key to find
  const want = await page.evaluate(() => {
    const lv = window.__cp.LEVELS.find((l) => l.lessons.some((x) => x.steps.some((st) => st.type === 'key')));
    const li = lv.lessons.findIndex((x) => x.steps.some((st) => st.type === 'key'));
    const si = lv.lessons[li].steps.findIndex((st) => st.type === 'key');
    window.__cp.openLesson(lv.n, li);
    window.__cp.lessonStep(si);
    return lv.lessons[li].steps[si].targets.split(' ')[0];
  });
  await page.waitForTimeout(400);
  check(await page.evaluate(() => getComputedStyle(document.querySelector('#btnLessonHint')).display !== 'none'), 'lesson key step shows the hint button');
  await page.click('#btnLessonHint');
  await page.waitForTimeout(100);
  const lit = await page.evaluate(() => [...document.querySelectorAll('#lessonKb .target')].map((k) => k.dataset.m));
  check(lit.length === 1, `lesson hint lights the key to find (${want} -> ${lit})`);
  await page.evaluate(() => window.__cp.show('home'));
  await page.waitForTimeout(100);
  check(await page.evaluate(() => !document.querySelector('#btnLessonHint').classList.contains('nudge')), 'leaving the lesson stops the bounce');
  await page.evaluate(() => { window.__cp.openSong('peck', 'songs'); });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__cp.show('home'));
  await page.waitForTimeout(100);
  check(await page.evaluate(() => !document.querySelector('#btnHint').classList.contains('nudge')), 'leaving the song stops the bounce');
  check(!errs.length, `no page errors ${errs.join(' ')}`);
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
