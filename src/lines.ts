// Everything the chicken says out loud that is built from data (song titles, note names, egg counts).
// tools/voice-lines.mjs calls these same functions to list every possible line, so each one gets a
// pre-recorded clip. A line can be a list of sentences: each is its own clip, played back to back.

import { AVATARS } from './profiles.ts';
import { EAR_MAX_EGGS } from './ear.js';
import type { Song, Level } from './types.ts';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACC_WORD: Record<string, string> = { '': '', '#': ' sharp', 'b': ' flat', '♯': ' sharp', '♭': ' flat' };

// "C", "F sharp", "B flat" from a note label like F♯
export const noteWords = (label: string): string => label[0] + ACC_WORD[label.slice(1)];
// The tune a chicken song comes from ("Twinkle Twinkle Little Star"), or null for songs written for the app
export const originalName = (song: Pick<Song, 'sub' | 'title'>): string | null => (song.sub && song.sub !== 'New song' && song.sub !== song.title ? song.sub : null);
const spokenOriginal = (sub: string) => sub.replace(/\s*\(.*?\)/g, '');
export const letsPlay = (song: Pick<Song, 'sub' | 'title'>, label: string): string[] => {
  const orig = originalName(song);
  return [`Let's play ${song.title}!`, ...(orig ? [`That's ${spokenOriginal(orig)}!`] : []), startOn(label)];
};
export const startOn = (label: string) => `Start on ${noteWords(label)}.`;
export const oopsFind = (label: string) => `Oops! Find ${noteWords(label)}.`;
export const openSongsAsk = (level: number) => `Open all the songs in level ${level}?`;
export const throwAwayAsk = 'Throw this song away?';
export const songDone = (eggs: number) => ['', 'You did it! One egg!', 'You did it! Two eggs!', 'Perfect! Three eggs!'][eggs];
export const coop = (eggs: number, chicks: number): string[] => [
  'This is your chicken coop!',
  eggs === 1 ? 'You have one egg.' : `You have ${eggs} eggs.`,
  ...(chicks ? [chicks === 1 ? 'And one baby chick.' : `And ${chicks} baby chicks.`] : []),
  'Win eggs in lessons and songs. Finish a level to hatch a baby chick!',
];
// Speed button: snail, turtle, bunny (src/beat.ts SPEEDS)
export const SPEED_WORDS = ['Snail speed. Nice and slow.', 'Turtle speed.', 'Bunny speed!'];
// Play with the beat, and echo mode
export const BEAT_START = 'Wait for the pecks, then play with the beat!';
export const ECHO_START = 'Echo time! Listen to me, then play it back.';
export const ECHO_AGAIN = 'Listen again!';
// Ear game (src/eartraining.ts): the chicken plays, you find the notes. ECHO_AGAIN after a wrong key.
export const EAR_PICK = 'Ear game! Pick a nest.';
export const EAR_START = (len: number) => (len === 1 ? 'Listen to my note. Then find it on the piano!' : 'Listen to my notes. Then find them on the piano!');
export const EAR_HINT = 'Try the glowing key!';
// players (profiles.ts): a typed name has no recorded clip, so the device voice says those
export const whoPlays = 'Who is playing?';
export const pickChicken = 'Pick your chicken!';
export const hello = (name: string) => `Hi, ${name}! Let's play!`;
export const removeAsk = (name: string) => `Take ${name} out of the coop? Their eggs go too.`;
export const LAST_LEVEL = 10;
export const lessonDone = (newSongs: string[], finishedLevel: number): string[] => [
  'You did it! You got an egg!',
  ...newSongs.map((t) => `New song: ${t}!`),
  ...(finishedLevel ? [`You finished level ${finishedLevel}! A baby chick hatched! ${finishedLevel < LAST_LEVEL ? `Next is level ${finishedLevel + 1}.` : 'You are a piano champion!'}`] : []),
];

// the first key a song asks for
const firstLabel = (s: Song) => { const n = s.notes.find((x) => !x.r); return n && !n.r ? n.label : 'C'; };

// Every templated sentence the app can say, for the clip recorder.
export function templatedLines(songs: Song[], levels: Level[]): string[] {
  const labels = LETTERS.flatMap((l) => [l, l + '♯', l + '♭']);
  const maxEggs = songs.length * 3 + levels.reduce((a, lv) => a + lv.lessons.length, 0) + EAR_MAX_EGGS;
  const out = [
    ...songs.flatMap((s) => letsPlay(s, firstLabel(s))),
    ...labels.map(startOn),
    ...songs.map((s) => `New song: ${s.title}!`),
    ...labels.map(oopsFind),
    ...labels.map(noteWords),
    ...levels.map((lv) => openSongsAsk(lv.n)),
    throwAwayAsk,
    ...levels.flatMap((lv) => lessonDone([], lv.n).slice(1)),
    lessonDone([], 0)[0],
    ...[1, 2, 3].map(songDone),
    ...SPEED_WORDS, BEAT_START, ECHO_START, ECHO_AGAIN,
    EAR_PICK, EAR_START(1), EAR_START(2), EAR_HINT,
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
export function lineId(text: string): string {
  const s = String(text).trim().replace(/\s+/g, ' ');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
