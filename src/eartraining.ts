// Ear game: the chicken plays a note (or two or three), and you find them on the piano: with the microphone,
// a USB keyboard, or the keys on screen. Eight nests, easiest first (src/ear.js); each nest is five puzzles
// and gives up to three eggs, like a song.
import { COLORS, letterOf, nameOf } from './music.js';
import { playSequence, say, stopTalking, cluck, peck } from './audio.js';
import { expectNote } from './mic.js';
import { drawStaff } from './staff.js';
import { makeKeyboard } from './keyboard.js';
import { EAR_STAGES, EAR_ROUNDS, earEggs, earPuzzle } from './ear.js';
import { EAR_PICK, EAR_START, EAR_HINT, ECHO_AGAIN, songDone } from './lines.js';
import type { NoteSource, EarStage } from './types';

const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector<T>(s)!;
const pc = (m: number) => ((m % 12) + 12) % 12;
const TEMPO = 80; // the chicken's notes, quarter beats a minute
const MIC_QUIET = 1000; // ms after the chicken's last note ends before the mic may answer (the piano still rings)
const HINT_AFTER = 3; // wrong keys on one puzzle before the right key glows

type Party = (eggs: number, o: { again: () => void; next: () => void; words: string }) => void;
// What the app hands over
export interface EarApp {
  show: (screen: string) => void;
  bubble: (el: HTMLElement, html: string) => void;
  bigLetter: (m: number) => string;
  act: (chicken: Element | null, cls: string, ms?: number) => void;
  party: Party;
  // the current player's progress (progress.ears: nest id -> best eggs) and saving it
  progress: () => { ears?: Record<string, number> };
  save: () => void;
  // the screen's handlers for played notes
  setInput: (onNote: (m: number, source: NoteSource) => void) => void;
  noteIn: (m: number, source: NoteSource) => void;
  keyUp: (m: number) => void;
}

// Eggs won in the ear game, for the coop
export const earEggTotal = (progress: { ears?: Record<string, number> }) => Object.values(progress.ears || {}).reduce((a, b) => a + b, 0);

