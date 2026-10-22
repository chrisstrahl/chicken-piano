import { SONGS, LEVELS, PRAISE, COLORS, BEATS, letterOf, nameOf, isBlack, parse, songById, songsForLevel } from './music.js';
import { startAudio, playNote, noteDown, noteUp, playSequence, cluck, peck, bawk, silly, say, stopTalking } from './audio.js';
import { startMic, stopMic, micOn, micSupported, expectNote, micHealth } from './mic.js';
import { drawStaff, focusNote } from './staff.js';
import { makeKeyboard, LOW, HIGH } from './keyboard.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const pc = (m) => ((m % 12) + 12) % 12;
const ms = (tokens) => (tokens ? parse(tokens).filter((n) => !n.r).flatMap((n) => n.keys.map((k) => k.m)) : []);
const range = (tokens) => { const r = ms(tokens); return r.length ? [Math.min(...r), Math.max(...r)] : [LOW, HIGH]; };

/* ---------- progress (per device) ---------- */
const KEY = 'chicken-piano-v1';
let progress = { songs: {}, lessons: {}, letters: true, all: false };
try { progress = { ...progress, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) {} };
const totalEggs = () => Object.values(progress.songs).reduce((a, b) => a + b, 0) + Object.keys(progress.lessons).length;

// Progress: any level can be picked. The "current" level is the first one with lessons left, and the map
// points the chicken at it. Each lesson finished opens more of its level's songs: 1, 2, 3, then all 5.
const lessonsDone = (lv) => lv.lessons.filter((l) => progress.lessons[l.id]).length;
const levelDone = (lv) => lessonsDone(lv) === 4;
const currentLevel = () => (LEVELS.find((lv) => !levelDone(lv)) || LEVELS[9]).n;
const nextLesson = (lv) => lv.lessons.findIndex((l) => !progress.lessons[l.id]);
// progress.open[n]: a grown-up (or kid) chose to open every song in level n without doing its lessons
const songsOpenIn = (lv) => (progress.all || (progress.open || {})[lv.n] ? Infinity : [0, 1, 2, 3, Infinity][lessonsDone(lv)]);
const songOpen = (s) => songsForLevel(s.level).indexOf(s) < songsOpenIn(LEVELS[s.level - 1]);

/* ---------- chicken mascot ---------- */
const CHICKEN = `<svg class="chicken" viewBox="0 0 120 125" aria-hidden="true"><g class="ck-all"><g class="ck-body">
<circle cx="47" cy="29" r="8" fill="#ff4d4d"/><circle cx="60" cy="23" r="9.5" fill="#ff4d4d"/><circle cx="73" cy="29" r="8" fill="#ff4d4d"/>
<g class="ck-wl"><ellipse cx="22" cy="76" rx="11" ry="19" fill="#fff" stroke="#eadcc6" stroke-width="2.5"/></g>
<g class="ck-wr"><ellipse cx="98" cy="76" rx="11" ry="19" fill="#fff" stroke="#eadcc6" stroke-width="2.5"/></g>
<ellipse cx="60" cy="71" rx="40" ry="40" fill="#fff" stroke="#eadcc6" stroke-width="2.5"/>
<g class="ck-eyes"><circle cx="46" cy="58" r="6.5" fill="#2b1d0e"/><circle cx="74" cy="58" r="6.5" fill="#2b1d0e"/><circle cx="48.5" cy="55.5" r="2.2" fill="#fff"/><circle cx="76.5" cy="55.5" r="2.2" fill="#fff"/></g>
<circle cx="35" cy="72" r="6" fill="#ffb3c1" opacity=".8"/><circle cx="85" cy="72" r="6" fill="#ffb3c1" opacity=".8"/>
<path d="M51 66 L69 66 L60 79 Z" fill="#ffa31a" stroke="#e08600" stroke-width="2" stroke-linejoin="round"/>
<ellipse cx="60" cy="85" rx="4" ry="6" fill="#ff4d4d"/></g>
<g stroke="#ffa31a" stroke-width="4" stroke-linecap="round" fill="none"><path d="M48 109v10M48 119l-6 3M48 119l6 3M72 109v10M72 119l-6 3M72 119l6 3"/></g></g></svg>`;
$$('[data-chicken]').forEach((el) => { el.outerHTML = CHICKEN.replace('class="chicken"', `class="chicken"${el.id ? ` id="${el.id}"` : ''}`); });
function act(chicken, cls, ms = 700) {
  if (!chicken) return;
  chicken.classList.remove('happy', 'peck', 'oops');
  void chicken.getBoundingClientRect();
  chicken.classList.add(cls);
  clearTimeout(chicken._t);
  chicken._t = setTimeout(() => chicken.classList.remove(cls), ms);
}

/* ---------- small UI helpers ---------- */
function toast(msg, ms = 4000) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), ms);
}
// a colored letter ball; label lets a black key say B♭ instead of A♯
const bigLetter = (m, label) => `<span class="big${isBlack(m) ? ' blk' : ''}" style="background:${isBlack(m) ? '#555' : COLORS[letterOf(m)]}">${label || nameOf(m)}</span>`;
function bubble(el, html) { el.innerHTML = html; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function confetti(n = 28) {
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.textContent = pick(['🥚', '🪶', '🐥', '⭐', '🌽']);
    c.style.left = Math.random() * 100 + 'vw';
    c.style.animationDuration = 2 + Math.random() * 2 + 's';
    c.style.animationDelay = Math.random() * 0.8 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }
}
// A note object for a MIDI number (what free play and echo draw)
function noteOf(m, d = 'q') {
  const letter = letterOf(m);
  const acc = isBlack(m) ? '#' : '';
  const k = { m, letter, acc, oct: Math.floor(m / 12) - 1, label: nameOf(m) };
  return { m, keys: [k], d, letter, label: k.label, lyric: '' };
}

