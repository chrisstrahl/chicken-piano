// Holds the song data up against src/types.ts, so `npm run typecheck` catches a
// misspelled or missing field in songs.js. Never imported by the app, so never in the built page.
import type { SongData, EarStage } from './types.ts';
import { SONG_DATA } from './songs.js';
import { EAR_STAGES } from './ear.js';

// Every song has the fields a song needs...
export const songData: readonly SongData[] = SONG_DATA;
// ...and no field the app doesn't know about (a typo like `chord:` or `lyric:` lands here)
type Unknown<T, Known> = Exclude<keyof T, keyof Known>;
export const noUnknownSongFields: [Unknown<(typeof SONG_DATA)[number], SongData>] extends [never] ? true : Unknown<(typeof SONG_DATA)[number], SongData> = true;

export const earStages: readonly EarStage[] = EAR_STAGES;

// Lessons, levels and players need no check here: music.ts and profiles.ts declare them with these types.