export function setupEarTraining(app: EarApp) {
  // keyboard.js is untyped JS, and TypeScript reads its default onRelease as taking no arguments
  const onRelease = ((m: number) => app.keyUp(m)) as unknown as () => void;
  const kb = makeKeyboard($('#earKb'), (m: number) => app.noteIn(m, 'tap'), onRelease);
  const chicken = () => document.querySelector('#earChicken');
  const E = {
    si: 0, round: 0, notes: [] as number[], pos: 0, misses: 0, missHere: 0,
    ready: false, micAt: 0, tok: 0, stopPlay: null as null | (() => void), done: false,
  };
  const stage = (): EarStage => EAR_STAGES[E.si];
  const eggsOf = (id: string) => (app.progress().ears || {})[id] || 0;
  const nextStage = () => { const i = EAR_STAGES.findIndex((s) => !eggsOf(s.id)); return i < 0 ? EAR_STAGES.length - 1 : i; };

  /* ---------- the nests ---------- */
  const dots = (pool: number[]) => pool.map((m) => `<i style="background:${COLORS[letterOf(m) as keyof typeof COLORS]}"></i>`).join('');
  const eggRow = (n: number) => [0, 1, 2].map((i) => `<span class="${i < n ? '' : 'no'}">🥚</span>`).join('');
  function renderPicker() {
    const nx = nextStage();
    $('#earCards').innerHTML = EAR_STAGES.map((s, i) => `<button class="card reccard earcard${i === nx ? ' next' : ''}" data-ear="${i}">
      <div class="em">${s.emoji}</div><div class="t">${'🎵'.repeat(s.len)}</div><div class="pool">${dots(s.pool)}</div>
      <div class="eggs">${eggRow(eggsOf(s.id))}</div></button>`).join('');
    say(EAR_PICK);
  }
  $('#earCards').addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-ear]');
    if (b) open(+b.dataset.ear!);
  });

  /* ---------- one nest ---------- */
  function open(i: number) {
    E.si = i;
    app.show('ear');
  }
  function renderGame() {
    const s = stage();
    E.round = 0; E.misses = 0; E.notes = []; E.done = false;
    $('#earTitle').textContent = `👂 ${s.emoji} ${'🎵'.repeat(s.len)}`;
    kb.setRange(Math.min(...s.pool), Math.max(...s.pool));
    kb.setHL(s.pool);
    kb.setTarget(null);
    app.setInput(input);
    paintDots();
    newPuzzle(true);
  }
  function paintDots() {
    $('#earDots').innerHTML = Array.from({ length: EAR_ROUNDS }, (_, i) => `<i class="${i < E.round ? 'done' : i === E.round ? 'on' : ''}"></i>`).join('');
  }
  // the notes found so far, on the staff and in the bubble (eggs for the ones still hidden)
  function paint(extra = '') {
    const found = E.notes.slice(0, E.pos);
    drawStaff($('#earStaff'), found.map((m) => ({ m, keys: [{ m, letter: letterOf(m), acc: '', oct: Math.floor(m / 12) - 1, label: nameOf(m) }], d: 'q', letter: letterOf(m), label: nameOf(m), lyric: '' })), { minWidth: 320, pack: true });
    const slots = E.notes.map((m, i) => (i < E.pos ? app.bigLetter(m) : '<span class="earegg">🥚</span>')).join('');
    app.bubble($('#earBubble'), `${extra}<span class="keys">${slots}</span>`);
  }
  function newPuzzle(first = false) {
    E.notes = earPuzzle(stage(), E.notes.length ? E.notes : null);
    E.pos = 0; E.missHere = 0;
    kb.setTarget(null);
    paint();
    if (first) { E.ready = false; const t = ++E.tok; say(EAR_START(stage().len), () => t === E.tok && listen()); }
    else listen();
  }
  // the chicken plays the puzzle; keys don't count until it has finished
  function listen() {
    stopListen();
    stopTalking();
    const t = ++E.tok;
    E.ready = false;
    expectNote(null);
    chicken()?.classList.add('dance');
    paint('👂 ');
    const notes = E.notes.map((m) => ({ m, keys: [{ m }], d: 'q' }));
    E.stopPlay = playSequence(notes, TEMPO, () => app.act(chicken(), 'peck', 300), () => {
      if (t !== E.tok) return;
      E.stopPlay = null;
      E.ready = true;
      E.micAt = performance.now() + MIC_QUIET;
      chicken()?.classList.remove('dance');
      paint('🎹 ');
      setTimeout(() => { if (t === E.tok && E.ready) expectNote(E.notes[E.pos]); }, MIC_QUIET);
    });
  }
  function stopListen() {
    if (E.stopPlay) { E.stopPlay(); E.stopPlay = null; }
    chicken()?.classList.remove('dance');
  }
  function input(m: number, source: NoteSource) {
    if (!E.ready || E.done) return;
    if (source === 'mic' && performance.now() < E.micAt) return; // our own notes still ringing
    const want = E.notes[E.pos];
    if (pc(m) === pc(want)) {
      kb.flash(m, 'good', 300);
      peck();
      app.act(chicken(), 'peck', 300);
      E.pos++;
      kb.setTarget(E.missHere >= HINT_AFTER && E.pos < E.notes.length ? E.notes[E.pos] : null);
      if (E.pos < E.notes.length) { paint('🎹 '); expectNote(E.notes[E.pos]); return; }
      return solved();
    }
    E.misses++; E.missHere++;
    E.pos = 0;
    kb.flash(m, 'bad', 500);
    app.act(chicken(), 'oops');
    const t = ++E.tok;
    E.ready = false;
    paint('🙈 ');
    // wrong key: hear it again; after a few, the right key glows too
    const hint = E.missHere >= HINT_AFTER;
    if (hint) kb.setTarget(E.notes[0]);
    say(hint ? EAR_HINT : ECHO_AGAIN, () => t === E.tok && listen());
  }
  function solved() {
    E.ready = false;
    expectNote(null);
    kb.setTarget(null);
    E.round++;
    paintDots();
    cluck(2);
    app.act(chicken(), 'happy', 900);
    paint('🎉 ');
    const t = ++E.tok;
    if (E.round >= EAR_ROUNDS) return setTimeout(() => t === E.tok && finish(), 900);
    setTimeout(() => t === E.tok && newPuzzle(), 1400);
  }
  function finish() {
    E.done = true;
    const s = stage();
    const eggs = earEggs(E.misses);
    const p = app.progress();
    p.ears = { ...(p.ears || {}), [s.id]: Math.max(eggsOf(s.id), eggs) };
    app.save();
    const i = E.si;
    app.party(eggs, {
      again: () => open(i),
      next: () => (i + 1 < EAR_STAGES.length ? open(i + 1) : app.show('ears')),
      words: songDone(eggs),
    });
  }
  // Hear it again
  $('#earHear').addEventListener('click', () => { if (!E.done && (E.ready || E.stopPlay)) listen(); });

  return {
    screens: { ears: renderPicker, ear: renderGame },
    // leaving a screen stops the chicken mid-puzzle
    leave() { E.tok++; E.ready = false; stopListen(); },
    E, // for tests
  };
}
