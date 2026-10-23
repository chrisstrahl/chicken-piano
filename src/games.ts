// Learn games (tiles on the Learn screen), each nest giving up to three eggs like a song:
// - Egg Rush: a note pops onto the staff, play it on the piano, as fast as you can. Ten notes a rush.
// - Echo Game: the chicken plays a rhythm on C with the pecks; you copy it on any key. Then the staff shows
//   what you just played, so the sound meets its notes.
// - Twinkle Twist: Twinkle Twinkle in a new rhythm each nest (the Suzuki way): the rhythm alone, then two lines.
// Nest data is in src/games.js.
import { COLORS, letterOf, nameOf, parse } from './music.js';
import { playNote, say, stopTalking, cluck, peck, startBeat } from './audio.js';
import { BeatJudge, barBeats, MIC_LAG, timeline } from './beat.js';
import { expectNote } from './mic.js';
import { drawStaff } from './staff.js';
import { makeKeyboard } from './keyboard.js';
import { RUSH_STAGES, RUSH_ROUND, rushEggs, rushNotes, CLUCK_STAGES, CLUCK_ROUNDS, cluckEggs, cluckPattern, TWINKLE_STAGES, twinkleRounds, TWINKLE_ROUNDS } from './barnyard.js';
import { GAMES_PICK, RUSH_START, RUSH_BEST, CLUCK_START, twinkleStart, RHYTHM_TURN, RHYTHM_AGAIN, RHYTHM_GOOD, RHYTHM_OK, RHYTHM_SHH, songDone } from './lines.js';
import type { Drawn } from './staff.ts';
import type { Note, NoteSource } from './types';

const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector<T>(s)!;
const pc = (m: number) => ((m % 12) + 12) % 12;
const HINT_AFTER = 2; // wrong keys on one Egg Rush note before its key glows
const RING = 1500; // ms the mic may still hear the last right note ringing (not a wrong key)

type Party = (eggs: number, o: { again: () => void; next: () => void; words: string | string[] }) => void;
type Saved = { games?: Record<string, number>; rushBest?: Record<string, number> };
// What the app hands over
export interface GamesApp {
  show: (screen: string) => void;
  bubble: (el: HTMLElement, html: string) => void;
  bigLetter: (m: number) => string;
  act: (chicken: Element | null, cls: string, ms?: number) => void;
  party: Party;
  // the current player's progress (games: nest id -> best eggs; rushBest: nest id -> best seconds) and saving it
  progress: () => Saved;
  save: () => void;
  setInput: (onNote: (m: number, source: NoteSource) => void) => void;
  noteIn: (m: number, source: NoteSource) => void;
  keyUp: (m: number) => void;
}

// Eggs won in the games, for the coop
export const gameEggTotal = (progress: Saved) => Object.values(progress.games || {}).reduce((a, b) => a + b, 0);

