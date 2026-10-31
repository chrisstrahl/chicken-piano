// Ear quizzes (Learn → Ears): plain data and puzzle makers, no DOM, so Node tests and tools can use them.
// The screens are src/quizgames.ts.
// - Mystery Melodies: the chicken plays the start of a song you know; pick which song it is.
// - Happy or Sad: the chicken plays a chord or a little tune; is it happy (major) or sad (minor)?
import type { Note, Song } from './types';

export type Mood = 'happy' | 'sad';
export interface MysteryStage { id: string; emoji: string; levels: [number, number]; choices: number }
export interface MoodStage { id: string; emoji: string; form: 'both' | 'chord' | 'tune' }
export const QUIZ_ROUNDS = 5;

// Songs from a range of levels; only tunes with a real name (made-up "New song"s are hard to recognise)
export const MYSTERY_STAGES: MysteryStage[] = [
  { id: 'mm1', emoji: '🐣', levels: [1, 3], choices: 3 },
  { id: 'mm2', emoji: '🐥', levels: [1, 5], choices: 3 },
  { id: 'mm3', emoji: '🐔', levels: [4, 7], choices: 3 },
  { id: 'mm4', emoji: '🦅', levels: [1, 10], choices: 4 },
];
export const MOOD_STAGES: MoodStage[] = [
  { id: 'hs1', emoji: '🐣', form: 'both' }, // the chord's notes one by one, then together
  { id: 'hs2', emoji: '🐥', form: 'chord' }, // just the chord
  { id: 'hs3', emoji: '🐔', form: 'tune' }, // a little tune, then its chord
];
export const QUIZ_MAX_EGGS = (MYSTERY_STAGES.length + MOOD_STAGES.length) * 3;

// Eggs for a finished nest: a wrong pick or two is fine
export const quizEggs = (misses: number) => (misses <= 1 ? 3 : misses <= 3 ? 2 : 1);

export const knownSongs = (songs: Song[]) => songs.filter((s) => s.sub && !s.sub.startsWith('New song') && !s.sub.startsWith('Old rhyme'));
// The tune of a song (bass-clef songs keep it in the left hand)
export const melodyOf = (s: Song): Note[] => (s.melodyHand === 'lh' ? s.lh : s.notes);
// The first n sounding notes (rests and ties in between come along)
export function opening(notes: Note[], n: number): Note[] {
  const out: Note[] = [];
  let sounding = 0;
  for (const x of notes) {
    if (!x.r && !x.tie && sounding >= n) break;
    out.push(x);
    if (!x.r && !x.tie) sounding++;
  }
  return out;
}

const shuffle = <T>(a: T[], rnd: () => number) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// One Mystery Melodies puzzle: the song to guess and the cards (it plus look-alikes-free others), shuffled.
// Not the same song as the round before. rnd: Math.random, or a seeded one in tests.
export function mysteryPuzzle(stage: MysteryStage, songs: Song[], last: string | null = null, rnd = Math.random): { answer: Song; cards: Song[] } {
  const pool = knownSongs(songs).filter((s) => s.level >= stage.levels[0] && s.level <= stage.levels[1]);
  const fresh = pool.filter((s) => s.id !== last);
  const answer = fresh[Math.floor(rnd() * fresh.length)];
  // other cards: different emoji, so a child who can't read yet can still tell them apart
  const others = shuffle(pool.filter((s) => s.id !== answer.id && s.emoji !== answer.emoji), rnd)
    .filter((s, i, a) => a.findIndex((x) => x.emoji === s.emoji) === i).slice(0, stage.choices - 1);
  return { answer, cards: shuffle([answer, ...others], rnd) };
}

// One Happy or Sad puzzle: a major (happy) or minor (sad) chord on a white key, maybe with a little tune.
// Returns the notes to play as [midi list, beats] steps.
const ROOTS = [60, 62, 64, 65, 67];
const TUNES = [[0, 1, 2, 1, 0], [0, 2, 4, 2, 0], [4, 3, 2, 1, 0], [0, 1, 2, 3, 4, 2, 0], [2, 1, 0, 1, 2, 2, 2]];
export function moodPuzzle(stage: MoodStage, last: Mood | null = null, rnd = Math.random): { mood: Mood; steps: [number[], number][] } {
  // a fair coin, but never three of the same in a row is too fussy: just avoid a long run by flipping twice
  let mood: Mood = rnd() < 0.5 ? 'happy' : 'sad';
  if (mood === last && rnd() < 0.3) mood = mood === 'happy' ? 'sad' : 'happy';
  const root = ROOTS[Math.floor(rnd() * ROOTS.length)];
  const third = mood === 'happy' ? 4 : 3;
  const chord = [root, root + third, root + 7];
  const scale = [0, 2, third, 5, 7].map((x) => root + x);
  const steps: [number[], number][] = [];
  if (stage.form === 'both') { chord.forEach((m) => steps.push([[m], 1])); steps.push([chord, 3]); }
  else if (stage.form === 'chord') steps.push([chord, 3]);
  else { TUNES[Math.floor(rnd() * TUNES.length)].forEach((d) => steps.push([[scale[d]], 1])); steps.push([chord, 3]); }
  return { mood, steps };
}
