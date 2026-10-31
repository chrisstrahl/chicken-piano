// Songs the kids write (Learn → Make music → Write a Song), saved on this device per player, like recordings.
// notes: parse() tokens, e.g. "C4:q E4:h R:q G4:w".
export interface MySong { id: string; at: number; emoji: string; title: string; notes: string }
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export const MYSONGS_KEY = 'chicken-piano-mysongs-v1';
export const MAX_MYSONGS = 30; // per player
export const MAX_NOTES = 64; // per song

function readAll(storage: Store): Record<string, MySong[]> {
  try { return JSON.parse(storage.getItem(MYSONGS_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function writeAll(all: Record<string, MySong[]>, storage: Store): boolean {
  try { storage.setItem(MYSONGS_KEY, JSON.stringify(all)); return true; } catch (e) { return false; }
}
export const listMySongs = (pid: string, storage: Store = localStorage): MySong[] => readAll(storage)[pid] || [];
// adds or replaces (same id); the oldest goes when there are too many
export function saveMySong(pid: string, song: MySong, storage: Store = localStorage): boolean {
  const all = readAll(storage);
  const list = (all[pid] || []).filter((s) => s.id !== song.id);
  list.push(song);
  all[pid] = list.slice(-MAX_MYSONGS);
  return writeAll(all, storage);
}
export function deleteMySong(pid: string, id: string, storage: Store = localStorage) {
  const all = readAll(storage);
  all[pid] = (all[pid] || []).filter((s) => s.id !== id);
  writeAll(all, storage);
}
export function deletePlayerSongs(pid: string, storage: Store = localStorage) {
  const all = readAll(storage);
  delete all[pid];
  writeAll(all, storage);
}