// Note names said out loud. A lone capital letter makes some voices say "capital C", so spell them as words.
const SPOKEN = { C: 'see', D: 'dee', E: 'ee', F: 'eff', G: 'gee', A: 'ay', B: 'bee' };
const spoken = (label) => SPOKEN[label[0]] + (label.includes('♯') || label.includes('#') ? ' sharp' : label.includes('♭') ? ' flat' : '');

/* ---------- screens and note input routing ---------- */
let current = 'home';
let onNote = null; // the active screen's handler for a played note
let onRelease = null; // ...and for a tapped key being let go
let leaveHooks = [];
let gen = 0; // bumps on every screen or step change, so late callbacks know they are stale
function show(id) {
  leaveHooks.forEach((f) => f());
  leaveHooks = [];
  stopTalking();
  gen++;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  current = id;
  onNote = null;
  onRelease = null;
  expectNote(null);
  ({ home: renderHome, songs: renderSongs, map: renderMap, level: renderLevel, free: openFree })[id]?.();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) show(b.dataset.go);
});
// iOS: unlock audio on the first touch anywhere
document.addEventListener('pointerdown', () => { startAudio(); }, { capture: true });

function keyUp(m) {
  noteUp(m);
  onRelease && onRelease(m);
}
function noteIn(m, source) {
  if (source === 'tap') noteDown(m);
  const hd = $('#mic .heard');
  if (source === 'mic') heardCount++;
  if (source === 'mic') { hd.textContent = nameOf(m); hd.style.background = isBlack(m) ? '#ddd' : COLORS[letterOf(m)]; }
  onNote && onNote(m, source);
}

/* ---------- microphone button ---------- */
const micBtn = $('#mic');
let lastQuietTip = 0;
let heardCount = 0;
// Grown-ups: hold the mic button for 1.5s to see what the microphone is doing (for bug reports).
{
  let t = null;
  micBtn.addEventListener('pointerdown', () => {
    t = setTimeout(() => {
      t = null;
      const h = micHealth();
      toast(`🎤 ${micOn() ? 'on' : 'off'} · audio ${h.ctx} · stream ${h.open ? 'open' : 'closed'} · heard ${heardCount} · fixes ${h.fixes}`, 8000);
    }, 1500);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => micBtn.addEventListener(ev, () => clearTimeout(t)));
}
micBtn.addEventListener('click', async () => {
  await startAudio();
  if (micOn()) { stopMic(); micBtn.classList.remove('on'); $('#mic .ic').textContent = '🎤'; return; }
  if (!micSupported()) { toast('🎤 This browser can’t use the microphone here. Tap the keys instead!'); return; }
  try {
    await startMic({
      onNote: (m) => noteIn(m, 'mic'),
      onLevel: (v, quietMs) => {
        $('#mic .lvl i').style.width = Math.round(v * 100) + '%';
        // nothing loud enough for 20s while waiting for notes: the tablet is probably too far from the piano
        if (quietMs > 20000 && ['play', 'lesson'].includes(current) && performance.now() - lastQuietTip > 120000) {
          lastQuietTip = performance.now();
          toast('🐔👂 Clucky can’t hear the piano well. Move the tablet closer, or play a little louder!', 6000);
        }
      },
    });
    micBtn.classList.add('on');
    $('#mic .ic').textContent = '👂';
    cluck(2);
  } catch (e) {
    console.warn(e);
    toast('🎤 Clucky can’t hear here. Tap the keys on screen instead!', 6000);
  }
});

/* ---------- HOME ---------- */
function renderHome() {
  $('#homeLevel').textContent = `⭐ ${currentLevel()}`;
  const eggs = totalEggs();
  const chicks = Math.floor(eggs / 3);
  const left = eggs % 3;
  const shown = Math.min(chicks, 24);
  $('#coop').innerHTML = `<span class="lbl">🏡 ${eggs ? `${eggs}🥚` : ''}</span>${'🐥'.repeat(shown)}${chicks > shown ? `<b>+${chicks - shown}</b>` : ''}${'🥚'.repeat(left)}${eggs === 0 ? '<span style="opacity:.5">🥚 🥚 🥚 → 🐥</span>' : ''}`;
}

// The coop: every egg earned (lessons, and up to 3 per song) goes here; 3 eggs hatch a chick.
$('#coop').addEventListener('click', () => {
  const eggs = totalEggs();
  act($('#home .chicken'), 'happy');
  cluck(2);
  say(eggs ? `This is your chicken coop! You have ${eggs} eggs. Every three eggs hatch a baby chick. Win more eggs in lessons and songs!`
    : 'This is your chicken coop! Win eggs in lessons and songs. Every three eggs hatch a baby chick!');
});

// First tap: browsers only allow sound after a tap, so the egg on the start screen hatches with a silly chicken noise.
$('#start').addEventListener('pointerdown', async () => {
  await startAudio();
  $('#start').classList.add('hatch');
  silly();
  setTimeout(() => $('#start').remove(), 700);
  setTimeout(() => act($('#home .chicken'), 'happy', 900), 500);
}, { once: true });

/* ---------- LEVEL MAP ---------- */
function renderMap() {
  const cur = currentLevel();
  $('#mapNodes').innerHTML = LEVELS.map((lv) => {
    const done = levelDone(lv);
    const state = done ? 'done' : lv.n === cur ? 'here' : lv.n > cur ? 'later' : '';
    return `<button class="node ${state}" data-level="${lv.n}" style="--lc:${lv.color}">
      <span class="num">${done ? '⭐' : lv.n}</span><span class="em">${lv.emoji}</span><span class="nm">${lv.title}</span>
      <span class="pips">${lv.lessons.map((l) => `<i class="${progress.lessons[l.id] ? 'on' : ''}"></i>`).join('')}</span></button>`;
  }).join('');
  const stars = LEVELS.filter(levelDone).length;
  $('#mapStars').innerHTML = LEVELS.map((lv) => `<i class="${levelDone(lv) ? 'on' : lv.n === cur ? 'cur' : ''}" style="--lc:${lv.color}"></i>`).join('') + `<b>⭐ ${stars}/10</b>`;
  $('#btnKey').classList.toggle('on', !!progress.all);
}
let levelN = 1;
$('#mapNodes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-level]');
  if (!b) return;
  levelN = +b.dataset.level;
  show('level');
});
// Grown-ups: hold the key for 2 seconds to open (or close) every level.
{
  const k = $('#btnKey');
  let t = null;
  const cancel = () => { clearTimeout(t); k.classList.remove('holding'); };
  k.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    k.classList.add('holding');
    t = setTimeout(() => {
      k.classList.remove('holding');
      progress.all = !progress.all;
      save();
      toast(progress.all ? '🔓 All songs are open (grown-up mode)' : '🔒 Songs open as lessons are done again');
      renderMap();
    }, 2000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => k.addEventListener(ev, cancel));
}

