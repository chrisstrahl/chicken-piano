// Runs inside the page: what the robot kid can see right now, and (for the kid who knows the answer) what the
// right next move is. Added after hooks.js.
(() => {
  const K = window.__kid;
  const vis = (el) => {
    if (!el || !el.isConnected) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.1) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const OVERLAYS = ['#start', '#party.show', '#ask.show', '#editor.show', '#recFilm.show'];
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  // the element a finger at (x, y) would land on is `el` (or inside it)
  const reachable = (el) => {
    const r = el.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return 'offscreen';
    const hit = document.elementFromPoint(x, y);
    return hit && (hit === el || el.contains(hit) || hit.closest('[data-m]') === el) ? 'ok' : 'covered';
  };
  // can the list it sits in scroll it into view?
  const scrollable = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (p.scrollHeight > p.clientHeight + 2 || p.scrollWidth > p.clientWidth + 2)) return true;
    }
    return false;
  };
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const nameOf = (el) => el.id ? '#' + el.id : el.dataset.go ? `[data-go=${el.dataset.go}]` : el.dataset.pick ? `[data-pick=${el.dataset.pick}]` : el.dataset.quiz ? `[data-quiz=${el.dataset.quiz}]`
    : Object.keys(el.dataset).length ? `[data-${Object.keys(el.dataset)[0]}]` : el.className ? '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase();

  K.look = () => {
    const cp = window.__cp;
    const overlay = OVERLAYS.find((s) => { const e = document.querySelector(s); return e && vis(e); }) || null;
    const screen = document.querySelector('.screen.active')?.id || null;
    const root = overlay ? document.querySelector(overlay) : document.querySelector('.screen.active');
    const turn = vis(document.querySelector('#turn'));
    const taps = [];
    if (root) {
      const els = [...root.querySelectorAll('button, [data-go], #coop')];
      if (!overlay) els.push(...['#mic', '#midi'].map((s) => document.querySelector(s)));
      for (const el of els) {
        if (!vis(el) || el.closest('.kb')) continue;
        const reach = reachable(el);
        taps.push({ sel: nameOf(el), label: label(el), ...box(el), reach, canScroll: reach !== 'ok' && scrollable(el), disabled: !!el.disabled });
      }
    }
    const kb = root && !overlay ? [...root.querySelectorAll('.kb')].find(vis) : null;
    const keys = kb ? [...kb.querySelectorAll('[data-m]')].map((k) => ({ m: +k.dataset.m, ...box(k), glow: k.classList.contains('target'), reach: reachable(k) })) : [];
    // words a kid would have to read (not note letters on keys, not the build stamp)
    const words = [];
    if (root) {
      for (const el of root.querySelectorAll('.bubble, h1, h2, h3, .btn, .card, .choice, .t, .today, .streak')) {
        if (!vis(el) || el.closest('.kb')) continue;
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
        const txt = (el.classList.contains('bubble') ? el.textContent : own).replace(/\s+/g, ' ').trim();
        if (txt) words.push({ sel: nameOf(el), text: txt.slice(0, 160), n: (txt.match(/[A-Za-z']{2,}/g) || []).length });
      }
    }
    // how far along the kid is: changes whenever the app thinks the kid moved forward
    let progress = `${screen}|${overlay}`;
    try {
      const { L, P, games, ears } = cp;
      if (screen === 'lesson') progress += `|${L.li}.${L.step}.${L.sub}.${L.seqPos}.${L.got && L.got.size}.${L.done}`;
      if (screen === 'play') progress += `|${P.e}.${P.i}.${P.mode}.${P.ph}`;
      if (screen === 'rush') progress += `|${games.R.pos}.${games.R.done}`;
      if (screen === 'beat') progress += `|${games.B.round}.${games.B.tries}.${games.B.done}`;
      if (screen === 'ear') progress += `|${ears.E.round}.${ears.E.pos}.${ears.E.done}`;
    } catch (e) {}
    return { micOn: document.querySelector('#mic').classList.contains('on'), screen, overlay, turn, taps, keys, words, progress, answer: answer(screen, overlay, keys) };
  };

  // What a kid who knows the answer does next: notes to play now, a button to press, or notes on a beat.
  function answer(screen, overlay, keys) {
    const cp = window.__cp;
    if (overlay) return null;
    const glow = keys.filter((k) => k.glow).map((k) => k.m);
    const timed = (j) => j && { timed: j.items.map((it) => ({ at: it.t, m: (j.notes[it.i].keys || [])[0]?.m })) };
    try {
      if (screen === 'lesson') {
        const { L } = cp, s = L.lv.lessons[L.li].steps[L.step], ms = window.__cpMs;
        const pc = (m) => ((m % 12) + 12) % 12;
        if (L.done) return { tap: '#btnNext' };
        if (L.locked) return { wait: true };
        if (s.type === 'show') { const g = ms(s.goal); const miss = g.find((m) => !L.got.has(pc(m))); return { notes: [miss ?? g[0]] }; }
        if (s.type === 'key') return { notes: [ms(s.targets)[L.sub]] };
        if (s.type === 'seq') return { notes: [ms(s.seqs[L.sub])[L.seqPos]] };
        if (s.type === 'name') return { notes: [ms(s.notes)[L.sub]] };
        if (s.type === 'beats') return { ans: { 8: '½', q: '1', h: '2', hd: '3', w: '4' }[s.durs[L.sub]] };
        if (s.type === 'choice') return { ans: s.rounds[L.sub].answer };
        if (s.type === 'rhythm') return L.judge ? timed(L.judge) : { wait: true };
      }
      if (screen === 'play') {
        const { P } = cp;
        if (P.judge) return timed(P.judge);
        if (P.mode) return glow.length ? { notes: glow } : { wait: true };
        const ev = P.events[P.e];
        return ev ? { notes: ev.need.map((k) => k.m) } : null;
      }
      if (screen === 'rush') { const R = cp.games.R; return R.ready && !R.done ? { notes: [R.notes[R.pos]] } : { wait: true }; }
      if (screen === 'beat') { const B = cp.games.B; return B.judge ? timed(B.judge) : { wait: true }; }
      if (screen === 'ear') { const E = cp.ears.E; return E.ready && !E.done ? { notes: [E.notes[E.pos]] } : { wait: true }; }
    } catch (e) { return { error: String(e) }; }
    return glow.length ? { notes: glow } : null;
  }
})();
