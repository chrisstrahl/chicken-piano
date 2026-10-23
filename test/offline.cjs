// Home-screen app: serves dist/ on localhost, lets the service worker save the app and voice clips,
// then reloads with the network off. Also checks a new build reaches the page on the next online launch.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/mpeg' };
let stampOverride = null; // pretend a new build was deployed
let down = false; // the "network" is off (Playwright's setOffline doesn't reach service workers)
const server = http.createServer((req, res) => {
  if (down) return req.socket.destroy();
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(f);
  if (stampOverride && p === '/index.html') body = Buffer.from(body.toString().replace(/v \d{4}-\d\d-\d\d \d\d:\d\d UTC/, `v ${stampOverride}`));
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=0, must-revalidate' });
  res.end(body);
});

(async () => {
  await new Promise((ok) => server.listen(0, ok));
  const url = `http://localhost:${server.address().port}/`;
  const clips = Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'voice/manifest.json'), 'utf8'))).length;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto(url);
  const r = {};
  r.manifest = await page.evaluate(async () => (await (await fetch(document.querySelector('link[rel=manifest]').href)).json()).display);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the service worker
  r.controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  // wait for the background voice download (starts 5 s after launch)
  const t0 = Date.now();
  let saved = 0;
  while (Date.now() - t0 < 90000) {
    saved = await page.evaluate(async () => (await (await caches.open('voice-v1')).keys()).length);
    if (saved >= clips) break;
    await page.waitForTimeout(1000);
  }
  r.voice = `${saved}/${clips}`;

  down = true;
  await page.reload();
  await page.locator('#start').dispatchEvent('pointerdown'); await page.waitForTimeout(900);
  r.offlineHome = await page.evaluate(() => document.querySelector('#home').classList.contains('active') && document.querySelector('#coop').textContent.includes('🥚'));
  r.uncachedFile = await page.evaluate(async () => { try { const res = await fetch('voice/manifest.json'); return res.status; } catch (e) { return 'offline'; } });
  const someClip = Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'voice/manifest.json'), 'utf8')))[0];
  r.offlineMp3 = await page.evaluate(async (id) => (await fetch(`voice/${id}.mp3`)).status, someClip);
  await page.screenshot({ path: (process.argv[2] || '.') + '/offline-home.png' });

  // back online with a new build: the next launch shows it
  down = false;
  stampOverride = '2099-01-01 00:00 UTC';
  await page.reload();
  r.newBuild = await page.evaluate(() => document.querySelector('#home .ver').textContent.trim());

  const ok = r.manifest === 'standalone' && r.controlled && saved >= clips && r.offlineHome && r.offlineMp3 === 200 && r.uncachedFile === 'offline' && r.newBuild === 'v 2099-01-01 00:00 UTC' && !errors.length;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(r)}${errors.length ? ' errors: ' + errors.join(' | ') : ''}`);
  await browser.close();
  server.close();
  process.exit(ok ? 0 : 1);
})();