/* ---------- ONE LEVEL: 4 lessons, 5 songs ---------- */
const eggRow = (n) => [0, 1, 2].map((i) => `<span class="${i < n ? '' : 'no'}">🥚</span>`).join('');
function songCard(s) {
  if (!songOpen(s)) return `<button class="card song locked" data-song="${s.id}"><div class="em">🔒</div><div class="t">${s.title}</div></button>`;
  return `<button class="card song" data-song="${s.id}"><div class="em">${s.emoji}</div><div class="t">${s.title}</div><div class="eggs">${eggRow(progress.songs[s.id] || 0)}</div></button>`;
}
function renderLevel() {
  const lv = LEVELS[levelN - 1];
  $('#levelTitle').textContent = `${lv.emoji} Level ${lv.n}: ${lv.title}`;
  $('#level').style.setProperty('--lc', lv.color);
  const nx = nextLesson(lv);
  $('#levelLessons').innerHTML = lv.lessons.map((l, i) => {
    const done = progress.lessons[l.id];
    return `<button class="card lesson${i === nx ? ' next' : ''}${done ? ' done' : ''}" data-lesson="${l.id}"><div class="em">${l.emoji}</div>
      <div class="t">${l.title}</div><div class="badge">${done ? '✅' : i === nx ? '👉' : ''}</div></button>`;
  }).join('');
  $('#levelSongs').innerHTML = songsForLevel(lv.n).map(songCard).join('');
  $('#levelPrev').style.visibility = lv.n > 1 ? '' : 'hidden';
  $('#levelNext').style.visibility = lv.n < 10 ? '' : 'hidden';
  $('#levelNext').classList.toggle('pulse', levelDone(lv) && lv.n < 10);
}
$('#levelPrev').addEventListener('click', () => { levelN = Math.max(1, levelN - 1); renderLevel(); });
$('#levelNext').addEventListener('click', () => { levelN = Math.min(10, levelN + 1); renderLevel(); });
$('#levelLessons').addEventListener('click', (e) => {
  const c = e.target.closest('[data-lesson]');
  if (!c) return;
  const lv = LEVELS[levelN - 1];
  openLesson(lv.n, lv.lessons.findIndex((l) => l.id === c.dataset.lesson));
});
function songTap(e) {
  const c = e.target.closest('[data-song]');
  if (!c) return;
  const s = songById(c.dataset.song);
  if (!songOpen(s)) {
    cluck(1);
    return ask(`🔓 ${LEVELS[s.level - 1].emoji} ${s.level}`, `Open all the songs in level ${s.level}?`, () => {
      progress.open = { ...(progress.open || {}), [s.level]: true };
      save();
      if (current === 'level') renderLevel(); else renderSongs();
      openSong(s.id, current);
    });
  }
  openSong(s.id, current);
}
$('#levelSongs').addEventListener('click', songTap);

/* ---------- ALL SONGS ---------- */
function renderSongs() {
  $('#songCards').innerHTML = LEVELS.map((lv) => `<div class="lvrow" style="--lc:${lv.color}"><div class="lvtag">${lv.n}<small>${lv.emoji}</small></div>
    ${songsForLevel(lv.n).map(songCard).join('')}</div>`).join('');
}
$('#songCards').addEventListener('click', songTap);

/* ---------- PLAY A SONG ---------- */
const playKb = makeKeyboard($('#playKb'), (m) => noteIn(m, 'tap'), keyUp);
const P = { song: null, i: 0, mistakes: 0, missed: false, wrongRow: 0, drawn: null, stopDemo: null, back: 'songs' };
const playCard = $('#playStaff');
const playChicken = () => $('#playChicken');
const notesP = () => P.song.notes;
// rests and the second half of a tie need no key press
const skippable = (i) => notesP()[i] && (notesP()[i].r || (i > 0 && notesP()[i - 1].tie));
const matches = (n, m) => n.keys.some((k) => pc(k.m) === pc(m));

