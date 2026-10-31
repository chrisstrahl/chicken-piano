// Ear quizzes on screen (Learn → Ears): Mystery Melodies and Happy or Sad. The chicken plays, you tap a big
// picture. Each nest is five puzzles and gives up to three eggs, like a song. Data and puzzles: src/quiz.ts.
import { SONGS } from './music.js';
import { playSequence, playNote, say, stopTalking, cluck } from './audio.js';
import { makeKeyboard } from './keyboard.js';
import { MYSTERY_STAGES, MOOD_STAGES, QUIZ_ROUNDS, quizEggs, mysteryPuzzle, moodPuzzle, melodyOf, opening } from './quiz.js';
import type { Mood } from './quiz.ts';
import { MYSTERY_START, MOOD_START, MOOD_RIGHT, mysteryWas, ECHO_AGAIN, songDone, GAMES_PICK } from './lines.js';
import type { Song } from './types';

const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector<T>(s)!;
const FIRST_NOTES = 6; // Mystery Melodies plays this many notes; each "hear it again" adds a few more
const MORE_NOTES = 4;
const MOOD_TEMPO = 100;

type Party = (eggs: number, o: { again: () => void; next: () => void; words: string | string[] }) => void;
export interface QuizApp {
  show: (screen: string) => void;
  bubble: (el: HTMLElement, html: string) => void;
  act: (chicken: Element | null, cls: string, ms?: number) => void;
  party: Party;
  progress: () => { games?: Record<string, number> };
  save: () => void;
}

