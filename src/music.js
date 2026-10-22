// Note helpers, songs and lessons.

export const LETTERS = 'CCDDEFFGGAAB';
export const SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
export const COLORS = { C: '#ff4d4d', D: '#ff9a1f', E: '#ffcc00', F: '#3cc95a', G: '#2fa2ff', A: '#9b5de5', B: '#ff6fb0' };
// darker versions for drawing notes on the white staff
export const INK = { C: '#e8322f', D: '#ef8300', E: '#e0a800', F: '#22a843', G: '#1782e0', A: '#7f3fd6', B: '#e64e98' };
export const BEATS = { q: 1, h: 2, w: 4 };
export const NOTE_WORDS = { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'B' };

export const letterOf = (m) => LETTERS[m % 12];
export const isBlack = (m) => SHARP[m % 12] === 1;
export const nameOf = (m) => letterOf(m) + (isBlack(m) ? '♯' : '');
export const octaveOf = (m) => Math.floor(m / 12) - 1;
export const vfKey = (m) => letterOf(m).toLowerCase() + (isBlack(m) ? '#' : '') + '/' + octaveOf(m);

const OCT4 = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };
function parse(notes, lyrics) {
  const ly = lyrics.trim().split(/\s+/);
  return notes.trim().split(/\s+/).map((tok, i) => {
    const [n, d = 'q'] = tok.split(':');
    const m = OCT4[n[0]] + (n[1] === '5' ? 12 : 0);
    return { m, d, lyric: ly[i] || '' };
  });
}

export const SONGS = [
  {
    id: 'eggs', emoji: '🍳', title: 'Scrambled Eggs', sub: 'Hot Cross Buns', tempo: 96,
    notes: parse('E D C:h E D C:h C C C C D D D D E D C:h',
      'Scram- bled eggs, Scram- bled eggs, One a pen- ny, two a pen- ny, Scram- bled eggs!'),
  },
  {
    id: 'clucky', emoji: '🥚', title: "Clucky's Egg", sub: 'Mary Had a Little Lamb', tempo: 104,
    notes: parse('E D C D E E E:h D D D:h E G G:h E D C D E E E E D D E D C:w',
      'Clu- cky had a lit- tle egg, lit- tle egg, lit- tle egg, Clu- cky had a lit- tle egg, its shell was white as snow!'),
  },
  {
    id: 'twinkle', emoji: '⭐', title: 'Twinkle Little Chick', sub: 'Twinkle Twinkle Little Star', tempo: 100,
    notes: parse('C C G G A A G:h F F E E D D C:h G G F F E E D:h G G F F E E D:h C C G G A A G:h F F E E D D C:h',
      'Twin- kle twin- kle lit- tle chick, peck- ing seeds so ve- ry quick. Up a- bove the barn so high, like a feath- er in the sky. Twin- kle twin- kle lit- tle chick, peck- ing seeds so ve- ry quick!'),
  },
];

// Lesson steps:
//  info:  { text, say, keys?, staff?, hear? }
//  key:   { targets:[midi], say }           play/tap each target (any octave)
//  name:  { notes:[midi] }                  "what note is this?" pick an egg
//  beats: { durs:['q'|'h'|'w'] }            "how many beats?"
const q = (m) => ({ m, d: 'q' });
export const LESSONS = [
  {
    id: 'findc', emoji: '🏠', title: 'Find C',
    steps: [
      { type: 'info', text: '⚫⚫ ⚫⚫⚫', say: 'Look at the black keys. They come in groups of two, and groups of three. Like little chicken families!', keys: { groups: true, letters: 'none' } },
      { type: 'info', text: '🏠 = C', say: 'C lives just to the left of the two black keys. That is the chicken coop door!', keys: { hl: [60, 72], letters: 'hl' } },
      { type: 'key', targets: [60, 72, 60], letters: 'none', say: 'Can you play a C?', hint: 'Find the two black keys. C is right next to them, on the left.' },
    ],
  },
  {
    id: 'abc', emoji: '🔤', title: 'A B C D E F G',
    steps: [
      { type: 'info', text: 'A B C D E F G', say: 'Music only uses seven letters. A, B, C, D, E, F, G. Then they start over again!', keys: { letters: 'all' } },
      { type: 'info', text: 'C D E F G ➡️', say: 'Start on C and walk up. C, D, E, F, G. Going to the right sounds higher!', keys: { hl: [60, 62, 64, 65, 67], letters: 'hl' }, hear: [60, 62, 64, 65, 67].map(q) },
      { type: 'key', targets: [62, 64, 67, 65], letters: 'all', say: 'Your turn!' },
    ],
  },
  {
    id: 'staff', emoji: '🎼', title: 'The Staff',
    steps: [
      { type: 'info', text: '5 lines = staff', say: 'Music is written on five lines called a staff. It looks like a fence on the farm!', staff: [] },
      { type: 'info', text: '⬆️ higher!', say: 'Notes climb up the fence. Higher on the staff means a higher sound!', staff: [60, 62, 64, 65, 67, 69, 71, 72].map(q), hear: [60, 62, 64, 65, 67, 69, 71, 72].map(q) },
      { type: 'info', text: 'Middle C', say: 'This is middle C. It stands on its own tiny line under the fence, like a chicken on a perch!', staff: [{ m: 60, d: 'w' }], keys: { hl: [60], letters: 'hl' }, hear: [{ m: 60, d: 'h' }] },
      { type: 'name', notes: [64, 67, 60, 62, 65], say: 'What note is this?' },
    ],
  },
  {
    id: 'beats', emoji: '⏱️', title: 'How Long?',
    steps: [
      { type: 'info', text: '👏 1 beat', say: 'A filled in note with a stick is a quarter note. It gets one beat. Cluck!', staff: [q(67), q(67), q(67), q(67)], hear: [q(67), q(67), q(67), q(67)], clap: true },
      { type: 'info', text: '👏 2 beats', say: 'A hollow note with a stick is a half note. It gets two beats. Clu, uck!', staff: [{ m: 67, d: 'h' }, { m: 67, d: 'h' }], hear: [{ m: 67, d: 'h' }, { m: 67, d: 'h' }], clap: true },
      { type: 'info', text: '👏 4 beats', say: 'A hollow egg with no stick is a whole note. It gets four beats! Cluuuuuck!', staff: [{ m: 67, d: 'w' }], hear: [{ m: 67, d: 'w' }], clap: true },
      { type: 'beats', durs: ['h', 'q', 'w', 'h', 'q'], say: 'How many beats?' },
    ],
  },
];

export const PRAISE = ['Yes!', 'Egg-cellent!', 'Cluck yeah!', 'Peck-tacular!', 'Awesome!', 'Woo-hoo!', 'Super chick!'];