export function setupGames(app: GamesApp) {
  const onRelease = ((m: number) => app.keyUp(m)) as unknown as () => void;
  const eggsOf = (id: string) => (app.progress().games || {})[id] || 0;
  const eggRow = (n: number) => [0, 1, 2].map((i) => `<span class="${i < n ? '' : 'no'}">🥚</span>`).join('');
  const dots = (pool: number[]) => pool.map((m) => `<i style="background:${COLORS[letterOf(m) as keyof typeof COLORS]}"></i>`).join('');
  const secs = (ms: number) => (ms / 1000).toFixed(1);
  const win = (id: string, eggs: number) => {
    const p = app.progress();
    p.games = { ...(p.games || {}), [id]: Math.max(eggsOf(id), eggs) };
  };

  /* ---------- the picker: one game's nests (Learn has a tile per game) ---------- */
  let kind: 'rush' | 'cluck' | 'twinkle' = 'rush';
  const NAMES = { rush: '🥚 Egg Rush', cluck: '👏 Echo Game', twinkle: '⭐ Twinkle Twist' };
  document.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-pick]');
    if (b) { kind = b.dataset.pick as typeof kind; app.show('games'); }
  });
  function renderPicker() {
    $('#gamesTitle').textContent = NAMES[kind];
    const best = app.progress().rushBest || {};
    const card = (kind: string, i: number, id: string, top: string, mid: string) => `<button class="card reccard gamecard${eggsOf(id) ? '' : ' fresh'}" data-game="${kind}" data-i="${i}">
      <div class="em">${top}</div>${mid}<div class="eggs">${eggRow(eggsOf(id))}</div></button>`;
    $('#gameCards').innerHTML =
      kind === 'rush' ? RUSH_STAGES.map((s, i) => card('rush', i, s.id, s.emoji, `<div class="pool">${dots(s.pool)}</div><div class="when">${best[s.id] ? `⏱️ ${secs(best[s.id])}` : ''}</div>`)).join('')
      : kind === 'cluck' ? CLUCK_STAGES.map((s, i) => card('cluck', i, s.id, s.emoji, `<div class="t">${s.time === '3/4' ? '3/4' : '🥁'.repeat(s.bars)}</div>`)).join('')
      : TWINKLE_STAGES.map((s, i) => card('twinkle', i, s.id, s.emoji, `<div class="t">${s.word}</div>`)).join('');
    say(GAMES_PICK);
  }
  $('#gameCards').addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-game]');
    if (!b) return;
    if (b.dataset.game === 'rush') openRush(+b.dataset.i!);
    else openRhythm(b.dataset.game as 'cluck' | 'twinkle', +b.dataset.i!);
  });

  /* ---------- Egg Rush ---------- */
  const rushKb = makeKeyboard($('#rushKb'), (m: number) => app.noteIn(m, 'tap'), onRelease);
  const rushChicken = () => document.querySelector('#rushChicken');
  const R = { si: 0, notes: [] as number[], pos: 0, misses: 0, missHere: 0, t0: 0, ready: false, done: false, tok: 0, last: { m: -1, at: 0 }, timer: 0 as unknown as ReturnType<typeof setInterval> };
  function openRush(i: number) { R.si = i; kind = 'rush'; app.show('rush'); }
  function renderRush() {
    const s = RUSH_STAGES[R.si];
    Object.assign(R, { notes: rushNotes(s), pos: 0, misses: 0, missHere: 0, ready: false, done: false, last: { m: -1, at: 0 } });
    $('#rushTitle').textContent = `🥚 ${s.emoji}`;
    $('#rushTime').textContent = '0.0';
    const lo = Math.min(...s.pool), hi = Math.max(...s.pool);
    rushKb.reset();
    rushKb.setRange(Math.min(lo, 60), Math.max(hi, 72));
    rushKb.setLetters('none');
    app.setInput(rushInput);
    rushStaff(null);
    paintRush();
    const t = ++R.tok;
    say(RUSH_START, () => { if (t !== R.tok) return; R.t0 = performance.now(); R.ready = true; R.timer = setInterval(tickRush, 100); rushNote(); });
  }
  const clefOf = (m: number) => { const c = RUSH_STAGES[R.si].clef; return c === 'grand' ? (m < 60 ? 'bass' : 'treble') : c; };
  function rushStaff(m: number | null) {
    const clef = m === null ? RUSH_STAGES[R.si].clef === 'bass' ? 'bass' : 'treble' : clefOf(m);
    const notes = m === null ? [] : parse(`${nameOf(m).replace('♯', '#').replace('♭', 'b')}${Math.floor(m / 12) - 1}:w`);
    drawStaff($('#rushStaff'), notes, { minWidth: 240, clef, letters: false });
  }
  function paintRush(extra = '') {
    const eggs = R.notes.map((_, i) => (i < R.pos ? '🐣' : '<i class="egg0">🥚</i>')).join('');
    app.bubble($('#rushBubble'), `${extra}<span class="goal rushgoal">${eggs}</span>`);
  }
  function tickRush() { if (R.ready && !R.done) $('#rushTime').textContent = secs(performance.now() - R.t0); }
  function rushNote() {
    const m = R.notes[R.pos];
    R.missHere = 0;
    rushKb.setTarget(null);
    rushStaff(m);
    expectNote(m);
  }
  function rushInput(m: number, source: NoteSource) {
    if (!R.ready || R.done) return;
    const want = R.notes[R.pos];
    if (pc(m) === pc(want)) {
      rushKb.flash(m, 'good', 300);
      peck();
      app.act(rushChicken(), 'peck', 300);
      R.last = { m, at: performance.now() };
      R.pos++;
      paintRush();
      if (R.pos >= R.notes.length) return rushDone();
      return rushNote();
    }
    // the mic still hearing the note before isn't a wrong key
    if (source === 'mic' && pc(m) === pc(R.last.m) && performance.now() - R.last.at < RING) return;
    R.misses++; R.missHere++;
    rushKb.flash(m, 'bad', 500);
    app.act(rushChicken(), 'oops');
    if (R.missHere >= HINT_AFTER) { rushKb.setTarget(want); paintRush(`${app.bigLetter(want)} `); }
    else paintRush('🙈 ');
  }
  function rushDone() {
    R.done = true; R.ready = false;
    clearInterval(R.timer);
    expectNote(null);
    rushKb.setTarget(null);
    const s = RUSH_STAGES[R.si];
    const ms = performance.now() - R.t0;
    $('#rushTime').textContent = secs(ms);
    const eggs = rushEggs(R.misses, ms / 1000);
    const p = app.progress();
    const best = (p.rushBest || {})[s.id];
    const newBest = !best || ms < best;
    if (newBest) p.rushBest = { ...(p.rushBest || {}), [s.id]: Math.round(ms) };
    win(s.id, eggs);
    app.save();
    cluck(2);
    const i = R.si;
    setTimeout(() => app.party(eggs, {
      again: () => openRush(i),
      next: () => (i + 1 < RUSH_STAGES.length ? openRush(i + 1) : app.show('games')),
      words: newBest && best ? [songDone(eggs), RUSH_BEST] : songDone(eggs),
    }), 500);
  }

  /* ---------- Echo Game and Twinkle Twist: listen, then play it back with the pecks ---------- */
  const beatKb = makeKeyboard($('#beatKb'), (m: number) => app.noteIn(m, 'tap'), onRelease);
  const beatChicken = () => document.querySelector('#beatChicken');
  const B = {
    kind: 'cluck' as 'cluck' | 'twinkle', si: 0, round: 0, tries: 0, fails: 0, tokens: '', notes: [] as Note[],
    judge: null as BeatJudge | null, slips: 0, drawn: null as Drawn | null, shown: false, tok: 0, done: false,
    stop: null as null | (() => void),
  };
  const stages = () => (B.kind === 'cluck' ? CLUCK_STAGES : TWINKLE_STAGES);
  const rounds = () => (B.kind === 'cluck' ? CLUCK_ROUNDS : TWINKLE_ROUNDS);
  const timeOf = () => (B.kind === 'cluck' ? CLUCK_STAGES[B.si].time : '4/4');
  const beatMs = () => 60000 / stages()[B.si].tempo;
  function openRhythm(k: 'cluck' | 'twinkle', i: number) { B.kind = k; B.si = i; kind = k; app.show('beat'); }
  function renderBeat() {
    const s = stages()[B.si];
    Object.assign(B, { round: 0, fails: 0, tokens: '', done: false, judge: null });
    $('#beatTitle').textContent = `${B.kind === 'cluck' ? '👏' : '⭐'} ${s.emoji}`;
    beatKb.reset();
    if (B.kind === 'cluck') { beatKb.setRange(60, 76); beatKb.setLetters('none'); }
    else { beatKb.setRange(60, 72); beatKb.setHL([60, 62, 64, 65, 67, 69]); beatKb.setLetters('hl'); }
    app.setInput(beatInput);
    paintBeatDots();
    const t = ++B.tok;
    say(B.kind === 'cluck' ? CLUCK_START : twinkleStart(TWINKLE_STAGES[B.si].word), () => t === B.tok && newRound());
  }
  function paintBeatDots() {
    $('#beatDots').innerHTML = Array.from({ length: rounds() }, (_, i) => `<i class="${i < B.round ? 'done' : i === B.round ? 'on' : ''}"></i>`).join('');
  }
  function newRound() {
    B.tokens = B.kind === 'cluck' ? cluckPattern(CLUCK_STAGES[B.si], B.tokens || null) : twinkleRounds(TWINKLE_STAGES[B.si])[B.round];
    B.notes = parse(B.tokens);
    B.tries = 0;
    // Echo Game: listen first, the notes appear after; Twinkle Twist: read and listen
    drawBeat(B.kind === 'twinkle');
    demo();
  }
  function drawBeat(withNotes: boolean) {
    B.shown = withNotes;
    B.drawn = drawStaff($('#beatStaff'), withNotes ? B.notes : [], { minWidth: 420, time: timeOf(), letters: B.kind === 'twinkle', counts: withNotes });
  }
  function marks() {
    const d = B.drawn, j = B.judge;
    if (!d || !B.shown) return;
    d.noteEls.forEach((e) => e && e.classList.remove('done', 'miss'));
    // Echo Game shows the notes after you play, so only the missed ones are marked
    if (j) j.items.forEach((it) => { const e = d.noteEls[it.i]; if (e && it.result && (it.result === 'miss' || B.kind === 'twinkle')) e.classList.add(it.result === 'miss' ? 'miss' : 'done'); });
  }
  function lightBeat(b: number) {
    const d = B.drawn;
    if (!d || !d.countEls.length) return;
    d.countEls.forEach((e, j) => e.classList.toggle('on', j === b));
    d.cur.setAttribute('x', String(b < 0 ? -10000 : d.countAt(b) - 22));
  }
  function stopRun() { if (B.stop) { const f = B.stop; B.stop = null; f(); } }
  // one bar of pecks to count in, then the notes (demo: the chicken plays them). Returns when the first note is due.
  function run(demo: boolean, onEnd: () => void) {
    stopRun();
    const t = B.tok;
    const notes = B.notes, tl = timeline(notes);
    const total = tl.length ? tl[tl.length - 1].at + tl[tl.length - 1].len : 0;
    const per = barBeats(timeOf()), ms = beatMs();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const beat = startBeat({
      bpm: 60000 / ms,
      accent: (k) => k % per === 0,
      onBeat: (k) => {
        if (t !== B.tok) return;
        app.act(beatChicken(), 'peck', Math.min(280, ms * 0.6));
        const b = k - per;
        if (b < 0) { app.bubble($('#beatBubble'), `<span class="count">${Array.from({ length: per }, (_, j) => `<i class="${j === k ? 'on' : ''}">${j + 1}</i>`).join('')}</span>`); return; }
        if (b === 0) app.bubble($('#beatBubble'), demo ? '👂 🐔' : '🎹 🥁');
        if (b >= total) { lightBeat(-1); if (demo) { stopRun(); onEnd(); } return; }
        lightBeat(b);
        if (demo) tl.filter((x) => x.play && x.at >= b - 1e-6 && x.at < b + 1 - 1e-6).forEach((x) => timers.push(setTimeout(() => {
          if (t !== B.tok) return;
          const n = notes[x.i];
          if (n.r) return;
          const keys = n.keys.map((y) => y.m);
          playNote(keys, (x.len * ms * 0.9) / 1000);
          keys.forEach((m) => beatKb.flash(m, 'down', Math.min(400, x.len * ms)));
        }, (x.at - b) * ms)));
      },
    });
    const loop = setInterval(beatLoop, 40);
    B.stop = () => { beat.stop(); timers.forEach(clearTimeout); clearInterval(loop); };
    return beat.t0 + per * ms;
  }
  function demo() {
    const t = B.tok;
    B.judge = null;
    expectNote(null);
    marks();
    run(true, () => setTimeout(() => t === B.tok && turn(), 400));
  }
  function turn() {
    const t = B.tok;
    app.bubble($('#beatBubble'), '🎹 👂');
    say(RHYTHM_TURN, () => {
      if (t !== B.tok) return;
      B.slips = 0;
      expectNote(B.kind === 'cluck' ? 72 : null);
      const t1 = run(false, () => {}); // keeps pecking until every note is judged
      B.judge = new BeatJudge(B.notes, beatMs(), t1);
    });
  }
  function beatLoop() {
    const j = B.judge;
    if (!j) return;
    if (j.tick(performance.now()).length) { marks(); app.act(beatChicken(), 'oops'); }
    if (j.done) tryDone();
  }
  function beatInput(m: number, source: NoteSource) {
    const j = B.judge;
    if (!j || B.done) return;
    const at = performance.now() - (source === 'mic' ? MIC_LAG : 0);
    // Echo Game: any key is the chicken's C
    const r = j.input(B.kind === 'cluck' ? 72 : m, at);
    if (!r) {
      // a key during a rest
      const b = (at - j.items[0].t) / j.beatMs + timeline(B.notes)[j.items[0].i].at;
      const x = timeline(B.notes).find((y) => b >= y.at && b < y.at + y.len);
      if (x && B.notes[x.i].r) { B.slips++; beatKb.flash(m, 'bad', 400); app.act(beatChicken(), 'oops'); app.bubble($('#beatBubble'), '🤫'); if (B.slips === 1) say(RHYTHM_SHH); }
      return;
    }
    if (r.grade === 'wrong') { beatKb.flash(m, 'bad', 400); app.act(beatChicken(), 'oops'); return; }
    beatKb.flash(m, 'good', 300);
    marks();
    app.bubble($('#beatBubble'), r.grade === 'good' ? '🎯' : r.grade === 'early' ? '🐇 👍' : '🐢 👍');
    if (r.grade === 'good') app.act(beatChicken(), 'happy', 400);
    if (j.done) setTimeout(() => B.judge === j && tryDone(), 300);
  }
  function tryDone() {
    const j = B.judge!;
    stopRun();
    lightBeat(-1);
    expectNote(null);
    const c = j.counts();
    const ok = c.miss === 0 && B.slips <= 1 && c.good >= j.items.length / 2;
    // now the notes on the staff: green for the ones you got, red for the ones you missed
    if (!B.shown) drawBeat(true);
    marks();
    B.judge = null;
    B.tries++;
    const t = ++B.tok;
    if (ok || B.tries >= 2) {
      if (!ok) B.fails++;
      B.round++;
      paintBeatDots();
      if (ok) { cluck(2); app.act(beatChicken(), 'happy', 900); }
      app.bubble($('#beatBubble'), ok ? '🎉' : '👍');
      say(ok ? RHYTHM_GOOD : RHYTHM_OK);
      setTimeout(() => { if (t !== B.tok) return; if (B.round >= rounds()) beatDone(); else newRound(); }, ok ? 2200 : 2600);
      return;
    }
    B.fails++;
    app.act(beatChicken(), 'oops');
    app.bubble($('#beatBubble'), `🎯 ${c.good} · 👍 ${c.early + c.late} · 🙈 ${c.miss} 🔁`);
    setTimeout(() => t === B.tok && say(RHYTHM_AGAIN, () => t === B.tok && demo()), 1200);
  }
  function beatDone() {
    B.done = true;
    const s = stages()[B.si];
    const eggs = cluckEggs(B.fails);
    win(s.id, eggs);
    app.save();
    const kind = B.kind, i = B.si, n = stages().length;
    app.party(eggs, {
      again: () => openRhythm(kind, i),
      next: () => (i + 1 < n ? openRhythm(kind, i + 1) : app.show('games')),
      words: songDone(eggs),
    });
  }
  // Hear it again (not while it's your turn)
  $('#beatHear').addEventListener('click', () => { if (B.done || B.judge) return; B.tok++; stopTalking(); demo(); });

  return {
    screens: { games: renderPicker, rush: renderRush, beat: renderBeat },
    // leaving a screen stops the clock and the pecks
    leave() { R.tok++; B.tok++; R.ready = false; clearInterval(R.timer); B.judge = null; stopRun(); },
    R, B, // for tests
  };
}
