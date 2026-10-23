// Ear game data: the nests (stages) and the puzzles in them. Plain data, no DOM, so Node tools can use it
// (tools/voice-lines.mjs counts the eggs through lines.js). The screen is src/eartraining.ts.

const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72;

// Each nest: which keys the chicken may play (pool) and how many notes it plays at once (len).
// Easiest first: one note from three, then five, then eight keys; then the same pools with two and three notes.
export const EAR_STAGES = [
  { id: 'ear1', emoji: '🐣', pool: [C4, D4, E4], len: 1 },
  { id: 'ear2', emoji: '🐥', pool: [C4, D4, E4, F4, G4], len: 1 },
  { id: 'ear3', emoji: '🐤', pool: [C4, D4, E4, F4, G4, A4, B4, C5], len: 1 },
  { id: 'ear4', emoji: '🐔', pool: [C4, D4, E4], len: 2 },
  { id: 'ear5', emoji: '🐓', pool: [C4, D4, E4, F4, G4], len: 2 },
  { id: 'ear6', emoji: '🦃', pool: [C4, D4, E4], len: 3 },
  { id: 'ear7', emoji: '🦚', pool: [C4, D4, E4, F4, G4], len: 3 },
  { id: 'ear8', emoji: '🦅', pool: [C4, D4, E4, F4, G4, A4, B4, C5], len: 3 },
];
export const EAR_ROUNDS = 5; // puzzles in a nest
export const EAR_MAX_EGGS = EAR_STAGES.length * 3;

// Eggs for a finished nest, like a song: a few wrong guesses are fine (trying keys is how ears learn)
export const earEggs = (misses) => (misses <= 2 ? 3 : misses <= 6 ? 2 : 1);

// The notes for one puzzle: no key twice in a row inside a pattern, and not the same puzzle as last time.
// rnd: () => 0..1 (Math.random, or a seeded one in tests)
/** @param {{ pool: number[], len: number }} stage @param {number[] | null} [last] @param {() => number} [rnd] @returns {number[]} */
export function earPuzzle(stage, last = null, rnd = Math.random) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  for (let tries = 0; ; tries++) {
    const out = [];
    while (out.length < stage.len) {
      const m = pick(stage.pool);
      if (m !== out[out.length - 1]) out.push(m);
    }
    if (tries > 20 || !last || out.join() !== last.join()) return out;
  }
}