function setLetters() {
  const on = progress.letters;
  $('#btnLetters').classList.toggle('off', !on);
  playKb.setLetters(on ? 'all' : 'none');
  P.drawn && P.drawn.letterEls.forEach((g) => g && (g.style.display = on ? '' : 'none'));
}
$('#btnLetters').addEventListener('click', () => { progress.letters = !progress.letters; save(); setLetters(); });
$('#btnPlayBack').addEventListener('click', () => show(P.back));

function openSong(id, back = 'songs') {
  show('play');
  P.song = songById(id);
  P.back = back === 'level' ? 'level' : 'songs';
  levelN = P.song.level;
  $('#playTitle').textContent = `${P.song.emoji} ${P.song.title}`;
  const [lo, hi] = range(P.song.notes.filter((n) => !n.r).map((n) => n.keys.map((k) => `${k.letter}${k.acc}${k.oct}`).join(' ')).join(' '));
  playKb.setRange(lo, hi);
  P.drawn = drawStaff(playCard, P.song.notes, {
    scroll: true, lyrics: true, bars: P.song.bars !== false, clef: P.song.clef, time: P.song.time, pickup: P.song.pickup, onTap: jumpTo,
  });
  restartSong(true);
  onNote = playInput;
  leaveHooks.push(stopDemo);
  if (!micOn()) micBtn.classList.add('nudge'), setTimeout(() => micBtn.classList.remove('nudge'), 3200);
}
function restartSong(first) {
  stopDemo();
  P.i = 0; P.mistakes = 0; P.missed = false; P.wrongRow = 0;
  markUpTo(0);
  setLetters();
  settle();
  setCurrent();
  const n = notesP()[P.i];
  if (first) say(`Let's play ${P.song.title}! Start on ${spoken(n.label)}.`);
}
// grey out every note before i, un-grey the rest
function markUpTo(i) {
  const d = P.drawn;
  d.noteEls.forEach((e, j) => e && e.classList.toggle('done', j < i));
  [d.letterEls, d.lyricEls].forEach((list) => list.forEach((e, j) => e && e.classList.toggle('done', j < i)));
}
function markDone(i) {
  const d = P.drawn;
  [d.noteEls[i], d.letterEls[i], d.lyricEls[i]].forEach((e) => e && e.classList.add('done'));
}
// step over rests and tied notes; returns true if there was a rest
function settle() {
  let rest = false;
  while (P.i < notesP().length && skippable(P.i)) { rest = rest || notesP()[P.i].r; markDone(P.i); P.i++; }
  return rest;
}
function setCurrent(rest = false) {
  const n = notesP()[P.i];
  focusNote(playCard, P.drawn, P.i);
  $('#playProg').style.width = (P.i / notesP().length) * 100 + '%';
  expectNote(n ? n.m : null);
  if (!n) { playKb.setTarget(null); return; }
  playKb.setTarget(n.m);
  bubble($('#playBubble'), `${rest ? '🤫 ' : ''}👉 ${bigLetter(n.m, n.label)}`);
}
// Tap a note in the music to go back (or ahead) to it.
function jumpTo(i) {
  if (current !== 'play') return;
  stopDemo();
  P.i = i;
  P.missed = false; P.wrongRow = 0;
  markUpTo(i);
  settle();
  setCurrent();
  const n = notesP()[P.i];
  if (n) { playNote(n.keys.map((k) => k.m), 0.7); act(playChicken(), 'peck', 300); }
}
function playInput(m) {
  if (P.stopDemo) return;
  const n = notesP()[P.i];
  if (!n) return;
  if (matches(n, m)) {
    markDone(P.i);
    playKb.flash(n.m, 'good', 300);
    peck();
    act(playChicken(), 'peck', 300);
    P.i++; P.missed = false; P.wrongRow = 0;
    const rest = settle();
    if (P.i >= notesP().length) return finishSong();
    setCurrent(rest);
    if (P.i % 6 === 0 && !rest) { const x = notesP()[P.i]; bubble($('#playBubble'), `${pick(PRAISE)} 👉 ${bigLetter(x.m, x.label)}`); act(playChicken(), 'happy'); }
  } else {
    if (!P.missed) P.mistakes++;
    P.missed = true;
    P.wrongRow++;
    playKb.flash(m, 'bad', 500);
    act(playChicken(), 'oops');
    bubble($('#playBubble'), `${bigLetter(m)} 🙈 👉 ${bigLetter(n.m, n.label)}`);
    playCard.classList.remove('shake'); void playCard.offsetWidth; playCard.classList.add('shake');
    if (P.wrongRow === 2) say(`Oops! Find ${spoken(n.label)}.`);
  }
}
function finishSong() {
  playKb.setTarget(null);
  $('#playProg').style.width = '100%';
  const eggs = P.mistakes === 0 ? 3 : P.mistakes <= 3 ? 2 : 1;
  progress.songs[P.song.id] = Math.max(progress.songs[P.song.id] || 0, eggs);
  save();
  const list = songsForLevel(P.song.level);
  const nxt = list[list.indexOf(P.song) + 1];
  party(eggs, {
    again: () => openSong(P.song.id, P.back),
    next: () => (nxt && songOpen(nxt) ? openSong(nxt.id, P.back) : show('level')),
    words: eggs === 3 ? 'Perfect! Three eggs!' : `You did it! ${eggs} eggs!`,
  });
}
function stopDemo() {
  if (P.stopDemo) { P.stopDemo(); P.stopDemo = null; }
  $('#btnListen').textContent = '👂';
  act(playChicken(), 'happy', 1);
  playChicken()?.classList.remove('dance');
}
// Listen plays the song from where you are (or from the start once it's finished).
$('#btnListen').addEventListener('click', () => {
  if (P.stopDemo) { stopDemo(); setCurrent(); return; }
  stopTalking();
  $('#btnListen').textContent = '⏹️';
  playChicken().classList.add('dance');
  playKb.setTarget(null);
  const from = P.i < notesP().length ? P.i : 0;
  const part = notesP().slice(from);
  P.stopDemo = playSequence(part, P.song.tempo, (j) => {
    const n = part[j];
    focusNote(playCard, P.drawn, from + j);
    if (n.r) { bubble($('#playBubble'), '🤫'); return; }
    playKb.flash(n.m, 'hl', 350);
    bubble($('#playBubble'), `🎵 ${bigLetter(n.m, n.label)}`);
  }, () => { P.stopDemo = null; stopDemo(); setCurrent(); });
});
$('#btnRestart').addEventListener('click', () => restartSong(false));
window.addEventListener('resize', () => { if (current === 'play' && P.drawn) focusNote(playCard, P.drawn, P.i); });

