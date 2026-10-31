import { SONGS, LEVELS, PRAISE, COLORS, BEATS, letterOf, nameOf, isBlack, parse, songById, songsForLevel } from './music.js';
import { coop, openSongsAsk, letsPlay, oopsFind, songDone, lessonDone, noteWords, whoPlays, pickChicken, hello, removeAsk, originalName, dayEgg, dayTalk, SPEED_WORDS, BEAT_START, ECHO_START, ECHO_AGAIN, RHYTHM_TURN, RHYTHM_AGAIN, RHYTHM_GOOD, RHYTHM_OK, RHYTHM_HOLD, RHYTHM_SHH, LEARN_CATS, SPOT_START, SPOT_FASTER, SPOT_AGAIN, SPOT_FIXED } from './lines.js';
import { startAudio, playNote, noteDown, noteUp, playSequence, cluck, peck, bawk, silly, say, stopTalking, preloadVoice, startBeat } from './audio.js';
import { BeatJudge, phrases, SPEEDS, barBeats, peckEvery, timeline } from './beat.js';
import { struckAt, markTap, setLag } from './timing.js';
import { startMic, stopMic, micOn, micSupported, expectNote, micHealth } from './mic.js';
import { startMidi, midiSupported, midiAllowed } from './midi.js';
import { drawStaff, focusX } from './staff.js';
import { makeKeyboard, LOW, HIGH } from './keyboard.js';
import type { Keyboard } from './keyboard.ts';
import { setupRecordings } from './recordings.js';
import { setupEarTraining, earEggTotal } from './eartraining.js';
import { setupGames, gameEggTotal } from './games.js';
import { setupJam } from './jam.js';
import { setupQuizzes } from './quizgames.js';
import { setupFreshTunes } from './freshtunes.js';
import { setupParent } from './parent.js';
import { players, playerId, AVATARS, MAX_PLAYERS, avatarOf } from './profiles.js';
import { deletePlayerRecordings, listRecordings, makeRecorder, toTokens, guessTempo } from './recorder.js';
import { CHICKEN, lookOf, avatarChicken } from './chicken.js';
import { startOffline } from './offline.js';
import { addWin, streak, todayWins, calendar, DAILY_GOAL } from './streaks.js';
import type { Days } from './streaks.ts';
import type { Drawn, StaffOpts } from './staff.ts';
import type { Note, Pitch, Song, Level, LessonStep, NoteSource } from './types.ts';

type Hands = 'rh' | 'lh' | 'both';
type Part = 'rh' | 'lh';
type Sounding = Extract<Note, { m: number }>;
type Step<T extends LessonStep['type']> = Extract<LessonStep, { type: T }>;
// what a player has done, saved per player (profiles.ts)
type Progress = {
  songs: Record<string, number>; lessons: Record<string, boolean>; days: Days; letters: boolean; all: boolean;
  open?: Record<number, boolean>; hands?: Hands; clefFlip?: boolean; speed?: number; ears?: Record<string, number>;
  games?: Record<string, number>; rushBest?: Record<string, number>;
  missed?: Record<string, number>; // note name -> wrong keys when it was wanted (songs, Fresh Tunes), for the grown-ups' page
};
// a key to press now in a song, and which hand's note it belongs to
type Need = Pitch & { part: Part; i: number };
// a moment in a song where the hand(s) being played start notes
type SongEvent = { beat: number; items: { part: Part; i: number; n: Sounding }[]; need: Need[]; got: Set<Need> };
type DayWin = ReturnType<typeof addWin>;
// handles for the browser tests (test/*.cjs)
declare global {
  interface Window { __cp: { progress: Progress } & Record<string, unknown>; __cpMs: unknown; __cpHeard: unknown; __cpFree: unknown; __cpFreeTokens: unknown; __cpMidi: unknown }
}
type PartyOptions = { again: () => void; next: () => void; words: string | string[]; chick?: boolean; rec?: { id: string } | null; day?: DayWin | null };

// every element the app looks up is in index.html, so a lookup always finds it
const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const shuffle = <T>(a: T[]): T[] => a.map((x): [number, T] => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const pc = (m: number) => ((m % 12) + 12) % 12;
const ms = (tokens: string | null | undefined): number[] => (tokens ? parse(tokens).filter((n) => !n.r).flatMap((n) => n.keys.map((k) => k.m)) : []);
const range = (tokens: string): [number, number] => { const r = ms(tokens); return r.length ? [Math.min(...r), Math.max(...r)] : [LOW, HIGH]; };

/* ---------- progress (per player, see profiles.js) ---------- */
const loadProgress = (): Progress => ({ songs: {}, lessons: {}, days: {}, letters: true, all: false, ...players.progress() });
let progress = loadProgress();
const save = () => players.save(progress);
// a song or lesson was finished today (see streaks.ts)
const dayWin = () => { const r = addWin(progress.days); save(); return r; };
// counts a note the kid was looking for and missed (once per note), for the grown-ups' page
const missedNote = (label: string) => { progress.missed = { ...(progress.missed || {}), [label]: ((progress.missed || {})[label] || 0) + 1 }; };
const totalEggs = () => Object.values(progress.songs).reduce((a, b) => a + b, 0) + Object.keys(progress.lessons).length + earEggTotal(progress) + gameEggTotal(progress);

// Progress: any level can be picked. The "current" level is the first one with lessons left, and the map
// points the chicken at it. Each lesson finished opens more of its level's songs: 1, 2, 3, then all 5.
const lessonsDone = (lv: Level) => lv.lessons.filter((l) => progress.lessons[l.id]).length;
const levelDone = (lv: Level) => lessonsDone(lv) === 4;
const currentLevel = () => (LEVELS.find((lv) => !levelDone(lv)) || LEVELS[9]).n;
const nextLesson = (lv: Level) => lv.lessons.findIndex((l) => !progress.lessons[l.id]);
// progress.open[n]: a grown-up (or kid) chose to open every song in level n without doing its lessons
const songsOpenIn = (lv: Level) => (progress.all || (progress.open || {})[lv.n] ? Infinity : [0, 1, 2, 3, Infinity][lessonsDone(lv)]);
const songOpen = (s: Song) => songsForLevel(s.level).indexOf(s) < songsOpenIn(LEVELS[s.level - 1]);

/* ---------- chicken mascot ---------- */
$$('[data-chicken]').forEach((el) => { el.outerHTML = CHICKEN.replace('class="chicken"', `class="chicken"${el.id ? ` id="${el.id}"` : ''}`); });
function act(chicken: (Element & { _t?: ReturnType<typeof setTimeout> }) | null, cls: string, ms = 700) {
  if (!chicken) return;
  chicken.classList.remove('happy', 'peck', 'oops');
  void chicken.getBoundingClientRect();
  chicken.classList.add(cls);
  clearTimeout(chicken._t);
  chicken._t = setTimeout(() => chicken.classList.remove(cls), ms);
}

/* ---------- small UI helpers ---------- */
function toast(msg: string, ms = 4000) {
  const t = $<HTMLElement & { _t?: ReturnType<typeof setTimeout> }>('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), ms);
}
// a colored letter ball; label lets a black key say B♭ instead of A♯
const bigLetter = (m: number, label?: string) => `<span class="big${isBlack(m) ? ' blk' : ''}" style="background:${isBlack(m) ? '#555' : COLORS[letterOf(m)]}">${label || nameOf(m)}</span>`;
// the keys to press now; three or more (a chord with the other hand) get smaller circles
const needHtml = (need: Pitch[]) => `<span class="keys${need.length > 2 ? ' many' : ''}">${need.map((k) => bigLetter(k.m, k.label)).join('')}</span>`;
function bubble(el: HTMLElement, html: string) { el.innerHTML = html; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
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
function noteOf(m: number, d = 'q'): Sounding {
  const letter = letterOf(m);
  const acc = isBlack(m) ? '#' : '';
  const k = { m, letter, acc, oct: Math.floor(m / 12) - 1, label: nameOf(m) };
  return { m, keys: [k], d, letter, label: k.label, lyric: '' };
}


/* ---------- screens and note input routing ---------- */
let current = 'home';
let onNote: ((m: number, source: NoteSource) => void) | null = null; // the active screen's handler for a played note
let onRelease: ((m: number) => void) | null = null; // ...and for a tapped key being let go
let leaveHooks: (() => void)[] = [];
let gen = 0; // bumps on every screen or step change, so late callbacks know they are stale
function show(id: string) {
  recs.leave(id);
  ears.leave();
  games.leave();
  jam.leave();
  quizzes.leave();
  fresh.leave();
  leaveHooks.forEach((f) => f());
  leaveHooks = [];
  stopTalking();
  gen++;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  current = id;
  onNote = null;
  onRelease = null;
  expectNote(null);
  ({ home: renderHome, learn: renderLearn, who: renderWho, songs: renderSongs, map: renderMap, level: renderLevel, free: openFree, nest: renderNest, ...recs.screens, ...ears.screens, ...games.screens, ...jam.screens, ...quizzes.screens, ...fresh.screens, ...parent.screens } as Record<string, () => void>)[id]?.();
}
document.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-go]');
  if (b) show(b.dataset.go!);
});
// iOS: unlock audio on the first touch anywhere
document.addEventListener('pointerdown', () => { startAudio(); }, { capture: true });

