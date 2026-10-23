import { SONGS, LEVELS, PRAISE, COLORS, BEATS, letterOf, nameOf, isBlack, parse, songById, songsForLevel } from './music.js';
import { coop, openSongsAsk, letsPlay, oopsFind, songDone, lessonDone, noteWords, whoPlays, pickChicken, hello, removeAsk, SPEED_WORDS, BEAT_START, ECHO_START, ECHO_AGAIN } from './lines.js';
import { startAudio, playNote, noteDown, noteUp, playSequence, cluck, peck, bawk, silly, say, stopTalking, preloadVoice, startBeat } from './audio.js';
import { BeatJudge, phrases, SPEEDS, barBeats, peckEvery, MIC_LAG } from './beat.js';
import { startMic, stopMic, micOn, micSupported, expectNote, micHealth } from './mic.js';
import { startMidi, midiSupported, midiAllowed } from './midi.js';
import { drawStaff, focusX } from './staff.js';
import { makeKeyboard, LOW, HIGH } from './keyboard.js';
import { setupRecordings } from './recordings.js';
import { players, playerId, AVATARS, MAX_PLAYERS, avatarOf } from './profiles.js';
import { deletePlayerRecordings } from './recorder.js';
import { CHICKEN, lookOf, avatarChicken } from './chicken.js';
import { startOffline } from './offline.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const pc = (m) => ((m % 12) + 12) % 12;
const ms = (tokens) => (tokens ? parse(tokens).filter((n) => !n.r).flatMap((n) => n.keys.map((k) => k.m)) : []);
const range = (tokens) => { const r = ms(tokens); return r.length ? [Math.min(...r), Math.max(...r)] : [LOW, HIGH]; };

/* ---------- progress (per player, see profiles.js) ---------- */
const loadProgress = () => ({ songs: {}, lessons: {}, letters: true, all: false, ...players.progress() });
let progress = loadProgress();
const save = () => players.save(progress);
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
// the keys to press now; three or more (a chord with the other hand) get smaller circles
const needHtml = (need) => `<span class="keys${need.length > 2 ? ' many' : ''}">${need.map((k) => bigLetter(k.m, k.label)).join('')}</span>`;
function bubble(el, html) { el.innerHTML = html; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function confetti(n = 28) {
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.textContent = pick(['🥚', '🪶', '🐥', '🌽']);
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


/* ---------- screens and note input routing ---------- */
let current = 'home';
let onNote = null; // the active screen's handler for a played note
let onRelease = null; // ...and for a tapped key being let go
let leaveHooks = [];
let gen = 0; // bumps on every screen or step change, so late callbacks know they are stale
function show(id) {
  recs.leave(id);
  leaveHooks.forEach((f) => f());
  leaveHooks = [];
  stopTalking();
  gen++;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  current = id;
  onNote = null;
  onRelease = null;
  expectNote(null);
  ({ home: renderHome, who: renderWho, songs: renderSongs, map: renderMap, level: renderLevel, free: openFree, ...recs.screens })[id]?.();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) show(b.dataset.go);
});
// iOS: unlock audio on the first touch anywhere
document.addEventListener('pointerdown', () => { startAudio(); }, { capture: true });

