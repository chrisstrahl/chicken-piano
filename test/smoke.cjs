const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=' + __dirname + '/edc.wav','--autoplay-policy=no-user-gesture-required'] });
  const out = process.argv[2] || 'shots';
  for (const [w,h,tag] of [[1024,768,'ipad'],[844,390,'phone']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, permissions: ['microphone'] });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', m => logs.push(m.type()+': '+m.text()));
    page.on('pageerror', e => logs.push('PAGEERROR: '+e.message));
    await page.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    await page.goto('file://' + process.cwd() + '/dist/index.html');
    await page.waitForTimeout(400);
    await page.screenshot({ path: out+'/'+tag+'-home.png' });
    await page.click('[data-go=songs]'); await page.waitForTimeout(300);
    await page.screenshot({ path: out+'/'+tag+'-songs.png' });
    await page.click('[data-song=clucky]'); await page.waitForTimeout(700);
    await page.screenshot({ path: out+'/'+tag+'-play.png' });
    // tap correct notes via on-screen keys
    for (const m of [64,62,60,62]) { await page.locator('#playKb [data-m="'+m+'"]').dispatchEvent('pointerdown'); await page.waitForTimeout(150); }
    await page.locator('#playKb [data-m="65"]').dispatchEvent('pointerdown');
    await page.waitForTimeout(600);
    await page.screenshot({ path: out+'/'+tag+'-play2.png' });
    logs.push('play index after taps: ' + await page.evaluate(() => window.__cp.P.i));
    if (tag === 'ipad') {
      await page.evaluate(() => window.__cp.openLesson(0)); await page.waitForTimeout(400);
      await page.screenshot({ path: out+'/ipad-lesson1.png' });
      await page.evaluate(() => window.__cp.openLesson(2)); await page.waitForTimeout(300);
      await page.click('#btnNext',{force:true}); await page.waitForTimeout(300);
      await page.screenshot({ path: out+'/ipad-lesson3b.png' });
      await page.click('#btnNext',{force:true}); await page.click('#btnNext',{force:true}); await page.waitForTimeout(300);
      await page.screenshot({ path: out+'/ipad-lesson3quiz.png' });
      await page.evaluate(() => window.__cp.openLesson(3)); await page.waitForTimeout(300);
      await page.screenshot({ path: out+'/ipad-lesson4.png' });
      await page.evaluate(() => window.__cp.show('free'));
      for (const m of [60,64,67,66,72]) { await page.locator('#freeKb [data-m="'+m+'"]').dispatchEvent('pointerdown'); await page.waitForTimeout(100); }
      await page.screenshot({ path: out+'/ipad-free.png' });
      // mic test: start a song and let fake mic (E D C E D C) play
      await page.evaluate(() => { window.__heard = []; window.__busyLog = []; window.__cp.openSong('eggs'); });
      await page.click('#mic',{force:true});
      await page.waitForTimeout(9000);
      logs.push('mic: ' + await page.evaluate(() => JSON.stringify([window.__cp.P.i, window.__cp.P.mistakes])));
      await page.screenshot({ path: out+'/ipad-mic.png' });
      // finish song via taps to see party
      await page.click('#mic',{force:true});
      const notes = [60,60,60,60,62,62,62,62,64,62,60];
      await page.evaluate(() => { const P = window.__cp.P; P.i = 6; });
      for (const m of notes) { await page.locator('#playKb [data-m="'+m+'"]').dispatchEvent('pointerdown'); await page.waitForTimeout(60); }
      await page.waitForTimeout(1200);
      await page.screenshot({ path: out+'/ipad-party.png' });
    }
    console.log(tag, logs.join('\n'));
    await ctx.close();
  }
  await browser.close();
})();
