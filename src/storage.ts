// Everything Chicken Piano saves lives in the browser's localStorage, under keys that start with 'chicken-piano':
//   chicken-piano-players          { current, list: Player[] }                 (profiles.ts)
//   chicken-piano-v1:<player id>   that player's progress: eggs, lessons, days... (profiles.ts, main.ts)
//   chicken-piano-recordings-v1    { [player id]: Recording[] }                (recorder.ts)
//   chicken-piano-mysongs-v1       { [player id]: MySong[] }                   (mysongs.ts)
//   chicken-piano-lag              this device's measured input delays         (timing.ts)
//   chicken-piano-uploads-v1      songs a grown-up uploaded from score files: (SongData & { at })[] (uploads.ts); every kid sees them
//   chicken-piano-private-songs    private song source: repo, token, downloaded songs (privatesongs.ts); not backed up
//   chicken-piano-schema           which layout the keys above are in (SCHEMA); migrate() brings old ones up to date
//   chicken-piano-backup-at        when a grown-up last saved a backup file
//   chicken-piano-broken:<key>     a value that couldn't be read, kept instead of being overwritten
//
// This module keeps that data safe:
// - readJSON() never throws; a value that won't parse is set aside (not silently replaced by an empty one)
// - writeJSON() makes room when the device is full (the oldest recordings go first) and says if it failed
// - migrate() runs once per launch and upgrades older layouts, one numbered step at a time
// - makeBackup()/mergeBackup() turn all of it into a file and back. Loading a backup only ever adds: it merges
//   eggs, lessons and songs into what's here, so the Safari tab and the home-screen app (which iPads keep
//   apart) can be joined up, and progress survives Safari clearing its data.
import type { Player } from './types.ts';

export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { key?: (i: number) => string | null; readonly length?: number };
export const PREFIX = 'chicken-piano';
export const KEYS = {
  players: 'chicken-piano-players',
  oldProgress: 'chicken-piano-v1', // progress from before there were players
  recordings: 'chicken-piano-recordings-v1',
  mysongs: 'chicken-piano-mysongs-v1',
  lag: 'chicken-piano-lag',
  schema: 'chicken-piano-schema',
  backupAt: 'chicken-piano-backup-at',
  privateSongs: 'chicken-piano-private-songs',
  uploads: 'chicken-piano-uploads-v1',
} as const;
export const progressKey = (id: string) => `${KEYS.oldProgress}:${id}`;
const brokenKey = (k: string) => `${PREFIX}-broken:${k}`;
export const SCHEMA = 2;

