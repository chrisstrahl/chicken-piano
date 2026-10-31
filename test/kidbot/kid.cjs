// Robot kids play the real built app (dist/) in a headless browser and write down what trips them up.
//
//   npm run kid                 the usual four kids, about two minutes each
//   KID_SECONDS=300 KID_CAREFUL_SECONDS=900 npm run kid   longer sessions (wild kids / careful kids)
//   KID_ONLY=wild6 npm run kid  one kid (see KIDS below)
//   KID_SEED=7 npm run kid      a different (but repeatable) run
//
// Each kid taps with a real pointer at real screen positions, and can play the "Casio" through a fake
// microphone (test/kidbot/hooks.js) that also hears the tablet's own speaker. Report: test/kidbot/out/report.md
// (with screenshots). Exits 1 if a kid hit a real bug (page error, a stuck screen), 0 for usability notes only.
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '../../dist');
const OUT = process.env.KID_OUT || path.join(__dirname, 'out');
const SECONDS = +(process.env.KID_SECONDS || 150);
// the careful kids work through a list of things to try, so they get longer
const CAREFUL_SECONDS = +(process.env.KID_CAREFUL_SECONDS || 900);
const SEED = +(process.env.KID_SEED || 1);
const VOICE = JSON.parse(fs.readFileSync(path.join(ROOT, 'voice/manifest.json'), 'utf8'));
const IPAD = { width: 1024, height: 768 }, PHONE = { width: 844, height: 390 };

// Who plays. accuracy: chance of pressing the right key when the kid knows it; hesitate: ms before each move;
// jitter: ms off the beat; input: 'screen' taps or 'mic' (plays the Casio, screen taps sometimes too).
const KIDS = {
  careful8: { name: 'Careful 8-year-old, taps the iPad', age: 8, view: IPAD, input: 'screen', accuracy: 0.85, hesitate: [400, 2200], jitter: 70, careful: true },
  casio8: { name: 'Careful 8-year-old, plays the Casio (mic)', age: 8, view: IPAD, input: 'mic', accuracy: 0.85, hesitate: [500, 2000], jitter: 80, careful: true },
  wild6: { name: 'Wild 6-year-old, taps everything', age: 6, view: IPAD, input: 'screen', accuracy: 0.45, hesitate: [100, 900], jitter: 220, careful: false },
  phone6: { name: 'Wild 6-year-old on a phone, sometimes the Casio', age: 6, view: PHONE, input: 'mixed', accuracy: 0.4, hesitate: [150, 1200], jitter: 250, careful: false },
};

