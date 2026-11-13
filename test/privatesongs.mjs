// Private song source (src/privatesongs.ts + setPrivateSongs in music.ts): repo names, the GitHub request,
// error messages, field checks, and how the songs join the library. Needs no network: fetch is faked.
// usage: node test/privatesongs.mjs
import { repoName, sourceUrl, download, cleanSong, readSource, writeSource, forgetSource, PRIVATE_KEY } from '../src/privatesongs.ts';
import { memoryStore, makeBackup } from '../src/storage.ts';
import { SONGS, setPrivateSongs, songsForLevel, songById } from '../src/music.ts';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const rejects = async (p, re, msg) => { try { await p; check(false, msg + ' (no error)'); } catch (e) { check(re.test(e.message), `${msg}: ${e.message}`); } };

check(repoName('chrisstrahl/chicken-piano-songs') === 'chrisstrahl/chicken-piano-songs', 'owner/name');
check(repoName(' https://github.com/chrisstrahl/chicken-piano-songs.git/ ') === 'chrisstrahl/chicken-piano-songs', 'a pasted GitHub link');
check(repoName('not a repo') === null && repoName('a/b/c') === null, 'nonsense is refused');
check(sourceUrl({ repo: 'a/b', path: 'songs.json' }) === 'https://api.github.com/repos/a/b/contents/songs.json', 'contents API URL');
check(sourceUrl({ repo: 'https://example.com/x.json', path: '' }) === 'https://example.com/x.json', 'a plain JSON URL is used as is');

const SONG = { id: 'hook', level: 2, emoji: '🎤', title: 'My <b>Hook</b>', sub: 'Some hit', key: 'C', time: '4/4', tempo: 100, notes: 'C D E F G:w', lyrics: 'one two three four five' };
let seen;
const fake = (status, body) => async (url, init) => { seen = { url, init }; return { ok: status < 300, status, text: async () => body }; };
const list = await download({ repo: 'a/b', path: 'songs.json', token: ' tok ' }, fake(200, JSON.stringify([SONG])));
check(list.length === 1 && seen.init.headers.Authorization === 'Bearer tok' && /raw/.test(seen.init.headers.Accept), 'downloads the raw file with the token');
check((await download({ repo: 'a/b', path: 'songs.json', token: '' }, fake(200, JSON.stringify({ songs: [SONG, SONG] })))).length === 2, '{ songs: [...] } works too');
check(!('Authorization' in seen.init.headers), 'no token, no Authorization header');
await rejects(download({ repo: 'a/b', path: 'songs.json', token: 'x' }, fake(401, '')), /token/, '401');
await rejects(download({ repo: 'a/b', path: 'songs.json', token: 'x' }, fake(404, '')), /can't find songs.json/, '404');
await rejects(download({ repo: 'a/b', path: 'songs.json', token: 'x' }, fake(200, '{oops')), /isn't valid JSON/, 'bad JSON');
await rejects(download({ repo: 'a/b', path: 'songs.json', token: 'x' }, fake(200, '{"x":1}')), /list of songs/, 'wrong shape');
await rejects(download({ repo: 'a/b', path: 'songs.json', token: 'x' }, async () => { throw new Error('offline'); }), /online/, 'offline');

const c = cleanSong(SONG);
check('song' in c && c.song.title === 'My bHook/b', 'markup is stripped from titles');
check('why' in cleanSong({ ...SONG, level: 11 }) && 'why' in cleanSong({ ...SONG, id: 'a b' }) && 'why' in cleanSong({ ...SONG, notes: '' }) && 'why' in cleanSong({ ...SONG, time: '5/4' }), 'bad level, id, notes and time are refused');
check('song' in cleanSong({ id: 'min', level: 1, title: 'Min', notes: 'C D E' }), 'only id, level, title and notes are required');
check('song' in cleanSong({ ...SONG, extra: 1 }) && !('extra' in cleanSong({ ...SONG, extra: 1 }).song), 'unknown fields are dropped');

const before = SONGS.length, lastBuiltIn = songsForLevel(2).at(-1);
const r = setPrivateSongs([c.song, { ...c.song, id: 'broken', notes: 'C Z9 E' }, c.song]);
check(r.added.length === 1 && r.skipped.length === 2 && SONGS.length === before + 1, `adds good songs, skips bad notes and repeats (${r.skipped.map((s) => s.why).join('; ')})`);
const mine = songById('priv-hook');
check(mine && mine.priv && songsForLevel(2).at(-1) === mine && songsForLevel(2).at(-2) === lastBuiltIn, 'listed last in its level, id prefixed');
check(mine.lh.length > 0, 'gets a left hand like any other song');
setPrivateSongs([]);
check(SONGS.length === before && !songById('priv-hook'), 'loading an empty list takes them out again');

const store = memoryStore();
writeSource(store, { repo: 'a/b', path: 'songs.json', token: 'secret', at: 1, songs: [SONG], error: '' });
check(readSource(store).token === 'secret' && readSource(store).songs.length === 1, 'saved on the device');
check(!(PRIVATE_KEY in makeBackup(store).data), 'the token and songs are not put in backup files');
forgetSource(store);
check(readSource(store) === null, 'remove forgets it');

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log('all passed');
