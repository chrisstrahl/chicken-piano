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
export const BEATS = { 8: 0.5, q: 1, qd: 1.5, h: 2, hd: 3, w: 4 };

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

const song = (id, level, emoji, title, sub, notes, lyrics, opts = {}) => ({ id, level, emoji, title, sub, tempo: 100, time: '4/4', clef: 'treble', pickup: 0, bars: true, ...opts, notes: parse(notes, lyrics) });

// Songs grouped by level, easiest first. Old favorites get chicken words; a few short originals practice one idea each.
export const SONGS = [
  // ---- Level 1: C D E
  song('eggs', 1, '🍳', 'Scrambled Eggs', 'Hot Cross Buns',
    'E D C:h E D C:h C C C C D D D D E D C:h',
    'Scram- bled eggs, Scram- bled eggs, One a pen- ny, two a pen- ny, Scram- bled eggs!', { tempo: 96 }),
  song('peck', 1, '🌽', 'Peck Peck Peck', 'New song',
    'E E E:h D D D:h C D E D C:w',
    'Peck, peck, peck! Peck, peck, peck! Pick- ing up the corn!', { tempo: 96 }),
  song('walk', 1, '🐾', 'Chicken Walk', 'New song',
    'C D E E D C D:h C D E E D D C:h',
    'Walk- ing to the barn, cluck, cluck! Walk- ing back a- gain, cluck, cluck!', { tempo: 96 }),
  song('threeeggs', 1, '🐣', 'Little Eggies', 'New song',
    'C C D D E:h E:h E E D D C:h C:h',
    'Lit- tle eg- gies, crack! crack! Lit- tle chick- ies, hel- lo!', { tempo: 96 }),
  song('moon', 1, '🌙', 'Moonlight Chicks', 'Au Clair de la Lune',
    'C C C D E:h D:h C E D D C:w C C C D E:h D:h C E D D C:w',
    'In the moon- light, lit- tle chick- ens go to sleep. Snug- gle in the nest now, ti- ny chicks, good night!', { tempo: 96 }),

  // ---- Level 2: C D E F G
  song('clucky', 2, '🥚', "Clucky's Egg", 'Mary Had a Little Lamb',
    'E D C D E E E:h D D D:h E G G:h E D C D E E E E D D E D C:w',
    'Clu- cky had a lit- tle egg, lit- tle egg, lit- tle egg, Clu- cky had a lit- tle egg, its shell was white as snow!', { tempo: 104 }),
  song('rain', 2, '🌧️', 'Rain, Rain, Go Away', 'Rain, Rain, Go Away',
    'G:h E:h G G E:h G G E A G G E:h G:h E:h G G E:h G G E A G G E:h',
    'Rain, rain, go a- way, chick- ens want to come and play! Sun, sun, come and stay, chick- ens want to peck all day!', { tempo: 100 }),
  song('hens', 2, '🐔', 'Happy Hens', 'Ode to Joy',
    'E E F G G F E D C C D E E D D:h E E F G G F E D C C D E D C C:h',
    'Hap- py hens are in the hen- house, lay- ing eggs and sing- ing songs. Peck- ing corn and flap- ping feath- ers, clu- cking all the whole day long!'),
  song('jingle', 2, '🔔', 'Jingle Clucks', 'Jingle Bells',
    'E E E:h E E E:h E G C D E:w F F F F F E E E E D D E D:h G:h',
    'Jin- gle clucks, jin- gle clucks, jin- gle all the way! Oh what fun it is to peck in a big red barn to- day!', { tempo: 112 }),
  song('lightly', 2, '🚣', 'Lightly Peck', 'Lightly Row',
    'G E E:h F D D:h C D E F G G G:h G E E:h F D D:h C E G G C:w D D D D D E F:h E E E E E F G:h G E E:h F D D:h C E G G C:w',
    'Light- ly peck, light- ly peck, pick- ing up the corn we go. Light- ly peck, light- ly peck, chick- ens in a row. Let the chick- ens all come out, fluff their feath- ers, run a- bout. Light- ly peck, light- ly peck, chick- ens in a row!', { tempo: 104 }),

  // ---- Level 3: note lengths and rests
  song('holdnote', 3, '⏳', 'Hold That Note', 'New song',
    'C:w E:w G:h F:h E:w D:h E:h F:h D:h C:w',
    'Cluck! Cluck! Hold the note! Long and slow, the end!', { tempo: 100 }),
  song('reststop', 3, '🤫', 'Rest Stop', 'New song',
    'C E G R:q G E C R:q D E F R:q E D C R:q C E G R:q G F E D C:h R:h',
    'Cluck cluck cluck, cluck cluck cluck, peck peck peck, peck peck peck, flap flap flap, hush now ti- ny chick.', { tempo: 100 }),
  song('march', 3, '🥁', 'When the Chicks Go Marching In', 'When the Saints Go Marching In',
    'C E F G:w C E F G:w C E F G:h E:h C:h E:h D:w E E D C:h C E G:h G F:w E F G:h E:h C:h D:h C:w',
    'Oh when the chicks go march- ing in, oh when the chicks go march- ing in, Oh I want to be in that num- ber, when the chicks go march- ing in!', { tempo: 120, bars: false }),
  song('michael', 3, '⛵', 'Chickens Row the Boat Ashore', 'Michael, Row the Boat Ashore',
    'C E G:h E G A G:h E G A G:w E G G:h E F E D:w C D E D C:w',
    'Chick- ens row the boat a- shore, cluck cluck cluck cluck! Chick- ens row the boat a- shore, cluck cluck cluck cluck cluck!', { tempo: 104, bars: false }),
  song('twinkle', 3, '⭐', 'Twinkle Little Chick', 'Twinkle Twinkle Little Star',
    'C C G G A A G:h F F E E D D C:h G G F F E E D:h G G F F E E D:h C C G G A A G:h F F E E D D C:h',
    'Twin- kle twin- kle lit- tle chick, peck- ing seeds so ve- ry quick. Up a- bove the barn so high, like a feath- er in the sky. Twin- kle twin- kle lit- tle chick, peck- ing seeds so ve- ry quick!'),

  // ---- Level 4: reading the staff, up to high C
  song('coop', 4, '🔨', 'The Coop Is Falling Down', 'London Bridge',
    'G A G F E F G:h D E F:h E F G:h G A G F E F G:h D:h G:h E:h C:h',
    'Chick- en coop is fall- ing down, fall- ing down, fall- ing down. Chick- en coop is fall- ing down, fix it, chick- ens!', { tempo: 104 }),
  song('farm', 4, '🚜', "Old MacDonald's Chicks", 'Old MacDonald Had a Farm',
    'C C C G A A G:h E E D D C:w C C C G A A G:h E E D D C:w C C C:h G G G:h C C C G A A G:h E E D D C:w',
    'Old Mac- Don- ald had a farm, E- I- E- I- O! On that farm he had some chicks, E- I- E- I- O! Chick chick here, chick chick there, Old Mac- Don- ald had a farm, E- I- E- I- O!', { tempo: 108 }),
  song('races', 4, '🏁', 'Chicken Races', 'Camptown Races',
    'G G E G A G E:h E D:h R:q E D:h R:q G G E G A G E:h D D E D C:w',
    'Chick- en la- dies sing this song, doo- dah! doo- dah! Chick- en race- track five miles long, oh de doo- dah day!', { tempo: 112 }),
  song('linespace', 4, '🪜', 'Line and Space Race', 'New song',
    'E G B D5 F5:h F A C5 E5:h E5 C5 A F:h F5 D5 B G E:h',
    'Every Good Chick Does Fine! F A C E! Back down a- gain, down the lines we go!', { tempo: 96, bars: false }),
  song('roll', 4, '🛶', 'Roll, Roll, Roll Your Egg', 'Row, Row, Row Your Boat',
    'C C C D E:h E D E F G:h C5 C5 C5 G G G E E E C C C G F E D C:w',
    'Roll, roll, roll your egg, gent- ly down the lane. Mer- ri- ly, mer- ri- ly, mer- ri- ly, mer- ri- ly, chick- ens love the game!', { tempo: 104 }),

  // ---- Level 5: A, B, low notes and moving your hand
  song('goodmorning', 5, '🌅', 'Good Morning, Chicks', 'New song (G position)',
    'G A B C5 D5:h D5:h C5 B A B G:w D5 C5 B A G:h A:h B C5 D5 B G:w',
    "Good morn- ing, lit- tle chicks, it's time to wake up! The sun is in the sky, so stretch your wings up!", { tempo: 104 }),
  song('yankee', 5, '🎩', 'Yankee Chicken', 'Yankee Doodle',
    'C C D E C E D G3 C C D E C:h B3:h C C D E F E D C B3 G3 A3 B3 C:h C:h',
    'Yan- kee Chick- en went to town a- rid- ing on a tur- key, stuck a feath- er in his cap and called it mac- a- ro- ni!', { tempo: 112 }),
  song('wenceslas', 5, '👑', 'Good Hen Wenceslas', 'Good King Wenceslas',
    'C C C D C C G3:h A3 G3 A3 B3 C:h C:h C C C D C C G3:h A3 G3 A3 B3 C:h C:h',
    'Good Hen Wen- ces- las looked out, on the feast of Ste- phen. When the snow lay round a- bout, deep and crisp and e- ven.', { tempo: 100 }),
  song('deck', 5, '🎄', 'Deck the Coop', 'Deck the Halls',
    'G F E D C D E C D E F D E:h D C B3:h C:h G F E D C D E C D E F D E:h D C B3:h C:h',
    'Deck the coop with straw so co- zy, fa la la la la, la la la la! Chicks and hens are snug and hap- py, fa la la la la, la la la la!', { tempo: 108 }),
  song('morning', 5, '☀️', 'Sunrise in the Coop', 'Morning Mood (Grieg)',
    'G E D C D E G E D C D E D E G E G A E A G E D C:w', '', { tempo: 96, bars: false }),

  // ---- Level 6: 3/4 time, dotted half notes, loud and soft
  song('bday', 6, '🎂', 'Happy Hatch Day', 'Happy Birthday',
    'G3:8 G3:8 A3 G3 C B3:h G3:8 G3:8 A3 G3 D C:h G3:8 G3:8 G E C B3 A3 F:8 F:8 E C D C:hd',
    'Hap- py hatch day to you, hap- py hatch day to you, hap- py hatch day dear chick- en, hap- py hatch day to you!', { time: '3/4', pickup: 1, tempo: 100 }),
  song('waltz', 6, '💃', 'Chicken Waltz', 'New song',
    'C E G C5:h G A G F E:hd D F A B:h A G F D C:hd',
    'One, two, three, waltz with me, round and round! Flap your wings, turn a- round and then bow!', { time: '3/4', tempo: 112 }),
  song('sleepyhen', 6, '😴', 'Sleepy Hen', 'New song',
    'E D C D:h E F E D C:hd G F E F:h G A G F E D D C:hd',
    'Sleep- y hen, nod your head, go to bed. Close your eyes, tuck your beak, dream till dawn, dream till dawn.', { time: '3/4', tempo: 92 }),
  song('merry', 6, '🎁', 'Merry Clucks-mas', 'We Wish You a Merry Christmas',
    'G3 C C:8 D:8 C:8 B3:8 A3 A3 A3 D D:8 E:8 D:8 C:8 B3 G3 G3 E E:8 F:8 E:8 D:8 C A3 G3:8 G3:8 A3 D B3 C:hd',
    'We wish you a mer- ry Clucks- mas, we wish you a mer- ry Clucks- mas, we wish you a mer- ry Clucks- mas and a hap- py new year!', { time: '3/4', pickup: 1, tempo: 112 }),
  song('silent', 6, '🌟', 'Quiet Night', 'Silent Night',
    'G A G E:hd G A G E:hd D5:h D5 B:hd C5:h C5 G:hd A:h A C5 B A G A G E:hd A:h A C5 B A G A G E:hd D5:h D5 F5 D5 B C5:hd E5:hd C5 G E G F D C:hd',
    "Qui- et _ night, sleep- y _ night, hens tuck in, chicks hold tight. 'Round the nest the lit- tle ones lie _ dream- ing of corn and sun- shine and sky, sleep in heav- en- ly peace _ sleep in heav- en- ly peace _", { time: '3/4', tempo: 84 }),

  // ---- Level 7: eighth notes
  song('eggsremix', 7, '🥞', 'Scrambled Eggs Remix', 'Hot Cross Buns (real rhythm)',
    'E D C:h E D C:h C:8 C:8 C:8 C:8 D:8 D:8 D:8 D:8 E D C:h',
    'Scram- bled eggs, scram- bled eggs, one a pen- ny, two a pen- ny, scram- bled eggs!', { tempo: 100 }),
  song('speedy', 7, '💨', 'Speedy Little Chick', 'Twinkle Twinkle (fast)',
    'C:8 C:8 C:8 C:8 G:8 G:8 G:8 G:8 A:8 A:8 A:8 A:8 G:h F:8 F:8 F:8 F:8 E:8 E:8 E:8 E:8 D:8 D:8 D:8 D:8 C:h', '', { tempo: 92 }),
  song('frere', 7, '⏰', 'Brother Chick', 'Frère Jacques',
    'C D E C C D E C E F G:h E F G:h G:8 A:8 G:8 F:8 E C G:8 A:8 G:8 F:8 E C C G3 C:h C G3 C:h',
    'Are you sleep- ing, are you sleep- ing, Broth- er Chick? Broth- er Chick? Morn- ing eggs are hatch- ing, morn- ing eggs are hatch- ing, cock- a- doo! cock- a- doo!', { tempo: 104 }),
  song('oldhen', 7, '👵', 'This Old Hen', 'This Old Man',
    'G E G:h G E G:h A G F E D E F:h E:8 F:8 G C C:8 C:8 C C:8 D:8 E:8 F:8 G G:8 D:8 D:8 F:8 E D C:w',
    'This old hen, she laid one, she laid eggs out in the sun, with a cluck cluck pad- dy- whack, give the chick some corn, this old hen came rol- ling home.', { tempo: 104 }),
  song('boogie', 7, '🕺', 'Chicken Boogie', 'New song',
    'C:8 E:8 G:8 A:8 G:8 E:8 C C:8 E:8 G:8 A:8 G:8 E:8 C F:8 A:8 C5:8 D5:8 C5:8 A:8 F C:8 E:8 G:8 A:8 G:8 E:8 C G:8 B:8 D5:8 E5:8 D5:8 B:8 G F:8 A:8 C5:8 D5:8 C5:8 A:8 F C:8 E:8 G:8 A:8 G:8 E:8 C G:h C:h', '', { tempo: 100 }),

  // ---- Level 8: sharps and flats (black keys)
  song('blackbuns', 8, '🖤', 'Black Key Buns', 'Hot Cross Buns on black keys',
    'A# G# F#:h A# G# F#:h F# F# F# F# G# G# G# G# A# G# F#:h',
    'Scram- bled eggs, scram- bled eggs, one a pen- ny, two a pen- ny, scram- bled eggs!', { tempo: 96 }),
  song('bounce', 8, '🏀', 'Black Key Bounce', 'New song',
    'F# G# A# C#5 D#5:h D#5:h C#5 A# G# A# F#:w D#5 C#5 A# G# F#:h G#:h A# C#5 A# G# F#:w', '', { tempo: 104 }),
  song('sneaky', 8, '🥷', 'Sneaky Chick', 'New song',
    'C C# D D# E:w E D# D C# C:w G F# F E D# D C# D C:w',
    'Tip- toe, tip- toe, sneak! Tip- toe, tip- toe, back! Sneak- y, sneak- y, qui- et lit- tle peep!', { tempo: 92 }),
  song('mountain', 8, '⛰️', 'In the Hall of the Rooster King', 'In the Hall of the Mountain King',
    'A B C5 D5 E5 C5 E5:h D#5 B D#5:h D5 Bb D5:h A B C5 D5 E5 C5 E5 A5 G5 E5 C5 E5 G5:w', '', { tempo: 104 }),
  song('elise', 8, '🎹', 'Für Eggs-lise', 'Für Elise (Beethoven)',
    'E5:8 D#5:8 E5:8 D#5:8 E5:8 B:8 D5:8 C5:8 A:q R:8 C:8 E:8 A:8 B:q R:8 E:8 G#:8 B:8 C5:q R:8 E:8 E5:8 D#5:8 E5:8 D#5:8 E5:8 B:8 D5:8 C5:8 A:q R:8 C:8 E:8 A:8 B:q R:8 E:8 C5:8 B:8 A:h', '', { tempo: 80, bars: false }),

  // ---- Level 9: bass clef and the left hand
  song('lheggs', 9, '🍳', 'Low-Down Scrambled Eggs', 'Hot Cross Buns (left hand)',
    'E3 D3 C3:h E3 D3 C3:h C3 C3 C3 C3 D3 D3 D3 D3 E3 D3 C3:h',
    'Scram- bled eggs, scram- bled eggs, one a pen- ny, two a pen- ny, scram- bled eggs!', { clef: 'bass', tempo: 96 }),
  song('lhclucky', 9, '🥚', "Clucky's Egg (Left Hand)", 'Mary Had a Little Lamb (left hand)',
    'E3 D3 C3 D3 E3 E3 E3:h D3 D3 D3:h E3 G3 G3:h E3 D3 C3 D3 E3 E3 E3 E3 D3 D3 E3 D3 C3:w',
    'Clu- cky had a lit- tle egg, lit- tle egg, lit- tle egg, Clu- cky had a lit- tle egg, its shell was white as snow!', { clef: 'bass', tempo: 100 }),
  song('rumble', 9, '🐓', 'Rooster Rumble', 'New song',
    'C3 E3 G3 E3 C3 E3 G3:h F3 D3 F3 D3 C3:w G3 F3 E3 D3 C3 D3 E3:h G3 F3 E3 D3 C3:w', '', { clef: 'bass', tempo: 104 }),
  song('lhhens', 9, '🐔', 'Happy Hens (Left Hand)', 'Ode to Joy (left hand)',
    'E3 E3 F3 G3 G3 F3 E3 D3 C3 C3 D3 E3 E3 D3 D3:h E3 E3 F3 G3 G3 F3 E3 D3 C3 C3 D3 E3 D3 C3 C3:h',
    'Hap- py hens are in the hen- house, lay- ing eggs and sing- ing songs. Peck- ing corn and flap- ping feath- ers, clu- cking all the whole day long!', { clef: 'bass', tempo: 100 }),
  song('lhtwinkle', 9, '⭐', 'Twinkle Little Chick (Left Hand)', 'Twinkle Twinkle (left hand)',
    'C3 C3 G3 G3 A3 A3 G3:h F3 F3 E3 E3 D3 D3 C3:h G3 G3 F3 F3 E3 E3 D3:h G3 G3 F3 F3 E3 E3 D3:h C3 C3 G3 G3 A3 A3 G3:h F3 F3 E3 E3 D3 D3 C3:h',
    'Twin- kle twin- kle lit- tle chick, peck- ing seeds so ve- ry quick. Up a- bove the barn so high, like a feath- er in the sky. Twin- kle twin- kle lit- tle chick, peck- ing seeds so ve- ry quick!', { clef: 'bass', tempo: 100 }),

  // ---- Level 10: scales, chords and longer pieces
  song('scale', 10, '🪜', 'Chicken Scale March', 'New song (C major scale)',
    'C D E F G A B C5 C5 B A G F E D C C E G E C:w',
    'Up the lad- der, climb- ing high- er, down the lad- der, back a- gain now, hop, hop, hop, hop, home!', { tempo: 104 }),
  song('chordhop', 10, '🎶', 'Chord Hop', 'New song (C, F and G chords)',
    'C E G E C:h R:h F A C5 A F:h R:h G B D5 B G:h R:h C E G:h C5:w', '', { tempo: 100 }),
  song('joy', 10, '🎉', 'Joy to the Coop', 'Joy to the World',
    'C5:h B A G:hd F E:h D:h C:w G A:hd A B:hd B C5:hd C5 C5 B A G:h G F E:w C5 B A G F E D C:w',
    'Joy to the coop, the chicks have come! Let all the hens re- joice! Let ev- ery chick pre- pare a room, sing, chick- ens, sing, a hap- py song!', { tempo: 96, bars: false }),
  song('hensfull', 10, '🐓', 'Happy Hens (Whole Song)', 'Ode to Joy (full)',
    'E E F G G F E D C C D E E D D:h E E F G G F E D C C D E D C C:h D D E C D E:8 F:8 E C D E:8 F:8 E D C D G3:h E E F G G F E D C C D E D C C:h',
    'Hap- py hens are in the hen- house, lay- ing eggs and sing- ing songs. Peck- ing corn and flap- ping feath- ers, clu- cking all the whole day long! Wings spread wide and flap- ping in the sun, hop- ping through the yard, chick- ens fly! Hap- py hens are in the hen- house, clu- cking all the whole day long!'),
  song('minuet', 10, '🎻', 'Hen Minuet', 'Minuet in G (Petzold)',
    'D5 G:8 A:8 B:8 C5:8 D5 G G E5 C5:8 D5:8 E5:8 F#5:8 G5 G G C5 D5:8 C5:8 B:8 A:8 B C5:8 B:8 A:8 G:8 F# G:8 A:8 B:8 G:8 A:hd D5 G:8 A:8 B:8 C5:8 D5 G G E5 C5:8 D5:8 E5:8 F#5:8 G5 G G C5 D5:8 C5:8 B:8 A:8 B C5:8 B:8 A:8 G:8 A B:8 A:8 G:8 F#:8 G:hd',
    '', { time: '3/4', tempo: 100 }),
];
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
export const songsForLevel = (n) => SONGS.filter((s) => s.level === n);

export const PRAISE = ['Yes!', 'Egg-cellent!', 'Cluck yeah!', 'Peck-tacular!', 'Awesome!', 'Woo-hoo!', 'Super chick!'];
