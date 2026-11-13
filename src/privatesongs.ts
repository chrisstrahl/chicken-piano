// Private songs: extra songs kept OUT of this public repo (for example simplified versions of copyrighted tunes),
// in a private GitHub repo of the family's own. A grown-up enters the repo and a read-only token once on the
// grown-ups' page; this device downloads songs.json from it and keeps a copy, so the songs work offline and the
// public site never contains them. The token never leaves this device except to api.github.com, and is left out
// of backup files.
//
// songs.json is a list of songs in exactly the songs.js format (id, level, emoji, title, sub, key, time, tempo,
// notes, lyrics, and optionally pickup, clef, lh, chords, fingers, lhFingers, lhStyle), or { "songs": [...] }.
// The app checks each one and skips any it can't read (setPrivateSongs in music.ts says why).
import { KEYS, readJSON, writeJSON, remove, type Store } from './storage.ts';
import type { SongData } from './types.ts';

export interface PrivateSource {
  repo: string; // "owner/name", or a full https URL to a JSON file (no token needed then)
  path: string; // file in the repo, default songs.json
  token: string; // GitHub fine-grained token with read-only Contents access to that one repo
  at: number; // when the songs were last downloaded (0: never)
  songs: unknown[]; // the downloaded list, as is
  error: string; // the last download's problem, '' when it worked
}
export const PRIVATE_KEY = KEYS.privateSongs;
export const DEFAULT_PATH = 'songs.json';

export const readSource = (s: Store): PrivateSource | null => {
  const v = readJSON<Partial<PrivateSource> | null>(s, PRIVATE_KEY, null);
  if (!v || typeof v !== 'object' || typeof v.repo !== 'string') return null;
  return { repo: v.repo, path: v.path || DEFAULT_PATH, token: v.token || '', at: v.at || 0, songs: Array.isArray(v.songs) ? v.songs : [], error: v.error || '' };
};
export const writeSource = (s: Store, src: PrivateSource) => writeJSON(s, PRIVATE_KEY, src);
export const forgetSource = (s: Store) => remove(s, PRIVATE_KEY);

// "chrisstrahl/chicken-piano-songs", "https://github.com/chrisstrahl/chicken-piano-songs(.git)" -> owner/name
export function repoName(text: string): string | null {
  const t = text.trim().replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/+$/, '').replace(/\.git$/, '');
  return /^[\w.-]+\/[\w.-]+$/.test(t) ? t : null;
}
export function sourceUrl(src: Pick<PrivateSource, 'repo' | 'path'>): string | null {
  if (/^https:\/\//.test(src.repo) && !/^https:\/\/(www\.)?github\.com\//.test(src.repo)) return src.repo;
  const r = repoName(src.repo);
  if (!r) return null;
  const path = (src.path || DEFAULT_PATH).replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${r}/contents/${path}`;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;
// Downloads the song list. Returns the list, or throws an Error whose message a grown-up can act on.
export async function download(src: Pick<PrivateSource, 'repo' | 'path' | 'token'>, fetchFn: Fetch = (u, i) => fetch(u, i)): Promise<unknown[]> {
  const url = sourceUrl(src);
  if (!url) throw new Error('That doesn\'t look like a GitHub repo. Use owner/name, like chrisstrahl/chicken-piano-songs.');
  const github = url.startsWith('https://api.github.com/');
  const headers: Record<string, string> = github ? { Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' } : {};
  if (github && src.token) headers.Authorization = `Bearer ${src.token.trim()}`;
  let res;
  try { res = await fetchFn(url, { headers, cache: 'no-store' }); } catch (e) { throw new Error('Couldn\'t reach GitHub. Is this device online?'); }
  if (!res.ok) {
    if (res.status === 401) throw new Error('GitHub didn\'t accept the token. It may have expired: make a new one.');
    if (res.status === 403) throw new Error('GitHub refused (403). Check the token can read this repo\'s Contents.');
    if (res.status === 404) throw new Error(`GitHub can't find ${src.path || DEFAULT_PATH} in ${src.repo}. Check the name, and that the token covers this repo.`);
    throw new Error(`GitHub answered ${res.status}.`);
  }
  let data: any;
  try { data = JSON.parse(await res.text()); } catch (e) { throw new Error(`${src.path || DEFAULT_PATH} isn't valid JSON.`); }
  const list = Array.isArray(data) ? data : data && Array.isArray(data.songs) ? data.songs : null;
  if (!list) throw new Error(`${src.path || DEFAULT_PATH} should be a list of songs, or { "songs": [ ... ] }.`);
  return list;
}

// Checks one song's fields and copies the ones the app knows. Returns the clean song, or why it was skipped.
// Text that ends up on screen loses < > & " so a song file can't add markup to the page.
const FIELDS = ['id', 'level', 'emoji', 'title', 'sub', 'key', 'time', 'tempo', 'pickup', 'clef', 'bars', 'lhStyle', 'notes', 'lh', 'chords', 'fingers', 'lhFingers', 'lyrics'] as const;
const plain = (v: string) => v.replace(/[<>&"]/g, '');
export function cleanSong(raw: unknown): { song: SongData } | { why: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { why: 'not a song object' };
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !/^[\w-]{1,40}$/.test(r.id)) return { why: 'id must be letters, numbers, - or _' };
  if (!Number.isInteger(r.level) || (r.level as number) < 1 || (r.level as number) > 10) return { why: 'level must be 1 to 10' };
  if (typeof r.notes !== 'string' || !r.notes.trim()) return { why: 'no notes' };
  if (typeof r.title !== 'string' || !r.title.trim()) return { why: 'no title' };
  const out: Record<string, unknown> = {};
  for (const k of FIELDS) {
    const v = r[k];
    if (v === undefined) continue;
    if (['level', 'tempo', 'pickup'].includes(k)) { if (typeof v !== 'number' || !isFinite(v)) return { why: `${k} must be a number` }; out[k] = v; continue; }
    if (k === 'bars') { out[k] = !!v; continue; }
    if (typeof v !== 'string') return { why: `${k} must be text` };
    out[k] = ['title', 'sub', 'emoji', 'lyrics'].includes(k) ? plain(v) : v;
  }
  if (out.tempo !== undefined) out.tempo = Math.min(240, Math.max(30, out.tempo as number));
  if (out.time !== undefined && !['4/4', '3/4', '6/8'].includes(out.time as string)) return { why: `time ${out.time} isn't supported` };
  if (out.clef !== undefined && !['treble', 'bass'].includes(out.clef as string)) return { why: 'clef must be treble or bass' };
  return { song: { emoji: '🎵', sub: '', key: 'C', time: '4/4', tempo: 100, lyrics: '', ...out } as unknown as SongData };
}
