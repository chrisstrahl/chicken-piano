// Songs the kids write (Learn → Make music → Write a Song), saved on this device per player, like recordings.
// notes: parse() tokens, e.g. "C4:q E4:h R:q G4:w".
export interface MySong { id: string; at: number; emoji: string; title: string; notes: string }
import { KEYS, readJSON, writeJSON, browserStore, type Store } from './storage.ts';
export const MYSONGS_KEY = KEYS.mysongs;
export const MAX_MYSONGS = 30; // per player
export const MAX_NOTES = 64; // per song

const readAll = (storage: Store): Record<string, MySong[]> => readJSON<Record<string, MySong[]>>(storage, MYSONGS_KEY, {});
// a full device drops old recordings to make room (storage.ts)
const writeAll = (all: Record<string, MySong[]>, storage: Store): boolean => writeJSON(storage, MYSONGS_KEY, all);
export const listMySongs = (pid: string, storage: Store = browserStore()): MySong[] => readAll(storage)[pid] || [];
// adds or replaces (same id); the oldest goes when there are too many
export function saveMySong(pid: string, song: MySong, storage: Store = browserStore()): boolean {
  const all = readAll(storage);
  const list = (all[pid] || []).filter((s) => s.id !== song.id);
  list.push(song);
  all[pid] = list.slice(-MAX_MYSONGS);
  return writeAll(all, storage);
}
export function deleteMySong(pid: string, id: string, storage: Store = browserStore()) {
  const all = readAll(storage);
  all[pid] = (all[pid] || []).filter((s) => s.id !== id);
  writeAll(all, storage);
}
export function deletePlayerSongs(pid: string, storage: Store = browserStore()) {
  const all = readAll(storage);
  delete all[pid];
  writeAll(all, storage);
}