/* ---------- yes / no question ---------- */
function ask(html, words, onYes) {
  $('#askText').innerHTML = html;
  $('#ask').classList.add('show');
  say(words);
  const close = () => { $('#ask').classList.remove('show'); stopTalking(); };
  $('#askYes').onclick = () => { close(); onYes(); };
  $('#askNo').onclick = close;
}

/* ---------- CELEBRATION ---------- */
function party(eggs, { again, next, words }) {
  $('#partyEggs').innerHTML = '<span>🥚</span>'.repeat(eggs) + '<span style="filter:grayscale(1) opacity(.25)">🥚</span>'.repeat(3 - eggs);
  $('#partyTitle').textContent = eggs === 3 ? 'BAWK-TASTIC!' : 'BAWK!';
  $('#party').classList.add('show');
  $('#partyChicken').classList.add('dance');
  bawk();
  confetti();
  setTimeout(() => say(words), 1300);
  const close = () => { $('#party').classList.remove('show'); $('#partyChicken').classList.remove('dance'); };
  $('#partyAgain').onclick = () => { close(); again(); };
  $('#partyNext').onclick = () => { close(); next(); };
  $('#partyHome').onclick = () => { close(); show('home'); };
}

/* ---------- LESSON PLAYER ---------- */
const lessonKb = makeKeyboard($('#lessonKb'), (m) => noteIn(m, 'tap'), keyUp);
const L = { lv: null, li: 0, step: 0, sub: 0, stopHear: null, locked: false, hits: 0, got: new Set(), done: false, echo: [], seqPos: 0 };
const lessonCard = $('#lessonStaff');
const lessonChicken = () => $('#lessonChicken');
const lesson = () => L.lv.lessons[L.li];
const stepObj = () => lesson().steps[L.step];
const round = () => stepObj().rounds[L.sub];

function openLesson(n, i) {
  show('lesson');
  L.lv = LEVELS[n - 1]; L.li = i; L.step = 0;
  levelN = n;
  onNote = lessonInput;
  leaveHooks.push(stopHear);
  renderStep();
}
function stopHear() { L.stopHear && L.stopHear(); L.stopHear = null; }
function hear(tokens, { tempo = 92, vel = 0.8, clap = false } = {}) {
  if (!tokens) return;
  stopHear();
  const notes = parse(tokens);
  act(lessonChicken(), 'happy');
  L.stopHear = playSequence(notes, tempo, (i) => {
    const n = notes[i];
    if (clap) cluck(1);
    if (!n.r) n.keys.forEach((k) => lessonKb.flash(k.m, 'down', 300));
  }, () => { L.stopHear = null; }, vel);
}
// say the step's words, then (optionally) play its music
function sayThen(text, after) {
  const g = gen;
  say(text, () => { if (g === gen && after) after(); });
}
function staff(tokens, s, extra = {}) {
  lessonCard.style.display = '';
  return drawStaff(lessonCard, tokens ? parse(tokens) : [], { minWidth: 420, clef: s.clef || 'treble', time: s.time || null, repeat: !!s.repeat, ...extra });
}
function keyboard(on, rangeTokens) {
  $('#lessonKb').parentElement.style.display = on ? '' : 'none';
  const [lo, hi] = rangeTokens ? range(rangeTokens) : [LOW, HIGH];
  lessonKb.setRange(lo, hi);
  lessonKb.reset();
}
function choices(html) {
  $('#lessonChoices').style.display = html ? '' : 'none';
  $('#lessonChoices').innerHTML = html || '';
}

