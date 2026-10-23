// Notes, songs, lessons and levels.
//
// Note tokens (used everywhere below):  C  D#  Bb3  C5:h  G3:hd  E:8  R:q  C+E+G:w  C:h~
//   letter, optional # or b, optional octave (default 4), optional :duration, optional ~ (tie to next)
//   durations: 8 (eighth), q (quarter, default), qd (dotted quarter), h (half), hd (dotted half), w (whole). R = rest.
//   Song time: '4/4', '3/4' or '6/8'.
//   C+E+G = chord.

export const COLORS = { C: '#ff4d4d', D: '#ff9a1f', E: '#ffcc00', F: '#3cc95a', G: '#2fa2ff', A: '#9b5de5', B: '#ff6fb0' };
// darker versions for drawing notes on the white staff
export const INK = { C: '#e8322f', D: '#ef8300', E: '#e0a800', F: '#22a843', G: '#1782e0', A: '#7f3fd6', B: '#e64e98' };
export const BLACK_INK = '#4a4a4a';
export const BEATS = { 16: 0.25, 8: 0.5, q: 1, qd: 1.5, h: 2, hd: 3, w: 4 };

const LETTERS = 'CCDDEFFGGAAB';
const SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const letterOf = (m) => LETTERS[((m % 12) + 12) % 12];
export const isBlack = (m) => SHARP[((m % 12) + 12) % 12] === 1;
export const nameOf = (m) => letterOf(m) + (isBlack(m) ? '♯' : '');
export const samePc = (a, b) => ((a - b) % 12 + 12) % 12 === 0;

