// "Unchicken" the songs: each kid can pick chicken names (Scrambled Eggs) or the real tune names
// (Hot Cross Buns). Saved in that kid's progress as realNames; main.ts keeps this flag in step.
// Songs written for the app have no real name, so they keep their chicken name either way.
import { originalName, spokenTune } from './lines.ts';
import type { Song } from './types.ts';

type Named = Pick<Song, 'sub' | 'title'>;
let real = false;
export const setRealNames = (on: boolean) => { real = on; };
export const realNames = () => real;
// the big name on a card or title bar
export const songName = (s: Named): string => (real && originalName(s)) || s.title;
// the small name under it: the other one, if the song has both
export const otherName = (s: Named): string | null => (real ? (originalName(s) ? s.title : null) : originalName(s));
// the name the chicken says out loud ("Morning Mood", not "Morning Mood (Grieg)"; "Canon by Pachelbel")
export const spokenName = (s: Named): string => { const o = real && originalName(s); return o ? spokenTune(o) : s.title; };