function renderStep() {
  const les = lesson();
  const s = stepObj();
  gen++;
  stopHear();
  Object.assign(L, { sub: 0, locked: false, hits: 0, got: new Set(), done: false, echo: [], seqPos: 0 });
  expectNote(null);
  $('#lessonTitle').textContent = `${les.emoji} ${les.title}`;
  $('#lessonDots').innerHTML = les.steps.map((_, i) => `<i class="${i < L.step ? 'done' : i === L.step ? 'on' : ''}"></i>`).join('');
  $('#btnNext').style.display = 'none';
  $('#btnHear').style.display = s.hear || (s.type === 'choice' && s.rounds.some((r) => r.hear)) ? '' : 'none';
  lessonCard.style.display = 'none';
  choices('');
  ({ show: showStep, key: keyStep, seq: seqStep, name: namePrompt, beats: beatsPrompt, choice: choicePrompt })[s.type]();
}
function nextStep() {
  stopHear();
  if (L.step < lesson().steps.length - 1) { L.step++; renderStep(); return; }
  finishLesson();
}
function finishLesson() {
  const les = lesson();
  const lv = L.lv;
  const songsBefore = songsOpenIn(lv);
  const wasDone = levelDone(lv);
  progress.lessons[les.id] = true;
  save();
  const newSongs = songsForLevel(lv.n).slice(songsBefore, songsOpenIn(lv)).slice(0, 5);
  const newLevel = !wasDone && levelDone(lv) && lv.n < 10;
  let words = 'You did it! You got an egg!';
  if (newSongs.length) words += ` New song: ${newSongs.map((x) => x.title).join(', and ')}!`;
  if (newLevel) words += ` You finished level ${lv.n}! You got a star! Next is level ${lv.n + 1}.`;
  if (newSongs.length) setTimeout(() => toast(`🔓 ${newSongs.map((x) => `${x.emoji} ${x.title}`).join('  ')}`, 5000), 900);
  const nxt = lv.lessons[L.li + 1] && !progress.lessons[lv.lessons[L.li + 1].id] ? lv.lessons[L.li + 1] : null;
  party(1, {
    again: () => openLesson(lv.n, L.li),
    next: () => {
      if (newSongs.length) return openSong(newSongs[0].id, 'level');
      if (nxt) return openLesson(lv.n, L.li + 1);
      if (newLevel) { levelN = lv.n + 1; return show('level'); }
      show('level');
    },
    words,
  });
}
function stepDone() {
  L.done = true;
  expectNote(null);
  lessonKb.setTarget(null);
  act(lessonChicken(), 'happy');
  cluck(2);
  bubble($('#lessonBubble'), `✅ ${pick(PRAISE)}`);
  $('#btnNext').style.display = '';
}
$('#btnNext').addEventListener('click', nextStep);
$('#btnSay').addEventListener('click', () => say(stepObj().say));
$('#btnHear').addEventListener('click', () => {
  const s = stepObj();
  stopTalking();
  if (s.type === 'choice') { const r = round(); return hear(r.hear, { tempo: r.tempo, vel: r.vel }); }
  hear(s.hear, { clap: s.clap, vel: s.hearVel || 0.8 });
});
$('#btnLessonBack').addEventListener('click', () => show('level'));

/* show: explain, then do it. Every show step has a goal: play the glowing keys `times` times. */
const goalPcs = (s) => [...new Set(ms(s.goal).map(pc))];
const labelFor = (s, p) => { const k = parse(s.goal).flatMap((n) => n.keys).find((x) => pc(x.m) === p); return k ? k.label : nameOf(p); };
function needed(s) { const g = goalPcs(s); return { times: s.times || 1, distinct: Math.min(s.times || 1, g.length) }; }
function goalHtml(s) {
  const { times } = needed(s);
  return `<span class="goal">${Array.from({ length: times }, (_, i) => (i < L.hits ? '🐥' : '🥚')).join('')}</span>`;
}
function showStep() {
  const s = stepObj();
  const k = s.keys || {};
  keyboard(true, k.range);
  const hl = ms(k.hl);
  lessonKb.setHL(hl);
  lessonKb.setGroups(k.groups);
  lessonKb.setLetters(k.letters || 'all');
  if (k.fingers) lessonKb.setFingers(Object.fromEntries([...hl].sort((a, b) => a - b).map((m, i) => [m, i + 1])));
  if (s.staff !== undefined) staff(s.staff, s, { letters: !s.clap });
  const g = goalPcs(s);
  if (g.length === 1) expectNote(ms(s.goal)[0]);
  bubble($('#lessonBubble'), `${s.text} ${goalHtml(s)}`);
  sayThen(s.say, s.hear ? () => hear(s.hear, { clap: s.clap, vel: s.hearVel || 0.8 }) : null);
}
function showInput(m) {
  const s = stepObj();
  if (s.echo) {
    L.echo.push(noteOf(m, 'q'));
    if (L.echo.length > 8) L.echo.shift();
    lessonCard.style.display = '';
    drawStaff(lessonCard, L.echo, { minWidth: 420, clef: s.clef || 'treble' });
  }
  if (L.done) return;
  const g = goalPcs(s);
  if (g.includes(pc(m))) {
    lessonKb.flash(m, 'good', 400);
    act(lessonChicken(), 'peck', 300);
    L.hits++;
    L.got.add(pc(m));
    if (g.length >= 7) say(spoken(nameOf(m)));
    const { times, distinct } = needed(s);
    if (L.hits >= times && L.got.size >= distinct) return stepDone();
    // all the taps used up on the same key? wait for the missing ones
    if (L.hits >= times) L.hits = times - 1;
    const rest = g.filter((p) => !L.got.has(p));
    const hint = L.hits >= times - 1 && rest.length && L.got.size < distinct ? ` 👉 ${bigLetter(rest[0], labelFor(s, rest[0]))}` : '';
    bubble($('#lessonBubble'), `${bigLetter(m, labelFor(s, pc(m)))} ${goalHtml(s)}${hint}`);
  } else {
    lessonKb.flash(m, 'bad', 500);
    act(lessonChicken(), 'oops');
    const want = g.find((p) => !L.got.has(p)) ?? g[0];
    bubble($('#lessonBubble'), `${bigLetter(m)} 🙈 👉 ${bigLetter(want, labelFor(s, want))} ${goalHtml(s)}`);
  }
}

