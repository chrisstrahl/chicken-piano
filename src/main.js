import { SONGS, LESSONS, PRAISE, COLORS, BEATS, letterOf, nameOf, isBlack } from './music.js';
import { startAudio, playNote, playSequence, cluck, peck, bawk, say, stopTalking } from './audio.js';
import { startMic, stopMic, micOn, micSupported } from './mic.js';
import { drawStaff, focusNote } from './staff.js';
import { makeKeyboard } from './keyboard.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* ---------- progress (per device) ---------- */
const KEY = 'chicken-piano-v1';
let progress = { songs: {}, lessons: {}, letters: true };
try { progress = { ...progress, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) {} };
const totalEggs = () => Object.values(progress.songs).reduce((a, b) => a + b, 0) + Object.keys(progress.lessons).length;

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
const bigLetter = (m) => `<span class="big" style="background:${isBlack(m) ? '#555' : COLORS[letterOf(m)]}">${nameOf(m)}</span>`;
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

/* ---------- screens and note input routing ---------- */
let current = 'home';
let onNote = null; // the active screen's handler for a played note
let leaveHooks = [];
function show(id) {
  leaveHooks.forEach((f) => f());
  leaveHooks = [];
  stopTalking();
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  current = id;
  onNote = null;
  ({ home: renderHome, songs: renderSongs, learn: renderLessons, free: openFree })[id]?.();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) show(b.dataset.go);
});
// iOS: unlock audio on the first touch anywhere
document.addEventListener('pointerdown', () => { startAudio(); }, { capture: true });

function noteIn(m, source) {
  if (source === 'tap') playNote(m);
  const hd = $('#mic .heard');
  if (source === 'mic') { hd.textContent = nameOf(m); hd.style.background = isBlack(m) ? '#ddd' : COLORS[letterOf(m)]; }
  onNote && onNote(m, source);
}

