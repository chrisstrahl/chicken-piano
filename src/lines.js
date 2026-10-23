// Everything the chicken says out loud that is built from data (song titles, note names, egg counts).
// tools/voice-lines.mjs calls these same functions to list every possible line, so each one gets a
// pre-recorded clip. A line can be a list of sentences: each is its own clip, played back to back.

import { AVATARS } from './profiles.js';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACC_WORD = { '': '', '#': ' sharp', 'b': ' flat', '♯': ' sharp', '♭': ' flat' };

// "C", "F sharp", "B flat" from a note label like F♯
export const noteWords = (label) => label[0] + ACC_WORD[label.slice(1)];
export const letsPlay = (title, label) => `Let's play ${title}! Start on ${noteWords(label)}.`;
export const oopsFind = (label) => `Oops! Find ${noteWords(label)}.`;
export const openSongsAsk = (level) => `Open all the songs in level ${level}?`;
export const songDone = (eggs) => ['', 'You did it! One egg!', 'You did it! Two eggs!', 'Perfect! Three eggs!'][eggs];
export const coop = (eggs, chicks) => [
  'This is your chicken coop!',
  eggs === 1 ? 'You have one egg.' : `You have ${eggs} eggs.`,
  ...(chicks ? [chicks === 1 ? 'And one baby chick.' : `And ${chicks} baby chicks.`] : []),
  'Win eggs in lessons and songs. Finish a level to hatch a baby chick!',
];
// Speed button: snail, turtle, bunny (src/beat.js SPEEDS)
export const SPEED_WORDS = ['Snail speed. Nice and slow.', 'Turtle speed.', 'Bunny speed!'];
// Play with the beat, and echo mode
export const BEAT_START = 'Wait for the pecks, then play with the beat!';
export const ECHO_START = 'Echo time! Listen to me, then play it back.';
export const ECHO_AGAIN = 'Listen again!';
// players (profiles.js): a typed name has no recorded clip, so the device voice says those
export const whoPlays = 'Who is playing?';
export const pickChicken = 'Pick your chicken!';
export const hello = (name) => `Hi, ${name}! Let's play!`;
export const removeAsk = (name) => `Take ${name} out of the coop? Their eggs go too.`;
export const LAST_LEVEL = 10;
export const lessonDone = (newSongs, finishedLevel) => [
  'You did it! You got an egg!',
  ...newSongs.map((t) => `New song: ${t}!`),
  ...(finishedLevel ? [`You finished level ${finishedLevel}! A baby chick hatched! ${finishedLevel < LAST_LEVEL ? `Next is level ${finishedLevel + 1}.` : 'You are a piano champion!'}`] : []),
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
    ...levels.map((lv) => openSongsAsk(lv.n)),
    ...levels.flatMap((lv) => lessonDone([], lv.n).slice(1)),
    lessonDone([], 0)[0],
    ...[1, 2, 3].map(songDone),
    ...SPEED_WORDS, BEAT_START, ECHO_START, ECHO_AGAIN,
    whoPlays,
    pickChicken,
    ...AVATARS.map((a) => hello(a.name)),
    ...AVATARS.map((a) => removeAsk(a.name)),
  ];
  for (let e = 0; e <= maxEggs; e++) out.push(...coop(e, 0));
  for (let c = 1; c <= levels.length; c++) out.push(...coop(1, c));
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