/* key: find each target, one at a time */
function keyStep() {
  const s = stepObj();
  keyboard(true, s.range);
  lessonKb.setLetters(s.letters || 'all');
  keyPrompt(true);
}
function keyPrompt(first) {
  const s = stepObj();
  const n = parse(s.targets)[L.sub];
  expectNote(n.m);
  bubble($('#lessonBubble'), `🎹 ${bigLetter(n.m, n.label)}`);
  if (first) sayThen(s.say); else say(spoken(n.label));
}
function keyInput(m) {
  const s = stepObj();
  const targets = parse(s.targets);
  const n = targets[L.sub];
  if (pc(m) === pc(n.m)) {
    lessonKb.flash(m, 'good', 500);
    quizRight(() => advanceSub(targets.length, () => keyPrompt(false)));
  } else {
    lessonKb.flash(m, 'bad', 500);
    bubble($('#lessonBubble'), `${bigLetter(m)} 🙈 👉 ${bigLetter(n.m, n.label)}`);
    quizWrong();
  }
}

/* seq: play a little tune in order */
function seqStep() {
  const s = stepObj();
  keyboard(true, s.range || s.seqs.join(' '));
  seqPrompt(true);
}
function seqPrompt(first) {
  const s = stepObj();
  const tune = parse(s.seqs[L.sub]);
  L.seqPos = 0;
  L.seqDrawn = staff(s.seqs[L.sub], s, { letters: true });
  lessonKb.setHL(tune.map((n) => n.m));
  seqTarget();
  if (first) sayThen(s.say);
}
function seqTarget() {
  const tune = parse(stepObj().seqs[L.sub]);
  const n = tune[L.seqPos];
  lessonKb.setTarget(n.m);
  expectNote(n.m);
  L.seqDrawn.cur.setAttribute('x', L.seqDrawn.xs[L.seqPos] - 22);
  L.seqDrawn.noteEls.forEach((e, j) => e && e.classList.toggle('done', j < L.seqPos));
  bubble($('#lessonBubble'), `${tune.map((x, j) => (j < L.seqPos ? '🐥' : j === L.seqPos ? bigLetter(x.m, x.label) : '🥚')).join('')}`);
}
function seqInput(m) {
  const s = stepObj();
  const tune = parse(s.seqs[L.sub]);
  const n = tune[L.seqPos];
  if (pc(m) === pc(n.m)) {
    lessonKb.flash(m, 'good', 300);
    peck();
    act(lessonChicken(), 'peck', 300);
    L.seqPos++;
    if (L.seqPos >= tune.length) { lessonKb.setTarget(null); return quizRight(() => advanceSub(s.seqs.length, () => seqPrompt(false))); }
    seqTarget();
  } else {
    lessonKb.flash(m, 'bad', 500);
    act(lessonChicken(), 'oops');
  }
}