/* ---------- the browser's storage, or a stand-in ---------- */
export function memoryStore(): Store {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
let fallback: Store | null = null;
// localStorage, or (private browsing that refuses it, Node tests) a store that lasts until the page closes
export function browserStore(): Store {
  try { if (typeof localStorage !== 'undefined') { localStorage.getItem(KEYS.schema); return localStorage; } } catch (e) {}
  return (fallback ||= memoryStore());
}

/* ---------- safe reads and writes ---------- */
export const readRaw = (s: Store, k: string): string | null => { try { return s.getItem(k); } catch (e) { return null; } };
export const remove = (s: Store, k: string) => { try { s.removeItem(k); } catch (e) {} };
export function keysOf(s: Store): string[] {
  const out: string[] = [];
  try { for (let i = 0; i < (s.length || 0); i++) { const k = s.key?.(i); if (k && k.startsWith(PREFIX)) out.push(k); } } catch (e) {}
  return out;
}

// The value saved under k, or fallback when there is none. A value that isn't readable JSON (or isn't the
// expected kind: object vs array) is copied to chicken-piano-broken:<k> first, so the next save can't erase
// the only copy.
export function readJSON<T>(s: Store, k: string, fb: T): T {
  const raw = readRaw(s, k);
  if (raw == null) return fb;
  try {
    const v = JSON.parse(raw);
    const want = Array.isArray(fb) ? 'array' : fb === null ? null : typeof fb;
    const got = Array.isArray(v) ? 'array' : v === null ? null : typeof v;
    if (want == null || got === want) return v as T;
  } catch (e) {}
  try { if (readRaw(s, brokenKey(k)) == null) s.setItem(brokenKey(k), raw); } catch (e) {}
  return fb;
}

// Things that can free space when the device is full; each returns true if it freed something.
const roomMakers: ((s: Store) => boolean)[] = [];
export const onFull = (f: (s: Store) => boolean) => { roomMakers.push(f); };
let failedAt = 0;
// when a save last failed for lack of room (0: never, since the page opened); the grown-ups' page shows it
export const lastFailedSave = () => failedAt;

// Saves v as JSON under k. A full device gets room made (oldest recordings first) and the save tried again.
// Returns false if it still couldn't be saved.
// makeRoom false: just try once (for writing the recordings themselves, which trim their own list).
export function writeJSON(s: Store, k: string, v: unknown, makeRoom = true): boolean {
  const text = JSON.stringify(v);
  for (let tries = 0; tries < 200; tries++) {
    try { s.setItem(k, text); return true; } catch (e) {
      if (!makeRoom || !roomMakers.some((f) => { try { return f(s); } catch (err) { return false; } })) break;
    }
  }
  failedAt = Date.now();
  return false;
}

/* ---------- migrations ---------- */
// Each step takes the data from version n-1 to n. Version 0 = nothing stamped yet.
type Players = { current: string; list: Player[] };
const MIGRATIONS: Record<number, (s: Store) => void> = {
  // 1: players. Progress saved before there were players belongs to player 1.
  1: (s) => {
    const list = readJSON<Players | null>(s, KEYS.players, null);
    if (list && Array.isArray(list.list) && list.list.length) return;
    const old = readRaw(s, KEYS.oldProgress);
    if (old && readRaw(s, progressKey('p1')) == null) writeJSON(s, progressKey('p1'), readJSON(s, KEYS.oldProgress, {}));
  },
  // 2: tidy up. Recordings, songs and progress of players who were removed before removal cleaned up after
  // itself are dropped; the pre-players copy (moved to player 1 by step 1) goes too.
  2: (s) => {
    const pl = readJSON<Players | null>(s, KEYS.players, null);
    if (!pl || !Array.isArray(pl.list) || !pl.list.length) return; // nobody yet: nothing can be an orphan
    const ids = new Set(pl.list.map((p) => p.id));
    for (const key of [KEYS.recordings, KEYS.mysongs]) {
      const all = readJSON<Record<string, unknown>>(s, key, {});
      const gone = Object.keys(all).filter((id) => !ids.has(id));
      if (gone.length) { gone.forEach((id) => delete all[id]); writeJSON(s, key, all); }
    }
    keysOf(s).filter((k) => k.startsWith(KEYS.oldProgress + ':') && !ids.has(k.slice(KEYS.oldProgress.length + 1))).forEach((k) => remove(s, k));
    if (readRaw(s, progressKey('p1')) != null || !ids.has('p1')) remove(s, KEYS.oldProgress);
  },
};

// Brings saved data up to SCHEMA. Safe to call every launch. Data from a newer build is left alone.
export function migrate(s: Store): number {
  const from = Number(readRaw(s, KEYS.schema)) || 0;
  if (from >= SCHEMA) return from;
  for (let v = from + 1; v <= SCHEMA; v++) {
    try { MIGRATIONS[v](s); } catch (e) {}
  }
  writeJSON(s, KEYS.schema, SCHEMA);
  return SCHEMA;
}

/* ---------- backups ---------- */
export interface Backup { app: 'chicken-piano'; schema: number; at: number; data: Record<string, string> }
// Everything saved, as one object (the file a grown-up keeps). Broken copies and the schema stamp stay behind.
export function makeBackup(s: Store, now = Date.now()): Backup {
  const data: Record<string, string> = {};
  keysOf(s).filter((k) => k !== KEYS.schema && k !== KEYS.backupAt && k !== KEYS.privateSongs && !k.startsWith(`${PREFIX}-broken:`)).forEach((k) => { const v = readRaw(s, k); if (v != null) data[k] = v; });
  return { app: 'chicken-piano', schema: SCHEMA, at: now, data };
}
export const backupName = (at: number) => `chicken-piano-backup-${new Date(at).toISOString().slice(0, 10)}.json`;
export function parseBackup(text: string): Backup | null {
  try {
    const b = JSON.parse(text);
    if (b && b.app === 'chicken-piano' && b.data && typeof b.data === 'object' && Number(b.schema) <= SCHEMA) return b as Backup;
  } catch (e) {}
  return null;
}

// Settings a kid chose on this device win over the backup's; everything else is progress, merged so nothing
// is lost: the larger egg count, any lesson done, the most wins per day, the fastest time.
const SETTINGS = new Set(['letters', 'clefFlip', 'speed', 'hands']);
const FASTEST = new Set(['rushBest']);
type Obj = Record<string, any>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
export function mergeProgress(here: Obj, there: Obj, lowerWins = false, top = true): Obj {
  const out: Obj = { ...here };
  for (const [k, b] of Object.entries(there || {})) {
    const a = out[k];
    if (a === undefined) out[k] = b;
    else if (top && SETTINGS.has(k)) continue;
    else if (isObj(a) && isObj(b)) out[k] = mergeProgress(a, b, lowerWins || (top && FASTEST.has(k)), false);
    else if (typeof a === 'number' && typeof b === 'number') out[k] = lowerWins ? Math.min(a, b) : Math.max(a, b);
    else if (typeof a === 'boolean' && typeof b === 'boolean') out[k] = a || b;
  }
  return out;
}
const unionById = <T extends { id: string; at: number }>(a: T[], b: T[], max: number, newestFirst: boolean): T[] => {
  const seen = new Set(a.map((x) => x.id));
  const all = [...a, ...b.filter((x) => x && !seen.has(x.id))].sort((x, y) => (newestFirst ? y.at - x.at : x.at - y.at));
  return newestFirst ? all.slice(0, max) : all.slice(-max);
};

// A backup is a file from outside, so nothing in it is trusted: only the shapes the app itself saves get in,
// ids are plain words, and text loses anything that could be read as markup. (A doctored file must not be
// able to put its own HTML or script on the page.)
const ID = /^[\w-]{1,32}$/;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const cleanText = (v: unknown, max: number): string => String(v ?? '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
// progress: nested records of numbers and booleans, plus a few one-word settings
export function cleanProgress(v: unknown, depth = 0): Obj {
  const out: Obj = {};
  if (!isObj(v) || depth > 3) return out;
  for (const [key, x] of Object.entries(v).slice(0, 2000)) {
    const k = cleanText(key, 40);
    if (!k || BAD_KEYS.has(k)) continue;
    if (num(x) || typeof x === 'boolean') out[k] = x;
    else if (typeof x === 'string' && /^[\w-]{0,24}$/.test(x)) out[k] = x;
    else if (isObj(x)) out[k] = cleanProgress(x, depth + 1);
  }
  return out;
}
export function cleanPlayer(p: unknown): Player | null {
  if (!isObj(p) || typeof p.id !== 'string' || !ID.test(p.id) || typeof p.avatar !== 'string' || !ID.test(p.avatar)) return null;
  return { id: p.id, avatar: p.avatar, name: cleanText(p.name, 12) || 'Chicken' };
}
type Item = { id: string; at: number };
function cleanRecording(r: unknown): Item | null {
  if (!isObj(r) || typeof r.id !== 'string' || !ID.test(r.id) || !Array.isArray(r.notes)) return null;
  const notes = r.notes.filter((n: unknown) => Array.isArray(n) && n.length === 4 && n.every(num)).slice(0, 5000);
  if (!notes.length) return null;
  return { id: r.id, at: num(r.at) ? r.at : 0, title: cleanText(r.title, 60) || 'My song', emoji: cleanText(r.emoji, 16) || '🎹', song: typeof r.song === 'string' && ID.test(r.song) ? r.song : null, notes } as Item;
}
function cleanMySong(m: unknown): Item | null {
  if (!isObj(m) || typeof m.id !== 'string' || !ID.test(m.id) || typeof m.notes !== 'string' || !/^[A-GRa-g#b0-9:+~hqwd ]{1,2000}$/.test(m.notes)) return null;
  return { id: m.id, at: num(m.at) ? m.at : 0, title: cleanText(m.title, 60) || 'My song', emoji: cleanText(m.emoji, 16) || '🎵', notes: m.notes } as Item;
}
// an uploaded song (uploads.ts): an id, a level, and text fields only (the app checks the notes again when it loads it)
const UPLOAD_TEXT = ['emoji', 'title', 'sub', 'key', 'time', 'notes', 'lyrics', 'clef', 'lh', 'chords', 'fingers', 'lhFingers', 'lhStyle'];
function cleanUpload(u: unknown): Item | null {
  if (!isObj(u) || typeof u.id !== 'string' || !ID.test(u.id) || typeof u.notes !== 'string' || !num(u.level)) return null;
  const out: Obj = { id: u.id, at: num(u.at) ? u.at : 0, level: u.level };
  for (const k of ['tempo', 'pickup']) if (num(u[k])) out[k] = u[k];
  for (const k of UPLOAD_TEXT) if (typeof u[k] === 'string') out[k] = cleanText(u[k], 20000);
  return out as Item;
}
const cleanList = (v: unknown, clean: (x: unknown) => Item | null): Item[] => (Array.isArray(v) ? v.map(clean).filter((x): x is Item => !!x) : []);

export interface MergeResult { added: string[]; merged: string[]; skipped: string[] }
// Adds a backup's players and progress to what's here. A backup player joins the one here with the same id
// (the Safari tab and home-screen app both start with 'p1'), or failing that the same name and chicken;
// anyone else is added if there's room (maxPlayers).
export function mergeBackup(s: Store, b: Backup, maxPlayers: number, limits: { recordings: number; mysongs: number; uploads?: number } = { recordings: 30, mysongs: 30 }): MergeResult {
  const res: MergeResult = { added: [], merged: [], skipped: [] };
  const from = memoryStore();
  Object.entries(b.data).forEach(([k, v]) => from.setItem(k, String(v)));
  migrate(from); // an older backup is brought up to date first
  const theirs = readJSON<Players | null>(from, KEYS.players, null);
  const mine = readJSON<Players | null>(s, KEYS.players, null) || { current: 'p1', list: [] };
  const recsHere = readJSON<Obj>(s, KEYS.recordings, {}), recsThere = readJSON<Obj>(from, KEYS.recordings, {});
  const songsHere = readJSON<Obj>(s, KEYS.mysongs, {}), songsThere = readJSON<Obj>(from, KEYS.mysongs, {});
  for (const p of (theirs && Array.isArray(theirs.list) ? theirs.list : []).map(cleanPlayer).filter((x): x is Player => !!x)) {
    let me = mine.list.find((q) => q.id === p.id) || mine.list.find((q) => q.name === p.name && q.avatar === p.avatar);
    if (!me) {
      if (mine.list.length >= maxPlayers) { res.skipped.push(p.name); continue; }
      me = { ...p };
      while (mine.list.some((q) => q.id === me!.id)) me.id += 'x';
      mine.list.push(me);
      res.added.push(me.name);
    } else res.merged.push(me.name);
    const prog = mergeProgress(readJSON<Obj>(s, progressKey(me.id), {}), cleanProgress(readJSON<Obj>(from, progressKey(p.id), {})));
    writeJSON(s, progressKey(me.id), prog);
    recsHere[me.id] = unionById(recsHere[me.id] || [], cleanList(recsThere[p.id], cleanRecording), limits.recordings, true);
    songsHere[me.id] = unionById(songsHere[me.id] || [], cleanList(songsThere[p.id], cleanMySong), limits.mysongs, false);
  }
  if (!mine.list.some((q) => q.id === mine.current) && mine.list.length) mine.current = mine.list[0].id;
  writeJSON(s, KEYS.players, mine);
  writeJSON(s, KEYS.mysongs, songsHere);
  // uploaded songs belong to the device, not a kid: the backup's are added to the ones here
  const upHere = readJSON<any[]>(s, KEYS.uploads, []), upThere = readJSON<any[]>(from, KEYS.uploads, []);
  if (Array.isArray(upThere) && upThere.length) writeJSON(s, KEYS.uploads, unionById(Array.isArray(upHere) ? upHere : [], cleanList(upThere, cleanUpload), limits.uploads ?? 50, false));
  // recordings last: the biggest, and the ones that give way (oldest first) if room runs out
  while (!writeJSON(s, KEYS.recordings, recsHere, false)) {
    const lists = Object.values(recsHere).filter((l: any[]) => l.length);
    if (!lists.length) break;
    lists.sort((x: any[], y: any[]) => x[x.length - 1].at - y[y.length - 1].at)[0].pop();
  }
  // this device's delay check, if it hasn't done its own (same iPad, other app)
  if (readRaw(s, KEYS.lag) == null && readRaw(from, KEYS.lag) != null) writeJSON(s, KEYS.lag, cleanProgress(readJSON(from, KEYS.lag, {})));
  return res;
}
