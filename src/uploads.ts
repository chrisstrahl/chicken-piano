// Songs a grown-up uploaded on the grown-ups' page (score files turned into songs by scoreimport.ts). Kept on this
// device for every kid, in the songs.js format, and added to their level like the private songs (always open,
// listed last). They go in backup files, so a backup carries them to the home-screen app or another iPad.
import { KEYS, readJSON, writeJSON, type Store } from './storage.ts';
import type { SongData } from './types.ts';

export type Upload = SongData & { at: number };
export const MAX_UPLOADS = 50;

export const listUploads = (s: Store): Upload[] => {
  const v = readJSON<unknown>(s, KEYS.uploads, []);
  return Array.isArray(v) ? v.filter((x): x is Upload => !!x && typeof x === 'object' && typeof (x as Upload).id === 'string') : [];
};
// false when the device is full
export function addUpload(s: Store, song: SongData, now = Date.now()): boolean {
  const list = listUploads(s).filter((u) => u.id !== song.id);
  if (list.length >= MAX_UPLOADS) return false;
  return writeJSON(s, KEYS.uploads, [...list, { ...song, at: now }]);
}
export const removeUpload = (s: Store, id: string) => writeJSON(s, KEYS.uploads, listUploads(s).filter((u) => u.id !== id));
// a new id for an upload: letters and digits only, so it passes cleanSong
export const uploadId = (now = Date.now()) => now.toString(36) + Math.floor(Math.random() * 1296).toString(36);