/* ---------- microphone button ---------- */
const micBtn = $('#mic');
micBtn.addEventListener('click', async () => {
  await startAudio();
  if (micOn()) { stopMic(); micBtn.classList.remove('on'); $('#mic .ic').textContent = '🎤'; return; }
  if (!micSupported()) { toast('🎤 This browser can’t use the microphone here. Tap the keys instead!'); return; }
  try {
    await startMic({
      onNote: (m) => noteIn(m, 'mic'),
      onLevel: (v) => { $('#mic .lvl i').style.width = Math.round(v * 100) + '%'; },
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
  const eggs = totalEggs();
  const chicks = Math.floor(eggs / 3);
  const left = eggs % 3;
  $('#coop').innerHTML = `<span class="lbl">🏡</span>${'🐥'.repeat(chicks)}${'🥚'.repeat(left)}${eggs === 0 ? '<span style="opacity:.5">🥚 🥚 🥚 → 🐥</span>' : ''}`;
}

/* ---------- SONG LIST ---------- */
const eggRow = (n) => [0, 1, 2].map((i) => `<span class="${i < n ? '' : 'no'}">🥚</span>`).join('');
function renderSongs() {
  $('#songCards').innerHTML = SONGS.map((s) => {
    const used = [...new Set(s.notes.map((n) => letterOf(n.m)))].sort((a, b) => 'CDEFGAB'.indexOf(a) - 'CDEFGAB'.indexOf(b));
    const best = progress.songs[s.id] || 0;
    return `<button class="card" data-song="${s.id}"><div class="em">${s.emoji}</div><div><div class="t">${s.title}</div><div class="s">${s.sub}</div></div>
      <div class="dots">${used.map((l) => `<b style="background:${COLORS[l]}">${l}</b>`).join('')}</div><div class="eggs">${eggRow(best)}</div></button>`;
  }).join('');
}
$('#songCards').addEventListener('click', (e) => {
  const c = e.target.closest('[data-song]');
  if (c) openSong(c.dataset.song);
});

/* ---------- PLAY A SONG ---------- */
const playKb = makeKeyboard($('#playKb'), (m) => noteIn(m, 'tap'));
const P = { song: null, i: 0, mistakes: 0, missed: false, wrongRow: 0, drawn: null, stopDemo: null };
const playCard = $('#playStaff');
const playChicken = () => $('#playChicken');

function setLetters() {
  const on = progress.letters;
  $('#btnLetters').classList.toggle('off', !on);
  playKb.setLetters(on ? 'all' : 'none');
  P.drawn && P.drawn.letterEls.forEach((g) => (g.style.display = on ? '' : 'none'));
}
$('#btnLetters').addEventListener('click', () => { progress.letters = !progress.letters; save(); setLetters(); });

function openSong(id) {
  show('play');
  P.song = SONGS.find((s) => s.id === id);
  $('#playTitle').textContent = `${P.song.emoji} ${P.song.title}`;
  P.drawn = drawStaff(playCard, P.song.notes, { scroll: true, lyrics: true });
  restartSong(true);
  onNote = playInput;
  leaveHooks.push(stopDemo);
  if (!micOn()) micBtn.classList.add('nudge'), setTimeout(() => micBtn.classList.remove('nudge'), 3200);
}
function restartSong(first) {
  stopDemo();
  P.i = 0; P.mistakes = 0; P.missed = false; P.wrongRow = 0;
  P.drawn.noteEls.forEach((e) => e && e.classList.remove('done'));
  P.drawn.letterEls.concat(P.drawn.lyricEls).forEach((e) => e.classList.remove('done'));
  setLetters();
  setCurrent();
  const m = P.song.notes[0].m;
  if (first) say(`Let's play ${P.song.title}! Start on ${letterOf(m)}.`);
}
function setCurrent() {
  const n = P.song.notes[P.i];
  focusNote(playCard, P.drawn, P.i);
  $('#playProg').style.width = (P.i / P.song.notes.length) * 100 + '%';
  if (!n) { playKb.setTarget(null); return; }
  playKb.setTarget(n.m);
  bubble($('#playBubble'), `👉 ${bigLetter(n.m)}`);
}
function markDone(i) {
  const d = P.drawn;
  d.noteEls[i] && d.noteEls[i].classList.add('done');
  d.letterEls[i] && d.letterEls[i].classList.add('done');
  d.lyricEls[i] && d.lyricEls[i].classList.add('done');
}
function playInput(m) {
  if (P.stopDemo) return;
  const n = P.song.notes[P.i];
  if (!n) return;
  if (m % 12 === n.m % 12) {
    markDone(P.i);
    playKb.flash(n.m, 'good', 300);
    peck();
    act(playChicken(), 'peck', 300);
    P.i++; P.missed = false; P.wrongRow = 0;
    if (P.i >= P.song.notes.length) return finishSong();
    setCurrent();
    if (P.i % 6 === 0) { bubble($('#playBubble'), `${pick(PRAISE)} 👉 ${bigLetter(P.song.notes[P.i].m)}`); act(playChicken(), 'happy'); }
  } else {
    if (!P.missed) P.mistakes++;
    P.missed = true;
    P.wrongRow++;
    playKb.flash(m, 'bad', 500);
    act(playChicken(), 'oops');
    bubble($('#playBubble'), `${bigLetter(m)} 🙈 👉 ${bigLetter(n.m)}`);
    playCard.classList.remove('shake'); void playCard.offsetWidth; playCard.classList.add('shake');
    if (P.wrongRow === 2) say(`Oops! Find ${letterOf(n.m)}.`);
  }
}
function finishSong() {
  playKb.setTarget(null);
  $('#playProg').style.width = '100%';
  const eggs = P.mistakes === 0 ? 3 : P.mistakes <= 3 ? 2 : 1;
  progress.songs[P.song.id] = Math.max(progress.songs[P.song.id] || 0, eggs);
  save();
  const idx = SONGS.indexOf(P.song);
  party(eggs, {
    again: () => openSong(P.song.id),
    next: () => (idx < SONGS.length - 1 ? openSong(SONGS[idx + 1].id) : show('songs')),
    words: eggs === 3 ? 'Perfect! Three eggs!' : `You did it! ${eggs} eggs!`,
  });
}
function stopDemo() {
  if (P.stopDemo) { P.stopDemo(); P.stopDemo = null; }
  $('#btnListen').textContent = '👂';
  act(playChicken(), 'happy', 1);
  playChicken()?.classList.remove('dance');
}
$('#btnListen').addEventListener('click', () => {
  if (P.stopDemo) { stopDemo(); setCurrent(); return; }
  stopTalking();
  $('#btnListen').textContent = '⏹️';
  playChicken().classList.add('dance');
  playKb.setTarget(null);
  const stop = playSequence(P.song.notes, P.song.tempo, (i) => {
    focusNote(playCard, P.drawn, i);
    playKb.flash(P.song.notes[i].m, 'hl', 350);
    bubble($('#playBubble'), `🎵 ${bigLetter(P.song.notes[i].m)}`);
  }, () => { P.stopDemo = null; stopDemo(); setCurrent(); });
  P.stopDemo = stop;
});
$('#btnRestart').addEventListener('click', () => restartSong(false));
window.addEventListener('resize', () => { if (current === 'play' && P.drawn) focusNote(playCard, P.drawn, P.i); });

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

/* ---------- LESSON LIST ---------- */
function renderLessons() {
  $('#lessonCards').innerHTML = LESSONS.map((l, i) => `<button class="card" data-lesson="${i}"><div class="em">${l.emoji}</div>
    <div class="t">${l.title}</div><div class="done-badge">${progress.lessons[l.id] ? '✅' : '<span style="opacity:.25">🥚</span>'}</div></button>`).join('');
}
$('#lessonCards').addEventListener('click', (e) => {
  const c = e.target.closest('[data-lesson]');
  if (c) openLesson(+c.dataset.lesson);
});

/* ---------- LESSON PLAYER ---------- */
const lessonKb = makeKeyboard($('#lessonKb'), (m) => noteIn(m, 'tap'));
const L = { li: 0, step: 0, sub: 0, stopHear: null, locked: false };
const lessonCard = $('#lessonStaff');
const lessonChicken = () => $('#lessonChicken');

function openLesson(i) {
  show('lesson');
  L.li = i; L.step = 0;
  onNote = lessonInput;
  leaveHooks.push(() => { L.stopHear && L.stopHear(); L.stopHear = null; });
  renderStep();
}
function stepObj() { return LESSONS[L.li].steps[L.step]; }
function renderStep() {
  const les = LESSONS[L.li];
  const s = stepObj();
  L.sub = 0; L.locked = false;
  $('#lessonTitle').textContent = `${les.emoji} ${les.title}`;
  $('#lessonDots').innerHTML = les.steps.map((_, i) => `<i class="${i < L.step ? 'done' : i === L.step ? 'on' : ''}"></i>`).join('');
  const quiz = s.type !== 'info';
  $('#btnNext').style.display = quiz ? 'none' : '';
  $('#btnHear').style.display = s.hear ? '' : 'none';
  $('#lessonChoices').innerHTML = '';
  $('#lessonChoices').style.display = s.type === 'name' || s.type === 'beats' ? '' : 'none';

  // staff
  const staffNotes = s.type === 'name' ? [{ m: s.notes[0], d: 'w' }] : s.type === 'beats' ? [{ m: 67, d: s.durs[0] }] : s.staff;
  lessonCard.style.display = staffNotes ? '' : 'none';
  if (staffNotes) drawStaff(lessonCard, staffNotes, { letters: s.type === 'info' && s.staff && s.type !== 'beats' && !s.clap, minWidth: 420 });

  // keyboard
  const showKb = s.type === 'key' || !!s.keys;
  $('#lessonKb').parentElement.style.display = showKb ? '' : 'none';
  $('#lessonKb').parentElement.style.flex = staffNotes ? '' : '0 0 58%';
  lessonKb.reset();
  if (s.keys) {
    lessonKb.setHL(s.keys.hl || []);
    lessonKb.setGroups(s.keys.groups);
    lessonKb.setLetters(s.keys.letters || 'all');
  }
  if (s.type === 'key') { lessonKb.setLetters(s.letters || 'all'); }

  if (s.type === 'info') bubble($('#lessonBubble'), s.text);
  if (s.type === 'key') keyPrompt();
  if (s.type === 'name') namePrompt();
  if (s.type === 'beats') beatsPrompt();
  say(s.say);
}
function nextStep() {
  const les = LESSONS[L.li];
  L.stopHear && L.stopHear(); L.stopHear = null;
  if (L.step < les.steps.length - 1) { L.step++; renderStep(); return; }
  progress.lessons[les.id] = true;
  save();
  party(1, {
    again: () => openLesson(L.li),
    next: () => (L.li < LESSONS.length - 1 ? openLesson(L.li + 1) : show('learn')),
    words: 'You did it! You got an egg!',
  });
}
$('#btnNext').addEventListener('click', nextStep);
$('#btnSay').addEventListener('click', () => say(stepObj().say));
$('#btnHear').addEventListener('click', () => {
  const s = stepObj();
  if (!s.hear) return;
  stopTalking();
  L.stopHear && L.stopHear();
  act(lessonChicken(), 'happy');
  L.stopHear = playSequence(s.hear, 92, (i) => {
    lessonKb.flash(s.hear[i].m, 'down', 300);
    if (s.clap) cluck(1);
  }, () => { L.stopHear = null; });
});

function keyPrompt() {
  const s = stepObj();
  const m = s.targets[L.sub];
  bubble($('#lessonBubble'), `🎹 ${bigLetter(m)}`);
}
function namePrompt() {
  const s = stepObj();
  const m = s.notes[L.sub];
  drawStaff(lessonCard, [{ m, d: 'w' }], { letters: false, minWidth: 420 });
  bubble($('#lessonBubble'), '🤔 ❓');
  const pool = ['C', 'D', 'E', 'F', 'G'].filter((l) => l !== letterOf(m));
  const opts = [letterOf(m), ...pool.sort(() => Math.random() - 0.5).slice(0, 2)].sort(() => Math.random() - 0.5);
  $('#lessonChoices').innerHTML = opts.map((l) => `<button class="choice" data-ans="${l}" style="color:${COLORS[l]}">${l}</button>`).join('');
}
function beatsPrompt() {
  const s = stepObj();
  const d = s.durs[L.sub];
  drawStaff(lessonCard, [{ m: 67, d }], { letters: false, minWidth: 420 });
  bubble($('#lessonBubble'), '👏 ❓');
  $('#lessonChoices').innerHTML = [1, 2, 4].map((b) => `<button class="choice" data-ans="${b}">${b}<small>${'👏'.repeat(b)}</small></button>`).join('');
}
function quizRight(after) {
  L.locked = true;
  act(lessonChicken(), 'happy');
  cluck(2);
  bubble($('#lessonBubble'), `✅ ${pick(PRAISE)}`);
  setTimeout(() => { L.locked = false; after(); }, 1100);
}
function quizWrong(m) {
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
  const right = s.type === 'name' ? letterOf(s.notes[L.sub]) : String(BEATS[s.durs[L.sub]]);
  if (b.dataset.ans === right) {
    b.classList.add('right');
    if (s.type === 'name') playNote(s.notes[L.sub], 0.8);
    quizRight(() => advanceSub(s.type === 'name' ? s.notes.length : s.durs.length, s.type === 'name' ? namePrompt : beatsPrompt));
  } else {
    b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
    quizWrong();
  }
});
function lessonInput(m) {
  const s = stepObj();
  if (L.locked) return;
  if (s.type === 'key') {
    const target = s.targets[L.sub];
    if (m % 12 === target % 12) { lessonKb.flash(m, 'good', 500); quizRight(() => advanceSub(s.targets.length, keyPrompt)); }
    else { lessonKb.flash(m, 'bad', 500); bubble($('#lessonBubble'), `${bigLetter(m)} 🙈 👉 ${bigLetter(target)}`); quizWrong(m); }
  } else if (s.type === 'name') {
    const target = s.notes[L.sub];
    if (m % 12 === target % 12) { const b = $(`#lessonChoices [data-ans="${letterOf(target)}"]`); b && b.classList.add('right'); quizRight(() => advanceSub(s.notes.length, namePrompt)); }
    else quizWrong(m);
  } else if (s.keys) {
    // free exploring during an info step
  }
}

/* ---------- FREE PLAY ---------- */
const freeKb = makeKeyboard($('#freeKb'), (m) => noteIn(m, 'tap'));
const F = { notes: [] };
function openFree() {
  F.notes = [];
  drawStaff($('#freeStaff'), [], { minWidth: 420 });
  bubble($('#freeBubble'), '🎹 🎤 ❓');
  onNote = (m) => {
    F.notes.push({ m, d: 'q' });
    if (F.notes.length > 8) F.notes.shift();
    drawStaff($('#freeStaff'), F.notes, { minWidth: 420 });
    bubble($('#freeBubble'), bigLetter(m));
    freeKb.flash(m, 'hl', 600);
    act($('#freeChicken'), Math.random() < 0.3 ? 'happy' : 'peck', 500);
  };
}

/* ---------- computer keyboard (for grown-ups testing on a laptop) ---------- */
const KEYMAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76 };
document.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey) return;
  const m = KEYMAP[e.key.toLowerCase()];
  if (m) { startAudio(); [playKb, lessonKb, freeKb].forEach((kb) => kb.flash(m, 'down', 180)); noteIn(m, 'tap'); }
});

renderHome();
window.__cp = { show, openSong, openLesson, noteIn, P, L };
