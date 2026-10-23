// Learn games data: Egg Rush (read a note, play it, fast), Echo Game (copy the chicken's rhythm on any key)
// and Twinkle Twist (Twinkle Twinkle in new rhythms, the Suzuki way). Plain data, no DOM, so Node tools can use
// it (tools/voice-lines.mjs counts the eggs through lines.js). The screens are src/games.ts.

const C3 = 48, D3 = 50, E3 = 52, F3 = 53, G3 = 55, A3 = 57, B3 = 59;
const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76, F5 = 77;

/* ---------- Egg Rush ---------- */
// Each nest: the notes that may pop up. Notes below middle C go on the bass staff when clef is 'grand'.
export const RUSH_STAGES = [
  { id: 'rush1', emoji: '🐣', pool: [C4, D4, E4], clef: 'treble' },
  { id: 'rush2', emoji: '🐥', pool: [C4, D4, E4, F4, G4], clef: 'treble' },
  { id: 'rush3', emoji: '➖', pool: [E4, G4, B4, D5, F5], clef: 'treble' }, // line notes
  { id: 'rush4', emoji: '⚪', pool: [F4, A4, C5, E5], clef: 'treble' }, // space notes
  { id: 'rush5', emoji: '🐔', pool: [C4, D4, E4, F4, G4, A4, B4, C5], clef: 'treble' },
  { id: 'rush6', emoji: '⬇️', pool: [G3, A3, B3, C4, D4, E4], clef: 'treble' }, // ledger lines below
  { id: 'rush7', emoji: '🐻', pool: [C3, D3, E3, F3, G3], clef: 'bass' },
  { id: 'rush8', emoji: '🦅', pool: [C3, E3, G3, B3, C4, D4, F4, A4, C5], clef: 'grand' },
];
export const RUSH_ROUND = 10; // notes in one rush
// Eggs for a rush: few wrong keys and a quick pace (seconds per note)
export const rushEggs = (misses, secs) => {
  const pace = secs / RUSH_ROUND;
  return misses <= 1 && pace <= 3 ? 3 : misses <= 4 && pace <= 6 ? 2 : 1;
};
// The notes of one rush: never the same letter twice in a row (the mic could still hear the last one ringing)
/** @param {{ pool: number[] }} stage @param {() => number} [rnd] @returns {number[]} */
export function rushNotes(stage, rnd = Math.random) {
  const out = [];
  while (out.length < RUSH_ROUND) {
    const m = stage.pool[Math.floor(rnd() * stage.pool.length)];
    if (!out.length || m % 12 !== out[out.length - 1] % 12) out.push(m);
  }
  return out;
}

/* ---------- Echo Game ---------- */
// Each nest: the rhythm pieces a pattern is built from (one piece = a few beats), the time signature,
// how many bars the chicken plays, and the tempo. Every pattern is played on C.
export const CLUCK_STAGES = [
  { id: 'cluck1', emoji: '🐣', cells: ['q', 'q', 'h'], time: '4/4', bars: 1, tempo: 80 },
  { id: 'cluck2', emoji: '🐥', cells: ['q', 'q', 'h', 'R:q'], time: '4/4', bars: 1, tempo: 80 },
  { id: 'cluck3', emoji: '🐤', cells: ['q', 'h', 'R:q', 'w'], time: '4/4', bars: 2, tempo: 80 },
  { id: 'cluck4', emoji: '🐔', cells: ['q', 'h', '8 8'], time: '4/4', bars: 1, tempo: 72 },
  { id: 'cluck5', emoji: '🐓', cells: ['q', 'h', '8 8', 'R:q'], time: '4/4', bars: 2, tempo: 72 },
  { id: 'cluck6', emoji: '💃', cells: ['q', 'h', 'hd', '8 8'], time: '3/4', bars: 2, tempo: 80 },
];
export const CLUCK_ROUNDS = 5;
// Eggs for a nest of rounds: tries that needed a second listen
export const cluckEggs = (fails) => (fails <= 1 ? 3 : fails <= 3 ? 2 : 1);

const LEN = { 8: 0.5, q: 1, h: 2, hd: 3, w: 4 };
const cellBeats = (c) => c.split(' ').reduce((a, t) => a + LEN[t.replace('R:', '')], 0);
const onC = (c) => c.split(' ').map((t) => (t.startsWith('R:') ? t : `C5:${t}`)).join(' ');
// One pattern: bars filled with random pieces, each bar starting with a note, more notes than bars, and not the
// same as the last pattern. Returns note tokens on C5 (high enough to hear clearly, low enough for the mic).
/** @param {{ cells: string[], time: string, bars: number }} stage @param {string | null} [last] @param {() => number} [rnd] @returns {string} */
export function cluckPattern(stage, last = null, rnd = Math.random) {
  const per = (+stage.time.split('/')[0] * 4) / +stage.time.split('/')[1];
  const fill = () => {
    const bar = [];
    let left = per;
    while (left > 0) {
      const fit = stage.cells.filter((c) => cellBeats(c) <= left && !(bar.length === 0 && c.startsWith('R:')) && !(c.startsWith('R:') && bar[bar.length - 1]?.startsWith('R:')));
      if (!fit.length) return null;
      const c = fit[Math.floor(rnd() * fit.length)];
      bar.push(c);
      left -= cellBeats(c);
    }
    return bar.join(' ');
  };
  for (let tries = 0; ; tries++) {
    const bars = [];
    while (bars.length < stage.bars) { const b = fill(); if (b) bars.push(b); }
    const out = bars.map(onC).join(' ');
    const notes = out.split(' ').filter((x) => !x.startsWith('R:')).length;
    if (tries > 40 || (notes > stage.bars && out !== last)) return out;
  }
}

/* ---------- Twinkle Twist ---------- */
// Twinkle Twinkle's first two lines: pairs of the same note, then a long one. Each nest plays every pair
// in a new rhythm (the word is what the chicken says for it).
const LINES = [['C', 'G', 'A'], ['F', 'E', 'D']];
const ENDS = ['G', 'C'];
export const TWINKLE_STAGES = [
  { id: 'tw1', emoji: '⭐', word: 'Cluck, cluck', pair: ['q', 'q'], tempo: 80 },
  { id: 'tw2', emoji: '🌙', word: 'Long cluck', pair: ['h'], tempo: 84 },
  { id: 'tw3', emoji: '🐤', word: 'Chick-en, chick-en', pair: ['8', '8', '8', '8'], tempo: 66 },
  { id: 'tw4', emoji: '🥚', word: 'Chick-en cluck', pair: ['8', '8', 'q'], tempo: 69 },
  { id: 'tw5', emoji: '🐓', word: 'Cluck, chick-en', pair: ['q', '8', '8'], tempo: 69 },
];
// The rounds of a Twinkle nest: the rhythm alone on C (two pairs' worth), then line one, then line two.
/** @param {{ pair: string[] }} stage @returns {string[]} */
export function twinkleRounds(stage) {
  const pair = (l) => stage.pair.map((d) => `${l}:${d}`).join(' ');
  return [
    `${pair('C')} ${pair('C')}`,
    ...LINES.map((line, i) => `${line.map(pair).join(' ')} ${ENDS[i]}:h`),
  ];
}
export const TWINKLE_ROUNDS = 3;

export const GAME_MAX_EGGS = (RUSH_STAGES.length + CLUCK_STAGES.length + TWINKLE_STAGES.length) * 3;
