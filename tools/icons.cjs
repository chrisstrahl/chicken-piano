// Draws the home-screen icons into dist/icons with the app's chicken. Run once after changing the chicken:
//   node tools/icons.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/chicken.js'), 'utf8');
  const BODY = 'style="fill:#fff;stroke:#eadcc6"';
  const svg = src.match(/export const CHICKEN = `([\s\S]*?)`;/)[1].replace(/\$\{BODY\}/g, BODY);
  // a hen on a sunny yolk background over three piano keys; pad shrinks it into the maskable safe zone
  const page = (size, pad) => `<html><body style="margin:0"><div style="width:${size}px;height:${size}px;position:relative;overflow:hidden;
    background:radial-gradient(circle at 50% 40%,#fff6c9,#ffd84d 72%)">
    <div style="position:absolute;left:${pad}%;right:${pad}%;bottom:${pad}%;height:${(100 - 2 * pad) * 0.26}%;display:flex;gap:${size * 0.012}px">
      ${[0, 1, 2, 3, 4].map((i) => `<div style="flex:1;background:#fffdf8;border-radius:0 0 ${size * 0.03}px ${size * 0.03}px;box-shadow:inset 0 -${size * 0.02}px 0 rgba(0,0,0,.1)"></div>`).join('')}
      ${[1, 2, 4].map((i) => `<div style="position:absolute;left:${(i / 5) * 100 - 6}%;top:0;width:12%;height:58%;background:#2a211b;border-radius:0 0 ${size * 0.015}px ${size * 0.015}px"></div>`).join('')}
    </div>
    <div style="position:absolute;left:${pad + 6}%;right:${pad + 6}%;top:${pad - 2}%;bottom:${pad + (100 - 2 * pad) * 0.2}%;display:flex;justify-content:center">${svg.replace('class="chicken"', 'style="height:100%;width:auto"')}</div>
  </div></body></html>`;
  const out = path.join(__dirname, '../dist/icons');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  for (const [name, size, pad] of [['icon-512', 512, 6], ['icon-192', 192, 6], ['apple-touch-icon', 180, 6], ['icon-maskable-512', 512, 16]]) {
    const p = await browser.newPage({ viewport: { width: size, height: size } });
    await p.setContent(page(size, pad));
    await p.screenshot({ path: path.join(out, `${name}.png`) });
    await p.close();
  }
  await browser.close();
  console.log('icons in dist/icons');
})();