function keyUp(m) {
  recs.up(m);
  noteUp(m);
  onRelease && onRelease(m);
}
// source: 'tap' (screen or computer keys), 'mic', or 'midi' (a USB keyboard, which makes its own sound).
// vel: 0..1, only known for MIDI.
function noteIn(m, source, vel) {
  if (source === 'mic' && midiNames.length) return; // a plugged-in keyboard is exact; don't let the mic second-guess it
  recs.down(m, source, vel);
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

/* ---------- USB keyboard (Web MIDI) ---------- */
// The 🎹 button only appears where the browser can talk to a keyboard (not iPad/iPhone Safari).
// First time: tap it to allow MIDI. After that it connects by itself whenever a keyboard is plugged in.
const midiBtn = $('#midi');
let midiNames = [];
let midiStarted = false;
let midiCount = 0;
async function connectMidi(asked) {
  if (midiStarted) return;
  try {
    await startMidi({
      onDown: (m, vel) => { midiCount++; [playKb, lessonKb, freeKb].forEach((kb) => kb.flash(m, 'down', 180)); noteIn(m, 'midi', vel); },
      onUp: (m) => keyUp(m),
      onChange: (names) => {
        const was = midiNames.length;
        midiNames = names;
        midiBtn.classList.toggle('on', !!names.length);
        document.body.classList.toggle('midi', !!names.length);
        if (names.length && !was) cluck(2);
        else if (!names.length && was && micOn()) toast('🎤 Keyboard unplugged. Clucky is listening with the microphone again.', 4000);
      },
    });
    midiStarted = true;
    if (asked && !midiNames.length) toast('🔌🎹 Plug the piano in with a USB cable!', 5000);
  } catch (e) {
    console.warn(e);
    if (asked) toast('🎹 The browser said no. Allow MIDI in the site settings, then tap 🎹 again.', 6000);
  }
}
if (midiSupported()) {
  midiBtn.classList.add('can');
  midiAllowed().then((ok) => ok && connectMidi(false));
}
// Grown-ups: hold 🎹 for 1.5s to see which keyboard is connected.
{
  let t = null, held = false;
  midiBtn.addEventListener('pointerdown', () => {
    held = false;
    t = setTimeout(() => { held = true; toast(`🎹 ${midiStarted ? 'allowed' : 'not allowed yet'} · ${midiNames.join(', ') || 'no keyboard'} · notes ${midiCount}`, 8000); }, 1500);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => midiBtn.addEventListener(ev, () => clearTimeout(t)));
  midiBtn.addEventListener('click', () => {
    if (held) return;
    startAudio();
    if (!midiStarted) connectMidi(true);
    else if (!midiNames.length) toast('🔌🎹 Plug the piano in with a USB cable!', 5000);
    else cluck(1);
  });
}

/* ---------- HOME ---------- */
function renderHome() {
  $('#homeLevel').textContent = currentLevel();
  const eggs = totalEggs();
  const chicks = LEVELS.filter(levelDone).length;
  $('#coop').innerHTML = `<span class="lbl">🏡</span><span class="cnt">🥚 ${eggs}</span>${chicks ? `<span class="cnt">${'🐥'.repeat(chicks)}</span>` : ''}`;
}

// The coop: eggs from lessons (1 each) and songs (up to 3 each), plus one chick for every finished level.
$('#coop').addEventListener('click', () => {
  const eggs = totalEggs();
  act($('#home .chicken'), 'happy');
  cluck(2);
  const chicks = LEVELS.filter(levelDone).length;
  say(coop(eggs, chicks));
});

// First tap: browsers only allow sound after a tap, so the egg on the start screen hatches with a silly chicken noise.
$('#start').addEventListener('pointerdown', async () => {
  await startAudio();
  $('#start').classList.add('hatch');
  silly();
  setTimeout(() => $('#start').remove(), 700);
  // two or more kids share the tablet: ask who is playing first
  if (players.list().length > 1) { show('who'); setTimeout(() => current === 'who' && say(whoPlays), 900); return; }
  setTimeout(() => act($('#home .chicken'), 'happy', 900), 500);
}, { once: true });

/* ---------- PLAYERS: who is playing? ---------- */
// Each kid has their own chicken (and eggs, chicks, open songs). Every chicken in the app wears the player's colors.
function lookLikePlayer() {
  const p = players.current();
  lookOf(p).split(';').forEach((d) => { const [k, v] = d.split(':'); document.documentElement.style.setProperty(k, v); });
  $('#btnWho').innerHTML = `${avatarChicken(p.avatar)}<span class="nm">${p.name}</span>`;
}
function usePlayer(id) {
  players.use(id);
  progress = loadProgress();
  window.__cp.progress = progress;
  lookLikePlayer();
}
$('#btnWho').addEventListener('click', () => { show('who'); say(whoPlays); });
function renderWho() {
  const cur = players.current().id;
  $('#players').innerHTML = players.list().map((p) => `<div class="player${p.id === cur ? ' cur' : ''}">
    <button class="pick" data-player="${p.id}">${avatarChicken(p.avatar)}<span class="nm">${p.name}</span></button>
    <button class="btn round edit" data-edit="${p.id}" aria-label="Change">✏️</button></div>`).join('')
    + (players.list().length < MAX_PLAYERS ? '<div class="player"><button class="pick add" data-edit="new" aria-label="New player"><span class="plus">➕</span></button></div>' : '');
}
function startAs(id) {
  usePlayer(id);
  show('home');
  act($('#home .chicken'), 'happy', 900);
  cluck(2);
  say(hello(players.current().name));
}
$('#players').addEventListener('click', (e) => {
  const ed = e.target.closest('[data-edit]');
  if (ed) return openEditor(ed.dataset.edit === 'new' ? null : ed.dataset.edit);
  const b = e.target.closest('[data-player]');
  if (b) startAs(b.dataset.player);
});
// New player, or change a player's chicken and name. Typing a name is optional: the chicken's own name is used.
const ED = { id: null, avatar: null };
function openEditor(id) {
  const p = players.list().find((x) => x.id === id);
  const used = players.list().map((x) => x.avatar);
  ED.id = p ? p.id : null;
  ED.avatar = p ? p.avatar : (AVATARS.find((a) => !used.includes(a.id)) || AVATARS[0]).id;
  $('#edName').value = p && p.name !== avatarOf(p).name ? p.name : '';
  $('#edDel').style.display = p && players.list().length > 1 ? '' : 'none';
  paintEditor();
  $('#editor').classList.add('show');
  say(pickChicken);
}
function paintEditor() {
  $('#edAvatars').innerHTML = AVATARS.map((a) => `<button class="avbtn${a.id === ED.avatar ? ' on' : ''}" data-av="${a.id}" aria-label="${a.name}">${avatarChicken(a.id)}</button>`).join('');
  $('#edName').placeholder = avatarOf(ED).name;
}
const closeEditor = () => { $('#editor').classList.remove('show'); $('#edName').blur(); stopTalking(); };
$('#edAvatars').addEventListener('click', (e) => {
  const b = e.target.closest('[data-av]');
  if (!b) return;
  ED.avatar = b.dataset.av;
  paintEditor();
  cluck(1);
  act($(`#edAvatars [data-av="${ED.avatar}"] .chicken`), 'happy');
});
$('#edNo').addEventListener('click', closeEditor);
$('#edYes').addEventListener('click', () => {
  closeEditor();
  if (!ED.id) { const p = players.add(ED.avatar, $('#edName').value); if (p) startAs(p.id); return; }
  players.update(ED.id, ED.avatar, $('#edName').value);
  if (ED.id === players.current().id) lookLikePlayer();
  renderWho();
});
$('#edDel').addEventListener('click', () => {
  const p = players.list().find((x) => x.id === ED.id);
  closeEditor();
  ask(`🗑️ ${avatarChicken(p.avatar, 'mini')} ${p.name}`, removeAsk(p.name), () => {
    players.remove(p.id);
    usePlayer(players.current().id);
    renderWho();
  });
});

// Fade the bottom of a scrolling list while there's more below.
function moreHint(el) {
  const upd = () => el.classList.toggle('more', el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  el.addEventListener('scroll', upd, { passive: true });
  window.addEventListener('resize', upd);
  return upd;
}
const moreLevel = moreHint($('#level .lvbody'));
const moreSongs = moreHint($('#songCards'));

/* ---------- LEVEL MAP ---------- */
function renderMap() {
  const cur = currentLevel();
  $('#mapNodes').innerHTML = LEVELS.map((lv) => {
    const done = levelDone(lv);
    const state = done ? 'done' : lv.n === cur ? 'here' : lv.n > cur ? 'later' : '';
    return `<button class="node ${state}" data-level="${lv.n}" style="--lc:${lv.color}">
      <span class="num">${done ? '🐥' : lv.n}</span><span class="em">${lv.emoji}</span><span class="nm">${lv.title}</span>
      <span class="pips">${lv.lessons.map((l) => `<i class="${progress.lessons[l.id] ? 'on' : ''}"></i>`).join('')}</span></button>`;
  }).join('');
  const chicks = LEVELS.filter(levelDone).length;
  $('#mapStars').innerHTML = LEVELS.map((lv) => `<i class="${levelDone(lv) ? 'on' : lv.n === cur ? 'cur' : ''}" style="--lc:${lv.color}"></i>`).join('') + `<b>🐥 ${chicks}/10</b>`;
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
  $('#level .lvbody').scrollTop = 0;
  requestAnimationFrame(moreLevel);
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
    return ask(`🔓 ${LEVELS[s.level - 1].emoji} ${s.level}`, openSongsAsk(s.level), () => {
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
  requestAnimationFrame(moreSongs);
}
$('#songCards').addEventListener('click', songTap);

/* ---------- PLAY A SONG ---------- */
// A song is played as "events": each moment where the active hand(s) start a note. In two-hand mode an event
// can need two (or more) keys; taps and MIDI must press them all, the mic only needs one (it can't hear chords).
const playKb = makeKeyboard($('#playKb'), (m) => noteIn(m, 'tap'), keyUp);
const P = { song: null, e: 0, events: [], hands: 'rh', mistakes: 0, missed: false, wrongRow: 0, drawn: null, stopDemo: null, back: 'songs',
  // play-with-the-beat and echo follow the melody note by note (P.i)
  i: 0, mode: null, tok: null, beat: null, loop: null, judge: null, stopEcho: null, phrases: [], ph: 0, turn: false, echoWrong: 0 };
const playCard = $('#playStaff');
const playChicken = () => $('#playChicken');
const HANDS = { rh: '🫱', lh: '🫲', both: '🙌' };
const twoHands = () => !!(P.song && P.song.lh);

// [{ beat, items: [{ part: 'rh'|'lh', i, n }] }] for the hands being played
function buildEvents() {
  const map = new Map();
  const add = (notes, part) => {
    let beat = 0;
    notes.forEach((n, i) => {
      const cont = i > 0 && notes[i - 1].tie;
      if (!n.r && !cont) {
        const k = Math.round(beat * 1000);
        if (!map.has(k)) map.set(k, { beat, items: [] });
        map.get(k).items.push({ part, i, n });
      }
      beat += BEATS[n.d];
    });
  };
  if (P.hands !== 'lh' || !twoHands()) add(P.song.notes, 'rh');
  if (P.hands !== 'rh' && twoHands()) add(P.song.lh, 'lh');
  P.events = [...map.values()].sort((x, y) => x.beat - y.beat);
  P.events.forEach((ev) => { ev.need = ev.items.flatMap((it) => it.n.keys.map((k) => ({ ...k, part: it.part, i: it.i }))); });
}
const evNow = () => P.events[P.e];
const fingersOf = (part) => (part === 'lh' ? P.song.lhFingers : P.song.fingers) || [];
// a chord's fingers are listed lowest key first
const fingerFor = (k) => {
  const f = fingersOf(k.part)[k.i];
  if (!Array.isArray(f)) return f;
  const keys = (k.part === 'lh' ? P.song.lh : P.song.notes)[k.i].keys.map((x) => x.m).sort((a, b) => a - b);
  return f[keys.indexOf(k.m)];
};

function setLetters() {
  const on = progress.letters;
  $('#btnLetters').classList.toggle('off', !on);
  playKb.setLetters(on ? 'all' : 'none');
  [P.drawn, P.drawn && P.drawn.lh].forEach((d) => d && d.letterEls.forEach((g) => g && g.querySelectorAll('circle:not(.fing circle), text.lt:not(.fing text)').forEach((x) => { if (!x.closest('.fing')) x.style.display = on ? '' : 'none'; })));
}
$('#btnLetters').addEventListener('click', () => { progress.letters = !progress.letters; save(); setLetters(); });
$('#btnPlayBack').addEventListener('click', () => show(P.back));
$('#btnHands').addEventListener('click', () => {
  P.hands = { rh: 'lh', lh: 'both', both: 'rh' }[P.hands];
  progress.hands = P.hands;
  save();
  drawSong();
  restartSong(false);
  say({ rh: 'Right hand', lh: 'Left hand', both: 'Both hands!' }[P.hands]);
});

function drawSong() {
  const s = P.song;
  $('#btnHands').style.display = twoHands() ? '' : 'none';
  $('#btnHands').textContent = HANDS[P.hands];
  const toks = (ns) => (ns || []).filter((n) => !n.r).flatMap((n) => n.keys.map((k) => k.m));
  const all = toks(s.notes).concat(P.hands !== 'rh' ? toks(s.lh) : []);
  playKb.setRange(Math.min(...all), Math.max(...all));
  // On a phone the grand staff is tiny, so one hand alone gets just its own staff.
  // P.solo = 'lh' means the left hand is drawn (and followed by beat and echo modes) on its own.
  const grand = twoHands() && (P.hands === 'both' || playCard.clientHeight > 220);
  P.solo = twoHands() && !grand && P.hands === 'lh' ? 'lh' : null;
  if (P.solo) {
    P.drawn = drawStaff(playCard, s.lh, {
      scroll: true, lyrics: true, bars: s.bars !== false, clef: 'bass', time: s.time, pickup: s.pickup, onTapBeat: jumpToBeat,
      key: s.key && s.key !== 'C' ? s.key : null, sig: s.keySig, fingers: s.lhFingers,
    });
    buildEvents();
    return;
  }
  P.drawn = drawStaff(playCard, s.notes, {
    scroll: true, lyrics: true, bars: s.bars !== false, clef: s.clef, time: s.time, pickup: s.pickup, onTapBeat: jumpToBeat,
    key: s.key && s.key !== 'C' ? s.key : null, sig: s.keySig, lh: grand ? s.lh : null, chords: grand ? s.chords : null,
    fingers: s.fingers, lhFingers: s.lhFingers,
  });
  // the hand that isn't being played is greyed out
  const dim = (d, on) => d && [d.noteEls, d.letterEls].forEach((list) => list.forEach((e) => e && e.classList.toggle('dim', on)));
  dim(P.drawn, twoHands() && P.hands === 'lh');
  dim(P.drawn.lh, P.hands === 'rh');
  buildEvents();
}
function openSong(id, back = 'songs') {
  show('play');
  P.song = songById(id);
  P.back = back === 'level' ? 'level' : 'songs';
  // bass-clef songs have the melody in the left hand: start there unless both hands were picked
  const pref = progress.hands || 'rh';
  P.hands = !twoHands() ? 'rh' : P.song.melodyHand === 'lh' && pref === 'rh' ? 'lh' : pref;
  levelN = P.song.level;
  $('#playTitle').textContent = `${P.song.emoji} ${P.song.title}`;
  drawSong();
  restartSong(true);
  onNote = playInput;
  leaveHooks.push(stopDemo, stopMode);
  setSpeedBtn();
  if (!micOn()) micBtn.classList.add('nudge'), setTimeout(() => micBtn.classList.remove('nudge'), 3200);
}
function restartSong(first) {
  stopDemo();
  stopMode();
  P.e = 0; P.i = 0; P.mistakes = 0; P.missed = false; P.wrongRow = 0;
  markUpTo(0);
  setLetters();
  setCurrent();
  const ev = evNow();
  if (first && ev) say(letsPlay(P.song.title, ev.need[0].label));
}
// grey out every note that starts before `beat`, un-grey the rest
function markUpTo(beat) {
  [P.drawn, P.drawn.lh].forEach((d) => {
    if (!d) return;
    d.beats.forEach((b, j) => [d.noteEls[j], d.letterEls[j], d.lyricEls[j]].forEach((e) => e && e.classList.toggle('done', b < beat - 1e-6)));
  });
}
function setCurrent() {
  const ev = evNow();
  $('#playProg').style.width = (P.e / Math.max(1, P.events.length)) * 100 + '%';
  if (!ev) { focusX(playCard, P.drawn, null); playKb.setTarget(null); playKb.setFingers({}); expectNote(null); return; }
  ev.got = new Set();
  markUpTo(ev.beat);
  focusX(playCard, P.drawn, P.drawn.beatX(ev.beat));
  expectNote(ev.need[0].m);
  playKb.setTarget(ev.need.map((k) => k.m));
  playKb.setFingers(Object.fromEntries(ev.need.map((k) => [k.m, fingerFor(k)]).filter((x) => x[1])));
  bubble($('#playBubble'), `👉 ${needHtml(ev.need)}`);
}
// Beat and echo modes step through the melody one note at a time.
// They follow the hand being played, or the melody when both are.
const modeHand = () => (!twoHands() ? 'rh' : P.hands === 'both' ? P.song.melodyHand : P.hands);
const notesP = () => (modeHand() === 'lh' ? P.song.lh : P.song.notes);
const melDrawn = () => (modeHand() === 'lh' && P.drawn.lh ? P.drawn.lh : P.drawn);
const focusMel = (i) => focusX(playCard, P.drawn, melDrawn().xs[i]);
const skippable = (i) => notesP()[i] && (notesP()[i].r || (i > 0 && notesP()[i - 1].tie));
const matches = (n, m) => n.keys.some((k) => pc(k.m) === pc(m));
const markDone = (i) => [melDrawn().noteEls[i], melDrawn().letterEls[i], melDrawn().lyricEls[i]].forEach((e) => e && e.classList.add('done'));
// step over rests and tied notes
function settle() {
  while (P.i < notesP().length && skippable(P.i)) { markDone(P.i); P.i++; }
}
// Tap the music to go back (or ahead) to that spot.
function jumpToBeat(beat) {
  if (current !== 'play' || P.mode) return;
  stopDemo();
  const e = P.events.findIndex((ev) => ev.beat >= beat - 1e-6);
  P.e = e < 0 ? P.events.length - 1 : e;
  P.missed = false; P.wrongRow = 0;
  setCurrent();
  const ev = evNow();
  if (ev) { playNote(ev.need.map((k) => k.m), 0.7); act(playChicken(), 'peck', 300); }
}
function playInput(m, source) {
  if (P.mode === 'beat') return beatInput(m, source);
  if (P.mode === 'echo') return echoInput(m);
  if (P.stopDemo) return;
  const ev = evNow();
  if (!ev) return;
  const hit = ev.need.find((k) => pc(k.m) === pc(m) && !ev.got.has(k));
  if (hit) {
    ev.got.add(hit);
    playKb.flash(hit.m, 'good', 300);
    peck();
    act(playChicken(), 'peck', 300);
    if (source !== 'mic' && ev.got.size < ev.need.length) return;
    P.e++; P.missed = false; P.wrongRow = 0;
    if (P.e >= P.events.length) { markUpTo(1e9); return finishSong(); }
    const gap = evNow().beat - (ev.beat + Math.min(...ev.items.map((it) => BEATS[it.n.d])));
    setCurrent();
    if (gap > 0.01) bubble($('#playBubble'), `🤫 👉 ${needHtml(evNow().need)}`);
    else if (P.e % 6 === 0) { bubble($('#playBubble'), `${pick(PRAISE)} 👉 ${needHtml(evNow().need)}`); act(playChicken(), 'happy'); }
  } else if (!ev.need.some((k) => pc(k.m) === pc(m))) {
    if (!P.missed) P.mistakes++;
    P.missed = true;
    P.wrongRow++;
    playKb.flash(m, 'bad', 500);
    act(playChicken(), 'oops');
    bubble($('#playBubble'), `${bigLetter(m)} 🙈 👉 ${needHtml(ev.need)}`);
    playCard.classList.remove('shake'); void playCard.offsetWidth; playCard.classList.add('shake');
    if (P.wrongRow === 2) say(oopsFind(ev.need[0].label));
  }
}
function finishSong(eggs = P.mistakes === 0 ? 3 : P.mistakes <= 3 ? 2 : 1) {
  const mode = P.mode;
  stopMode();
  playKb.setTarget(null);
  playKb.setFingers({});
  $('#playProg').style.width = '100%';
  progress.songs[P.song.id] = Math.max(progress.songs[P.song.id] || 0, eggs);
  save();
  const rec = recs.finish({ open: false });
  const list = songsForLevel(P.song.level);
  const nxt = list[list.indexOf(P.song) + 1];
  party(eggs, {
    again: () => { openSong(P.song.id, P.back); if (mode === 'beat') startBeatMode(); if (mode === 'echo') startEcho(); },
    next: () => (nxt && songOpen(nxt) ? openSong(nxt.id, P.back) : show('level')),
    words: songDone(eggs),
    rec,
  });
}
function stopDemo() {
  if (P.stopDemo) { P.stopDemo(); P.stopDemo = null; }
  $('#btnListen').textContent = '👂';
  act(playChicken(), 'happy', 1);
  playChicken()?.classList.remove('dance');
}
// The notes of a part from `beat` on, with rests in front if its first note starts later (keeps hands in step).
// Returns { notes, beats } where beats[j] is when notes[j] starts.
function from(notes, beat) {
  let b = 0;
  const out = [];
  const beats = [];
  notes.forEach((n) => {
    if (b >= beat - 1e-6) { out.push(n); beats.push(b); }
    b += BEATS[n.d];
  });
  let gap = (beats[0] ?? beat) - beat;
  const lead = [];
  for (const [d, v] of [['h', 2], ['q', 1], ['8', 0.5]]) while (gap >= v - 1e-6) { lead.push({ r: true, d, keys: [] }); gap -= v; }
  let t = beat;
  const leadBeats = lead.map((n) => { const x = t; t += BEATS[n.d]; return x; });
  return { notes: lead.concat(out), beats: leadBeats.concat(beats) };
}
// Listen plays the song (both hands) from where you are, or from the start once it's finished.
$('#btnListen').addEventListener('click', () => {
  if (P.stopDemo) { stopDemo(); setCurrent(); return; }
  if (P.mode) { stopMode(); setCurrent(); }
  stopTalking();
  $('#btnListen').textContent = '⏹️';
  playChicken().classList.add('dance');
  playKb.setTarget(null);
  playKb.setFingers({});
  const start = P.e < P.events.length ? evNow().beat : 0;
  const r = from(P.song.notes, start);
  const tempo = P.song.tempo * speed();
  const stops = [];
  stops.push(playSequence(r.notes, tempo, (j) => {
    const n = r.notes[j];
    focusX(playCard, P.drawn, P.drawn.beatX(r.beats[j]));
    if (n.r) { bubble($('#playBubble'), '🤫'); return; }
    playKb.flash(n.m, 'hl', 350);
    bubble($('#playBubble'), `🎵 ${bigLetter(n.m, n.label)}`);
  }, () => { P.stopDemo = null; stopDemo(); setCurrent(); }, 0.8));
  if (twoHands()) {
    const l = from(P.song.lh, start);
    stops.push(playSequence(l.notes, P.song.tempo, (j) => { const n = l.notes[j]; if (!n.r) n.keys.forEach((k) => playKb.flash(k.m, 'hl', 350)); }, null, 0.55));
  }
  P.stopDemo = () => stops.forEach((f) => f());
});
// start over: back to the first note, mistakes forgiven
$('#btnRestart').addEventListener('click', () => {
  cluck(); act(playChicken(), 'happy');
  if (P.mode === 'beat') return startBeatMode();
  if (P.mode === 'echo') return startEcho();
  restartSong(false);
});

/* ---------- SPEED: snail, turtle, bunny ---------- */
// Slows down Listen, play-with-the-beat and echo. Remembered on this device.
const speed = () => (SPEEDS.includes(progress.speed) ? progress.speed : 1);
const SPEED_ICON = ['🐌', '🐢', '🐇'];
function setSpeedBtn() { $('#btnSpeed').textContent = SPEED_ICON[SPEEDS.indexOf(speed())]; }
$('#btnSpeed').addEventListener('click', () => {
  const k = (SPEEDS.indexOf(speed()) + SPEEDS.length - 1) % SPEEDS.length; // bunny → turtle → snail → bunny
  progress.speed = SPEEDS[k];
  save();
  setSpeedBtn();
  act(playChicken(), 'happy');
  // a running play-along starts over at the new speed; echo uses it from the next phrase
  if (P.mode === 'beat') return startBeatMode();
  if (!(P.mode === 'echo' && P.turn)) say(SPEED_WORDS[k]);
});

// Leaves play-with-the-beat or echo and goes back to plain "find the next note" playing.
function stopMode() {
  P.tok = null;
  if (P.beat) { P.beat.stop(); P.beat = null; }
  clearInterval(P.loop);
  P.loop = null;
  if (P.stopEcho) { P.stopEcho(); P.stopEcho = null; }
  P.mode = null; P.judge = null; P.turn = false;
  $('#btnBeat').classList.remove('on');
  $('#btnEcho').classList.remove('on');
  playChicken()?.classList.remove('dance');
  [P.drawn, P.drawn && P.drawn.lh].forEach((d) => d && [d.noteEls, d.letterEls, d.lyricEls].forEach((list) => list.forEach((e) => e && e.classList.remove('miss', 'later'))));
}
// start one of the modes from the top of the song; returns a token that goes stale when the mode stops
function startMode(mode) {
  stopTalking();
  restartSong(false);
  P.mode = mode;
  P.tok = {};
  $(mode === 'beat' ? '#btnBeat' : '#btnEcho').classList.add('on');
  playKb.setTarget(null);
  expectNote(null);
  return P.tok;
}

/* ---------- PLAY WITH THE BEAT ---------- */
// The chicken pecks the beat (one bar to count in), the song moves along in time, and each note is
// scored for the right key at the right moment. Eggs come from how many notes were on the beat.
function startBeatMode() {
  const tok = startMode('beat');
  const s = P.song;
  const bpm = s.tempo * speed(), beatMs = 60000 / bpm;
  const per = barBeats(s.time), every = peckEvery(s.time);
  const lead = per - (s.pickup || 0); // beats from the first peck to the first note
  bubble($('#playBubble'), '🥁 👂');
  say(BEAT_START, () => {
    if (tok !== P.tok) return;
    P.beat = startBeat({
      bpm, every,
      accent: (k) => (k * every) % per === 0,
      onBeat: (k) => {
        if (tok !== P.tok) return;
        act(playChicken(), 'peck', Math.min(280, beatMs * every * 0.6));
        const b = k * every;
        if (b < lead - 1e-6) {
          const n = Math.ceil(lead / every);
          bubble($('#playBubble'), `<span class="count">${Array.from({ length: n }, (_, j) => `<i class="${j === k ? 'on' : ''}">${j + 1}</i>`).join('')}</span>`);
        }
      },
    });
    P.judge = new BeatJudge(notesP(), beatMs, P.beat.t0 + lead * beatMs);
    P.shown = -1;
    P.loop = setInterval(beatLoop, 40);
  });
}
const GRADE = { good: '🎯', early: '👍', late: '👍' };
function paintJudge() {
  const j = P.judge;
  j.items.forEach((it) => {
    if (it.result === 'miss') { markDone(it.i); melDrawn().noteEls[it.i]?.classList.add('miss'); }
  });
}
function beatLoop() {
  const j = P.judge;
  if (!j) return;
  const now = performance.now();
  if (j.tick(now).length) paintJudge();
  if (j.done) return finishSong(j.eggs());
  const k = j.current(now);
  if (k === null || k === P.shown) return;
  // show the next note a moment before it's due
  const it = j.items[k];
  if (it.t - now > Math.max(600, j.beatMs)) return;
  P.shown = k;
  P.i = it.i;
  const n = notesP()[it.i];
  focusMel(it.i);
  playKb.setTarget(n.m);
  expectNote(n.m);
  $('#playProg').style.width = (it.i / notesP().length) * 100 + '%';
  bubble($('#playBubble'), `${P.grade ? `<span class="grade">${P.grade}</span> ` : ''}👉 ${bigLetter(n.m, n.label)}`);
  P.grade = '';
}
function beatInput(m, source) {
  const j = P.judge;
  if (!j) return; // still counting in
  const r = j.input(m, performance.now() - (source === 'mic' ? MIC_LAG : 0));
  if (!r) return;
  if (r.grade === 'wrong') { playKb.flash(m, 'bad', 400); act(playChicken(), 'oops'); return; }
  const i = j.items[r.k].i;
  markDone(i);
  paintJudge();
  playKb.flash(notesP()[i].m, 'good', 300);
  P.grade = GRADE[r.grade];
  if (r.grade === 'good') act(playChicken(), 'happy', 400);
  if (j.done) setTimeout(() => P.judge === j && finishSong(j.eggs()), 400);
}
$('#btnBeat').addEventListener('click', () => {
  if (P.mode === 'beat') { stopMode(); restartSong(false); return; }
  stopDemo();
  startBeatMode();
});

/* ---------- ECHO: the chicken plays a bit, you play it back ---------- */
function startEcho() {
  const tok = startMode('echo');
  P.phrases = phrases(notesP(), P.song);
  P.ph = 0;
  bubble($('#playBubble'), '🦜 👂');
  say(ECHO_START, () => tok === P.tok && echoPlay());
}
function echoPlay() {
  const tok = P.tok;
  const [a, b] = P.phrases[P.ph];
  const d = melDrawn();
  P.turn = false;
  P.echoWrong = 0;
  P.missed = false;
  markUpTo(d.beats[a]);
  [d.noteEls, d.letterEls, d.lyricEls].forEach((list) => list.forEach((e, j) => e && e.classList.toggle('later', j >= b)));
  playKb.setTarget(null);
  expectNote(null);
  $('#playProg').style.width = (a / notesP().length) * 100 + '%';
  playChicken().classList.add('dance');
  bubble($('#playBubble'), '🐔 🎵');
  const part = notesP().slice(a, b);
  P.stopEcho = playSequence(part, P.song.tempo * speed(), (j) => {
    focusMel(a + j);
    part[j].r || part[j].keys.forEach((k) => playKb.flash(k.m, 'hl', 350));
  }, () => {
    P.stopEcho = null;
    if (tok !== P.tok) return;
    playChicken().classList.remove('dance');
    P.i = a;
    settle();
    P.turn = true;
    focusMel(P.i);
    expectNote(notesP()[P.i].m);
    act(playChicken(), 'happy');
    bubble($('#playBubble'), '🐣 👉 🎹');
  });
}
function echoInput(m) {
  if (!P.turn) return;
  const [, b] = P.phrases[P.ph];
  const n = notesP()[P.i];
  if (matches(n, m)) {
    markDone(P.i);
    playKb.flash(n.m, 'good', 300);
    act(playChicken(), 'peck', 300);
    P.i++; P.missed = false;
    settle();
    if (P.i >= b) return echoPhraseDone();
    const x = notesP()[P.i];
    focusMel(P.i);
    expectNote(x.m);
    // after a slip, the glowing key shows the way; otherwise it's all by ear
    playKb.setTarget(P.echoWrong ? x.m : null);
    if (P.echoWrong) bubble($('#playBubble'), `👉 ${bigLetter(x.m, x.label)}`);
  } else {
    if (!P.missed) P.mistakes++;
    P.missed = true;
    P.echoWrong++;
    playKb.flash(m, 'bad', 500);
    act(playChicken(), 'oops');
    playCard.classList.remove('shake'); void playCard.offsetWidth; playCard.classList.add('shake');
    if (P.echoWrong >= 3) {
      // hear it again from the top of the phrase
      P.turn = false;
      const tok = P.tok;
      bubble($('#playBubble'), '🔁 👂');
      say(ECHO_AGAIN, () => tok === P.tok && echoPlay());
      return;
    }
    playKb.setTarget(n.m);
    bubble($('#playBubble'), `${bigLetter(m)} 🙈 👉 ${bigLetter(n.m, n.label)}`);
  }
}
function echoPhraseDone() {
  const tok = P.tok;
  P.turn = false;
  playKb.setTarget(null);
  expectNote(null);
  act(playChicken(), 'happy');
  cluck(2);
  bubble($('#playBubble'), `✅ ${pick(PRAISE)}`);
  setTimeout(() => {
    if (tok !== P.tok) return;
    P.ph++;
    if (P.ph >= P.phrases.length) finishSong();
    else echoPlay();
  }, 1200);
}
$('#btnEcho').addEventListener('click', () => {
  if (P.mode === 'echo') { stopMode(); restartSong(false); return; }
  stopDemo();
  startEcho();
});
window.addEventListener('resize', () => {
  if (current !== 'play' || !P.drawn) return;
  if (P.mode) return focusMel(P.i);
  const ev = evNow();
  focusX(playCard, P.drawn, ev ? P.drawn.beatX(ev.beat) : null);
});

/* ---------- record and share ---------- */
// Recordings are kept per player; a removed player's recordings go with them
const recs = setupRecordings({ show, toast, ask: (...a) => ask(...a), bubble, bigLetter, player: playerId });
players.onRemove(deletePlayerRecordings);
recs.button($('#playRec'), () => ({ title: P.song.title, emoji: P.song.emoji, song: P.song.id }));
recs.button($('#freeRec'), () => ({ title: 'My song', emoji: '🎹', song: null }));

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
// eggs won (a lesson gives 1, a song up to 3); chick: a level was just finished
// rec: a recording that just stopped with the song, to listen to from here
function party(eggs, { again, next, words, chick = false, rec = null }) {
  $('#partyEggs').innerHTML = chick ? '<span>🥚</span><span>🐣</span>'
    : '<span>🥚</span>'.repeat(eggs) + '<span style="filter:grayscale(1) opacity(.25)">🥚</span>'.repeat(3 - eggs);
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
  $('#partyRec').style.display = rec ? '' : 'none';
  $('#partyRec').onclick = () => { close(); recs.openRec(rec.id); };
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
  preloadVoice(lesson().steps.map((st) => [st.say, st.hint]));
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
  const notes = tokens ? parse(tokens) : [];
  // one or two notes get a short staff, so they're drawn big
  return drawStaff(lessonCard, notes, { minWidth: notes.length && notes.length <= 2 ? 240 : 420, clef: s.clef || 'treble', time: s.time || null, repeat: !!s.repeat, ...extra });
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
  const hatched = !wasDone && levelDone(lv);
  const newLevel = hatched && lv.n < 10;
  const words = lessonDone(newSongs.map((x) => x.title), hatched && lv.n);
  if (newSongs.length) setTimeout(() => toast(`🔓 ${newSongs.map((x) => `${x.emoji} ${x.title}`).join('  ')}`, 5000), 900);
  const nxt = lv.lessons[L.li + 1] && !progress.lessons[lv.lessons[L.li + 1].id] ? lv.lessons[L.li + 1] : null;
  party(1, {
    chick: hatched,
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
  return `<span class="goal">${Array.from({ length: times }, (_, i) => (i < L.hits ? '🥚' : '<i class="egg0">🥚</i>')).join('')}</span>`;
}
function showStep() {
  const s = stepObj();
  const k = s.keys || {};
  // without a range, make sure every highlighted key fits (F5 in Line Notes)
  keyboard(true, k.range || (k.hl && `${k.hl} C E5`));
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
    if (g.length >= 7) say(noteWords(nameOf(m)));
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
  if (first) sayThen(s.say); else say(noteWords(n.label));
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
  bubble($('#lessonBubble'), `${tune.map((x, j) => (j < L.seqPos ? '🥚' : j === L.seqPos ? bigLetter(x.m, x.label) : '<i class="egg0">🥚</i>')).join('')}`);
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
// Note lengths in free play, counted at 90 beats a minute. Short values come from how soon the NEXT note starts
// (a tap is always quick, so how long a finger rests on the glass says nothing about eighths); long values come
// from how long the key is held. Boundaries sit a bit below the halfway points (on a log scale), because
// children let go early: when in doubt, the longer note wins.
const FREE_BEAT = 60000 / 90;
const heldLength = (ms) => { const b = ms / FREE_BEAT; return b < 1.3 ? 'q' : b < 2.3 ? 'h' : b < 3.2 ? 'hd' : 'w'; };
const gapLength = (ms) => { const b = ms / FREE_BEAT; return b < 0.3 ? '16' : b < 0.6 ? '8' : 'q'; };
function drawFree() {
  // low notes read better on the bass staff
  const low = F.notes.filter((n) => n.m < 60).length > F.notes.length / 2;
  drawStaff($('#freeStaff'), F.notes, { minWidth: FREE_W, clef: low ? 'bass' : 'treble', pack: true });
}
const FREE_W = 560; // room for 8 notes, so the staff stays the same size as it fills
// Free play metronome: pecks at free play's own 90 beats a minute, so held notes come out the right length.
let freeBeat = null;
function stopFreeBeat() { if (freeBeat) freeBeat.stop(); freeBeat = null; $('#btnFreeBeat').classList.remove('on'); }
$('#btnFreeBeat').addEventListener('click', () => {
  if (freeBeat) return stopFreeBeat();
  $('#btnFreeBeat').classList.add('on');
  freeBeat = startBeat({ bpm: 90, onBeat: () => act($('#freeChicken'), 'peck', 250) });
});
function openFree() {
  leaveHooks.push(stopFreeBeat);
  F.notes = [];
  drawStaff($('#freeStaff'), [], { minWidth: FREE_W, pack: true });
  bubble($('#freeBubble'), '🎹 🎤 ❓');
  F.down = {};
  F.last = null;
  onNote = (m, source) => {
    const n = noteOf(m);
    const now = performance.now();
    // the note before this one was short if this one came quickly (and it wasn't held longer than a beat)
    const prev = F.last;
    if (prev && prev.n.d === 'q' && F.notes.includes(prev.n)) prev.n.d = gapLength(now - prev.t);
    F.last = { n, t: now };
    F.notes.push(n);
    if (F.notes.length > 8) F.notes.shift();
    // tapped (or USB keyboard) keys start as quarter notes and get their real length when the finger lifts
    if (source !== 'mic') F.down[m] = { n, t: now };
    drawFree();
    bubble($('#freeBubble'), bigLetter(m));
    freeKb.flash(m, 'hl', 600);
    act($('#freeChicken'), Math.random() < 0.3 ? 'happy' : 'peck', 500);
  };
  onRelease = (m) => {
    const d = F.down[m];
    if (!d) return;
    delete F.down[m];
    const len = heldLength(performance.now() - d.t);
    // only lengthen: a quick next note may already have made it shorter
    if (len !== 'q' && F.notes.includes(d.n)) { d.n.d = len; drawFree(); }
  };
}

/* ---------- computer keyboard (for grown-ups testing on a laptop) ---------- */
const KEYMAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76 };
const typing = (e) => e.target && e.target.tagName === 'INPUT';
document.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || typing(e)) return;
  const m = KEYMAP[e.key.toLowerCase()];
  if (m) { startAudio(); [playKb, lessonKb, freeKb].forEach((kb) => kb.flash(m, 'down', 180)); noteIn(m, 'tap'); }
});
document.addEventListener('keyup', (e) => { if (typing(e)) return; const m = KEYMAP[e.key.toLowerCase()]; if (m) keyUp(m); });

window.__cp = { recs, players, usePlayer, say, show, openSong, openLesson, noteIn, jumpToBeat, P, L, progress, LEVELS, SONGS, startBeatMode, startEcho };
window.__cpMs = ms;
window.__cpHeard = () => heardCount;
window.__cpFree = () => F.notes;
window.__cpMidi = () => ({ names: midiNames, started: midiStarted, count: midiCount });
lookLikePlayer();
renderHome();
startOffline();
