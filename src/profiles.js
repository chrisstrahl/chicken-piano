// Players: each kid picks a chicken and gets their own eggs, chicks and unlocked songs.
// Progress for player <id> lives in localStorage under 'chicken-piano-v1:<id>'; the list of players under
// 'chicken-piano-players'. Progress saved before players existed ('chicken-piano-v1') becomes player 'p1'.

// The chickens a kid can be. body/edge recolor the mascot (see chicken.js).
export const AVATARS = [
  { id: 'clucky', name: 'Clucky', body: '#ffffff', edge: '#eadcc6' },
  { id: 'sunny', name: 'Sunny', body: '#ffe45c', edge: '#e2c23a' },
  { id: 'nugget', name: 'Nugget', body: '#d9a066', edge: '#b98146' },
  { id: 'rosie', name: 'Rosie', body: '#ffb8d6', edge: '#e993b8' },
  { id: 'blueberry', name: 'Blueberry', body: '#a6d8ff', edge: '#7cb8e8' },
  { id: 'pickle', name: 'Pickle', body: '#b5e68a', edge: '#8fc663' },
];
export const MAX_PLAYERS = 6;
export const avatarOf = (p) => AVATARS.find((a) => a.id === (p && p.avatar)) || AVATARS[0];

const OLD = 'chicken-piano-v1';
const LIST = 'chicken-piano-players';
const progressKey = (id) => `${OLD}:${id}`;

// storage: anything with getItem/setItem/removeItem (localStorage, or a stand-in in tests)
export function makePlayers(storage) {
  const get = (k) => { try { return storage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { storage.setItem(k, v); } catch (e) {} };
  const del = (k) => { try { storage.removeItem(k); } catch (e) {} };
  const removed = [];

  let state = null;
  try { state = JSON.parse(get(LIST)); } catch (e) {}
  if (!state || !Array.isArray(state.list) || !state.list.length) {
    // first launch, or the first launch since players were added: whatever progress exists belongs to player 1
    state = { current: 'p1', list: [{ id: 'p1', avatar: AVATARS[0].id, name: AVATARS[0].name }] };
    const old = get(OLD);
    if (old && !get(progressKey('p1'))) set(progressKey('p1'), old);
  }
  if (!state.list.some((p) => p.id === state.current)) state.current = state.list[0].id;
  const store = () => set(LIST, JSON.stringify(state));
  store();

  const find = (id) => state.list.find((p) => p.id === id);
  return {
    list: () => state.list.slice(),
    current: () => find(state.current),
    use(id) { if (find(id)) { state.current = id; store(); } return this.current(); },
    add(avatar, name) {
      if (state.list.length >= MAX_PLAYERS) return null;
      let id = 'p' + Date.now().toString(36);
      while (find(id)) id += 'x';
      const p = { id, avatar, name: cleanName(name, avatar) };
      state.list.push(p);
      store();
      return p;
    },
    update(id, avatar, name) {
      const p = find(id);
      if (p) { p.avatar = avatar; p.name = cleanName(name, avatar); store(); }
      return p;
    },
    // the last player can't be removed
    remove(id) {
      if (state.list.length < 2 || !find(id)) return false;
      state.list = state.list.filter((p) => p.id !== id);
      if (state.current === id) state.current = state.list[0].id;
      del(progressKey(id));
      store();
      removed.forEach((f) => f(id));
      return true;
    },
    onRemove(fn) { removed.push(fn); },
    // a player's saved progress (a plain object; the app adds its own defaults)
    progress(id = state.current) { try { return JSON.parse(get(progressKey(id)) || '{}') || {}; } catch (e) { return {}; } },
    save(progress, id = state.current) { set(progressKey(id), JSON.stringify(progress)); },
  };
}
// a short name, or the chicken's own name when none was typed
function cleanName(name, avatar) {
  const n = String(name || '').replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  return n || AVATARS.find((a) => a.id === avatar)?.name || AVATARS[0].name;
}

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const browserStorage = () => { try { if (typeof localStorage !== 'undefined') return localStorage; } catch (e) {} return memory(); };
export const players = makePlayers(browserStorage());
// for other modules that keep per-player data (recordings)
export const playerId = () => players.current().id;
