// Holds the real song and player data up against src/types.ts, so `npm run typecheck` catches a
// misspelled or missing field in songs.js. Never imported by the app, so never in the built page.
import type { SongData, Avatar } from './types';
import { SONG_DATA } from './songs.js';
import { AVATARS } from './profiles.js';

// Every song has the fields a song needs...
export const songData: readonly SongData[] = SONG_DATA;
// ...and no field the app doesn't know about (a typo like `chord:` or `lyric:` lands here)
type Unknown<T, Known> = Exclude<keyof T, keyof Known>;
export const noUnknownSongFields: [Unknown<(typeof SONG_DATA)[number], SongData>] extends [never] ? true : Unknown<(typeof SONG_DATA)[number], SongData> = true;

export const avatars: readonly Avatar[] = AVATARS;

// Song (the arranged song) and Level are not checked here yet: music.js builds them through untyped
// helpers, so TypeScript sees `any`. They get checked for real once music.js moves to TypeScript.
