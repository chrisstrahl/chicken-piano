// Offline checks for saved data (src/storage.ts): migrations, unreadable values, a full device, backups.
// Usage: node test/storage.mjs
import { memoryStore, migrate, readJSON, writeJSON, KEYS, progressKey, SCHEMA, makeBackup, parseBackup, mergeBackup, mergeProgress, keysOf } from '../src/storage.ts';
import { makePlayers } from '../src/profiles.ts';
import { saveRecording, listRecordings } from '../src/recorder.ts';
import { saveMySong, listMySongs } from '../src/mysongs.ts';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const J = JSON.stringify;
const rec = (id, at) => ({ id, at, title: 't', emoji: '🎹', song: null, notes: [[0, 60, 300, 0.8]] });

// 1. a device from before players: its progress becomes player 1, the old key goes on the next launch
{
  const s = memoryStore();
  s.setItem(KEYS.oldProgress, J({ songs: { clucky: 3 }, lessons: { l1a: true } }));
  const pl = makePlayers(s);
  check(pl.progress('p1').songs.clucky === 3, 'pre-players progress moves to player 1');
  check(s.getItem(KEYS.schema) === String(SCHEMA), `schema stamped ${SCHEMA}`);
  check(migrate(s) === SCHEMA, 'migrate is a no-op when up to date');
}
// 2. a v1 device (players, no schema stamp) with leftovers of a removed player
{
  const s = memoryStore();
  s.setItem(KEYS.players, J({ current: 'p1', list: [{ id: 'p1', avatar: 'clucky', name: 'Max' }] }));
  s.setItem(progressKey('p1'), J({ songs: { a: 2 } }));
  s.setItem(progressKey('gone'), J({ songs: { a: 1 } }));
  s.setItem(KEYS.oldProgress, J({ songs: { a: 1 } }));
  s.setItem(KEYS.recordings, J({ p1: [rec('r1', 1)], gone: [rec('r2', 2)] }));
  s.setItem(KEYS.mysongs, J({ gone: [{ id: 's', at: 1 }] }));
  migrate(s);
  check(s.getItem(progressKey('gone')) == null && s.getItem(KEYS.oldProgress) == null, 'orphan and pre-players progress removed');
  check(J(Object.keys(JSON.parse(s.getItem(KEYS.recordings)))) === '["p1"]', 'orphan recordings removed');
  check(J(JSON.parse(s.getItem(KEYS.mysongs))) === '{}', 'orphan songs removed');
  check(JSON.parse(s.getItem(progressKey('p1'))).songs.a === 2, 'real progress kept');
}
// 3. data from a newer build is left alone
{
  const s = memoryStore();
  s.setItem(KEYS.schema, String(SCHEMA + 5));
  s.setItem(progressKey('zz'), '{}');
  migrate(s);
  check(s.getItem(progressKey('zz')) === '{}' && s.getItem(KEYS.schema) === String(SCHEMA + 5), 'newer schema untouched');
}
// 4. a value that won't parse is set aside, not lost
{
  const s = memoryStore();
  s.setItem(progressKey('p1'), '{"songs":{"a":3');
  const v = readJSON(s, progressKey('p1'), {});
  check(J(v) === '{}', 'unreadable progress reads as empty');
  writeJSON(s, progressKey('p1'), { songs: {} });
  check(s.getItem(`chicken-piano-broken:${progressKey('p1')}`) === '{"songs":{"a":3', 'unreadable value kept under broken:');
  s.setItem(KEYS.recordings, '"text"');
  check(J(listRecordings('p1', s)) === '[]', 'recordings of the wrong kind read as empty');
}
// 5. a full device: saving progress drops the oldest recordings, never the progress
{
  const s = memoryStore();
  const set = s.setItem;
  let size = () => ['chicken-piano-recordings-v1', progressKey('p1')].reduce((a, k) => a + (k === pending.k ? pending.v.length : (s.getItem(k) || '').length), 0);
  const pending = { k: '', v: '' };
  s.setItem = (k, v) => { pending.k = k; pending.v = v; const n = size(); pending.k = ''; if (n > 3000) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } set(k, v); };
  for (let i = 0; i < 20; i++) saveRecording('p1', { ...rec('r' + i, i), notes: Array(10).fill([0, 60, 100]) }, s);
  const before = listRecordings('p1', s).length;
  const ok = writeJSON(s, progressKey('p1'), { songs: Object.fromEntries(Array.from({ length: 60 }, (_, i) => ['song' + i, 3])) });
  const after = listRecordings('p1', s);
  check(ok, 'progress saved on a full device');
  check(after.length < before && after[after.length - 1].at > 0 && after[0].id === 'r19', `oldest recordings made room (${before} -> ${after.length}, newest kept)`);
}
// 6. merging progress: the most eggs, any lesson done, the fastest time; this device's settings stay
{
  const m = mergeProgress(
    { songs: { a: 1, b: 3 }, lessons: { l1: true }, days: { '2026-11-01': 1 }, rushBest: { r1: 9000 }, letters: false, speed: 1 },
    { songs: { a: 3, c: 2 }, lessons: { l2: true }, days: { '2026-11-01': 4, '2026-11-02': 2 }, rushBest: { r1: 7000, r2: 8000 }, letters: true, speed: 0.5, hands: 'both', open: { 3: true } });
  check(J(m.songs) === J({ a: 3, b: 3, c: 2 }), 'songs: most eggs');
  check(J(m.lessons) === J({ l1: true, l2: true }), 'lessons: union');
  check(J(m.days) === J({ '2026-11-01': 4, '2026-11-02': 2 }), 'days: most wins');
  check(J(m.rushBest) === J({ r1: 7000, r2: 8000 }), 'Egg Rush: fastest');
  check(m.letters === false && m.speed === 1 && m.hands === 'both' && m.open[3] === true, 'settings stay, new ones come in');
}
// 7. backup from the Safari tab loaded into the home-screen app
{
  const tab = memoryStore();
  const tp = makePlayers(tab);
  tp.update('p1', 'sunny', 'Max');
  tp.save({ songs: { a: 3 }, lessons: { l1: true } }, 'p1');
  const sis = tp.add('rosie', 'Ivy');
  tp.save({ songs: { b: 1 } }, sis.id);
  saveRecording('p1', rec('tab-rec', 50), tab);
  saveMySong(sis.id, { id: 'w1', at: 5, emoji: '🎵', title: 'Mine', notes: 'C4:q' }, tab);
  tab.setItem(KEYS.lag, J({ mic: 40 }));
  const text = J(makeBackup(tab, Date.UTC(2026, 10, 7)));

  const app = memoryStore();
  const ap = makePlayers(app);
  ap.save({ songs: { a: 1, z: 2 }, lessons: { l2: true }, letters: false }, 'p1');
  saveRecording('p1', rec('app-rec', 60), app);
  const b = parseBackup(text);
  check(!!b && b.schema === SCHEMA, 'backup parses');
  const r = mergeBackup(app, b, 6);
  check(J(r.merged) === '["Clucky"]' && J(r.added) === '["Ivy"]', `player 1 merged, sister added (${J(r)})`);
  const ap2 = makePlayers(app);
  const p1 = ap2.progress('p1');
  check(J(p1.songs) === J({ a: 3, z: 2 }) && p1.lessons.l1 && p1.lessons.l2 && p1.letters === false, 'player 1 progress merged');
  check(ap2.list().length === 2 && ap2.progress(sis.id).songs.b === 1, "sister's progress came along");
  check(J(listRecordings('p1', app).map((x) => x.id)) === '["app-rec","tab-rec"]', 'recordings joined, newest first');
  check(listMySongs(sis.id, app)[0]?.title === 'Mine', "sister's written song came along");
  check(JSON.parse(app.getItem(KEYS.lag)).mic === 40, "delay check copied when this app hasn't done one");
  // loading the same backup twice changes nothing
  const snap = J(makeBackup(app, 1));
  mergeBackup(app, parseBackup(text), 6);
  check(J(makeBackup(app, 1)) === snap, 'loading twice is harmless');
  // no room for more players
  const full = memoryStore();
  const fp = makePlayers(full);
  for (let i = 0; i < 5; i++) fp.add('pickle', 'K' + i);
  const r2 = mergeBackup(full, parseBackup(text), 6);
  check(J(r2.skipped) === '["Ivy"]', 'a seventh player is skipped, not squeezed in');
}
// 8. not a backup
check(parseBackup('{"hello":1}') === null && parseBackup('nope') === null, 'other files are refused');
check(parseBackup(J({ app: 'chicken-piano', schema: SCHEMA + 1, at: 1, data: {} })) === null, 'a backup from a newer version is refused');