// One pitch like "Bb3" -> { m, letter, acc, oct, label }
function pitch(p) {
  const x = p.match(/^([A-G])([#b]?)(\d?)$/);
  if (!x) throw new Error('bad note ' + p);
  const [, letter, acc, o] = x;
  const oct = o === '' ? 4 : +o;
  const m = 12 * (oct + 1) + BASE[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
  return { m, letter, acc, oct, label: letter + (acc === '#' ? '♯' : acc === 'b' ? '♭' : '') };
}

// "C D E:h" (+ optional lyrics, one word per sounding note, "_" = none) -> note objects
export function parse(notes, lyrics = '') {
  const ly = lyrics.trim() ? lyrics.trim().split(/\s+/) : [];
  let li = 0;
  return notes.trim().split(/\s+/).map((tok) => {
    const tie = tok.endsWith('~');
    const [p, d = 'q'] = tok.replace('~', '').split(':');
    if (!(d in BEATS)) throw new Error('bad duration ' + tok);
    if (p === 'R') return { r: true, d, keys: [], lyric: '' };
    const keys = p.split('+').map(pitch);
    const w = ly[li++];
    return { m: keys[0].m, keys, d, tie, label: keys[0].label, letter: keys[0].letter, lyric: !w || w === '_' ? '' : w };
  });
}

import { SONG_DATA } from './songs.js';
import { arrange } from './arrange.js';

// lh / chords given in songs.js are kept as lhData / chordsData; arrange() works out the rest
const song = (id, level, emoji, title, sub, notes, lyrics, { lh, chords, fingers, lhFingers, ...opts } = {}) => arrange({
  id, level, emoji, title, sub, tempo: 100, time: '4/4', clef: 'treble', key: 'C', pickup: 0, bars: true, ...opts,
  lhData: lh, chordsData: chords, fingersData: fingers, lhFingersData: lhFingers, notes: parse(notes, lyrics),
}, parse);

// Songs live in songs.js (raw strings, grouped by level, easiest first).
export const SONGS = SONG_DATA.map(({ notes, lyrics, ...x }) => song(x.id, x.level, x.emoji, x.title, x.sub, notes, lyrics, x));
export const songById = (id) => SONGS.find((s) => s.id === id);

/* ------------------------------------------------------------------------------------------------
 Lessons. Every step asks the child to do something before moving on:
  show:   explain, then play the glowing keys (goal) to continue           { text, say, keys, staff, hear, goal, times }
  key:    find each target key (any octave)                                 { targets, letters, say, hint }
  seq:    play notes in order                                               { seqs, say }
  name:   "what note is this?" pick an egg (or play it)                     { notes, pool, clef, say }
  beats:  "how many beats?"                                                 { durs, say }
  choice: listen or look, then pick an answer                               { say, rounds:[{ staff, hear, tempo, vel, hl, options, answer }] }
------------------------------------------------------------------------------------------------ */
const L = (id, emoji, title, steps) => ({ id, emoji, title, steps });
const C_POS = 'C D E F G';

export const LEVELS = [
  {
    n: 1, emoji: '🐣', title: 'Hello, Keys', color: '#ff8a1f',
    lessons: [
      L('findc', '🏠', 'Find C', [
        { type: 'show', text: '⚫⚫ ⚫⚫⚫', say: 'Look at the black keys. They come in groups of two, and groups of three, like little chicken families! Tap a black key in a group of two.', keys: { groups: true, letters: 'none' }, goal: 'C# D#', times: 2 },
        { type: 'show', text: '🏠 = C', say: 'C lives just to the left of the two black keys. It is the chicken coop door! Tap the glowing C.', keys: { hl: 'C C5', letters: 'hl' }, goal: 'C', times: 2 },
        { type: 'key', targets: 'C C5 C', letters: 'none', say: 'Now find C all by yourself!', hint: 'Find the two black keys. C is right next to them, on the left.' },
      ]),
      L('de', '🦶', 'Meet D and E', [
        { type: 'show', text: 'D = middle', say: 'D lives right in the middle of the two black keys, like a chick snuggled between two hens. Tap D.', keys: { hl: 'D D5', letters: 'hl' }, goal: 'D', times: 2 },
        { type: 'show', text: 'E ➡️', say: 'E lives just to the right of the two black keys. Tap E.', keys: { hl: 'E E5', letters: 'hl' }, goal: 'E', times: 2 },
        { type: 'key', targets: 'D E D E', letters: 'none', say: 'Find D and E!', hint: 'Look for the two black keys. D is in the middle, E is on the right.' },
      ]),
      L('highlow', '🎈', 'High and Low', [
        { type: 'show', text: '🐓 ⬅️  ➡️ 🐥', say: 'Keys on the left sound low, like a big rooster. Keys on the right sound high, like a tiny chick! Tap a low key and a high key.', keys: { hl: 'C D C5 D5 E5', letters: 'none' }, goal: 'C D E', times: 2 },
        { type: 'choice', say: 'Listen! Is the second note higher or lower?', rounds: [
          { hear: 'C:h G:h', options: ['⬆️', '⬇️'], answer: '⬆️' },
          { hear: 'C5:h D:h', options: ['⬆️', '⬇️'], answer: '⬇️' },
          { hear: 'E:h F:h', options: ['⬆️', '⬇️'], answer: '⬆️' },
          { hear: 'G:h C:h', options: ['⬆️', '⬇️'], answer: '⬇️' },
        ] },
      ]),
      L('walk', '🐾', 'Chicken Walk', [
        { type: 'show', text: 'C D E ➡️', say: 'Walk up the keys: C, D, E. Each step sounds a little higher. Tap the three glowing keys.', keys: { hl: 'C D E', letters: 'hl' }, hear: 'C D E', goal: 'C D E', times: 3 },
        { type: 'seq', say: 'Play them in order!', seqs: ['C D E', 'E D C', 'C D E D C'] },
      ]),
    ],
  },
  {
    n: 2, emoji: '✋', title: 'Five Finger Friends', color: '#2fa2ff',
    lessons: [
      L('abc', '🔤', 'A B C D E F G', [
        { type: 'show', text: 'A B C D E F G', say: 'Music only uses seven letters. A, B, C, D, E, F, G. Then they start over again! Tap any keys and listen to their names.', keys: { letters: 'all' }, goal: 'C D E F G A B', times: 4 },
        { type: 'show', text: 'C D E F G ➡️', say: 'Start on C and walk up. C, D, E, F, G. Tap them all.', keys: { hl: C_POS, letters: 'hl' }, hear: C_POS, goal: C_POS, times: 5 },
        { type: 'key', targets: 'D E G F', letters: 'all', say: 'Your turn! Find each letter.' },
      ]),
      L('fg', '🌽', 'Meet F and G', [
        { type: 'show', text: 'F ⬅️ ⚫⚫⚫', say: 'F lives just to the left of the three black keys. Tap F.', keys: { hl: 'F', letters: 'hl', groups: true }, goal: 'F', times: 2 },
        { type: 'show', text: 'F ➡️ G', say: 'G is right next door to F. Tap G.', keys: { hl: 'G', letters: 'hl' }, goal: 'G', times: 2 },
        { type: 'key', targets: 'F G F G C', letters: 'none', say: 'Find each key!', hint: 'F is next to the three black keys, on the left. G is right after F.' },
      ]),
      L('fingers', '🖐️', 'Chicken Fingers', [
        { type: 'show', text: '👍 1  2  3  4  5', say: 'Your fingers have numbers! Thumb is one, then two, three, four, and your pinky is five. Put your right thumb on C and play C, D, E, F, G with fingers one to five.', keys: { hl: C_POS, letters: 'hl', fingers: true }, goal: C_POS, times: 5 },
        { type: 'choice', say: 'Thumb on C. Which finger plays this key?', rounds: [
          { hl: 'E', options: ['1', '2', '3', '4', '5'], answer: '3' },
          { hl: 'G', options: ['1', '2', '3', '4', '5'], answer: '5' },
          { hl: 'D', options: ['1', '2', '3', '4', '5'], answer: '2' },
          { hl: 'F', options: ['1', '2', '3', '4', '5'], answer: '4' },
        ] },
      ]),
      L('steps', '👣', 'Steps', [
        { type: 'show', text: 'step = next door', say: 'Going from a key to the very next key is called a step. One little chicken step! Step up from C to G.', staff: C_POS, keys: { hl: C_POS, letters: 'hl' }, goal: C_POS, times: 5 },
        { type: 'seq', say: 'Step up, then step down!', seqs: ['C D E F G', 'G F E D C'] },
      ]),
    ],
  },
  {
    n: 3, emoji: '⏱️', title: 'Beat Keepers', color: '#9b5de5',
    lessons: [
      L('beats', '⏱️', 'How Long?', [
        { type: 'show', text: '♩ = 1 👏', say: 'A filled in note with a stick is a quarter note. It gets one beat. Cluck! Play G four times.', staff: 'G G G G', hear: 'G G G G', clap: true, keys: { hl: 'G', letters: 'hl' }, goal: 'G', times: 4 },
        { type: 'show', text: '𝅗𝅥 = 2 👏👏', say: 'A hollow note with a stick is a half note. Two beats. Clu, uck! Play G and hold it.', staff: 'G:h G:h', hear: 'G:h G:h', clap: true, keys: { hl: 'G', letters: 'hl' }, goal: 'G', times: 2 },
        { type: 'show', text: '𝅝 = 4 👏👏👏👏', say: 'A hollow egg with no stick is a whole note. Four beats! Cluuuuuck! Play G and hold it a long time.', staff: 'G:w', hear: 'G:w', clap: true, keys: { hl: 'G', letters: 'hl' }, goal: 'G', times: 1 },
        { type: 'beats', durs: ['h', 'q', 'w', 'h', 'q'], say: 'How many beats?' },
      ]),
      L('rests', '🤫', 'Shh! Rests', [
        { type: 'show', text: '𝄽 = 🤫', say: 'A rest means be quiet! This squiggle is a quarter rest. Stay quiet for one beat. Play C, then shh!', staff: 'C R:q C R:q', hear: 'C R:q C R:q', clap: true, keys: { hl: 'C', letters: 'hl' }, goal: 'C', times: 2 },
        { type: 'show', text: '🎩 2 · 🕳️ 4', say: 'A half rest sits on the line like a hat. Two quiet beats. A whole rest hangs down like a hole. Four quiet beats! Play C to keep going.', staff: 'R:h R:h R:w', keys: { hl: 'C', letters: 'hl' }, goal: 'C' },
        { type: 'choice', say: 'Note or rest? Should you play, or be quiet?', rounds: [
          { staff: 'R:q', options: ['🎹', '🤫'], answer: '🤫' },
          { staff: 'E', options: ['🎹', '🤫'], answer: '🎹' },
          { staff: 'R:h', options: ['🎹', '🤫'], answer: '🤫' },
          { staff: 'G:h', options: ['🎹', '🤫'], answer: '🎹' },
        ] },
      ]),
      L('measures', '📦', 'Measures', [
        { type: 'show', text: '| 1 2 3 4 |', say: 'Bar lines cut music into little boxes called measures. Each box is like a nest that holds four beats. Play the notes in the first box: C, D, E, F.', staff: 'C D E F G:h G:h E:w', time: '4/4', keys: { hl: 'C D E F', letters: 'hl' }, goal: 'C D E F', times: 4 },
        { type: 'show', text: '4/4', say: 'The two numbers at the start are the time signature. The top 4 means four beats in every box. Tap C to go on.', staff: 'C C C C', time: '4/4', keys: { hl: 'C', letters: 'hl' }, goal: 'C' },
        { type: 'choice', say: 'Count the beats!', rounds: [
          { staff: 'C D', options: ['2', '3', '4'], answer: '2' },
          { staff: 'C:h D', options: ['2', '3', '4'], answer: '3' },
          { staff: 'C:h C:h', options: ['2', '3', '4'], answer: '4' },
          { staff: 'C D E F', options: ['2', '3', '4'], answer: '4' },
        ] },
      ]),
      L('clap', '👏', 'Clap and Play', [
        { type: 'show', text: '👂 then 🎹', say: 'Listen to the rhythm, then play it on C. Short, short, long!', staff: 'C C C:h', hear: 'C C C:h', clap: true, keys: { hl: 'C', letters: 'hl' }, goal: 'C', times: 3 },
        { type: 'choice', say: 'Listen. Which rhythm did you hear?', rounds: [
          { hear: 'C C C:h', options: ['♩ ♩ 𝅗𝅥', '𝅗𝅥 𝅗𝅥'], answer: '♩ ♩ 𝅗𝅥' },
          { hear: 'C:h C:h', options: ['♩ ♩ 𝅗𝅥', '𝅗𝅥 𝅗𝅥'], answer: '𝅗𝅥 𝅗𝅥' },
          { hear: 'C:w', options: ['𝅝', '♩ ♩ ♩ ♩'], answer: '𝅝' },
          { hear: 'C C C C', options: ['𝅝', '♩ ♩ ♩ ♩'], answer: '♩ ♩ ♩ ♩' },
        ] },
      ]),
    ],
  },
  {
    n: 4, emoji: '🎼', title: 'Staff Readers', color: '#3cc95a',
    lessons: [
      L('staff', '🎼', 'The Staff', [
        { type: 'show', text: '5 lines = staff', say: 'Music is written on five lines called a staff. It looks like a fence on the farm! Tap any key to see where it sits on the fence.', staff: '', keys: { letters: 'all' }, goal: 'C D E F G A B', times: 3, echo: true },
        { type: 'show', text: '⬆️ higher!', say: 'Notes climb up the fence. Higher on the staff means a higher sound! Play C, D, E, F, G and watch them climb.', staff: 'C D E F G', keys: { hl: C_POS, letters: 'hl' }, goal: C_POS, times: 5 },
        { type: 'show', text: 'Middle C', say: 'This is middle C. It stands on its own tiny line under the fence, like a chicken on a perch! Play middle C.', staff: 'C:w', keys: { hl: 'C', letters: 'hl' }, goal: 'C', times: 2 },
        { type: 'name', notes: 'E G C D F', pool: 'CDEFG', say: 'What note is this?' },
      ]),
      L('lines', '📝', 'Line Notes', [
        { type: 'show', text: 'E G B D F', say: 'The notes on the lines are E, G, B, D, F. Remember: Every Good Chick Does Fine! Play them going up.', staff: 'E G B D5 F5', keys: { hl: 'E G B D5 F5', letters: 'hl' }, goal: 'E G B D F', times: 5 },
        { type: 'name', notes: 'E G B D5 F5 G E', pool: 'EGBDF', say: 'Which line note is this?' },
      ]),
      L('spaces', '🙂', 'Space Notes', [
        { type: 'show', text: 'F A C E', say: 'The notes in the spaces spell FACE! F, A, C, E. Play them going up.', staff: 'F A C5 E5', keys: { hl: 'F A C5 E5', letters: 'hl' }, goal: 'F A C E', times: 4 },
        { type: 'name', notes: 'F A C5 E5 A F', pool: 'FACE', say: 'Which space note is this?' },
      ]),
      L('linespace', '🔍', 'Line or Space?', [
        { type: 'show', text: '➖ line  ⚪ space', say: 'A line note has the line going right through its middle. A space note sits between two lines. Play a line note, E, then a space note, F.', staff: 'E:h F:h', keys: { hl: 'E F', letters: 'hl' }, goal: 'E F', times: 2 },
        { type: 'choice', say: 'Is this note on a line or in a space?', rounds: [
          { staff: 'G:w', options: ['➖', '⚪'], answer: '➖' },
          { staff: 'A:w', options: ['➖', '⚪'], answer: '⚪' },
          { staff: 'C5:w', options: ['➖', '⚪'], answer: '⚪' },
          { staff: 'D5:w', options: ['➖', '⚪'], answer: '➖' },
          { staff: 'F:w', options: ['➖', '⚪'], answer: '⚪' },
        ] },
      ]),
    ],
  },
  {
    n: 5, emoji: '🧭', title: 'New Places', color: '#ff6fb0',
    lessons: [
      L('ab', '🍎', 'Meet A and B', [
        { type: 'show', text: 'G A B', say: 'After G come A and B. They live inside the group of three black keys, near the top. Tap A, then B.', keys: { hl: 'A B', letters: 'hl', groups: true }, goal: 'A B', times: 4 },
        { type: 'key', targets: 'A B A G B', letters: 'none', say: 'Find each key!', hint: 'A and B are near the top of the three black keys.' },
      ]),
      L('octave', '🎈', 'High C', [
        { type: 'show', text: 'C ... C', say: 'After B, the letters start over at C! Two keys with the same name sound alike, one is just higher. That is called an octave. Play both Cs.', keys: { hl: 'C C5', letters: 'hl' }, hear: 'C:h C5:h', goal: 'C', times: 2 },
        { type: 'choice', say: 'Listen. Same letter, or different?', rounds: [
          { hear: 'C:h C5:h', options: ['✅', '❌'], answer: '✅' },
          { hear: 'C:h G:h', options: ['✅', '❌'], answer: '❌' },
          { hear: 'D:h D5:h', options: ['✅', '❌'], answer: '✅' },
          { hear: 'E:h F:h', options: ['✅', '❌'], answer: '❌' },
        ] },
      ]),
      L('ledger', '🪜', 'Below the Staff', [
        { type: 'show', text: 'B A G ⬇️', say: 'Notes can climb down below the fence on little extra lines, called ledger lines. Below middle C are B, A and G. Play them going down.', staff: 'C B3 A3 G3', keys: { hl: 'C B3 A3 G3', letters: 'hl', range: 'C3 E5' }, goal: 'C B A G', times: 4 },
        { type: 'name', notes: 'B3 G3 A3 C B3', pool: 'GABC', say: 'What note is this?', range: 'C3 E5' },
      ]),
      L('gpos', '🤚', 'G Position', [
        { type: 'show', text: '👍 on G', say: 'Move your hand! Put your thumb on G, and your fingers on G, A, B, C, D. Play them all.', keys: { hl: 'G A B C5 D5', letters: 'hl' }, goal: 'G A B C D', times: 5 },
        { type: 'seq', say: 'Play up and down in G position!', seqs: ['G A B C5 D5', 'D5 C5 B A G'] },
      ]),
    ],
  },
  {
    n: 6, emoji: '💃', title: 'Waltz and Volume', color: '#ffcc00',
    lessons: [
      L('loud', '📢', 'Loud and Soft', [
        { type: 'show', text: 'f 🐓  p 🐥', say: 'f means forte, play loud like a rooster! p means piano, play soft like a sleepy chick. Listen, then play C loud and soft.', hear: 'C:h C:h', hearVel: [1, 0.25], keys: { hl: 'C', letters: 'hl' }, goal: 'C', times: 2 },
        { type: 'choice', say: 'Loud or soft?', rounds: [
          { hear: 'C E G', vel: 1, options: ['🐓 f', '🐥 p'], answer: '🐓 f' },
          { hear: 'C E G', vel: 0.2, options: ['🐓 f', '🐥 p'], answer: '🐥 p' },
          { hear: 'G:h', vel: 0.2, options: ['🐓 f', '🐥 p'], answer: '🐥 p' },
          { hear: 'G:h', vel: 1, options: ['🐓 f', '🐥 p'], answer: '🐓 f' },
        ] },
      ]),
      L('three', '3️⃣', '3/4 Time', [
        { type: 'show', text: '1 2 3 · 1 2 3', say: 'In three four time, every box has three beats. One, two, three! One, two, three! It feels like a dance. Play C, E, G.', staff: 'C E G C E G', time: '3/4', hear: 'C E G C E G', clap: true, keys: { hl: 'C E G', letters: 'hl' }, goal: 'C E G', times: 3 },
        { type: 'choice', say: 'Look at the top number. How many beats in each box?', rounds: [
          { staff: 'C E G', time: '3/4', options: ['3', '4'], answer: '3' },
          { staff: 'C E G C', time: '4/4', options: ['3', '4'], answer: '4' },
          { staff: 'G:hd', time: '3/4', options: ['3', '4'], answer: '3' },
        ] },
      ]),
      L('dotted', '🥚', 'Dotted Half Note', [
        { type: 'show', text: '𝅗𝅥. = 3', say: 'A dot makes a note longer. A dotted half note gets three beats. Play G and hold it, one, two, three!', staff: 'G:hd', time: '3/4', hear: 'G:hd', clap: true, keys: { hl: 'G', letters: 'hl' }, goal: 'G', times: 2 },
        { type: 'beats', durs: ['hd', 'h', 'q', 'hd', 'w'], say: 'How many beats?' },
      ]),
      L('tempo', '🐇', 'Fast and Slow', [
        { type: 'show', text: '🐇 fast  🐢 slow', say: 'Tempo means how fast the music goes. Some songs run like a bunny, some walk like a turtle. Play C, D, E fast, then slow.', hear: 'C D E', keys: { hl: 'C D E', letters: 'hl' }, goal: 'C D E', times: 6 },
        { type: 'choice', say: 'Fast or slow?', rounds: [
          { hear: 'C D E F G', tempo: 180, options: ['🐇', '🐢'], answer: '🐇' },
          { hear: 'C D E F G', tempo: 55, options: ['🐇', '🐢'], answer: '🐢' },
          { hear: 'G F E D C', tempo: 60, options: ['🐇', '🐢'], answer: '🐢' },
          { hear: 'G F E D C', tempo: 170, options: ['🐇', '🐢'], answer: '🐇' },
        ] },
      ]),
    ],
  },
  {
    n: 7, emoji: '🐤', title: 'Quick Chicks', color: '#46b4ff',
    lessons: [
      L('eighths', '🐤', 'Eighth Notes', [
        { type: 'show', text: '♫ = 1 beat', say: 'Two eighth notes holding hands make one beat. Say chick-en, chick-en! Play C eight quick times.', staff: 'C:8 C:8 C:8 C:8 C:8 C:8 C:8 C:8', hear: 'C:8 C:8 C:8 C:8 C:8 C:8 C:8 C:8', keys: { hl: 'C', letters: 'hl' }, goal: 'C', times: 8 },
        { type: 'beats', durs: ['8', 'q', 'h', '8', 'w'], say: 'How many beats?' },
      ]),
      L('count8', '🔢', 'One-and, Two-and', [
        { type: 'show', text: '1 & 2 & 3 & 4 &', say: 'Count eighth notes with and: one and two and three and four and! Play these notes.', staff: 'C:8 D:8 E:8 F:8 G:h', hear: 'C:8 D:8 E:8 F:8 G:h', keys: { hl: C_POS, letters: 'hl' }, goal: C_POS, times: 5 },
        { type: 'choice', say: 'How many beats in all?', rounds: [
          { staff: 'C:8 C:8', options: ['1', '2', '3'], answer: '1' },
          { staff: 'C:8 C:8 C', options: ['1', '2', '3'], answer: '2' },
          { staff: 'C:8 C:8 C:8 C:8', options: ['1', '2', '3'], answer: '2' },
          { staff: 'C:h C:8 C:8', options: ['1', '2', '3'], answer: '3' },
        ] },
      ]),
      L('ties', '🎀', 'Ties', [
        { type: 'show', text: '𝅗𝅥‿𝅗𝅥 = 4', say: 'A tie is a curved line that glues two notes on the same key together. Play it once and hold it for both! Play G and hold.', staff: 'G:h~ G:h', hear: 'G:w', keys: { hl: 'G', letters: 'hl' }, goal: 'G', times: 2 },
        { type: 'choice', say: 'How many beats do you hold?', rounds: [
          { staff: 'G:h~ G:h', options: ['2', '3', '4'], answer: '4' },
          { staff: 'G~ G', options: ['2', '3', '4'], answer: '2' },
          { staff: 'G:h~ G', options: ['2', '3', '4'], answer: '3' },
        ] },
      ]),
      L('repeat', '🔁', 'Repeat Sign', [
        { type: 'show', text: ':‖ = again!', say: 'Two dots by a thick bar line is a repeat sign. It means go back and play it again! Play C, D, E, then play it again.', staff: 'C D E:h', repeat: true, keys: { hl: 'C D E', letters: 'hl' }, goal: 'C D E', times: 6 },
        { type: 'choice', say: 'How many times do you play this?', rounds: [
          { staff: 'E D C:h', repeat: true, options: ['1', '2', '3'], answer: '2' },
          { staff: 'E D C:h', options: ['1', '2', '3'], answer: '1' },
        ] },
      ]),
    ],
  },
  {
    n: 8, emoji: '⚫', title: 'Black Key Secrets', color: '#555555',
    lessons: [
      L('sharp', '♯', 'Sharps', [
        { type: 'show', text: '♯ = up ➡️', say: 'A sharp sign means play the very next key up, to the right. C sharp is the black key just right of C! Tap C sharp.', staff: 'C:h C#:h', keys: { hl: 'C#', letters: 'hl' }, goal: 'C#', times: 2 },
        { type: 'key', targets: 'C# F# G# D#', letters: 'none', say: 'Find each sharp!', hint: 'Find the white key with that letter, then go one key to the right.' },
      ]),
      L('flat', '♭', 'Flats', [
        { type: 'show', text: '♭ = down ⬅️', say: 'A flat sign means play the very next key down, to the left. B flat is the black key just left of B! Tap B flat.', staff: 'B:h Bb:h', keys: { hl: 'Bb', letters: 'hl' }, goal: 'A#', times: 2 },
        { type: 'key', targets: 'Bb Eb Ab Db', letters: 'none', say: 'Find each flat!', hint: 'Find the white key with that letter, then go one key to the left.' },
      ]),
      L('halfwhole', '👟', 'Half and Whole Steps', [
        { type: 'show', text: '½ next · 1 skip one', say: 'A half step is the very next key, black or white. A whole step skips one key. E to F is a half step. C to D is a whole step. Play E, F, then C, D.', keys: { hl: 'C D E F', letters: 'hl' }, goal: 'C D E F', times: 4 },
        { type: 'choice', say: 'Half step or whole step?', rounds: [
          { hl: 'E F', hear: 'E F', options: ['½', '1'], answer: '½' },
          { hl: 'C D', hear: 'C D', options: ['½', '1'], answer: '1' },
          { hl: 'B C5', hear: 'B C5', options: ['½', '1'], answer: '½' },
          { hl: 'F G', hear: 'F G', options: ['½', '1'], answer: '1' },
          { hl: 'C C#', hear: 'C C#', options: ['½', '1'], answer: '½' },
        ] },
      ]),
      L('twonames', '🏷️', 'Two Names', [
        { type: 'show', text: 'C♯ = D♭', say: 'Every black key has two names! The key right of C is C sharp. It is also left of D, so it is D flat too. Tap it.', keys: { hl: 'C#', letters: 'hl' }, goal: 'C#', times: 2 },
        { type: 'choice', say: 'Which name is the same key?', rounds: [
          { hl: 'C#', ask: 'C♯', options: ['D♭', 'B♭', 'E♭'], answer: 'D♭' },
          { hl: 'F#', ask: 'F♯', options: ['A♭', 'G♭', 'D♭'], answer: 'G♭' },
          { hl: 'A#', ask: 'A♯', options: ['B♭', 'E♭', 'G♭'], answer: 'B♭' },
          { hl: 'D#', ask: 'D♯', options: ['A♭', 'D♭', 'E♭'], answer: 'E♭' },
        ] },
      ]),
    ],
  },
  {
    n: 9, emoji: '🐻', title: 'Left Hand Low', color: '#b8322a',
    lessons: [
      L('bass', '🐻', 'Bass Clef', [
        { type: 'show', text: '𝄢 = low', say: 'This is the bass clef. It is for low notes, usually played by your left hand. Its two dots hug the F line! Play low F.', staff: 'F3:w', clef: 'bass', keys: { hl: 'F3', letters: 'hl', range: 'C3 C5' }, goal: 'F', times: 2 },
        { type: 'show', text: 'C D E F G', say: 'Here are C, D, E, F, G down low, on the bass staff. Play them with your left hand.', staff: 'C3 D3 E3 F3 G3', clef: 'bass', keys: { hl: 'C3 D3 E3 F3 G3', letters: 'hl', range: 'C3 C5' }, goal: C_POS, times: 5 },
      ]),
      L('bassnotes', '🎯', 'Bass Notes', [
        { type: 'show', text: 'G B D F A', say: 'On the bass staff, the line notes are G, B, D, F, A. Good Burritos Don\'t Fall Apart! Play low G.', staff: 'G2 B2 D3 F3 A3', clef: 'bass', keys: { hl: 'G3', letters: 'hl', range: 'C3 C5' }, goal: 'G', times: 1 },
        { type: 'name', notes: 'C3 E3 G3 D3 F3', pool: 'CDEFG', clef: 'bass', say: 'What low note is this?', range: 'C3 C5' },
      ]),
      L('lefthand', '🤚', 'Left Hand C', [
        { type: 'show', text: '5 on C · 1 on G', say: 'Left hand: your pinky, finger five, goes on low C. Your thumb, finger one, goes on G. Play C, D, E, F, G with your left hand.', keys: { hl: 'C3 D3 E3 F3 G3', letters: 'hl', range: 'C3 C5' }, goal: C_POS, times: 5 },
        { type: 'seq', say: 'Left hand, up and down!', seqs: ['C3 D3 E3 F3 G3', 'G3 F3 E3 D3 C3'], range: 'C3 C5' },
      ]),
      L('whichclef', '🔀', 'Treble or Bass?', [
        { type: 'show', text: '𝄞 high · 𝄢 low', say: 'Treble clef is for high notes, often the right hand. Bass clef is for low notes, often the left hand. Play a high C and a low C.', keys: { hl: 'C3 C5', letters: 'hl', range: 'C3 C5' }, goal: 'C', times: 2 },
        { type: 'choice', say: 'Treble clef or bass clef?', rounds: [
          { staff: 'G', options: ['𝄞', '𝄢'], answer: '𝄞' },
          { staff: 'C3', clef: 'bass', options: ['𝄞', '𝄢'], answer: '𝄢' },
          { staff: 'E5', options: ['𝄞', '𝄢'], answer: '𝄞' },
          { staff: 'F3', clef: 'bass', options: ['𝄞', '𝄢'], answer: '𝄢' },
        ] },
      ]),
    ],
  },
  {
    n: 10, emoji: '👑', title: 'Piano Champion', color: '#7447d9',
    lessons: [
      L('scale', '🪜', 'C Major Scale', [
        { type: 'show', text: 'C D E F G A B C', say: 'A scale walks up eight notes, from C to the next C. After E, tuck your thumb under to reach F! Play the whole scale.', staff: 'C D E F G A B C5', hear: 'C D E F G A B C5', keys: { hl: 'C D E F G A B C5', letters: 'hl' }, goal: 'C D E F G A B', times: 8 },
        { type: 'seq', say: 'Up the scale and back down!', seqs: ['C D E F G A B C5', 'C5 B A G F E D C'] },
      ]),
      L('chordc', '🎶', 'The C Chord', [
        { type: 'show', text: 'C + E + G', say: 'A chord is notes played together. The C chord is C, E and G, skipping a key each time. Play C, E, G.', staff: 'C+E+G:w', hear: 'C+E+G:w', keys: { hl: 'C E G', letters: 'hl' }, goal: 'C E G', times: 3 },
        { type: 'seq', say: 'Play the C chord notes, one at a time.', seqs: ['C E G', 'G E C', 'C E G C5'] },
      ]),
      L('chordfg', '🎵', 'F and G Chords', [
        { type: 'show', text: 'F A C · G B D', say: 'The F chord is F, A, C. The G chord is G, B, D. Same shape, just moved over! Play them.', staff: 'F+A+C5:h G+B+D5:h', hear: 'F+A+C5:h G+B+D5:h', keys: { hl: 'F A C5 G B D5', letters: 'hl' }, goal: 'F A C G B D', times: 6 },
        { type: 'seq', say: 'Play each chord, one note at a time.', seqs: ['F A C5', 'G B D5', 'C E G'] },
      ]),
      L('champion', '🏆', 'Champion Quiz', [
        { type: 'show', text: '🏆', say: 'You know so much music now! Play C, E, G, C to start the champion quiz.', keys: { hl: 'C E G C5', letters: 'hl' }, goal: 'C E G', times: 4 },
        { type: 'name', notes: 'A F C5 E G3 D5 B', pool: 'CDEFGAB', say: 'Name this note!', range: 'C3 E5' },
        { type: 'beats', durs: ['8', 'hd', 'w', 'q', 'h'], say: 'How many beats?' },
      ]),
    ],
  },
];

export const lessonById = (id) => { for (const lv of LEVELS) for (const l of lv.lessons) if (l.id === id) return { lesson: l, level: lv }; return null; };
// Easiest first: by diff (1-100) when songs give one, else in songs.js order
export const songsForLevel = (n) => SONGS.filter((s) => s.level === n)
  .map((s, i) => [s.diff ?? i, i, s]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);

export const PRAISE = ['Yes!', 'Egg-cellent!', 'Cluck yeah!', 'Peck-tacular!', 'Awesome!', 'Woo-hoo!', 'Super chick!'];