function keyUp(m: number) {
  recs.up(m);
  noteUp(m);
  onRelease && onRelease(m);
}
// source: 'tap' (screen or computer keys), 'mic', or 'midi' (a USB keyboard, which makes its own sound).
// vel: 0..1, only known for MIDI.
function noteIn(m: number, source: NoteSource, vel?: number) {
  if (source === 'mic' && midiNames.length) return; // a plugged-in keyboard is exact; don't let the mic second-guess it
  recs.down(m, source, vel, struckAt(source, true));
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
  let t: ReturnType<typeof setTimeout> | null = null;
  micBtn.addEventListener('pointerdown', () => {
    t = setTimeout(() => {
      t = null;
      const h = micHealth();
      toast(`🎤 ${micOn() ? 'on' : 'off'} · audio ${h.ctx} · stream ${h.open ? 'open' : 'closed'} · heard ${heardCount} · fixes ${h.fixes}`, 8000);
    }, 1500);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => micBtn.addEventListener(ev, () => clearTimeout(t!)));
}
micBtn.addEventListener('click', async () => {
  await startAudio();
  if (micOn()) { stopMic(); micBtn.classList.remove('on'); $('#mic .ic').textContent = '🎤'; return; }
  if (!micSupported()) { toast('🎤 This browser can’t use the microphone here. Tap the keys instead!'); return; }
  try {
    await startMic({
      onNote: (m) => noteIn(m, 'mic'),
      onEnd: (m, at) => { recs.up(m, at, true); micEnd && micEnd(m, at); },
      onLevel: (v, quietMs) => {
        $('#mic .lvl i').style.width = Math.round(v * 100) + '%';
        // nothing loud enough for 20s while waiting for notes: the tablet is probably too far from the piano
        if (quietMs! > 20000 && ['play', 'lesson'].includes(current) && performance.now() - lastQuietTip > 120000) {
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
let midiNames: string[] = [];
let midiStarted = false;
let midiCount = 0;
async function connectMidi(asked: boolean) {
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
  midiAllowed().then((ok): unknown => ok && connectMidi(false));
}
// Grown-ups: hold 🎹 for 1.5s to see which keyboard is connected.
{
  let t: ReturnType<typeof setTimeout> | null = null, held = false;
  midiBtn.addEventListener('pointerdown', () => {
    held = false;
    t = setTimeout(() => { held = true; toast(`🎹 ${midiStarted ? 'allowed' : 'not allowed yet'} · ${midiNames.join(', ') || 'no keyboard'} · notes ${midiCount}`, 8000); }, 1500);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => midiBtn.addEventListener(ev, () => clearTimeout(t!)));
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
  $('#homeLevel').textContent = currentLevel() as unknown as string;
  const eggs = totalEggs();
  const chicks = LEVELS.filter(levelDone).length;
  const days = streak(progress.days);
  $('#coop').innerHTML = `<span class="lbl">🏡</span><span class="cnt">🥚 ${eggs}</span>${chicks ? `<span class="cnt">${'🐥'.repeat(chicks)}</span>` : ''}${days ? `<span class="cnt">🔥 ${days}</span>` : ''}`;
}
$('#coop').addEventListener('click', () => show('nest'));
// Learn: lessons, and the games that practise what they teach
function renderLearn() { $('#learnLevel').textContent = currentLevel() as unknown as string; }

// The coop: eggs from lessons (1 each) and songs (up to 3 each), one chick for every finished level,
// and the practice calendar: a day's egg is laid by finishing DAILY_GOAL songs or lessons that day.
const goalPips = (wins: number) => Array.from({ length: DAILY_GOAL }, (_, i) => `<i class="${i < wins ? 'on' : ''}"></i>`).join('');
function renderNest() {
  const eggs = totalEggs();
  const chicks = LEVELS.filter(levelDone).length;
  const days = streak(progress.days);
  const wins = todayWins(progress.days);
  const laid = wins >= DAILY_GOAL;
  $('#nestTotals').innerHTML = `<span>🥚 ${eggs}</span>${chicks ? `<span>${'🐥'.repeat(chicks)}</span>` : ''}`;
  $('#nestStreak').innerHTML = `<span class="fire${days ? '' : ' off'}">🔥</span><span class="n">${days}</span>`;
  $('#nestToday').innerHTML = laid ? '<span class="egg">🥚</span>' : `<span class="pips">${goalPips(wins)}</span>`;
  $('#nestCal').innerHTML = calendar(progress.days).map((row) => row.map((d) => `<div class="day${d.egg ? ' egg' : ''}${d.today ? ' today' : ''}${d.future ? ' future' : ''}">
    <span class="dt">${d.date}</span>${d.egg ? '<span class="em">🥚</span>' : d.today ? `<span class="pips">${goalPips(d.wins)}</span>` : ''}</div>`).join('')).join('');
  act($('#nest .chicken'), 'happy');
  cluck(2);
  say([...coop(eggs, chicks), ...dayTalk(days, laid, wins)]);
}

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
function usePlayer(id: string) {
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
function startAs(id: string) {
  usePlayer(id);
  show('home');
  act($('#home .chicken'), 'happy', 900);
  cluck(2);
  say(hello(players.current().name));
}
$('#players').addEventListener('click', (e) => {
  const ed = (e.target as Element).closest<HTMLElement>('[data-edit]');
  if (ed) return openEditor(ed.dataset.edit === 'new' ? null : ed.dataset.edit!);
  const b = (e.target as Element).closest<HTMLElement>('[data-player]');
  if (b) startAs(b.dataset.player!);
});
// New player, or change a player's chicken and name. Typing a name is optional: the chicken's own name is used.
// avatar is set by openEditor before the editor shows
const ED = { id: null, avatar: null } as unknown as { id: string | null; avatar: string };
function openEditor(id: string | null) {
  const p = players.list().find((x) => x.id === id);
  const used = players.list().map((x) => x.avatar);
  ED.id = p ? p.id : null;
  ED.avatar = p ? p.avatar : (AVATARS.find((a) => !used.includes(a.id)) || AVATARS[0]).id;
  $<HTMLInputElement>('#edName').value = p && p.name !== avatarOf(p).name ? p.name : '';
  $('#edDel').style.display = p && players.list().length > 1 ? '' : 'none';
  paintEditor();
  $('#editor').classList.add('show');
  say(pickChicken);
}
function paintEditor() {
  $('#edAvatars').innerHTML = AVATARS.map((a) => `<button class="avbtn${a.id === ED.avatar ? ' on' : ''}" data-av="${a.id}" aria-label="${a.name}">${avatarChicken(a.id)}</button>`).join('');
  $<HTMLInputElement>('#edName').placeholder = avatarOf(ED).name;
}
const closeEditor = () => { $('#editor').classList.remove('show'); $('#edName').blur(); stopTalking(); };
$('#edAvatars').addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-av]');
  if (!b) return;
  ED.avatar = b.dataset.av!;
  paintEditor();
  cluck(1);
  act($(`#edAvatars [data-av="${ED.avatar}"] .chicken`), 'happy');
});
$('#edNo').addEventListener('click', closeEditor);
$('#edYes').addEventListener('click', () => {
  closeEditor();
  if (!ED.id) { const p = players.add(ED.avatar, $<HTMLInputElement>('#edName').value); if (p) startAs(p.id); return; }
  players.update(ED.id, ED.avatar, $<HTMLInputElement>('#edName').value);
  if (ED.id === players.current().id) lookLikePlayer();
  renderWho();
});
$('#edDel').addEventListener('click', () => {
  const p = players.list().find((x) => x.id === ED.id)!;
  closeEditor();
  ask(`🗑️ ${avatarChicken(p.avatar, 'mini')} ${p.name}`, removeAsk(p.name), () => {
    players.remove(p.id);
    usePlayer(players.current().id);
    renderWho();
  });
});

// Fade the bottom of a scrolling list while there's more below.
function moreHint(el: HTMLElement) {
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
  const b = (e.target as Element).closest<HTMLElement>('[data-level]');
  if (!b) return;
  levelN = +b.dataset.level!;
  show('level');
});
// Grown-ups: hold the key for 2 seconds to open (or close) every level.
{
  const k = $('#btnKey');
  let t: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => { clearTimeout(t!); k.classList.remove('holding'); };
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
const eggRow = (n: number) => [0, 1, 2].map((i) => `<span class="${i < n ? '' : 'no'}">🥚</span>`).join('');
function songCard(s: Song) {
  if (!songOpen(s)) return `<button class="card song locked" data-song="${s.id}"><div class="em">🔒</div><div class="t">${s.title}</div></button>`;
  return `<button class="card song" data-song="${s.id}"><div class="em">${s.emoji}</div><div class="t">${s.title}</div>${originalName(s) ? `<div class="orig">${originalName(s)}</div>` : ''}<div class="eggs">${eggRow(progress.songs[s.id] || 0)}</div></button>`;
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
  const c = (e.target as Element).closest<HTMLElement>('[data-lesson]');
  if (!c) return;
  const lv = LEVELS[levelN - 1];
  openLesson(lv.n, lv.lessons.findIndex((l) => l.id === c.dataset.lesson));
});
function songTap(e: Event) {
  const c = (e.target as Element).closest<HTMLElement>('[data-song]');
  if (!c) return;
  const s = songById(c.dataset.song!)!;
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
// song is set by openSong before anything reads it
const P: PlayState = { song: null as unknown as Song, e: 0, events: [], hands: 'rh', mistakes: 0, missed: false, wrongRow: 0, drawn: null, stopDemo: null, back: 'songs',
  // play-with-the-beat and echo follow the melody note by note (P.i)
  i: 0, mode: null, tok: null, beat: null, loop: null, judge: null, stopEcho: null, phrases: [], ph: 0, turn: false, echoWrong: 0 };
const playCard = $('#playStaff');
type PlayState = {
  song: Song; e: number; events: SongEvent[]; hands: Hands; mistakes: number; missed: boolean; wrongRow: number;
  drawn: Drawn | null; stopDemo: (() => void) | null; back: string;
  i: number; mode: 'beat' | 'echo' | 'spot' | null; tok: object | null; beat: ReturnType<typeof startBeat> | null;
  loop: ReturnType<typeof setInterval> | null; judge: BeatJudge | null; stopEcho: (() => void) | null;
  phrases: [number, number][]; ph: number; turn: boolean; echoWrong: number;
  solo?: Part | null; soloNotes?: Note[] | null; shown?: number; grade?: string;
};
const playChicken = () => $('#playChicken');
const HANDS: Record<Hands, string> = { rh: '🫱', lh: '🫲', both: '🙌' };
const twoHands = () => !!(P.song && P.song.lh);

// [{ beat, items: [{ part: 'rh'|'lh', i, n }] }] for the hands being played
function buildEvents() {
  const map = new Map<number, SongEvent>();
  const add = (notes: Note[], part: Part) => {
    let beat = 0;
    notes.forEach((n, i) => {
      const cont = i > 0 && (notes[i - 1] as Sounding).tie;
      if (!n.r && !cont) {
        const k = Math.round(beat * 1000);
        if (!map.has(k)) map.set(k, { beat, items: [] } as unknown as SongEvent);
        map.get(k)!.items.push({ part, i, n });
      }
      beat += BEATS[n.d];
    });
  };
  if (P.hands !== 'lh' || !twoHands()) add(partNotes('rh'), 'rh');
  if (P.hands !== 'rh' && twoHands()) add(partNotes('lh'), 'lh');
  P.events = [...map.values()].sort((x, y) => x.beat - y.beat);
  P.events.forEach((ev) => { ev.need = ev.items.flatMap((it) => it.n.keys.map((k) => ({ ...k, part: it.part, i: it.i }))); });
}
const evNow = () => P.events[P.e];
// A hand's notes as played now: moved up or down by octaves when it's shown in the other clef.
const partNotes = (name: Part): Note[] => (P.solo === name && P.soloNotes) || (name === 'lh' ? P.song.lh : P.song.notes);
// Octaves to move a part so it sits on the other clef (middle of the notes near B4 on treble, D3 on bass).
function shiftTo(notes: Note[], clef: string): Note[] {
  const ms = notes.filter((n) => !n.r).flatMap((n) => n.keys.map((k) => k.m)).sort((a, b) => a - b);
  const mid = ms.length ? ms[Math.floor(ms.length / 2)] : 60;
  const oct = Math.round(((clef === 'bass' ? 50 : 71) - mid) / 12);
  if (!oct) return notes;
  return notes.map((n): Note => (n.r ? n : { ...n, keys: n.keys.map((k) => ({ ...k, m: k.m + 12 * oct, oct: k.oct + oct })), m: n.m + 12 * oct }));
}
const fingersOf = (part: Part) => (part === 'lh' ? P.song.lhFingers : P.song.fingers) || [];
// a chord's fingers are listed lowest key first
const fingerFor = (k: Need) => {
  const f = fingersOf(k.part)[k.i];
  if (!Array.isArray(f)) return f;
  const keys = (partNotes(k.part)[k.i].keys as Pitch[]).map((x) => x.m).sort((a, b) => a - b);
  return f[keys.indexOf(k.m)];
};

function setLetters() {
  const on = progress.letters;
  $('#btnLetters').classList.toggle('off', !on);
  playKb.setLetters(on ? 'all' : 'none');
  [P.drawn, P.drawn && P.drawn.lh].forEach((d) => d && d.letterEls.forEach((g) => g && g.querySelectorAll<SVGElement>('circle:not(.fing circle), text.lt:not(.fing text)').forEach((x) => { if (!x.closest('.fing')) x.style.display = on ? '' : 'none'; })));
}
$('#btnLetters').addEventListener('click', () => { progress.letters = !progress.letters; save(); setLetters(); });
$('#btnPlayBack').addEventListener('click', () => show(P.back));
$('#btnClef').addEventListener('click', () => {
  progress.clefFlip = !progress.clefFlip;
  save();
  drawSong();
  restartSong(false);
  cluck();
});
$('#btnHands').addEventListener('click', () => {
  P.hands = ({ rh: 'lh', lh: 'both', both: 'rh' } as const)[P.hands];
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
  // One hand at a time can be read on either clef (remembered per player).
  const one = P.hands !== 'both' || !twoHands();
  const hand = P.hands === 'lh' && twoHands() ? 'lh' : 'rh';
  const home = hand === 'lh' ? 'bass' : s.clef || 'treble';
  const flip = one && !!progress.clefFlip;
  const clef = flip ? (home === 'bass' ? 'treble' : 'bass') : home;
  $('#btnClef').style.display = one ? '' : 'none';
  $('#btnClef').textContent = clef === 'bass' ? '𝄢' : '𝄞';
  // On a phone the grand staff is tiny, so one hand alone gets just its own staff; so does a flipped clef.
  // P.solo names the hand drawn on its own (beat and echo modes follow it); P.soloNotes are its notes as shown.
  const grand = twoHands() && !flip && (P.hands === 'both' || playCard.clientHeight > 220);
  P.solo = !grand && (flip || hand === 'lh') ? hand : null;
  P.soloNotes = null;
  if (P.solo) {
    const src = hand === 'lh' ? s.lh : s.notes;
    P.soloNotes = flip ? shiftTo(src, clef) : src;
  }
  const toks = (ns: Note[] | null | undefined) => (ns || []).filter((n) => !n.r).flatMap((n) => n.keys.map((k) => k.m));
  const all = P.solo ? toks(P.soloNotes) : toks(s.notes).concat(P.hands !== 'rh' ? toks(s.lh) : []);
  playKb.setRange(Math.min(...all), Math.max(...all));
  if (P.solo) {
    P.drawn = drawStaff(playCard, P.soloNotes!, {
      scroll: true, lyrics: true, bars: s.bars !== false, clef, time: s.time, pickup: s.pickup, onTapBeat: jumpToBeat,
      key: s.key && s.key !== 'C' ? s.key : null, sig: s.keySig, fingers: hand === 'lh' ? s.lhFingers : s.fingers,
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
  const dim = (d: Drawn['lh'], on: boolean) => d && [d.noteEls, d.letterEls].forEach((list) => list.forEach((e) => e && e.classList.toggle('dim', on)));
  dim(P.drawn, twoHands() && P.hands === 'lh');
  dim(P.drawn.lh, P.hands === 'rh');
  buildEvents();
}
function openSong(id: string, back = 'songs') {
  show('play');
  P.song = songById(id)!;
  P.back = back === 'level' ? 'level' : 'songs';
  // bass-clef songs have the melody in the left hand: start there unless both hands were picked
  const pref = progress.hands || 'rh';
  P.hands = !twoHands() ? 'rh' : P.song.melodyHand === 'lh' && pref === 'rh' ? 'lh' : pref;
  levelN = P.song.level;
  $('#playTitle').innerHTML = `${P.song.emoji} ${P.song.title}${originalName(P.song) ? `<small>${originalName(P.song)}</small>` : ''}`;
  drawSong();
  restartSong(true);
  onNote = playInput;
  leaveHooks.push(stopDemo, stopMode, stopHint);
  setSpeedBtn();
  if (!micOn()) micBtn.classList.add('nudge'), setTimeout(() => micBtn.classList.remove('nudge'), 3200);
}
function restartSong(first: boolean) {
  stopDemo();
  stopMode();
  P.e = 0; P.i = 0; P.mistakes = 0; P.missed = false; P.wrongRow = 0;
  markUpTo(0);
  setLetters();
  setCurrent();
  const ev = evNow();
  if (first && ev) say(letsPlay(P.song, ev.need[0].label));
}
// grey out every note that starts before `beat`, un-grey the rest
function markUpTo(beat: number) {
  [P.drawn, P.drawn!.lh].forEach((d) => {
    if (!d) return;
    d.beats.forEach((b, j) => [d.noteEls[j], d.letterEls[j], d.lyricEls[j]].forEach((e) => e && e.classList.toggle('done', b < beat - 1e-6)));
  });
}
function setCurrent() {
  const ev = evNow();
  $('#playProg').style.width = (P.e / Math.max(1, P.events.length)) * 100 + '%';
  if (!ev) { focusX(playCard, P.drawn!, null); playKb.setTarget(null); playKb.setFingers({}); expectNote(null); return; }
  ev.got = new Set();
  markUpTo(ev.beat);
  focusX(playCard, P.drawn!, P.drawn!.beatX(ev.beat));
  expectNote(ev.need[0].m);
  playKb.setTarget(ev.need.map((k) => k.m));
  playKb.setFingers(Object.fromEntries(ev.need.map((k) => [k.m, fingerFor(k)]).filter((x) => x[1])));
  bubble($('#playBubble'), `👉 ${needHtml(ev.need)}`);
  if (!P.mode) armHint($('#btnHint'));
}
// Beat and echo modes step through the melody one note at a time.
// They follow the hand being played, or the melody when both are.
const modeHand = () => (!twoHands() ? 'rh' : P.hands === 'both' ? P.song.melodyHand : P.hands);
// .m is only read from notes, never rests (settle() steps over those)
const notesP = () => partNotes(modeHand()) as Sounding[];
const melDrawn = () => (!P.solo && modeHand() === 'lh' && P.drawn!.lh ? P.drawn!.lh : P.drawn!);
const focusMel = (i: number) => focusX(playCard, P.drawn!, melDrawn().xs[i]);
const skippable = (i: number) => notesP()[i] && (notesP()[i].r || (i > 0 && (notesP()[i - 1] as Sounding).tie));
const matches = (n: Note, m: number) => n.keys.some((k) => pc(k.m) === pc(m));
const markDone = (i: number) => [melDrawn().noteEls[i], melDrawn().letterEls[i], melDrawn().lyricEls[i]].forEach((e) => e && e.classList.add('done'));
// step over rests and tied notes
function settle() {
  while (P.i < notesP().length && skippable(P.i)) { markDone(P.i); P.i++; }
}
// Tap the music to go back (or ahead) to that spot.
function jumpToBeat(beat: number) {
  if (current !== 'play' || P.mode) return;
  stopDemo();
  const e = P.events.findIndex((ev) => ev.beat >= beat - 1e-6);
  P.e = e < 0 ? P.events.length - 1 : e;
  P.missed = false; P.wrongRow = 0;
  setCurrent();
  const ev = evNow();
  if (ev) { playNote(ev.need.map((k) => k.m), 0.7); act(playChicken(), 'peck', 300); }
}
function playInput(m: number, source: NoteSource) {
  if (P.mode === 'beat') return beatInput(m, source);
  if (P.mode === 'echo') return echoInput(m);
  if (P.mode === 'spot') return spotInput(m, source);
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
    if (!P.missed) { P.mistakes++; missedNote(ev.need[0].label); }
    P.missed = true;
    P.wrongRow++;
    playKb.flash(m, 'bad', 500);
    act(playChicken(), 'oops');
    bubble($('#playBubble'), `${bigLetter(m)} 🙈 👉 ${needHtml(ev.need)}`);
    playCard.classList.remove('shake'); void playCard.offsetWidth; playCard.classList.add('shake');
    if (P.wrongRow === 2) { say(oopsFind(ev.need[0].label)); nudgeHint($('#btnHint')); }
  }
}
function finishSong(eggs: number = P.mistakes === 0 ? 3 : P.mistakes <= 3 ? 2 : 1) {
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
    day: dayWin(),
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
function from(notes: Note[], beat: number) {
  let b = 0;
  const out: Note[] = [];
  const beats: number[] = [];
  notes.forEach((n) => {
    if (b >= beat - 1e-6) { out.push(n); beats.push(b); }
    b += BEATS[n.d];
  });
  let gap = (beats[0] ?? beat) - beat;
  const lead: Note[] = [];
  for (const [d, v] of [['h', 2], ['q', 1], ['8', 0.5]] as [string, number][]) while (gap >= v - 1e-6) { lead.push({ r: true, d, keys: [] } as unknown as Note); gap -= v; }
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
  const r = from(partNotes('rh'), start);
  const tempo = P.song.tempo * speed();
  const stops: (() => void)[] = [];
  stops.push(playSequence(r.notes, tempo, (j) => {
    const n = r.notes[j] as Sounding;
    focusX(playCard, P.drawn!, P.drawn!.beatX(r.beats[j]));
    if (n.r) { bubble($('#playBubble'), '🤫'); return; }
    playKb.flash(n.m, 'hl', 350);
    bubble($('#playBubble'), `🎵 ${bigLetter(n.m, n.label)}`);
  }, () => { P.stopDemo = null; stopDemo(); setCurrent(); }, 0.8));
  if (twoHands()) {
    const l = from(partNotes('lh'), start);
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
const speed = () => (SPEEDS.includes(progress.speed!) ? progress.speed! : 1);
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
  clearInterval(P.loop!);
  P.loop = null;
  if (P.stopEcho) { P.stopEcho(); P.stopEcho = null; }
  P.mode = null; P.judge = null; P.turn = false;
  $('#btnBeat').classList.remove('on');
  $('#btnEcho').classList.remove('on');
  $('#btnSpot').classList.remove('on');
  spot = null;
  playChicken()?.classList.remove('dance');
  [P.drawn, P.drawn && P.drawn.lh].forEach((d) => d && [d.noteEls, d.letterEls, d.lyricEls].forEach((list) => list.forEach((e) => e && e.classList.remove('miss', 'later'))));
}
// start one of the modes from the top of the song; returns a token that goes stale when the mode stops
function startMode(mode: 'beat' | 'echo') {
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
const GRADE: Record<string, string> = { good: '🎯', early: '👍', late: '👍' };
function paintJudge() {
  const j = P.judge!;
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
function beatInput(m: number, source: NoteSource) {
  const j = P.judge;
  if (!j) return; // still counting in
  const r = j.input(m, struckAt(source));
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
    armHint($('#btnHint'));
  });
}
function echoInput(m: number) {
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
/* ---------- TRICKY SPOT: loop one phrase, slow then faster ---------- */
// 🔁 loops the phrase you're on (tap the music first to pick another spot). The chicken plays it, then you play
// it with the pecks at snail speed; a clean pass goes up to turtle, then bunny. A clean bunny pass fixes it,
// and the song carries on from there.
const SPOT_SPEEDS = [0.5, 0.75, 1];
const SPOT_ICON = ['🐌', '🐢', '🐇'];
type Spot = { a: number; b: number; lvl: number; tries: number };
let spot: Spot | null = null;
function startSpot() {
  stopDemo();
  stopTalking();
  const notes = notesP();
  const tl = timeline(notes);
  const beat = evNow() ? evNow().beat : 0;
  const phs = phrases(notes, P.song);
  const ph = phs.find(([, b]) => tl[b - 1].at + tl[b - 1].len > beat + 1e-6) || phs[phs.length - 1];
  P.mode = 'spot';
  P.tok = {};
  spot = { a: ph[0], b: ph[1], lvl: 0, tries: 0 };
  $('#btnSpot').classList.add('on');
  const tok = P.tok;
  say(SPOT_START, () => tok === P.tok && spotRound());
}
// one go round the loop: listen at this speed, then play it with the pecks
function spotRound() {
  const tok = P.tok, sp = spot!;
  const d = melDrawn();
  const part = notesP().slice(sp.a, sp.b);
  const tempo = P.song.tempo * SPOT_SPEEDS[sp.lvl];
  markUpTo(d.beats[sp.a]);
  [d.noteEls, d.letterEls, d.lyricEls].forEach((list) => list.forEach((e, j) => e && (e.classList.toggle('later', j >= sp.b), e.classList.remove('miss'))));
  playKb.setTarget(null);
  expectNote(null);
  focusMel(sp.a);
  playChicken().classList.add('dance');
  bubble($('#playBubble'), `🔁 ${SPOT_ICON[sp.lvl]} 👂`);
  P.stopEcho = playSequence(part, tempo, (j) => {
    focusMel(sp.a + j);
    part[j].r || part[j].keys.forEach((k) => playKb.flash(k.m, 'hl', 350));
  }, () => {
    P.stopEcho = null;
    if (tok !== P.tok) return;
    playChicken().classList.remove('dance');
    markUpTo(d.beats[sp.a]);
    const beatMs = 60000 / tempo, per = barBeats(P.song.time);
    P.beat = startBeat({
      bpm: tempo, accent: (k) => k % per === 0,
      onBeat: (k) => {
        if (tok !== P.tok) return;
        act(playChicken(), 'peck', Math.min(280, beatMs * 0.6));
        if (k < per) bubble($('#playBubble'), `<span class="count">${Array.from({ length: per }, (_, j) => `<i class="${j === k ? 'on' : ''}">${j + 1}</i>`).join('')}</span>`);
      },
    });
    P.judge = new BeatJudge(part, beatMs, P.beat.t0 + per * beatMs);
    P.shown = -1;
    P.loop = setInterval(spotLoop, 40);
  });
}
function spotLoop() {
  const j = P.judge, sp = spot;
  if (!j || !sp) return;
  const now = performance.now();
  j.tick(now).forEach((k) => melDrawn().noteEls[sp.a + j.items[k].i]?.classList.add('miss'));
  if (j.done) return spotPassDone();
  const k = j.current(now);
  if (k === null || k === P.shown) return;
  const it = j.items[k];
  if (it.t - now > Math.max(600, j.beatMs)) return;
  P.shown = k;
  const n = j.notes[it.i] as Sounding;
  focusMel(sp.a + it.i);
  playKb.setTarget(n.m);
  expectNote(n.m);
}
function spotInput(m: number, source: NoteSource) {
  const j = P.judge, sp = spot;
  if (!j || !sp) return;
  const r = j.input(m, struckAt(source));
  if (!r) return;
  if (r.grade === 'wrong') { playKb.flash(m, 'bad', 400); act(playChicken(), 'oops'); return; }
  markDone(sp.a + j.items[r.k].i);
  playKb.flash(m, 'good', 300);
  bubble($('#playBubble'), `${GRADE[r.grade]} ${SPOT_ICON[sp.lvl]}`);
  if (j.done) setTimeout(() => P.judge === j && spotPassDone(), 400);
}
function spotPassDone() {
  const j = P.judge!, sp = spot!;
  if (P.beat) { P.beat.stop(); P.beat = null; }
  clearInterval(P.loop!);
  P.loop = null;
  P.judge = null;
  playKb.setTarget(null);
  expectNote(null);
  const c = j.counts();
  const clean = c.miss === 0 && c.good >= j.items.length / 2;
  const tok = P.tok;
  sp.tries++;
  if (clean && sp.lvl === SPOT_SPEEDS.length - 1) {
    // fixed: back to normal playing, from the start of the spot
    cluck(2); confetti(20); act(playChicken(), 'happy', 900);
    bubble($('#playBubble'), '✅ 🔁 🎉');
    say(SPOT_FIXED);
    const beat = melDrawn().beats[sp.a];
    stopMode();
    jumpToBeat(beat);
    return;
  }
  // after three tries at one speed it goes up anyway (practice still counts)
  if (clean || sp.tries >= 3) { sp.lvl++; sp.tries = 0; cluck(2); act(playChicken(), 'happy', 700); }
  else act(playChicken(), 'oops');
  bubble($('#playBubble'), `🎯 ${c.good} · 👍 ${c.early + c.late} · 🙈 ${c.miss} → ${SPOT_ICON[sp.lvl]}`);
  say(sp.tries === 0 ? SPOT_FASTER : SPOT_AGAIN, () => tok === P.tok && spotRound());
}
$('#btnSpot').addEventListener('click', () => {
  if (P.mode === 'spot') { stopMode(); setCurrent(); return; }
  if (P.mode) stopMode();
  startSpot();
});

window.addEventListener('resize', () => {
  if (current !== 'play' || !P.drawn) return;
  if (P.mode) return focusMel(P.i);
  const ev = evNow();
  focusX(playCard, P.drawn, ev ? P.drawn.beatX(ev.beat) : null);
});

/* ---------- HINT: the chicken shows (and plays) the next note ---------- */
// The 🐔 button bounces after 8 seconds without a right note, or after two wrong notes in a row.
const STUCK_MS = 8000;
let stuckTimer: ReturnType<typeof setTimeout> | null = null;
function armHint(btn: HTMLElement) { clearTimeout(stuckTimer!); btn.classList.remove('nudge'); stuckTimer = setTimeout(() => btn.classList.add('nudge'), STUCK_MS); }
function nudgeHint(btn: HTMLElement) { clearTimeout(stuckTimer!); btn.classList.add('nudge'); }
function stopHint() { clearTimeout(stuckTimer!); $('#btnHint').classList.remove('nudge'); $('#btnLessonHint').classList.remove('nudge'); }
// play the keys, make them hop, then say the note's name
function showHint(kb: Keyboard, keys: number[], label: string, chicken: Element | null) {
  playNote(keys, 0.8);
  keys.forEach((m) => kb.flash(m, 'hint', 1600));
  act(chicken, 'happy', 600);
  setTimeout(() => say(noteWords(label)), 700);
}
const pulse = (el: Element | null | undefined) => { if (!el) return; el.classList.remove('pulse'); void el.getBoundingClientRect(); el.classList.add('pulse'); };
$('#btnHint').addEventListener('click', () => {
  stopHint();
  if (P.stopDemo || P.mode === 'beat' || P.mode === 'spot') return;
  if (P.mode === 'echo') {
    if (!P.turn) return;
    const n = notesP()[P.i];
    playKb.setTarget(n.m);
    bubble($('#playBubble'), `🐔 👉 ${bigLetter(n.m, n.label)}`);
    showHint(playKb, n.keys.map((k) => k.m), n.label, playChicken());
    return armHint($('#btnHint'));
  }
  const ev = evNow();
  if (!ev) return;
  bubble($('#playBubble'), `🐔 👉 ${needHtml(ev.need)}`);
  pulse(P.drawn!.cur);
  showHint(playKb, ev.need.map((k) => k.m), ev.need[0].label, playChicken());
  armHint($('#btnHint'));
});
$('#btnLessonHint').addEventListener('click', () => {
  stopHint();
  const s = stepObj();
  if (L.locked || L.done) return;
  let m: number | null | undefined = null, label: string | null = null;
  if (s.type === 'key') ({ m, label } = (parse(s.targets) as Sounding[])[L.sub]);
  else if (s.type === 'seq') { ({ m, label } = (parse(s.seqs[L.sub]) as Sounding[])[L.seqPos]); pulse(L.seqDrawn && L.seqDrawn.cur); }
  else if (s.type === 'show') {
    const g = goalPcs(s);
    const want = g.find((p) => !L.got.has(p)) ?? g[0];
    m = ms(s.goal).find((x) => pc(x) === want);
    label = labelFor(s, want);
  }
  if (m == null) return;
  if (s.type === 'key') lessonKb.setTarget(m);
  showHint(lessonKb, [m], label!, lessonChicken());
  armHint($('#btnLessonHint'));
});

/* ---------- record and share ---------- */
// Recordings are kept per player; a removed player's recordings go with them
const recs = setupRecordings({ show, toast, ask: (...a) => ask(...a), bubble, bigLetter, player: playerId });
players.onRemove(deletePlayerRecordings);
recs.button($('#playRec'), () => ({ title: P.song.title, emoji: P.song.emoji, song: P.song.id }));
recs.button($('#freeRec'), () => ({ title: 'My song', emoji: '🎹', song: null }));

/* ---------- ear game (src/eartraining.ts) ---------- */
const ears = setupEarTraining({ show, bubble, bigLetter, act, party: (...a) => party(...a), progress: () => progress, save, setInput: (f) => { onNote = f; }, noteIn, keyUp });

/* ---------- learn games: Egg Rush, Echo Game, Twinkle Twist (src/games.ts) ---------- */
const games = setupGames({ show, bubble, bigLetter, act, party: (...a) => party(...a), progress: () => progress, save, setInput: (f) => { onNote = f; }, noteIn, keyUp });

/* ---------- Fresh Tunes sight reading (src/freshtunes.ts) ---------- */
const fresh = setupFreshTunes({ missed: (m) => missedNote(nameOf(m)), show, bubble, bigLetter, act, party: (...a) => party(...a), progress: () => progress, save, setInput: (f) => { onNote = f; }, noteIn, keyUp });

/* ---------- grown-ups' page (src/parent.ts) ---------- */
const parent = setupParent({
  show, players: () => players.list(), levels: LEVELS, songs: SONGS,
  progressOf: (id) => (id === playerId() ? progress : players.progress(id)),
  recordingsOf: (id) => listRecordings(id).length,
  avatar: (p) => `<span class="av">${avatarChicken(p.avatar)}</span>`,
});

/* ---------- ear quizzes: Mystery Melodies, Happy or Sad (src/quizgames.ts) ---------- */
const quizzes = setupQuizzes({ show, bubble, act, party: (...a) => party(...a), progress: () => progress, save });

/* ---------- Black-key Jam (src/jam.ts) ---------- */
const jam = setupJam({
  setInput: (f) => { onNote = f; }, noteIn, keyUp, bubble, bigLetter, act,
  micEars: () => micOn() && !midiNames.length,
  record: (b, what) => recs.begin(b, what),
  stopRecording: () => !!recs.finish({ open: false }),
});
recs.button($('#jamRec'), () => ({ title: 'Black-key Jam', emoji: '⚫', song: null }));
// Learn: tapping a column's icon says what kind of games it holds
document.querySelectorAll<HTMLElement>('#learn [data-cat]').forEach((b) => b.addEventListener('click', () => say(LEARN_CATS[+b.dataset.cat!])));

/* ---------- yes / no question ---------- */
function ask(html: string, words: string, onYes: () => void) {
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
// day: today's practice (dayWin()); laying today's egg gets its own cheer
function party(eggs: number, { again, next, words, chick = false, rec = null, day = null }: PartyOptions) {
  $('#partyEggs').innerHTML = chick ? '<span>🥚</span><span>🐣</span>'
    : '<span>🥚</span>'.repeat(eggs) + '<span style="filter:grayscale(1) opacity(.25)">🥚</span>'.repeat(3 - eggs);
  $('#partyTitle').textContent = eggs === 3 ? 'BAWK-TASTIC!' : 'BAWK!';
  $('#party').classList.add('show');
  $('#partyChicken').classList.add('dance');
  bawk();
  confetti();
  const pd = $('#partyDay');
  pd.style.display = day ? '' : 'none';
  if (day) {
    const n = streak(progress.days);
    pd.classList.toggle('laid', day.laid);
    pd.innerHTML = `<span class="pips">${goalPips(day.today)}</span>${day.laid ? `<span class="fire">🔥 ${n}</span>` : ''}`;
    if (day.laid) { words = ([] as string[]).concat(words, dayEgg(n)); setTimeout(() => confetti(40), 2500); }
  }
  setTimeout(() => say(words), 1300);
  const close = () => { $('#party').classList.remove('show'); $('#partyChicken').classList.remove('dance'); };
  $('#partyAgain').onclick = () => { close(); again(); };
  $('#partyNext').onclick = () => { close(); next(); };
  $('#partyHome').onclick = () => { close(); show('home'); };
  $('#partyRec').style.display = rec ? '' : 'none';
  $('#partyRec').onclick = () => { close(); recs.openRec(rec!.id); };
}

/* ---------- LESSON PLAYER ---------- */
const lessonKb = makeKeyboard($('#lessonKb'), (m) => noteIn(m, 'tap'), keyUp);
// lv is set by openLesson before anything reads it
const L: LessonState = { lv: null as unknown as Level, li: 0, step: 0, sub: 0, stopHear: null, locked: false, hits: 0, got: new Set(), done: false, echo: [], seqPos: 0 };
const lessonCard = $('#lessonStaff');
type LessonState = {
  lv: Level; li: number; step: number; sub: number; stopHear: (() => void) | null; locked: boolean; hits: number;
  got: Set<number>; done: boolean; echo: Note[]; seqPos: number; seqDrawn?: Drawn;
  // rhythm steps: the scorer while the child plays, tries so far, notes played during a rest, long notes let go early,
  // and when each key was struck (to see how long it was held)
  judge?: BeatJudge | null; tries?: number; slips?: number; short?: number; pressed?: Record<number, { t: number; len: number }>;
};
const lessonChicken = () => $('#lessonChicken');
const lesson = () => L.lv.lessons[L.li];
const stepObj = () => lesson().steps[L.step];
const round = () => (stepObj() as Step<'choice'>).rounds[L.sub];

function openLesson(n: number, i: number) {
  show('lesson');
  L.lv = LEVELS[n - 1]; L.li = i; L.step = 0;
  levelN = n;
  onNote = lessonInput;
  onRelease = lessonRelease;
  leaveHooks.push(stopHear, stopHint);
  preloadVoice(lesson().steps.map((st) => [st.say, (st as Step<'key'>).hint]));
  renderStep();
}
function stopHear() { L.stopHear && L.stopHear(); L.stopHear = null; }
function hear(tokens: string | undefined, { tempo = 92, vel = 0.8 as number | number[], clap = false } = {}) {
  if (!tokens) return;
  stopHear();
  const notes = parse(tokens);
  act(lessonChicken(), 'happy');
  const tl = timeline(notes);
  const counts = L.seqDrawn ? L.seqDrawn.countEls : [];
  const g = gen;
  L.stopHear = playSequence(notes, tempo, (i) => {
    const n = notes[i];
    if (clap) cluck(1);
    if (!n.r) n.keys.forEach((k) => lessonKb.flash(k.m, 'down', 300));
    // light each beat the note lasts, one after the other
    if (counts.length) for (let b = 0; b < tl[i].len; b++) setTimeout(() => g === gen && L.stopHear && lightBeat(Math.floor(tl[i].at) + b), b * 60000 / tempo);
  }, () => { L.stopHear = null; if (g === gen) lightBeat(-1); }, vel);
}
// say the step's words, then (optionally) play its music
function sayThen(text: string, after?: (() => void) | null) {
  const g = gen;
  say(text, () => { if (g === gen && after) after(); });
}
function staff(tokens: string | undefined, s: { clef?: string; time?: string | null; repeat?: boolean; [k: string]: unknown }, extra: StaffOpts = {}) {
  lessonCard.style.display = '';
  const notes = tokens ? parse(tokens) : [];
  // one or two notes get a short staff, so they're drawn big
  return drawStaff(lessonCard, notes, { minWidth: notes.length && notes.length <= 2 ? 240 : 420, clef: s.clef || 'treble', time: s.time || null, repeat: !!s.repeat, ...extra });
}
function keyboard(on: boolean, rangeTokens?: string | null) {
  $('#lessonKb').parentElement!.style.display = on ? '' : 'none';
  const [lo, hi] = rangeTokens ? range(rangeTokens) : [LOW, HIGH];
  lessonKb.setRange(lo, hi);
  lessonKb.reset();
}
function choices(html: string) {
  $('#lessonChoices').style.display = html ? '' : 'none';
  $('#lessonChoices').innerHTML = html || '';
}

function renderStep() {
  const les = lesson();
  const s = stepObj();
  gen++;
  stopHear();
  Object.assign(L, { sub: 0, locked: false, hits: 0, got: new Set(), done: false, echo: [], seqPos: 0, judge: null });
  expectNote(null);
  $('#lessonTitle').textContent = `${les.emoji} ${les.title}`;
  $('#lessonDots').innerHTML = les.steps.map((_, i) => `<i class="${i < L.step ? 'done' : i === L.step ? 'on' : ''}"></i>`).join('');
  $('#btnNext').style.display = 'none';
  $('#btnLessonHint').style.display = ['key', 'seq', 'show'].includes(s.type) ? '' : 'none';
  stopHint();
  $('#btnHear').style.display = (s as Step<'show'>).hear || s.type === 'rhythm' || (s.type === 'choice' && s.rounds.some((r) => r.hear)) ? '' : 'none';
  lessonCard.style.display = 'none';
  L.seqDrawn = undefined;
  choices('');
  ({ show: showStep, key: keyStep, seq: seqStep, name: namePrompt, beats: beatsPrompt, choice: choicePrompt, rhythm: rhythmStep })[s.type]();
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
  const words = lessonDone(newSongs.map((x) => x.title), (hatched && lv.n) as number);
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
    day: dayWin(),
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
  if (s.type === 'rhythm') { if (!L.judge && !L.done) { stopHear(); rhythmDemo(); } return; }
  hear((s as Step<'show'>).hear, { clap: (s as Step<'show'>).clap, vel: (s as Step<'show'>).hearVel || 0.8 });
});
$('#btnLessonBack').addEventListener('click', () => show('level'));

/* show: explain, then do it. Every show step has a goal: play the glowing keys `times` times. */
const goalPcs = (s: Step<'show'>) => [...new Set(ms(s.goal).map(pc))];
const labelFor = (s: Step<'show'>, p: number) => { const k = parse(s.goal).flatMap((n) => n.keys).find((x) => pc(x.m) === p); return k ? k.label : nameOf(p); };
function needed(s: Step<'show'>) { const g = goalPcs(s); return { times: s.times || 1, distinct: Math.min(s.times || 1, g.length) }; }
function goalHtml(s: Step<'show'>) {
  const { times } = needed(s);
  return `<span class="goal">${Array.from({ length: times }, (_, i) => (i < L.hits ? '🥚' : '<i class="egg0">🥚</i>')).join('')}</span>`;
}
function showStep() {
  const s = stepObj() as Step<'show'>;
  const k = s.keys || {};
  // without a range, make sure every highlighted key fits (F5 in Line Notes)
  keyboard(true, k.range || (k.hl && `${k.hl} C E5`));
  const hl = ms(k.hl);
  lessonKb.setHL(hl);
  lessonKb.setGroups(k.groups as boolean);
  lessonKb.setLetters(k.letters || 'all');
  // right hand: thumb (1) on the lowest key; left hand: pinky (5) on the lowest key
  if (k.fingers) { const up = [...hl].sort((a, b) => a - b); lessonKb.setFingers(Object.fromEntries(up.map((m, i) => [m, k.fingers === 'lh' ? up.length - i : i + 1]))); }
  if (s.staff !== undefined) L.seqDrawn = staff(s.staff, s, { letters: !s.clap && !s.lh, counts: !!s.count, lh: s.lh ? parse(s.lh) : null });
  const g = goalPcs(s);
  if (g.length === 1) expectNote(ms(s.goal)[0]);
  bubble($('#lessonBubble'), `${s.text} ${goalHtml(s)}`);
  sayThen(s.say, s.hear ? () => hear(s.hear, { clap: s.clap, vel: s.hearVel || 0.8 }) : null);
}
function showInput(m: number) {
  const s = stepObj() as Step<'show'>;
  if (s.echo) {
    L.echo.push(noteOf(m, 'q'));
    if (L.echo.length > 8) L.echo.shift();
    lessonCard.style.display = '';
    drawStaff(lessonCard, L.echo, { minWidth: 420, clef: s.clef || 'treble' });
  }
  if (L.done) return;
  const g = goalPcs(s);
  if (g.includes(pc(m))) {
    armHint($('#btnLessonHint'));
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
  const s = stepObj() as Step<'key'>;
  keyboard(true, s.range);
  lessonKb.setLetters(s.letters || 'all');
  keyPrompt(true);
}
function keyPrompt(first: boolean) {
  const s = stepObj() as Step<'key'>;
  const n = (parse(s.targets) as Sounding[])[L.sub];
  expectNote(n.m);
  lessonKb.setTarget(null); // a hint may have lit the last one
  bubble($('#lessonBubble'), `🎹 ${bigLetter(n.m, n.label)}`);
  if (first) sayThen(s.say); else say(noteWords(n.label));
  armHint($('#btnLessonHint'));
}
function keyInput(m: number) {
  const s = stepObj() as Step<'key'>;
  const targets = (parse(s.targets) as Sounding[]);
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
  const s = stepObj() as Step<'seq'>;
  keyboard(true, s.range || s.seqs.join(' '));
  if (s.read) lessonKb.setLetters('none');
  seqPrompt(true);
}
function seqPrompt(first: boolean) {
  const s = stepObj() as Step<'seq'>;
  const tune = (parse(s.seqs[L.sub]) as Sounding[]);
  L.seqPos = 0;
  L.seqDrawn = staff(s.seqs[L.sub], s, { letters: !s.read });
  lessonKb.setHL(s.read ? [] : tune.map((n) => n.m));
  seqTarget();
  if (first) sayThen(s.say);
}
function seqTarget() {
  const s = stepObj() as Step<'seq'>;
  const tune = (parse(s.seqs[L.sub]) as Sounding[]);
  const n = tune[L.seqPos];
  lessonKb.setTarget(s.read ? null : n.m);
  expectNote(n.m);
  L.seqDrawn!.cur.setAttribute('x', (L.seqDrawn!.xs[L.seqPos] - 22) as unknown as string);
  L.seqDrawn!.noteEls.forEach((e, j) => e && e.classList.toggle('done', j < L.seqPos));
  armHint($('#btnLessonHint'));
  bubble($('#lessonBubble'), `${tune.map((x, j) => (j < L.seqPos ? '🥚' : j === L.seqPos ? (s.read ? '👀' : bigLetter(x.m, x.label)) : '<i class="egg0">🥚</i>')).join('')}`);
}
function seqInput(m: number) {
  const s = stepObj() as Step<'seq'>;
  const tune = (parse(s.seqs[L.sub]) as Sounding[]);
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
  const s = stepObj() as Step<'name'>;
  const n = (parse(s.notes) as Sounding[])[L.sub];
  if (L.sub === 0) { keyboard(true, s.range); lessonKb.setLetters('none'); sayThen(s.say); }
  expectNote(n.m);
  staff(`${n.letter}${n.keys[0].acc}${n.keys[0].oct}:w`, s, { letters: false });
  bubble($('#lessonBubble'), '🤔 ❓');
  const pool = [...s.pool];
  const others = shuffle(pool.filter((l) => l !== n.letter));
  const opts = pool.length <= 4 ? pool : shuffle([n.letter, ...others.slice(0, 2)]);
  choices(opts.map((l) => `<button class="choice" data-ans="${l}" style="color:${COLORS[l]}">${l}</button>`).join(''));
}
function nameAnswer(ans: string, btn: HTMLElement | null) {
  const s = stepObj() as Step<'name'>;
  const notes = (parse(s.notes) as Sounding[]);
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
const BEAT_LABEL = (b: number) => (b === 0.5 ? '½' : String(b));
function beatsPrompt() {
  const s = stepObj() as Step<'beats'>;
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
  const s = stepObj() as Step<'choice'>;
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
function choiceAnswer(ans: string, btn: HTMLElement) {
  const s = stepObj() as Step<'choice'>;
  if (ans === round().answer) {
    btn.classList.add('right');
    quizRight(() => advanceSub(s.rounds.length, () => { gen++; choicePrompt(); }));
  } else {
    btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
    quizWrong();
    if (round().hear) { const g = gen; setTimeout(() => g === gen && hear(round().hear, { tempo: round().tempo, vel: round().vel ?? 0.8 }), 700); }
  }
}

function quizRight(after: () => void) {
  L.locked = true;
  act(lessonChicken(), 'happy');
  cluck(2);
  bubble($('#lessonBubble'), `✅ ${pick(PRAISE)}`);
  const g = gen;
  setTimeout(() => { if (g !== gen) return; L.locked = false; after(); }, 1100);
}
function quizWrong() {
  act(lessonChicken(), 'oops');
  const s = stepObj() as Step<'key'>;
  if (s.hint) say(s.hint);
}
function advanceSub(total: number, prompt: () => void) {
  L.sub++;
  if (L.sub >= total) nextStep(); else prompt();
}
$('#lessonChoices').addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-ans]');
  if (!b || L.locked) return;
  const s = stepObj();
  if (s.type === 'name') nameAnswer(b.dataset.ans!, b);
  else if (s.type === 'beats') {
    if (b.dataset.ans === BEAT_LABEL(BEATS[s.durs[L.sub]])) { b.classList.add('right'); quizRight(() => advanceSub(s.durs.length, beatsPrompt)); }
    else { b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); quizWrong(); }
  } else if (s.type === 'choice') choiceAnswer(b.dataset.ans!, b);
});
function lessonInput(m: number, source: NoteSource) {
  if (L.locked) return;
  const s = stepObj();
  if (s.type === 'rhythm') rhythmInput(m, source);
  else if (s.type === 'show') showInput(m);
  else if (s.type === 'key') keyInput(m);
  else if (s.type === 'seq') seqInput(m);
  else if (s.type === 'name') { if (pc(m) === pc((parse(s.notes) as Sounding[])[L.sub].m)) nameAnswer((parse(s.notes) as Sounding[])[L.sub].letter, $(`#lessonChoices [data-ans="${(parse(s.notes) as Sounding[])[L.sub].letter}"]`)); else { lessonKb.flash(m, 'bad', 500); quizWrong(); } }
}

/* rhythm: the chicken plays it with the pecks, then counts in one bar and the child plays it back in time.
   The beat numbers under the staff light up as the beats go by, so a half note is seen to last two of them. */
const RHYTHM_TEMPO = 72;
const rhythmNotes = (s: Step<'rhythm'>) => parse(s.play || s.staff);
const rhythmBeatMs = (s: Step<'rhythm'>) => 60000 / (s.tempo || RHYTHM_TEMPO);
// how many beats note i sounds for, ties included
const holdBeats = (notes: Note[], i: number) => { let b = BEATS[notes[i].d] || 1; for (let j = i; (notes[j] as Sounding).tie && notes[j + 1]; j++) b += BEATS[notes[j + 1].d] || 1; return b; };
function lightBeat(b: number) {
  const d = L.seqDrawn;
  if (!d || !d.countEls.length) return;
  d.countEls.forEach((e, j) => e.classList.toggle('on', j === b));
  d.cur.setAttribute('x', String(b < 0 ? -10000 : d.countAt(b) - 22));
}
function rhythmStep() {
  const s = stepObj() as Step<'rhythm'>;
  const all = s.play || s.staff;
  keyboard(true, s.range || `${all} C E5`);
  const keys = [...new Set(ms(all))];
  lessonKb.setHL(keys);
  lessonKb.setLetters('hl');
  if (new Set(keys.map(pc)).size === 1) expectNote(keys[0]);
  L.seqDrawn = staff(s.staff, s, { letters: !s.lh, counts: true, lh: s.lh ? parse(s.lh) : null });
  L.tries = 0;
  bubble($('#lessonBubble'), '👂 🐔');
  sayThen(s.say, rhythmDemo);
}
// Pecks the beat: one bar to count in, then the rhythm. demo: the chicken plays the notes itself.
// Returns the time (performance.now) the first note is due.
function rhythmRun(demo: boolean, onEnd?: () => void) {
  const s = stepObj() as Step<'rhythm'>;
  const g = gen;
  const notes = rhythmNotes(s), tl = timeline(notes);
  const total = tl.length ? tl[tl.length - 1].at + tl[tl.length - 1].len : 0;
  const per = barBeats(s.time), beatMs = rhythmBeatMs(s);
  const timers: ReturnType<typeof setTimeout>[] = [];
  const beat = startBeat({
    bpm: 60000 / beatMs,
    accent: (k) => k % per === 0,
    onBeat: (k) => {
      if (g !== gen) return;
      act(lessonChicken(), 'peck', Math.min(280, beatMs * 0.6));
      const b = k - per;
      if (b < 0) {
        bubble($('#lessonBubble'), `<span class="count">${Array.from({ length: per }, (_, j) => `<i class="${j === k ? 'on' : ''}">${j + 1}</i>`).join('')}</span>`);
        return;
      }
      if (b === 0) bubble($('#lessonBubble'), demo ? '👂 🐔' : '🎹 🥁');
      if (b >= total) {
        lightBeat(-1);
        if (onEnd) { stop(); onEnd(); }
        return;
      }
      lightBeat(b);
      if (demo) tl.filter((t) => t.play && t.at >= b - 1e-6 && t.at < b + 1 - 1e-6).forEach((t) => timers.push(setTimeout(() => {
        if (g !== gen) return;
        const n = notes[t.i];
        if (n.r) return;
        const keys = n.keys.map((x) => x.m);
        playNote(keys, (holdBeats(notes, t.i) * beatMs * 0.95) / 1000);
        keys.forEach((m) => lessonKb.flash(m, 'down', Math.min(500, holdBeats(notes, t.i) * beatMs)));
      }, (t.at - b) * beatMs)));
    },
  });
  const loop = setInterval(rhythmLoop, 40);
  const stop = () => { beat.stop(); timers.forEach(clearTimeout); clearInterval(loop); if (L.stopHear === stop) L.stopHear = null; };
  stopHear();
  L.stopHear = stop;
  return beat.t0 + per * beatMs;
}
function rhythmDemo() {
  const g = gen;
  L.judge = null;
  rhythmMarks(null);
  rhythmRun(true, () => setTimeout(() => g === gen && rhythmTurn(), 400));
}
function rhythmTurn() {
  const s = stepObj() as Step<'rhythm'>;
  const g = gen;
  bubble($('#lessonBubble'), '🎹 👂');
  say(RHYTHM_TURN, () => {
    if (g !== gen) return;
    Object.assign(L, { slips: 0, short: 0, pressed: {} });
    const t1 = rhythmRun(false);
    L.judge = new BeatJudge(rhythmNotes(s), rhythmBeatMs(s), t1);
  });
}
// color the drawn notes by how they went (only when the staff shows exactly what is judged)
function rhythmMarks(j: BeatJudge | null) {
  const s = stepObj() as Step<'rhythm'>;
  const d = L.seqDrawn;
  if (!d || s.play) return;
  d.noteEls.forEach((e) => e && e.classList.remove('done', 'miss'));
  if (j) j.items.forEach((it) => { const e = d.noteEls[it.i]; if (e && it.result) e.classList.add(it.result === 'miss' ? 'miss' : 'done'); });
}
function rhythmLoop() {
  const j = L.judge;
  if (!j) return;
  if (j.tick(performance.now()).length) { rhythmMarks(j); act(lessonChicken(), 'oops'); }
  if (j.done) rhythmFinish();
}
function rhythmFinish() {
  const j = L.judge!;
  L.judge = null;
  stopHear();
  lightBeat(-1);
  rhythmMarks(j);
  const c = j.counts();
  const ok = c.miss === 0 && (L.slips || 0) <= 1 && c.good >= j.items.length / 2;
  L.tries = (L.tries || 0) + 1;
  if (ok || L.tries >= 3) {
    stepDone();
    say(ok ? (L.short ? RHYTHM_HOLD : RHYTHM_GOOD) : RHYTHM_OK);
    return;
  }
  const g = gen;
  act(lessonChicken(), 'oops');
  bubble($('#lessonBubble'), `🎯 ${c.good} · 👍 ${c.early + c.late} · 🙈 ${c.miss} 🔁`);
  setTimeout(() => g === gen && say(RHYTHM_AGAIN, () => g === gen && rhythmDemo()), 900);
}
function rhythmInput(m: number, source: NoteSource) {
  const s = stepObj() as Step<'rhythm'>;
  const j = L.judge;
  if (!j || L.done) return; // listening or counting in
  const at = struckAt(source);
  const r = j.input(m, at);
  if (!r) {
    // a key during a rest
    const notes = rhythmNotes(s);
    const b = (at - j.items[0].t) / j.beatMs + timeline(notes)[j.items[0].i].at;
    const t = timeline(notes).find((x) => b >= x.at && b < x.at + x.len);
    if (t && notes[t.i].r) { L.slips = (L.slips || 0) + 1; lessonKb.flash(m, 'bad', 400); act(lessonChicken(), 'oops'); bubble($('#lessonBubble'), '🤫'); if (L.slips === 1) say(RHYTHM_SHH); }
    return;
  }
  if (r.grade === 'wrong') { lessonKb.flash(m, 'bad', 400); act(lessonChicken(), 'oops'); return; }
  const it = j.items[r.k];
  lessonKb.flash(m, 'good', 300);
  L.pressed![m] = { t: struckAt(source, true), len: holdBeats(j.notes, it.i) };
  rhythmMarks(j);
  bubble($('#lessonBubble'), r.grade === 'good' ? '🎯' : r.grade === 'early' ? '🐇 👍' : '🐢 👍');
  if (r.grade === 'good') act(lessonChicken(), 'happy', 400);
  if (j.done) setTimeout(() => L.judge === j && rhythmFinish(), 300);
}
// screen keys and USB keyboards say when a key is let go: a long note let go well before its time gets a nudge
function lessonRelease(m: number) {
  const p = L.pressed && L.pressed[m];
  if (!p || stepObj().type !== 'rhythm') return;
  delete L.pressed![m];
  const s = stepObj() as Step<'rhythm'>;
  const held = (performance.now() - p.t) / rhythmBeatMs(s);
  if (p.len >= 2 && held < p.len - 0.75) { L.short = (L.short || 0) + 1; bubble($('#lessonBubble'), '⏳ ✋'); }
}

/* ---------- FREE PLAY ---------- */
const freeKb = makeKeyboard($('#freeKb'), (m) => noteIn(m, 'tap'), keyUp);
freeKb.setRange(48, 76);
// Free play draws what is played the way a saved recording is drawn (src/recorder.ts): every note keeps
// its real start and length (taps, USB keys and heard notes are all timed from the strike, and the mic
// hears a note stop), the beat is counted from the playing (or is the metronome's when it's on), and a
// pause becomes a rest.
const F: { rec: ReturnType<typeof makeRecorder>; notes: Note[]; drawn: string; iv?: ReturnType<typeof setInterval> } = { rec: makeRecorder(), notes: [], drawn: '' };
const FREE_SHOW = 8; // notes (and rests) on the staff
function drawFree() {
  const all = F.rec.peek();
  const recent = all.slice(-24);
  const { tokens } = toTokens(recent, freeBeat ? FREE_BPM : guessTempo(all.slice(-40)));
  if (tokens === F.drawn) return;
  F.drawn = tokens;
  const notes = parse(tokens);
  // start the staff on a note, not a rest
  let from = Math.max(0, notes.length - FREE_SHOW);
  while (from < notes.length - 1 && notes[from].r) from++;
  F.notes = notes.slice(from);
  // low notes read better on the bass staff
  const ns = F.notes.filter((n) => !n.r);
  const low = ns.filter((n) => n.m < 60).length > ns.length / 2;
  drawStaff($('#freeStaff'), F.notes, { minWidth: FREE_W, clef: low ? 'bass' : 'treble', pack: true });
}
let micEnd: ((m: number, at: number) => void) | null = null;
const FREE_W = 560; // room for 8 notes, so the staff stays the same size as it fills
// Free play metronome: pecks at 90 beats a minute, and then the notes are counted in that beat.
const FREE_BPM = 90;
let freeBeat: ReturnType<typeof startBeat> | null = null;
function stopFreeBeat() { if (freeBeat) freeBeat.stop(); freeBeat = null; $('#btnFreeBeat').classList.remove('on'); }
// Grown-ups: hold 🥁 for 2 s for the tap-along check (calibrate below).
let freeBeatHeld = false;
{
  const b = $('#btnFreeBeat');
  let t: ReturnType<typeof setTimeout> | null = null;
  b.addEventListener('pointerdown', () => { freeBeatHeld = false; t = setTimeout(() => { freeBeatHeld = true; calibrate(); }, 2000); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => clearTimeout(t!)));
}
$('#btnFreeBeat').addEventListener('click', () => {
  if (freeBeatHeld) return;
  if (freeBeat) return stopFreeBeat();
  $('#btnFreeBeat').classList.add('on');
  freeBeat = startBeat({ bpm: FREE_BPM, onBeat: () => act($('#freeChicken'), 'peck', 250) });
});
// Tap-along check: the chicken pecks 12 beats and a grown-up plays any key on each one, with the input the
// kids use (screen, microphone or USB keyboard). The usual gap between peck and key is this device's delay
// for that input (speaker, mic, keyboard app), and every game played in time takes it off from then on.
const CAL_N = 12, CAL_BPM = 80;
function calibrate() {
  stopFreeBeat();
  startAudio();
  const g = gen;
  const ov = document.createElement('div');
  ov.className = 'calib';
  ov.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2vh;background:rgba(255,248,225,.96);font-size:min(8vw,8vh);touch-action:none;user-select:none';
  ov.innerHTML = `<div class="chicken" style="font-size:2.4em">🐔</div><div>🥁 👆 🎹 🎤</div><div class="dots" style="letter-spacing:.15em;font-size:.6em">${'○'.repeat(CAL_N)}</div>`;
  document.body.appendChild(ov);
  const hen = ov.querySelector('.chicken'), dots = ov.querySelector<HTMLElement>('.dots')!;
  const hits: { t: number; source: NoteSource }[] = [];
  const prev = { onNote, onRelease };
  onNote = (_m, source) => hits.push({ t: struckAt(source, true), source });
  onRelease = null;
  ov.addEventListener('pointerdown', (e) => { e.preventDefault(); hits.push({ t: e.timeStamp, source: 'tap' }); });
  const beat = startBeat({
    bpm: CAL_BPM,
    accent: (k) => k % 4 === 0,
    onBeat: (k) => {
      act(hen, 'peck', 250);
      dots.textContent = '●'.repeat(Math.min(k + 1, CAL_N)) + '○'.repeat(Math.max(0, CAL_N - k - 1));
      if (k === CAL_N) finish();
    },
  });
  function finish() {
    beat.stop();
    ov.remove();
    if (g === gen) { onNote = prev.onNote; onRelease = prev.onRelease; }
    const r = calibration(hits, beat.t0, beat.gap);
    if (!r) { toast('🤷 🥁 👆 🔁', 5000); return; }
    setLag(r.source, r.lag);
    toast(`✅ ${{ tap: '👆', mic: '🎤', midi: '🎹' }[r.source]} ${r.lag >= 0 ? '+' : ''}${r.lag} ms`, 6000);
  }
}
// The usual (median) gap between peck and key, for the input used most; the first two pecks are for listening.
function calibration(hits: { t: number; source: NoteSource }[], t0: number, gap: number): { source: NoteSource; lag: number } | null {
  const by: Partial<Record<NoteSource, number[]>> = {};
  hits.forEach((h) => {
    const k = Math.round((h.t - t0) / gap);
    const d = h.t - (t0 + k * gap);
    if (k >= 2 && k < CAL_N && Math.abs(d) < gap * 0.4) (by[h.source] = by[h.source] || []).push(d);
  });
  const best = (Object.entries(by) as [NoteSource, number[]][]).sort((a, b) => b[1].length - a[1].length)[0];
  if (!best || best[1].length < 5) return null;
  const xs = best[1].sort((a, b) => a - b);
  return { source: best[0], lag: Math.round(xs[Math.floor(xs.length / 2)]) };
}
function openFree() {
  leaveHooks.push(stopFreeBeat, () => { micEnd = null; clearInterval(F.iv); F.rec.stop(); });
  F.rec.start();
  F.notes = [];
  F.drawn = '';
  drawStaff($('#freeStaff'), [], { minWidth: FREE_W, pack: true });
  bubble($('#freeBubble'), '🎹 🎤 ❓');
  onNote = (m, source) => {
    F.rec.down(m, source, 0.8, struckAt(source, true));
    drawFree();
    bubble($('#freeBubble'), bigLetter(m));
    freeKb.flash(m, 'hl', 600);
    act($('#freeChicken'), Math.random() < 0.3 ? 'happy' : 'peck', 500);
  };
  onRelease = (m) => { F.rec.up(m, performance.now()); drawFree(); };
  micEnd = (m, at) => { F.rec.up(m, at, true); drawFree(); };
  // a note still sounding grows on the staff
  clearInterval(F.iv);
  F.iv = setInterval(drawFree, 300);
}

/* ---------- computer keyboard (for grown-ups testing on a laptop) ---------- */
const KEYMAP: Record<string, number> = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76 };
const typing = (e: Event) => e.target && (e.target as Element).tagName === 'INPUT';
document.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || typing(e)) return;
  const m = KEYMAP[e.key.toLowerCase()];
  if (m) { markTap(e.timeStamp); startAudio(); [playKb, lessonKb, freeKb].forEach((kb) => kb.flash(m, 'down', 180)); noteIn(m, 'tap'); }
});
document.addEventListener('keyup', (e) => { if (typing(e)) return; const m = KEYMAP[e.key.toLowerCase()]; if (m) keyUp(m); });

window.__cp = { recs, players, usePlayer, say, show, openSong, openLesson, noteIn, jumpToBeat, P, L, progress, LEVELS, SONGS, startBeatMode, startEcho, spot: () => spot, lessonStep: (i: number) => { L.step = i; renderStep(); }, ears, games, jam, quizzes, fresh };
window.__cpMs = ms;
window.__cpHeard = () => heardCount;
window.__cpFree = () => F.notes;
window.__cpFreeTokens = () => toTokens(F.rec.peek(), freeBeat ? FREE_BPM : guessTempo(F.rec.peek().slice(-40))).tokens;
window.__cpMidi = () => ({ names: midiNames, started: midiStarted, count: midiCount });
lookLikePlayer();
renderHome();
startOffline();