/* ---------- helpers ---------- */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// the app writes heard notes as C♯ or D♭: compare by pitch class
const FLAT = { 'D♭': 'C#', 'E♭': 'D#', 'G♭': 'F#', 'A♭': 'G#', 'B♭': 'A#' };
const pcName = (name) => { const n = name.replace(/\d/g, '').trim(); return FLAT[n] || n.replace('♯', '#'); };
const noteName = (m) => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const BACK = /^(#btnPlayBack|#btnLessonBack|#partyHome|\[data-go=(home|learn|map|recs|games|ears|songs)\]|#askNo|#edNo|#filmClose)$/;
const ACTIVITY = ['lesson', 'play', 'rush', 'beat', 'ear', 'free'];

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

/* ---------- one kid's session ---------- */
async function play(browser, url, id, kid, seed) {
  const R = rng(seed);
  const pick = (xs) => xs[Math.floor(R() * xs.length)];
  const between = ([a, b]) => a + R() * (b - a);
  const ctx = await browser.newContext({ viewport: kid.view, serviceWorkers: 'block', permissions: ['microphone'] });
  await ctx.addInitScript({ path: path.join(__dirname, 'hooks.js') });
  await ctx.addInitScript({ path: path.join(__dirname, 'look.js') });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());

  const findings = new Map();
  const t0 = Date.now();
  const clock = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const diary = []; // what the kid did, for the report
  let shots = 0;
  let screen = 'start';
  async function note(kind, sev, key, text, { shot = true } = {}) {
    const k = `${kind}|${key}`;
    const f = findings.get(k);
    if (f) { f.count++; return; }
    const nf = { kind, sev, key, text, count: 1, at: clock(), screen, kid: id };
    findings.set(k, nf);
    if (shot && shots < 25) { nf.shot = `${id}-${++shots}.png`; await page.screenshot({ path: path.join(OUT, nf.shot) }).catch(() => {}); }
  }
  page.on('pageerror', (e) => note('error', 'bug', e.message, `Page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_FAILED|fonts/.test(m.text())) note('error', 'bug', m.text(), `Console error: ${m.text()}`); });

  await page.goto(url);
  await page.waitForTimeout(600);
  const look = async () => { const v = await page.evaluate(() => window.__kid.look()); micIsOn = v.micOn; seen.add(v.overlay || v.screen); return v; };
  const seen = new Set();
  const counters = () => page.evaluate(() => ({ c: window.__kid.changes, s: window.__kid.sounds.length + window.__kid.loud, l: window.__kid.lines.length, now: performance.now() }));
  let micIsOn = false;
  const usingMic = () => micIsOn && (kid.input === 'mic' || (kid.input === 'mixed' && R() < 0.4));

  /* the kid's hands */
  async function tapBox(b, hold = 80 + R() * 80) {
    // a careful kid hits the middle; a wild one lands anywhere on it
    const sx = kid.careful ? 0.15 : 0.4;
    const x = b.x + b.w * (0.5 + (R() - 0.5) * 2 * sx), y = b.y + b.h * (0.5 + (R() - 0.5) * 2 * sx);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(hold);
    await page.mouse.up();
  }
  // tap a button the kid can see; notes when nothing at all happens
  async function tap(t, why = '') {
    if (t.reach !== 'ok' && t.canScroll) {
      await page.evaluate((sel) => { const el = [...document.querySelectorAll('.screen.active ' + sel.replace(/^\[data-(\w+)\]$/, '[data-$1]'))][0]; el && el.scrollIntoView({ block: 'center' }); }, t.sel).catch(() => {});
      const v = await look();
      t = v.taps.find((x) => x.sel === t.sel && x.label === t.label) || t;
    }
    const before = await counters();
    diary.push(`${clock()} ${screen}: tap ${t.label || t.sel}${why ? ' (' + why + ')' : ''}`);
    await tapBox(t);
    await page.waitForTimeout(1200);
    const after = await counters();
    if (after.c === before.c && after.s === before.s && after.l === before.l) await note('dead', 'trouble', `${screen} ${t.sel}`, `Tapped ${t.label || t.sel} on ${screen} and nothing happened (no change, no sound) for 1.2 s`);
    return t;
  }
  // press a piano key: on the Casio (fake mic) or on the screen keyboard
  async function key(v, m, hold = 150, viaMic = usingMic()) {
    if (viaMic) { await page.evaluate(([m, h]) => window.__kid.strike(m, h), [m, hold]); await page.waitForTimeout(hold); return; }
    // the screen may not show that octave: a kid presses the same letter they can see
    const k = v.keys.find((k) => k.m === m) || v.keys.filter((k) => (k.m - m) % 12 === 0).sort((a, b) => Math.abs(a.m - m) - Math.abs(b.m - m))[0];
    if (!k) { await note('missingkey', 'trouble', `${screen} ${noteName(m)}`, `Wanted to play ${noteName(m)} on ${screen} but no key with that letter is on the screen`); return; }
    if (k.reach !== 'ok') await note('keycovered', 'trouble', `${screen} ${noteName(k.m)}`, `The ${noteName(k.m)} key on ${screen} is ${k.reach}`);
    await tapBox({ x: k.x, y: k.y + k.h * 0.4, w: k.w, h: k.h * 0.6 }, hold);
  }
  const wrongNear = (m) => m + pick([-2, -1, 1, 2, 3]);

  /* things the kid notices on every screen */
  const seenWords = new Set();
  let lineSeen = 0;
  async function inspect(v) {
    if (v.turn) await note('turn', 'trouble', 'turn', 'The "turn me sideways" cover is showing');
    if (!v.overlay && v.screen !== 'home' && !v.taps.some((t) => (BACK.test(t.sel) || (v.screen === 'who' && t.sel === '[data-player]')) && t.reach === 'ok')) await note('deadend', 'trouble', `${v.screen}`, `No way back from ${v.screen}: no 🏠 or ⬅️ a kid can reach`);
    if (v.overlay && v.overlay !== '#start' && !v.taps.some((t) => t.reach === 'ok')) await note('deadend', 'bug', v.overlay, `${v.overlay} is showing with nothing to tap`);
    for (const t of v.taps) {
      if (t.reach !== 'ok' && !t.canScroll) await note('reach', 'trouble', `${v.screen} ${t.sel}`, `${t.label || t.sel} on ${v.screen} is ${t.reach} and can't be scrolled to`);
      if (t.reach === 'ok' && Math.min(t.w, t.h) < 40) await note('small', 'polish', `${v.screen} ${t.sel}`, `${t.label || t.sel} on ${v.screen} is ${Math.round(t.w)}×${Math.round(t.h)} px (under 40 px is hard for small fingers)`, { shot: false });
    }
    const minKey = Math.min(...v.keys.filter((k) => k.m % 12 !== 1 && k.m % 12 !== 3 && k.m % 12 !== 6 && k.m % 12 !== 8 && k.m % 12 !== 10).map((k) => k.w));
    if (v.keys.length && minKey < 30) await note('smallkeys', 'polish', v.screen, `White keys on ${v.screen} are only ${Math.round(minKey)} px wide`);
    for (const w of v.words) {
      const k = `${v.screen} ${w.text}`;
      if (w.n > 6 && !seenWords.has(k)) { seenWords.add(k); await note('words', 'polish', k, `${w.n} words to read on ${v.screen} (${w.sel}): "${w.text}"`, { shot: false }); }
    }
    // what the chicken said since last time
    const lines = await page.evaluate((i) => window.__kid.lines.slice(i), lineSeen);
    lineSeen += lines.length;
    for (const l of lines) {
      const text = l.text || (VOICE[l.id] && VOICE[l.id].text) || l.id;
      const n = (text.match(/[A-Za-z']{2,}/g) || []).length;
      diary.push(`${clock()} ${screen}: 🐔 "${text}"`);
      if (!l.clip) await note('noclip', 'polish', text, `Chicken line with no recorded voice (device voice instead): "${text}"`, { shot: false });
      if (n > 16) await note('longtalk', 'polish', text, `Long line for a ${kid.age}-year-old (${n} words, ${(l.ms / 1000).toFixed(1)} s): "${text}"`, { shot: false });
    }
  }

  /* mic: notes heard that nobody played, notes played that weren't heard */
  let micSeen = { h: 0, s: 0 };
  async function checkMic() {
    const k = await page.evaluate(() => ({ loudLog: window.__kid.loudLog, keyTaps: window.__kid.keyTaps, heard: window.__kid.heard, strikes: window.__kid.strikes, lines: window.__kid.lines, now: performance.now() }));
    const settled = k.now - 700;
    for (let i = micSeen.h; i < k.heard.length && k.heard[i].t < settled; i++, micSeen.h++) {
      const h = k.heard[i];
      const s = k.strikes.find((s) => s.t > h.t - 1500 && s.t < h.t + 100 && NAMES[((s.m % 12) + 12) % 12] === pcName(h.name));
      if (!s) {
        const talking = k.lines.some((l) => h.t >= l.t - 100 && h.t <= l.t + l.ms + 300);
        const own = k.keyTaps.find((x) => h.t - x.t < 3000 && h.t > x.t && NAMES[((x.m % 12) + 12) % 12] === pcName(h.name));
        if (own) { await note('ownnote', 'trouble', `${screen}`, `Tapped ${noteName(own.m)} on the screen (held ${own.held} ms) and ${Math.round(h.t - own.t)} ms later the mic heard the iPad's own ${h.name} from the speaker, so it counted twice`, { shot: false }); continue; }
        await note('phantom', 'trouble', `${screen} ${talking ? 'talk' : 'quiet'}`, `The mic heard ${h.name} on ${screen} but the kid didn't play it${talking ? ' (the chicken was talking)' : ' (maybe the app\'s own piano from the speaker)'}`, { shot: false });
      }
    }
    for (let i = micSeen.s; i < k.strikes.length && k.strikes[i].t < settled; i++, micSeen.s++) {
      const s = k.strikes[i];
      stats.strikes++;
      const heard = k.heard.some((h) => h.t > s.t - 50 && h.t < s.t + 700 && NAMES[((s.m % 12) + 12) % 12] === pcName(h.name));
      if (heard) stats.heard++;
      else {
        const talking = k.lines.some((l) => s.t >= l.t - 1200 && s.t <= l.t + l.ms + 300);
        // the app plays its own sounds (a cluck, the right note, a tune) and keeps the mic deaf until they fade
        const appSound = !talking && k.loudLog.some((t) => t > s.t - 1800 && t < s.t + 100);
        stats[talking ? 'missTalk' : appSound ? 'missApp' : 'miss']++;
        if (appSound) diary.push(`${clock()} ${screen}: (the app didn't hear that ${noteName(s.m)}: its own sound was still ringing)`);
        if (!talking && !appSound) { stats.missBy[screen] = (stats.missBy[screen] || 0) + 1; diary.push(`${clock()} ${screen}: (the app didn't hear that ${noteName(s.m)})`); }
      }
    }
  }
  const stats = { strikes: 0, heard: 0, miss: 0, missTalk: 0, missApp: 0, missBy: {}, screens: {}, eggs: 0 };

  /* ---------- the careful kid: a list of things to do, each played until done ---------- */
  // newest things first (rhythm lessons, the barnyard games, free play), then the rest; 'sel#n' = the n-th one
  const PLAN = [
    { goal: 'Egg Rush', route: ['[data-go=learn]', '[data-pick=rush]', '[data-game]'], screen: 'rush' },
    { goal: 'Echo Game', route: ['[data-go=learn]', '[data-pick=cluck]', '[data-game]'], screen: 'beat' },
    { goal: 'Clap and Play (rhythm lesson)', route: ['[data-go=learn]', '[data-go=map]', '[data-level]#3', '[data-lesson]#4'], screen: 'lesson' },
    { goal: 'Twinkle Twist', route: ['[data-go=learn]', '[data-pick=twinkle]', '[data-game]'], screen: 'beat' },
    { goal: 'Make and keep a song', route: ['[data-go=recs]', '[data-go=free]'], screen: 'free', free: true },
    { goal: 'Steps and Skips lesson', route: ['[data-go=learn]', '[data-go=map]', '[data-level]#2', '[data-lesson]#4'], screen: 'lesson' },
    { goal: 'Left Hand C lesson', route: ['[data-go=learn]', '[data-go=map]', '[data-level]#9', '[data-lesson]#3'], screen: 'lesson' },
    { goal: 'A song', route: ['[data-go=songs]', '[data-song]'], screen: 'play', extras: ['#btnHint', '#btnSpeed'] },
    { goal: 'Song with the beat', route: ['[data-go=songs]', '[data-song]'], screen: 'play', start: '#btnBeat' },
    { goal: 'Find it', route: ['[data-go=learn]', '[data-go=ears]', '[data-ear]'], screen: 'ear' },
    { goal: 'Lesson 1', route: ['[data-go=learn]', '[data-go=map]', '[data-level]', '[data-lesson]'], screen: 'lesson', next: 1 },
    { goal: 'Look at the coop', route: ['#coop'], screen: 'nest' },
  ];
  async function goHome() {
    for (let i = 0; i < 6; i++) {
      const v = await look();
      if (v.screen === 'home' && !v.overlay) return true;
      const b = v.taps.find((t) => /partyHome|data-go=home/.test(t.sel) && t.reach === 'ok') || v.taps.find((t) => BACK.test(t.sel) && t.reach === 'ok');
      if (!b) { await note('lost', 'trouble', v.screen + v.overlay, `Careful kid couldn't find the way home from ${v.overlay || v.screen}`); await page.evaluate(() => window.__cp.show('home')); return false; }
      await tap(b, 'going home');
    }
    return false;
  }
  async function follow(step) {
    for (const want of step.route) {
      const [sel, n = 1] = want.split('#').length > 1 && /#\d+$/.test(want) ? [want.replace(/#\d+$/, ''), +want.split('#').pop()] : [want];
      const v = await look();
      const opts = v.taps.filter((t) => t.sel === sel && !t.disabled);
      if (opts.length < n) { await note('lost', 'trouble', `${step.goal} ${want}`, `Looking for ${want} on ${v.screen} to get to ${step.goal}, but it isn't there`); return false; }
      // the first card is usually the right one for a beginner
      await tap(opts[n - 1], step.goal);
      screen = (await look()).screen;
      await page.waitForTimeout(between(kid.hesitate));
      const a = await look();
      if (a.overlay === '#ask.show') await tap(a.taps.find((t) => t.sel === '#askYes') || a.taps[0], 'yes please');
    }
    return true;
  }

  // play whatever is on screen like a kid who (mostly) knows the answer, until the party or time runs out
  async function playActivity(step, until) {
    let lastProgress = '', sameRight = 0, waited = 0, wrongRow = 0, tapsDone = new Set();
    const enteredAt = Date.now();
    let firstMoveAt = null;
    if (step.start) { const v = await look(); const b = v.taps.find((t) => t.sel === step.start); if (b) await tap(b, 'try it'); }
    while (Date.now() < until) {
      const v = await look();
      await inspect(v);
      await checkMic();
      if (v.overlay === '#party.show') {
        stats.eggs++;
        diary.push(`${clock()} ${v.screen}: 🎉 party`);
        const nx = step.next && step.next-- > 0 ? v.taps.find((t) => t.sel === '#partyNext') : null;
        if (nx) { await tap(nx, 'next one!'); step.screen = (await look()).screen; continue; }
        return true;
      }
      if (v.overlay) { await tap(v.taps.find((t) => /Yes|edYes|filmClose/.test(t.sel)) || v.taps[0]); continue; }
      if (v.screen !== step.screen) { await note('kicked', 'trouble', `${step.goal} ${v.screen}`, `While doing ${step.goal} the app moved to ${v.screen} by itself`); return false; }
      if (v.progress !== lastProgress) { lastProgress = v.progress; sameRight = 0; waited = 0; }
      const a = v.answer;
      if (step.extras) for (const sel of step.extras) if (!tapsDone.has(sel) && R() < 0.15) { tapsDone.add(sel); const b = v.taps.find((t) => t.sel === sel); if (b) await tap(b, 'what does this do?'); }
      if (!a || a.wait) {
        // the chicken is talking or playing: wait, but not forever
        const c = await counters();
        await page.waitForTimeout(500);
        const c2 = await counters();
        waited += 500;
        const quiet = c2.c === c.c && c2.s === c.s && c2.l === c.l;
        if (quiet && waited > 6000) { await note('quiet', 'trouble', `${step.goal} ${v.progress.split('|').pop()}`, `${step.goal}: kid waited ${(waited / 1000).toFixed(0)} s with nothing to do and nothing happening`); waited = -1e9; }
        if (!a && !v.keys.length) return false;
        if (!a && v.keys.length) await key(v, pick(v.keys).m, 200);
        continue;
      }
      if (firstMoveAt === null) {
        firstMoveAt = Date.now();
        const s = (firstMoveAt - enteredAt) / 1000;
        if (s > 9) await note('slowstart', 'polish', step.goal, `${step.goal}: ${s.toFixed(0)} s of listening before the kid could play anything`, { shot: false });
      }
      await page.waitForTimeout(between(kid.hesitate));
      if (a.tap) { const b = v.taps.find((t) => t.sel === a.tap); if (b) await tap(b, 'next'); else await note('lost', 'trouble', `${step.goal} ${a.tap}`, `${step.goal}: ${a.tap} should be there but isn't`); continue; }
      if (a.ans) {
        const choices = await page.evaluate(() => [...document.querySelectorAll('#lessonChoices [data-ans]')].map((b) => { const r = b.getBoundingClientRect(); return { ans: b.dataset.ans, x: r.x, y: r.y, w: r.width, h: r.height, reach: 'ok' }; }));
        const right = choices.find((c) => c.ans === a.ans);
        const c = R() < kid.accuracy || !choices.length ? right : pick(choices);
        if (!c) { await note('stuck', 'bug', `${step.goal} choice ${a.ans}`, `${step.goal}: the answer "${a.ans}" has no button`); return false; }
        diary.push(`${clock()} ${screen}: picks ${c.ans}${c === right ? '' : ' (wrong)'}`);
        await tapBox(c);
        await page.waitForTimeout(900);
        continue;
      }
      if (a.timed) {
        // play along on the beat: each note a little early or late, now and then one missed
        const viaMic = usingMic();
        diary.push(`${clock()} ${screen}: plays along with the beat (${a.timed.length} notes, ${viaMic ? 'Casio' : 'screen'})`);
        await page.evaluate(([items, jitter, acc, viaMic, seed]) => {
          let s = seed;
          const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
          const kb = document.querySelector('.screen.active .kb');
          items.forEach((it) => {
            if (r() > acc + 0.1) return;
            const m = it.m ?? 64;
            setTimeout(() => {
              if (viaMic) return window.__kid.strike(m, 180);
              const k = kb && (kb.querySelector(`[data-m="${m}"]`) || [...kb.querySelectorAll('[data-m]')].find((k) => (k.dataset.m - m) % 12 === 0));
              if (!k) return;
              const o = { bubbles: true, pointerId: 7, pointerType: 'touch' };
              k.dispatchEvent(new PointerEvent('pointerdown', o));
              setTimeout(() => k.dispatchEvent(new PointerEvent('pointerup', o)), 120);
            }, Math.max(0, it.at - performance.now() + (r() - 0.5) * 2 * jitter));
          });
        }, [a.timed, kid.jitter, kid.accuracy, viaMic, Math.floor(R() * 1e6) + 1]);
        const end = Math.max(...a.timed.map((x) => x.at)) - (await counters()).now;
        await page.waitForTimeout(Math.min(30000, Math.max(800, end + 1500)));
        diary.push(`${clock()} ${screen}: the chicken says ${await page.evaluate(() => document.querySelector('.screen.active .bubble')?.textContent)}`);
        continue;
      }
      if (a.notes) {
        const right = R() < kid.accuracy;
        // after two misses a careful kid asks the chicken for help
        if (!right) wrongRow++;
        if (wrongRow >= 2 && R() < 0.5) { const h = v.taps.find((t) => /btnHint|btnLessonHint/.test(t.sel)); if (h) { await tap(h, 'help!'); wrongRow = 0; continue; } }
        const ms = right ? a.notes : [wrongNear(a.notes[0])];
        const hold = kid.careful ? 150 + R() * 400 : 80 + R() * 1200;
        diary.push(`${clock()} ${screen}: plays ${ms.map(noteName).join('+')}${right ? '' : ' (oops)'}`);
        if (ms.length > 1 && !usingMic()) {
          // a chord with fingers: all keys down together
          await page.evaluate((ms) => { const kb = document.querySelector('.screen.active .kb'); ms.forEach((m, i) => { const k = kb.querySelector(`[data-m="${m}"]`); if (!k) return; const o = { bubbles: true, pointerId: 20 + i, pointerType: 'touch' }; k.dispatchEvent(new PointerEvent('pointerdown', o)); setTimeout(() => k.dispatchEvent(new PointerEvent('pointerup', o)), 250); }); }, ms);
        } else for (const m of ms) await key(v, m, hold);
        if (right) { wrongRow = 0; sameRight++; }
        await page.waitForTimeout(250);
        const after = await look();
        if (right && after.progress === v.progress) {
          if (sameRight >= 6) { await note('stuck', 'bug', `${step.goal} ${v.progress}`, `${step.goal}: played the right note (${ms.map(noteName).join('+')}) ${sameRight} times and the app didn't move on`); return false; }
        }
        continue;
      }
      return false;
    }
    await note('timeout', 'trouble', step.goal, `${step.goal}: not finished after ${Math.round((until - enteredAt) / 1000)} s of trying`);
    return false;
  }

  async function freePlay(until) {
    const tune = [60, 62, 64, 65, 67, 67, 69, 67, 65, 64, 62, 60];
    let v = await look();
    const rec = v.taps.find((t) => t.sel === '#freeRec');
    if (rec) await tap(rec, 'record');
    for (const m of tune) { if (Date.now() > until) break; v = await look(); await key(v, m, 200 + R() * 300); await page.waitForTimeout(150 + R() * 300); }
    v = await look();
    const stop = v.taps.find((t) => t.sel === '#freeRec');
    if (stop) await tap(stop, 'stop recording');
    await checkMic();
    const free = await page.evaluate(() => window.__cpFree().length);
    if (!free) await note('freeempty', 'bug', 'free', 'Played a tune in free play but no notes appeared on the staff');
    // back to My Songs: the new recording should be there and play
    v = await look();
    const back = v.taps.find((t) => t.sel === '[data-go=recs]');
    if (back) await tap(back, 'see my song');
    v = await look();
    const card = v.taps.find((t) => t.sel === '[data-rec]');
    if (!card) { await note('norec', 'bug', 'recs', 'Recorded a song but it is not in My Songs'); return; }
    await tap(card, 'my song!');
    v = await look();
    const playBtn = v.taps.find((t) => t.sel === '#recPlay');
    if (playBtn) { await tap(playBtn, 'listen'); await page.waitForTimeout(3000); }
  }

  async function careful(until) {
    const only = process.env.KID_GOALS ? new RegExp(process.env.KID_GOALS, 'i') : null;
    for (const step of PLAN.filter((s) => !only || only.test(s.goal))) {
      if (Date.now() > until - 20000) break;
      await goHome();
      screen = 'home';
      diary.push(`${clock()} — wants: ${step.goal}`);
      if (!(await follow(step))) continue;
      const v = await look();
      screen = v.screen;
      if (v.screen !== step.screen) { await note('lost', 'trouble', step.goal, `Followed the buttons to ${step.goal} but landed on ${v.overlay || v.screen}`); continue; }
      const stepEnd = Math.min(until, Date.now() + 150000);
      if (step.free) await freePlay(stepEnd);
      else if (step.screen === 'nest') { await inspect(v); await page.waitForTimeout(2500); }
      else await playActivity(step, stepEnd);
      await inspect(await look());
    }
  }

  /* ---------- the wild kid: taps whatever looks fun, quits whenever ---------- */
  async function wild(until) {
    let onScreenSince = Date.now(), last = '';
    while (Date.now() < until) {
      const v = await look();
      if (v.screen + v.overlay !== last) { last = v.screen + v.overlay; onScreenSince = Date.now(); screen = v.screen; diary.push(`${clock()} → ${v.overlay || v.screen}`); stats.screens[v.screen] = (stats.screens[v.screen] || 0) + 1; }
      await inspect(v);
      await checkMic();
      const okTaps = v.taps.filter((t) => t.reach === 'ok' && !t.disabled);
      const r = R();
      await page.waitForTimeout(between(kid.hesitate));
      if (v.overlay === '#editor.show') {
        // types a name (or doesn't), then OK
        if (R() < 0.6) { await page.fill('#edName', pick(['ZOE', 'bob', 'Chickn', '🐔🐔', 'aaaaaaaaaaaaaa'])).catch(() => {}); diary.push(`${clock()} editor: types a name`); }
        const av = await page.$$('#edAvatars [data-av]');
        if (av.length) await pick(av).click().catch(() => {});
        const ok = okTaps.find((t) => t.sel === '#edYes') || okTaps[0];
        if (ok) await tap(ok, 'done');
        continue;
      }
      // bored: leave whatever this is
      const bored = ACTIVITY.includes(v.screen) && Date.now() - onScreenSince > between([15000, 50000]);
      if (bored) { const b = okTaps.find((t) => BACK.test(t.sel)); if (b) { await tap(b, 'bored'); continue; } }
      if (v.keys.length && !v.overlay && r < 0.55) {
        const a = v.answer;
        const viaMic = usingMic();
        if (R() < 0.2) {
          // mash: lots of keys fast, sometimes the same one again and again
          const same = R() < 0.5, m0 = pick(v.keys).m;
          diary.push(`${clock()} ${screen}: mashes keys${same ? ' (same one)' : ''}${viaMic ? ' on the Casio' : ''}`);
          for (let i = 0; i < 3 + R() * 6; i++) await key(v, same ? m0 : pick(v.keys).m, 40 + R() * 60, viaMic);
        } else {
          const m = a && a.notes && R() < kid.accuracy ? a.notes[0] : pick(v.keys).m;
          const hold = R() < 0.2 ? 1000 + R() * 1500 : 80 + R() * 300;
          diary.push(`${clock()} ${screen}: plays ${noteName(m)}${hold > 900 ? ' and holds it' : ''}${viaMic ? ' on the Casio' : ''}`);
          await key(v, m, hold, viaMic);
        }
        continue;
      }
      if (r < 0.62 && R() < 0.3) { await page.waitForTimeout(2000 + R() * 5000); diary.push(`${clock()} ${screen}: looks out the window`); continue; }
      if (r < 0.66) {
        // presses and holds a button (the grown-up buttons open things on a long press)
        const b = pick(okTaps);
        if (b) { diary.push(`${clock()} ${screen}: holds ${b.label || b.sel}`); await tapBox(b, 2600); await page.waitForTimeout(800); }
        continue;
      }
      if (r < 0.70) { const x = R() * kid.view.width, y = R() * kid.view.height; await page.mouse.click(x, y); diary.push(`${clock()} ${screen}: pokes the screen`); continue; }
      // a fresh 6-year-old likes the big colorful ones; the chicken name tag gets a turn too
      const big = okTaps.filter((t) => t.w * t.h > 6000);
      const b = R() < 0.6 && big.length ? pick(big) : pick(okTaps);
      if (b) await tap(b, 'ooh');
      else if (!v.keys.length) await note('stuck', 'bug', `${v.screen} ${v.overlay}`, `Nothing to tap on ${v.overlay || v.screen}`);
    }
  }

  // hatch the egg
  {
    const startBox = await page.evaluate(() => { const r = document.querySelector('#start').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await tapBox(startBox);
    await page.waitForTimeout(1500);
    screen = (await look()).screen;
    diary.push(`${clock()} hatches the egg → ${screen}`);
  }
  if (kid.input !== 'screen') {
    const v = await look();
    const m = v.taps.find((t) => t.sel === '#mic');
    if (m) await tap(m, 'turn on the ears');
    await page.waitForTimeout(1500);
    const on = await page.evaluate(() => window.__kid.micOpened || 0);
    if (!on) await note('nomic', 'bug', 'mic', 'Tapped 🎤 but the app never opened the microphone');
  }
  const until = Date.now() + (kid.careful ? CAREFUL_SECONDS : SECONDS) * 1000;
  try {
    if (kid.careful) await careful(until); else await wild(until);
  } catch (e) {
    await note('crash', 'bug', String(e.message).split('\n')[0], `The robot kid itself got stuck: ${String(e.message).split('\n')[0]}`);
  }
  await checkMic().catch(() => {});
  const progress = await page.evaluate(() => { const p = window.__cp.progress; return { eggs: Object.values(p.eggs || {}).reduce((a, b) => a + b, 0), games: Object.values(p.games || {}).reduce((a, b) => a + b, 0), ears: Object.values(p.ears || {}).reduce((a, b) => a + b, 0), lessons: Object.keys(p.lessons || {}).length }; }).catch(() => ({}));
  await ctx.close();
  return { id, kid, findings: [...findings.values()], diary, stats, progress, seen: [...seen], seconds: Math.round((Date.now() - t0) / 1000) };
}

/* ---------- report ---------- */
const SEV = { bug: '🐞 Bug', trouble: '😣 Kid gets stuck or confused', polish: '✨ Polish' };
function report(runs) {
  let md = `# Robot kid playtest\n\nBuild: ${(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/class="ver">v ([^<]+)</) || [])[1]} · seed ${SEED} · ${SECONDS} s per kid\n\n`;
  for (const r of runs) {
    md += `## ${r.kid.name}\n\n${r.seconds} s, party screens: ${r.stats.eggs}, progress saved: ${JSON.stringify(r.progress)}\n`;
    if (r.stats.strikes) md += `\nCasio through the mic: ${r.stats.heard}/${r.stats.strikes} notes heard; missed ${r.stats.miss} with nothing else sounding ${JSON.stringify(r.stats.missBy)}, ${r.stats.missApp} while the app's own sound still rang, ${r.stats.missTalk} while the chicken talked (the mic is muted for both on purpose)\n`;
    for (const sev of Object.keys(SEV)) {
      const fs_ = r.findings.filter((f) => f.sev === sev);
      if (!fs_.length) continue;
      md += `\n### ${SEV[sev]} (${fs_.length})\n\n`;
      for (const f of fs_) md += `- ${f.text}${f.count > 1 ? ` (×${f.count})` : ''} — at ${f.at}${f.shot ? ` · [screenshot](${f.shot})` : ''}\n`;
    }
    md += `\n<details><summary>What the kid did</summary>\n\n${r.diary.map((d) => '    ' + d).join('\n')}\n\n</details>\n\n`;
  }
  const all = new Set(runs.flatMap((r) => r.seen));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const screens = [...html.matchAll(/<section id="(\w+)" class="screen/g)].map((m) => m[1]);
  md += `## Screens\n\nReached: ${[...all].join(', ')}\n\nNo kid got to: ${screens.filter((s) => !all.has(s)).join(', ') || 'none, every screen was reached'}\n`;
  fs.writeFileSync(path.join(OUT, 'report.md'), md);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(runs.map(({ diary, ...r }) => r), null, 1));
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const only = process.env.KID_ONLY ? process.env.KID_ONLY.split(',') : Object.keys(KIDS);
  const runs = [];
  for (const [i, id] of only.entries()) {
    process.stdout.write(`${KIDS[id].name} ... `);
    const r = await play(browser, url, id, KIDS[id], SEED * 1000 + i);
    runs.push(r);
    const n = (s) => r.findings.filter((f) => f.sev === s).length;
    console.log(`${r.seconds} s: ${n('bug')} bugs, ${n('trouble')} trouble spots, ${n('polish')} polish notes`);
  }
  await browser.close();
  srv.close();
  report(runs);
  const bugs = runs.flatMap((r) => r.findings.filter((f) => f.sev === 'bug'));
  for (const b of bugs) console.log(`BUG (${b.kid}): ${b.text}`);
  for (const t of runs.flatMap((r) => r.findings.filter((f) => f.sev === 'trouble'))) console.log(`trouble (${t.kid}): ${t.text}`);
  console.log(`report: ${path.relative(process.cwd(), path.join(OUT, 'report.md'))}`);
  process.exitCode = bugs.length ? 1 : 0;
})();
