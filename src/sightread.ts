// Fresh Tunes (Learn → Reading): a brand new little tune every time, to read and play. Plain data and the
// tune maker, no DOM (Node tests use it). The screen is in src/freshtunes.ts.

// pool: white keys the tune may use (MIDI), len: notes, letters: show letter bubbles, leaps: biggest step
// between neighbours (in pool places), long: some half notes, clef
export interface FreshStage { id: string; emoji: string; pool: number[]; len: number; letters: boolean; leaps: number; long: boolean; clef: 'treble' | 'bass' }
const C3 = 48, D3 = 50, E3 = 52, F3 = 53, G3 = 55, C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72;
export const FRESH_STAGES: FreshStage[] = [
  { id: 'ft1', emoji: '🐣', pool: [C4, D4, E4], len: 4, letters: true, leaps: 1, long: false, clef: 'treble' },
  { id: 'ft2', emoji: '🐥', pool: [C4, D4, E4, F4, G4], len: 5, letters: true, leaps: 1, long: false, clef: 'treble' },
  { id: 'ft3', emoji: '🐤', pool: [C4, D4, E4, F4, G4], len: 6, letters: false, leaps: 2, long: false, clef: 'treble' },
  { id: 'ft4', emoji: '🐔', pool: [C4, D4, E4, F4, G4, A4, B4, C5], len: 7, letters: false, leaps: 2, long: true, clef: 'treble' },
  { id: 'ft5', emoji: '🦉', pool: [C3, D3, E3, F3, G3], len: 6, letters: false, leaps: 2, long: false, clef: 'bass' },
];
export const FRESH_ROUNDS = 4; // tunes in a nest
export const FRESH_MAX_EGGS = FRESH_STAGES.length * 3;
export const freshEggs = (misses: number) => (misses <= 1 ? 3 : misses <= 4 ? 2 : 1);

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const tokenOf = (m: number) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

// A tune that sounds like a tune: it starts on the lowest key or the middle, moves by steps (and small skips
// later on), never repeats a key three times, and ends on the home key (the lowest). Returns parse() tokens.
// rnd: Math.random, or a seeded one in tests.
export function freshTune(stage: FreshStage, rnd = Math.random): string {
  for (let tries = 0; ; tries++) {
    const at = walk(stage, rnd);
    if (tries > 200 || !at.some((x, k) => (k > 1 && x === at[k - 1] && x === at[k - 2]) || (k > 0 && Math.abs(x - at[k - 1]) > stage.leaps))) {
      // half notes on some beats (always the last note) when the nest has long notes
      return at.map((i, k) => `${tokenOf(stage.pool[i])}:${stage.long && (k === at.length - 1 || rnd() < 0.2) ? 'h' : 'q'}`).join(' ');
    }
  }
}
function walk(stage: FreshStage, rnd: () => number): number[] {
  const { pool, len, leaps } = stage;
  const at: number[] = [rnd() < 0.6 ? 0 : Math.floor(pool.length / 2)];
  while (at.length < len - 1) {
    const cur = at[at.length - 1];
    const moves: number[] = [];
    for (let d = -leaps; d <= leaps; d++) if (cur + d >= 0 && cur + d < pool.length) moves.push(d);
    let d = moves[Math.floor(rnd() * moves.length)];
    if (d === 0 && at.length >= 2 && at[at.length - 2] === cur) d = cur > 0 ? -1 : 1; // no three in a row
    at.push(cur + d);
  }
  // the last note goes home; the one before it is close to home, so the ending isn't a big jump
  if (at[at.length - 1] > leaps) at[at.length - 1] = Math.min(leaps, at[at.length - 1]);
  at.push(0);
  return at;
}