// 9. a doctored backup: nothing in it may reach the page as markup, and odd shapes are dropped
{
  const evil = '<img src=x onerror=alert(1)>';
  const data = {
    [KEYS.players]: J({ current: 'p1', list: [
      { id: 'p1', avatar: 'sunny', name: evil },
      { id: '"><script>x</script>', avatar: 'rosie', name: 'Bad id' },
      { id: 'p9', avatar: 'x" onload="y', name: 'Bad chicken' },
      'not a player', null,
    ] }),
    [progressKey('p1')]: J({ songs: { a: 2, [evil]: 3, b: evil }, missed: { [evil]: 4 }, hands: 'lh', speed: 0.5, letters: false, junk: [1, 2], deep: { a: { b: { c: { d: { e: 1 } } } } } }),
    [KEYS.recordings]: J({ p1: [
      { id: 'ok1', at: 5, title: evil, emoji: evil, song: evil, notes: [[0, 60, 300, 0.8], 'x', [1, 2]] },
      { id: evil, at: 6, title: 't', emoji: '🎹', song: null, notes: [[0, 60, 300, 0.8]] },
      { id: 'nonotes', at: 7, title: 't', emoji: '🎹', song: null, notes: 'oops' },
    ] }),
    [KEYS.mysongs]: J({ p1: [
      { id: 'w1', at: 1, emoji: evil, title: evil, notes: 'C4:q E4:h R:q G4:w' },
      { id: 'w2', at: 2, emoji: '🎵', title: 'x', notes: evil },
      { id: 'w3', at: 3, emoji: '🎵', title: 'x', notes: { a: 1 } },
    ] }),
    [KEYS.lag]: J({ mic: 40, tap: evil }),
  };
  // (JSON.parse makes "__proto__" an own key, the way a real file would)
  data[progressKey('p1')] = data[progressKey('p1')].replace('{', '{"__proto__":{"polluted":true},');
  const s = memoryStore();
  const r = mergeBackup(s, parseBackup(J({ app: 'chicken-piano', schema: SCHEMA, at: 1, data })), 6);
  const all = keysOf(s).map((k) => s.getItem(k)).join('\n');
  check(!/[<>]/.test(all) && !all.includes('onerror=alert(1)>') && !all.includes('onload='), 'no markup from a backup is saved');
  const pl = JSON.parse(s.getItem(KEYS.players));
  check(pl.list.length === 1 && pl.list[0].id === 'p1' && pl.list[0].name.length <= 12 && r.added.length === 1, 'players with odd ids or chickens are dropped, names are cleaned');
  const pr = JSON.parse(s.getItem(progressKey('p1')));
  check(pr.songs.a === 2 && pr.hands === 'lh' && pr.speed === 0.5 && pr.letters === false && pr.junk === undefined && pr.songs.b === undefined, 'progress keeps numbers, yes/no and one-word settings only');
  check({}.polluted === undefined && !Object.prototype.hasOwnProperty.call(pr, '__proto__') && pr.polluted === undefined, 'no prototype tricks');
  const recs = listRecordings('p1', s);
  check(recs.length === 1 && recs[0].id === 'ok1' && recs[0].song === null && recs[0].notes.length === 1, 'recordings: bad ids, bad notes and bad song links are dropped');
  const mine = JSON.parse(s.getItem(KEYS.mysongs)).p1;
  check(mine.length === 1 && mine[0].id === 'w1' && mine[0].notes === 'C4:q E4:h R:q G4:w', 'written songs: only real note text gets in');
  check(J(JSON.parse(s.getItem(KEYS.lag))) === '{"mic":40}', 'delay check keeps numbers only');
}

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