export function setupQuizzes(app: QuizApp) {
  const kb = makeKeyboard($('#quizKb'), (m: number) => playNote(m, 0.8));
  const chicken = () => document.querySelector('#quizChicken');
  const eggsOf = (id: string) => (app.progress().games || {})[id] || 0;
  const eggRow = (n: number) => [0, 1, 2].map((i) => `<span class="${i < n ? '' : 'no'}">🥚</span>`).join('');
  let kind: 'mystery' | 'mood' = 'mystery';
  const stages = () => (kind === 'mystery' ? MYSTERY_STAGES : MOOD_STAGES);
  const Q = {
    si: 0, round: 0, misses: 0, missHere: 0, ready: false, done: false, tok: 0, heard: 0,
    song: null as Song | null, cards: [] as Song[], mood: null as Mood | null, steps: [] as [number[], number][],
    stop: null as null | (() => void),
  };

  /* ---------- the nests ---------- */
  document.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-quiz]');
    if (b) { kind = b.dataset.quiz as typeof kind; app.show('quizzes'); }
  });
  function renderPicker() {
    $('#quizzesTitle').textContent = kind === 'mystery' ? '🎁 Mystery Melodies' : '😊 😢 Happy or Sad';
    $('#quizCards').innerHTML = stages().map((s, i) => `<button class="card reccard gamecard${eggsOf(s.id) ? '' : ' fresh'}" data-qi="${i}">
      <div class="em">${s.emoji}</div><div class="t">${kind === 'mystery' ? '🎵'.repeat((s as typeof MYSTERY_STAGES[number]).choices) : ({ both: '🎹 🎶', chord: '🎶', tune: '🎵 🎶' })[(s as typeof MOOD_STAGES[number]).form]}</div>
      <div class="eggs">${eggRow(eggsOf(s.id))}</div></button>`).join('');
    say(GAMES_PICK);
  }
  $('#quizCards').addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-qi]');
    if (b) open(+b.dataset.qi!);
  });
  function open(i: number) { Q.si = i; app.show('quiz'); }

  /* ---------- one nest ---------- */
  function renderGame() {
    const s = stages()[Q.si];
    Object.assign(Q, { round: 0, misses: 0, done: false, song: null, mood: null });
    $('#quizTitle').textContent = `${kind === 'mystery' ? '🎁' : '😊 😢'} ${s.emoji}`;
    kb.reset();
    kb.setRange(kind === 'mystery' ? 55 : 60, 79);
    kb.setLetters('none');
    paintDots();
    newPuzzle(true);
  }
  function paintDots() {
    $('#quizDots').innerHTML = Array.from({ length: QUIZ_ROUNDS }, (_, i) => `<i class="${i < Q.round ? 'done' : i === Q.round ? 'on' : ''}"></i>`).join('');
  }
  function paintChoices() {
    const box = $('#quizChoices');
    box.className = `choices quizchoices ${kind}`;
    box.innerHTML = kind === 'mystery'
      ? Q.cards.map((c) => `<button class="choice wide songpick" data-ans="${c.id}"><span class="em">${c.emoji}</span><small>${c.title}</small></button>`).join('')
      : `<button class="choice wide" data-ans="happy">😊<small>Happy</small></button><button class="choice wide" data-ans="sad">😢<small>Sad</small></button>`;
  }
  function newPuzzle(first = false) {
    Q.missHere = 0;
    Q.heard = 0;
    if (kind === 'mystery') {
      const p = mysteryPuzzle(MYSTERY_STAGES[Q.si], SONGS, Q.song && Q.song.id);
      Q.song = p.answer; Q.cards = p.cards;
    } else {
      const p = moodPuzzle(MOOD_STAGES[Q.si], Q.mood);
      Q.mood = p.mood; Q.steps = p.steps;
    }
    paintChoices();
    app.bubble($('#quizBubble'), '👂');
    if (first) { const t = ++Q.tok; say(kind === 'mystery' ? MYSTERY_START : MOOD_START, () => t === Q.tok && listen()); }
    else listen();
  }
  // the chicken plays; answers count once it starts (no need to wait for the end of a tune you know)
  function listen() {
    stopListen();
    stopTalking();
    const t = ++Q.tok;
    Q.ready = true;
    chicken()?.classList.add('dance');
    app.bubble($('#quizBubble'), '👂 🎶');
    const flash = (ms: number[], beats: number, tempo: number) => ms.forEach((m) => kb.flash(m, 'down', Math.min(500, (beats * 60000) / tempo)));
    const end = () => { if (t !== Q.tok) return; Q.stop = null; chicken()?.classList.remove('dance'); app.bubble($('#quizBubble'), '❓'); };
    if (kind === 'mystery') {
      const s = Q.song!;
      const notes = opening(melodyOf(s), FIRST_NOTES + MORE_NOTES * Q.heard);
      Q.heard++;
      Q.stop = playSequence(notes, s.tempo, (i) => { const n = notes[i]; if (!n.r) flash(n.keys.map((k) => k.m), 1, s.tempo); app.act(chicken(), 'peck', 250); }, end);
    } else {
      const notes = Q.steps.map(([ms, beats]) => ({ d: beats === 3 ? 'hd' : 'q', keys: ms.map((m) => ({ m })) }));
      Q.stop = playSequence(notes, MOOD_TEMPO, (i) => { flash(Q.steps[i][0], Q.steps[i][1], MOOD_TEMPO); app.act(chicken(), 'peck', 250); }, end);
    }
  }
  function stopListen() {
    if (Q.stop) { Q.stop(); Q.stop = null; }
    chicken()?.classList.remove('dance');
  }
  $('#quizChoices').addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-ans]');
    if (!b || !Q.ready || Q.done) return;
    const right = kind === 'mystery' ? Q.song!.id : Q.mood!;
    if (b.dataset.ans === right) return solved(b);
    Q.misses++; Q.missHere++;
    b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
    app.act(chicken(), 'oops');
    const t = ++Q.tok;
    Q.ready = false;
    stopListen();
    // a second wrong pick: the right one lights up
    if (Q.missHere >= 2) $('#quizChoices').querySelector(`[data-ans="${right}"]`)?.classList.add('hint');
    say(ECHO_AGAIN, () => t === Q.tok && listen());
  });
  function solved(b: HTMLElement) {
    Q.ready = false;
    stopListen();
    b.classList.add('right');
    Q.round++;
    paintDots();
    cluck(2);
    app.act(chicken(), 'happy', 900);
    app.bubble($('#quizBubble'), '🎉');
    const t = ++Q.tok;
    const next = () => { if (t !== Q.tok) return; if (Q.round >= QUIZ_ROUNDS) finish(); else newPuzzle(); };
    say(kind === 'mystery' ? mysteryWas(Q.song!.title) : MOOD_RIGHT[Q.mood!], () => setTimeout(next, 500));
  }
  function finish() {
    Q.done = true;
    const s = stages()[Q.si];
    const eggs = quizEggs(Q.misses);
    const p = app.progress();
    p.games = { ...(p.games || {}), [s.id]: Math.max(eggsOf(s.id), eggs) };
    app.save();
    const i = Q.si, n = stages().length;
    app.party(eggs, {
      again: () => open(i),
      next: () => (i + 1 < n ? open(i + 1) : app.show('quizzes')),
      words: songDone(eggs),
    });
  }
  $('#quizHear').addEventListener('click', () => { if (!Q.done && Q.ready) listen(); });

  return {
    screens: { quizzes: renderPicker, quiz: renderGame },
    leave() { Q.tok++; Q.ready = false; stopListen(); },
    Q, // for tests
    get kind() { return kind; },
  };
}
