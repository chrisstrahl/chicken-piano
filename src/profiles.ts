// Players: each kid picks a chicken and gets their own eggs, chicks and unlocked songs.
// Progress for player <id> lives in localStorage under 'chicken-piano-v1:<id>'; the list of players under
// 'chicken-piano-players'. storage.ts reads and writes them safely and upgrades older layouts (migrate()).

// The chickens a kid can be. body/edge recolor the mascot (see chicken.ts).
import type { Avatar, Player } from './types.ts';
import { KEYS, progressKey, readJSON, writeJSON, remove, migrate, browserStore, type Store } from './storage.ts';

export const AVATARS: Avatar[] = [
  { id: 'clucky', name: 'Clucky', body: '#ffffff', edge: '#eadcc6' },
  { id: 'sunny', name: 'Sunny', body: '#ffe45c', edge: '#e2c23a' },
  { id: 'nugget', name: 'Nugget', body: '#d9a066', edge: '#b98146' },
  { id: 'rosie', name: 'Rosie', body: '#ffb8d6', edge: '#e993b8' },
  { id: 'blueberry', name: 'Blueberry', body: '#a6d8ff', edge: '#7cb8e8' },
  { id: 'pickle', name: 'Pickle', body: '#b5e68a', edge: '#8fc663' },
];
export const MAX_PLAYERS = 6;
export const avatarOf = (p: Pick<Player, 'avatar'> | null | undefined): Avatar => AVATARS.find((a) => a.id === (p && p.avatar)) || AVATARS[0];

// a player's saved progress: a plain object, the app adds its own defaults
type Progress = Record<string, any>;

// storage: localStorage, or a stand-in in tests
export function makePlayers(storage: Store) {
  migrate(storage);
  const removed: ((id: string) => void)[] = [];

  type State = { current: string; list: Player[] };
  const saved = readJSON<State | null>(storage, KEYS.players, null);
  // first launch: player 1 (any progress from before players existed was moved to p1 by migrate())
  let state: State = saved && Array.isArray(saved.list) && saved.list.length ? saved
    : { current: 'p1', list: [{ id: 'p1', avatar: AVATARS[0].id, name: AVATARS[0].name }] };
  if (!state.list.some((p) => p.id === state.current)) state.current = state.list[0].id;
  const store = () => writeJSON(storage, KEYS.players, state);
  store();

  const find = (id: string) => state.list.find((p) => p.id === id);
  return {
    list: () => state.list.slice(),
    // always someone: current points at a listed player and the last one can't be removed
    current: (): Player => find(state.current)!,
    // re-reads the list (after a backup was loaded)
    reload() {
      const s = readJSON<State | null>(storage, KEYS.players, null);
      if (s && Array.isArray(s.list) && s.list.length) { state = s; if (!find(state.current)) state.current = state.list[0].id; }
    },
    use(id: string) { if (find(id)) { state.current = id; store(); } return this.current(); },
    add(avatar: string, name?: string): Player | null {
      if (state.list.length >= MAX_PLAYERS) return null;
      let id = 'p' + Date.now().toString(36);
      while (find(id)) id += 'x';
      const p = { id, avatar, name: cleanName(name, avatar) };
      state.list.push(p);
      store();
      return p;
    },
    update(id: string, avatar: string, name?: string) {
      const p = find(id);
      if (p) { p.avatar = avatar; p.name = cleanName(name, avatar); store(); }
      return p;
    },
    // the last player can't be removed
    remove(id: string) {
      if (state.list.length < 2 || !find(id)) return false;
      state.list = state.list.filter((p) => p.id !== id);
      if (state.current === id) state.current = state.list[0].id;
      remove(storage, progressKey(id));
      store();
      removed.forEach((f) => f(id));
      return true;
    },
    onRemove(fn: (id: string) => void) { removed.push(fn); },
    // a player's saved progress (a plain object; the app adds its own defaults)
    progress(id = state.current): Progress { return readJSON<Progress>(storage, progressKey(id), {}); },
    // false if the device had no room for it, even after dropping old recordings
    save(progress: Progress, id = state.current): boolean { return writeJSON(storage, progressKey(id), progress); },
  };
}
// a short name, or the chicken's own name when none was typed
function cleanName(name: string | undefined, avatar: string) {
  const n = String(name || '').replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  return n || AVATARS.find((a) => a.id === avatar)?.name || AVATARS[0].name;
}

export const players = makePlayers(browserStore());
// for other modules that keep per-player data (recordings)
export const playerId = () => players.current().id;
