// Fresh Tunes on screen (Learn → Reading): a new little tune appears on the staff, you play it note by note
// (no clock, take your time), then the chicken plays it back so you hear what you read.
// Tunes and nests: src/sightread.ts.
import { parse } from './music.js';
import { playSequence, say, cluck, peck } from './audio.js';
import { expectNote } from './mic.js';
import { drawStaff } from './staff.js';
import { makeKeyboard } from './keyboard.js';
import { FRESH_STAGES, FRESH_ROUNDS, freshEggs, freshTune } from './sightread.js';
import { FRESH_START, FRESH_HEAR, GAMES_PICK, songDone } from './lines.js';
import type { Drawn } from './staff.ts';
import type { Note, NoteSource } from './types';

const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector<T>(s)!;
const pc = (m: number) => ((m % 12) + 12) % 12;
const HINT_AFTER = 2; // wrong keys on one note before its key glows
const RING = 1500; // ms the mic may still hear the last right note ringing
const TEMPO = 96;

type Party = (eggs: number, o: { again: () => void; next: () => void; words: string | string[] }) => void;
export interface FreshApp {
  missed: (m: number) => void; // a note wanted and missed (once per note), for the grown-ups' page
  show: (screen: string) => void;
  bubble: (el: HTMLElement, html: string) => void;
  bigLetter: (m: number) => string;
  act: (chicken: Element | null, cls: string, ms?: number) => void;
  party: Party;
  progress: () => { games?: Record<string, number> };
  save: () => void;
  setInput: (onNote: (m: number, source: NoteSource) => void) => void;
  noteIn: (m: number, source: NoteSource) => void;
  keyUp: (m: number) => void;
}

export function setupFreshTunes(app: FreshApp) {
  const onRelease = ((m: number) => app.keyUp(m)) as unknown as () => void;
  const kb = makeKeyboard($('#freshKb'), (m: number) => app.noteIn(m, 'tap'), onRelease);
  const chicken = () => document.querySelector('#freshChicken');
  const eggsOf = (id: string) => (app.progress().games || {})[id] || 0;
  const eggRow = (n: number) => [0, 1, 2].map((i) => `<span class="${i < n ? '' : 'no'}">🥚</span>`).join('');
  const F = {
    si: 0, round: 0, notes: [] as Note[], ms: [] as number[], pos: 0, misses: 0, missHere: 0, ready: false, done: false, tok: 0,
    drawn: null as Drawn | null, last: { m: -1, at: 0 }, stop: null as null | (() => void),
  };
  const stage = () => FRESH_STAGES[F.si];

  /* ---------- the nests ---------- */
  function renderPicker() {
    $('#freshCards').innerHTML = FRESH_STAGES.map((s, i) => `<button class="card reccard gamecard${eggsOf(s.id) ? '' : ' fresh'}" data-fi="${i}">
      <div class="em">${s.emoji}</div><div class="t">${s.clef === 'bass' ? '𝄢' : '𝄞'} ${'♩'.repeat(Math.min(s.len, 7))}</div><div class="when">${s.letters ? '🔤' : ''}</div>
      <div class="eggs">${eggRow(eggsOf(s.id))}</div></button>`).join('');
    say(GAMES_PICK);
  }
  $('#freshCards').addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-fi]');
    if (b) open(+b.dataset.fi!);
  });
  function open(i: number) { F.si = i; app.show('fresh'); }

  /* ---------- one nest ---------- */
  function renderGame() {
    const s = stage();
    Object.assign(F, { round: 0, misses: 0, done: false });
    $('#freshTitle').textContent = `📜 ${s.emoji}`;
    kb.reset();
    kb.setRange(Math.min(...s.pool), Math.max(...s.pool));
    kb.setLetters(s.letters ? 'all' : 'none');
    app.setInput(input);
    paintDots();
    const t = ++F.tok;
    newTune();
    say(FRESH_START, () => { if (t === F.tok) F.ready = true; });
  }
  function paintDots() {
    $('#freshDots').innerHTML = Array.from({ length: FRESH_ROUNDS }, (_, i) => `<i class="${i < F.round ? 'done' : i === F.round ? 'on' : ''}"></i>`).join('');
  }
  function newTune() {
    F.notes = parse(freshTune(stage()));
    F.ms = F.notes.map((n) => n.keys[0].m);
    F.pos = 0; F.missHere = 0; F.last = { m: -1, at: 0 };
    F.drawn = drawStaff($('#freshStaff'), F.notes, { minWidth: 420, clef: stage().clef, letters: stage().letters, time: null, bars: false });
    kb.setTarget(null);
    mark();
    app.bubble($('#freshBubble'), '👀 🎹');
    expectNote(F.ms[0]);
  }
  // played notes fade, the next one is ringed
  function mark() {
    const d = F.drawn;
    if (!d) return;
    d.noteEls.forEach((e, i) => { if (!e) return; e.classList.toggle('done', i < F.pos); e.classList.toggle('now', i === F.pos); });
  }
  function input(m: number, source: NoteSource) {
    if (!F.ready || F.done || F.pos >= F.notes.length) return;
    const want = F.ms[F.pos];
    if (pc(m) === pc(want)) {
      kb.flash(m, 'good', 300);
      peck();
      app.act(chicken(), 'peck', 300);
      F.last = { m, at: performance.now() };
      F.pos++;
      F.missHere = 0;
      kb.setTarget(null);
      mark();
      if (F.pos >= F.notes.length) return tuneDone();
      expectNote(F.ms[F.pos]);
      return;
    }
    if (source === 'mic' && pc(m) === pc(F.last.m) && performance.now() - F.last.at < RING) return;
    if (!F.missHere) app.missed(want);
    F.misses++; F.missHere++;
    kb.flash(m, 'bad', 500);
    app.act(chicken(), 'oops');
    if (F.missHere >= HINT_AFTER) { kb.setTarget(want); app.bubble($('#freshBubble'), app.bigLetter(want)); }
    else app.bubble($('#freshBubble'), '🙈 👀');
  }
  // the whole tune is played: hear it, then the next one
  function tuneDone() {
    F.ready = false;
    expectNote(null);
    F.round++;
    paintDots();
    cluck(2);
    app.act(chicken(), 'happy', 900);
    const t = ++F.tok;
    say(FRESH_HEAR, () => {
      if (t !== F.tok) return;
      chicken()?.classList.add('dance');
      app.bubble($('#freshBubble'), '👂 🎶');
      F.stop = playSequence(F.notes, TEMPO, (i) => { kb.flash(F.ms[i], 'down', 400); F.drawn?.noteEls[i]?.classList.add('now'); }, () => {
        if (t !== F.tok) return;
        F.stop = null;
        chicken()?.classList.remove('dance');
        setTimeout(() => {
          if (t !== F.tok) return;
          if (F.round >= FRESH_ROUNDS) return finish();
          newTune();
          F.ready = true;
        }, 700);
      });
    });
  }
  function finish() {
    F.done = true;
    const s = stage();
    const eggs = freshEggs(F.misses);
    const p = app.progress();
    p.games = { ...(p.games || {}), [s.id]: Math.max(eggsOf(s.id), eggs) };
    app.save();
    const i = F.si;
    app.party(eggs, {
      again: () => open(i),
      next: () => (i + 1 < FRESH_STAGES.length ? open(i + 1) : app.show('freshes')),
      words: songDone(eggs),
    });
  }

  return {
    screens: { freshes: renderPicker, fresh: renderGame },
    leave() { F.tok++; F.ready = false; if (F.stop) { F.stop(); F.stop = null; } chicken()?.classList.remove('dance'); },
    F, // for tests
  };
}
