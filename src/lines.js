// Everything the chicken says out loud that is built from data (song titles, note names, egg counts).
// tools/voice-lines.mjs calls these same functions to list every possible line, so each one gets a
// pre-recorded clip. A line can be a list of sentences: each is its own clip, played back to back.

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACC_WORD = { '': '', '#': ' sharp', 'b': ' flat', '♯': ' sharp', '♭': ' flat' };

// "C", "F sharp", "B flat" from a note label like F♯
export const noteWords = (label) => label[0] + ACC_WORD[label.slice(1)];
export const letsPlay = (title, label) => `Let's play ${title}! Start on ${noteWords(label)}.`;
export const oopsFind = (label) => `Oops! Find ${noteWords(label)}.`;
export const songLocked = (level) => `Do more lessons in level ${level} to open this song!`;
export const songDone = (eggs) => ['', 'You did it! One egg!', 'You did it! Two eggs!', 'Perfect! Three eggs!'][eggs];
export const coop = (eggs) => (eggs
  ? ['This is your chicken coop!', eggs === 1 ? 'You have one egg.' : `You have ${eggs} eggs.`, 'Every three eggs hatch a baby chick. Win more eggs in lessons and songs!']
  : 'This is your chicken coop! Win eggs in lessons and songs. Every three eggs hatch a baby chick!');
export const lessonDone = (newSongs, newLevel) => [
  'You did it! You got an egg!',
  ...newSongs.map((t) => `New song: ${t}!`),
  ...(newLevel ? [`You finished level ${newLevel}! You got a star! Next is level ${newLevel + 1}.`] : []),
];

// Every templated sentence the app can say, for the clip recorder.
export function templatedLines(songs, levels) {
  const labels = LETTERS.flatMap((l) => [l, l + '♯', l + '♭']);
  const maxEggs = songs.length * 3 + levels.reduce((a, lv) => a + lv.lessons.length, 0);
  const out = [
    ...songs.map((s) => letsPlay(s.title, s.notes.find((n) => !n.r).label)),
    ...songs.map((s) => `New song: ${s.title}!`),
    ...labels.map(oopsFind),
    ...labels.map(noteWords),
    ...levels.map((lv) => songLocked(lv.n)),
    ...levels.filter((lv) => lv.n < levels.length).flatMap((lv) => lessonDone([], lv.n).slice(1)),
    lessonDone([], 0)[0],
    ...[1, 2, 3].map(songDone),
  ];
  for (let e = 0; e <= maxEggs; e++) out.push(...[].concat(coop(e)));
  return out;
}

// Short stable id for a sentence: FNV-1a hash of the normalized text. Clips are named by it.
export function lineId(text) {
  const s = String(text).trim().replace(/\s+/g, ' ');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