/* name: what note is this? */
function namePrompt() {
  const s = stepObj();
  const n = parse(s.notes)[L.sub];
  if (L.sub === 0) { keyboard(true, s.range); lessonKb.setLetters('none'); sayThen(s.say); }
  expectNote(n.m);
  staff(`${n.letter}${n.keys[0].acc}${n.keys[0].oct}:w`, s, { letters: false });
  bubble($('#lessonBubble'), '🤔 ❓');
  const pool = [...s.pool];
  const others = shuffle(pool.filter((l) => l !== n.letter));
  const opts = pool.length <= 4 ? pool : shuffle([n.letter, ...others.slice(0, 2)]);
  choices(opts.map((l) => `<button class="choice" data-ans="${l}" style="color:${COLORS[l]}">${l}</button>`).join(''));
}
function nameAnswer(ans, btn) {
  const s = stepObj();
  const notes = parse(s.notes);
  const n = notes[L.sub];
  if (ans === n.letter) {
    btn && btn.classList.add('right');
    playNote(n.m, 0.8);
    quizRight(() => advanceSub(notes.length, namePrompt));
  } else {
    if (btn) { btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong'); }
    quizWrong();
  }
}

/* beats: how many beats does this note get? */
const BEAT_LABEL = (b) => (b === 0.5 ? '½' : String(b));
function beatsPrompt() {
  const s = stepObj();
  const d = s.durs[L.sub];
  if (L.sub === 0) { keyboard(false); sayThen(s.say); }
  staff(`G:${d}`, s, { letters: false });
  bubble($('#lessonBubble'), '👏 ❓');
  const right = BEATS[d];
  const all = [0.5, 1, 2, 3, 4];
  const opts = [right, ...shuffle(all.filter((b) => b !== right)).slice(0, 2)].sort((a, b) => a - b);
  choices(opts.map((b) => `<button class="choice" data-ans="${BEAT_LABEL(b)}">${BEAT_LABEL(b)}<small>${b >= 1 ? '👏'.repeat(b) : '👏½'}</small></button>`).join(''));
}

/* choice: look or listen, then pick */
function choicePrompt() {
  const s = stepObj();
  const r = round();
  const hl = ms(r.hl);
  keyboard(hl.length > 0, r.hl ? r.hl : null);
  if (hl.length) { lessonKb.setHL(hl); lessonKb.setLetters('none'); }
  if (r.staff !== undefined) staff(r.staff, { clef: r.clef, time: r.time, repeat: r.repeat }, { letters: false });
  else lessonCard.style.display = 'none';
  bubble($('#lessonBubble'), r.ask ? `<span class="ask">${r.ask}</span> = ❓` : r.hear ? '👂 ❓' : '🤔 ❓');
  choices(r.options.map((o) => `<button class="choice${o.length > 2 ? ' wide' : ''}" data-ans="${o}">${o}</button>`).join(''));
  const play = r.hear ? () => hear(r.hear, { tempo: r.tempo, vel: r.vel ?? 0.8 }) : null;
  if (L.sub === 0) sayThen(s.say, play);
  else if (play) { const g = gen; setTimeout(() => g === gen && play(), 500); }
}
function choiceAnswer(ans, btn) {
  const s = stepObj();
  if (ans === round().answer) {
    btn.classList.add('right');
    quizRight(() => advanceSub(s.rounds.length, () => { gen++; choicePrompt(); }));
  } else {
    btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
    quizWrong();
    if (round().hear) { const g = gen; setTimeout(() => g === gen && hear(round().hear, { tempo: round().tempo, vel: round().vel ?? 0.8 }), 700); }
  }
}

function quizRight(after) {
  L.locked = true;
  act(lessonChicken(), 'happy');
  cluck(2);
  bubble($('#lessonBubble'), `✅ ${pick(PRAISE)}`);
  const g = gen;
  setTimeout(() => { if (g !== gen) return; L.locked = false; after(); }, 1100);
}
function quizWrong() {
  act(lessonChicken(), 'oops');
  const s = stepObj();
  if (s.hint) say(s.hint);
}
function advanceSub(total, prompt) {
  L.sub++;
  if (L.sub >= total) nextStep(); else prompt();
}
$('#lessonChoices').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ans]');
  if (!b || L.locked) return;
  const s = stepObj();
  if (s.type === 'name') nameAnswer(b.dataset.ans, b);
  else if (s.type === 'beats') {
    if (b.dataset.ans === BEAT_LABEL(BEATS[s.durs[L.sub]])) { b.classList.add('right'); quizRight(() => advanceSub(s.durs.length, beatsPrompt)); }
    else { b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); quizWrong(); }
  } else if (s.type === 'choice') choiceAnswer(b.dataset.ans, b);
});
function lessonInput(m) {
  if (L.locked) return;
  const s = stepObj();
  if (s.type === 'show') showInput(m);
  else if (s.type === 'key') keyInput(m);
  else if (s.type === 'seq') seqInput(m);
  else if (s.type === 'name') { if (pc(m) === pc(parse(s.notes)[L.sub].m)) nameAnswer(parse(s.notes)[L.sub].letter, $(`#lessonChoices [data-ans="${parse(s.notes)[L.sub].letter}"]`)); else { lessonKb.flash(m, 'bad', 500); quizWrong(); } }
}

/* ---------- FREE PLAY ---------- */
const freeKb = makeKeyboard($('#freeKb'), (m) => noteIn(m, 'tap'), keyUp);
freeKb.setRange(48, 76);
const F = { notes: [], down: {} };
// How long a tapped key was held, as a note length (free play counts at 90 beats a minute)
const FREE_BEAT = 60000 / 90;
const lengthOf = (ms) => { const b = ms / FREE_BEAT; return b < 0.6 ? '8' : b < 1.5 ? 'q' : b < 2.5 ? 'h' : b < 3.5 ? 'hd' : 'w'; };
function drawFree() {
  // low notes read better on the bass staff
  const low = F.notes.filter((n) => n.m < 60).length > F.notes.length / 2;
  drawStaff($('#freeStaff'), F.notes, { minWidth: FREE_W, clef: low ? 'bass' : 'treble', pack: true });
}
const FREE_W = 560; // room for 8 notes, so the staff stays the same size as it fills
function openFree() {
  F.notes = [];
  drawStaff($('#freeStaff'), [], { minWidth: FREE_W, pack: true });
  bubble($('#freeBubble'), '🎹 🎤 ❓');
  F.down = {};
  onNote = (m, source) => {
    const n = noteOf(m);
    F.notes.push(n);
    if (F.notes.length > 8) F.notes.shift();
    // tapped keys start as quarter notes and get their real length when the finger lifts
    if (source === 'tap') F.down[m] = { n, t: performance.now() };
    drawFree();
    bubble($('#freeBubble'), bigLetter(m));
    freeKb.flash(m, 'hl', 600);
    act($('#freeChicken'), Math.random() < 0.3 ? 'happy' : 'peck', 500);
  };
  onRelease = (m) => {
    const d = F.down[m];
    if (!d) return;
    delete F.down[m];
    const len = lengthOf(performance.now() - d.t);
    if (len !== d.n.d && F.notes.includes(d.n)) { d.n.d = len; drawFree(); }
  };
}

/* ---------- computer keyboard (for grown-ups testing on a laptop) ---------- */
const KEYMAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76 };
document.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey) return;
  const m = KEYMAP[e.key.toLowerCase()];
  if (m) { startAudio(); [playKb, lessonKb, freeKb].forEach((kb) => kb.flash(m, 'down', 180)); noteIn(m, 'tap'); }
});
document.addEventListener('keyup', (e) => { const m = KEYMAP[e.key.toLowerCase()]; if (m) keyUp(m); });

renderHome();
window.__cp = { show, openSong, openLesson, noteIn, jumpTo, P, L, progress, LEVELS, SONGS };
window.__cpMs = ms;
window.__cpHeard = () => heardCount;
window.__cpFree = () => F.notes;
