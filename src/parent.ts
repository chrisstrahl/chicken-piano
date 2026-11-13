// Grown-ups' page: how each kid is doing, side by side. Opened by holding 📊 in the coop for 1.5 s, so little
// fingers don't land here. More words than the rest of the app, since it's for the grown-ups.
// summarize() is plain data (Node tests use it); setupParent() draws it.
import { RUSH_STAGES, CLUCK_STAGES, TWINKLE_STAGES } from './barnyard.js';
import { EAR_STAGES } from './ear.js';
import { MYSTERY_STAGES, MOOD_STAGES } from './quiz.js';
import { FRESH_STAGES } from './sightread.js';
import { streak, dayKey } from './streaks.js';
import { esc as escHtml } from './dom.js';
import { KEYS, readRaw, keysOf, makeBackup, backupName, parseBackup, mergeBackup, lastFailedSave, writeJSON, type Store } from './storage.js';
import type { Level, Song, SongData, Player } from './types';
import type { Draft } from './scoreimport.js';
import type { Upload } from './uploads.js';
import type { PrivateSource } from './privatesongs.js';
import { WHATSNEW } from './whatsnew.generated.js';

type Saved = {
  songs?: Record<string, number>; lessons?: Record<string, boolean>; days?: Record<string, number>;
  ears?: Record<string, number>; games?: Record<string, number>; rushBest?: Record<string, number>; missed?: Record<string, number>;
};
// one row per game: its name, its nest ids, and where its eggs are kept
export const GAME_ROWS: { name: string; ids: string[]; from: 'games' | 'ears' }[] = [
  { name: '🥚 Egg Rush', ids: RUSH_STAGES.map((s) => s.id), from: 'games' },
  { name: '📜 Fresh Tunes', ids: FRESH_STAGES.map((s) => s.id), from: 'games' },
  { name: '👂 Find it', ids: EAR_STAGES.map((s) => s.id), from: 'ears' },
  { name: '🎁 Mystery Melodies', ids: MYSTERY_STAGES.map((s) => s.id), from: 'games' },
  { name: '😊 Happy or Sad', ids: MOOD_STAGES.map((s) => s.id), from: 'games' },
  { name: '👏 Echo Game', ids: CLUCK_STAGES.map((s) => s.id), from: 'games' },
  { name: '⭐ Twinkle Twist', ids: TWINKLE_STAGES.map((s) => s.id), from: 'games' },
];

export function summarize(p: Saved, levels: Level[], songs: Song[], recordings: number, now = new Date()) {
  const lessons = p.lessons || {}, best = p.songs || {}, days = p.days || {};
  const allLessons = levels.flatMap((lv) => lv.lessons);
  const levelsDone = levels.filter((lv) => lv.lessons.every((l) => lessons[l.id])).length;
  const atLevel = (levels.find((lv) => !lv.lessons.every((l) => lessons[l.id])) || levels[levels.length - 1]).n;
  let practiced = 0;
  for (let i = 0; i < 28; i++) { const d = new Date(now); d.setDate(d.getDate() - i); if (days[dayKey(d)]) practiced++; }
  const games = GAME_ROWS.map((g) => {
    const saved = (g.from === 'ears' ? p.ears : p.games) || {};
    const got = g.ids.reduce((a, id) => a + (saved[id] || 0), 0);
    return { name: g.name, eggs: got, max: g.ids.length * 3, nests: g.ids.filter((id) => saved[id]).length, of: g.ids.length };
  });
  const rushTimes = Object.values(p.rushBest || {});
  const missed = Object.entries(p.missed || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return {
    streak: streak(days, now), practiced, today: days[dayKey(now)] || 0,
    lessons: allLessons.filter((l) => lessons[l.id]).length, lessonsOf: allLessons.length, levelsDone, atLevel,
    songs: songs.filter((s) => best[s.id]).length, songsOf: songs.length, perfect: songs.filter((s) => best[s.id] === 3).length,
    games, fastestRush: rushTimes.length ? Math.min(...rushTimes) : null, recordings, missed,
  };
}

export interface ParentApp {
  show: (screen: string) => void;
  players: () => Player[];
  progressOf: (id: string) => Saved;
  recordingsOf: (id: string) => number;
  avatar: (p: Player) => string;
  levels: Level[];
  songs: Song[];
  store: Store;
  maxPlayers: number;
  limits: { recordings: number; mysongs: number; uploads: number };
  // a backup was loaded: re-read players, progress, songs
  reload: () => void;
  // the family's private song source (main.ts, src/privatesongs.ts)
  privateSongs: {
    source: () => PrivateSource | null;
    result: () => { added: number; skipped: { id: string; why: string }[] };
    connect: (repo: string, token: string) => Promise<string>; // '' when it worked, else the problem
    forget: () => void;
  };
  // songs uploaded as score files (main.ts, src/uploads.ts, src/scoreimport.ts)
  uploads: {
    list: () => Upload[];
    skipped: () => { id: string; why: string }[];
    max: number;
    read: (name: string, bytes: Uint8Array) => Draft; // throws an Error to show
    add: (song: SongData) => boolean; // false: no room
    remove: (id: string) => void;
    preview: (song: SongData) => boolean; // true: playing, false: stopped
  };
}

// "today", "3 days ago"
export function ago(at: number, now = Date.now()) {
  const d = Math.floor((now - at) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector<T>(s)!;
const bar = (n: number, of: number) => `<span class="pbar"><i style="width:${of ? Math.round((n / of) * 100) : 0}%"></i></span>`;

export function setupParent(app: ParentApp) {
  // hold 📊 in the coop
  const b = $('#btnParent');
  let t: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => { clearTimeout(t!); b.classList.remove('holding'); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.classList.add('holding');
    t = setTimeout(() => { b.classList.remove('holding'); app.show('parent'); }, 1500);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, cancel));

  /* ---------- backup card: save everything to a file, load one back (merging, never replacing) ---------- */
  const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || !!(navigator as any).standalone; } catch (e) { return false; } };
  let note = '';
  function backupCard() {
    const at = Number(readRaw(app.store, KEYS.backupAt)) || 0;
    const kb = Math.ceil(keysOf(app.store).reduce((a, k) => a + k.length + (readRaw(app.store, k) || '').length, 0) * 2 / 1024);
    const full = lastFailedSave();
    return `<div class="pcard" id="backupCard">
      <div class="phead">💾 <b>Backup</b></div>
      <div class="prow"><span>Last backup</span><b>${at ? ago(at) : 'never'}</b></div>
      <div class="prow"><span>Saved on this ${standalone() ? 'home-screen app' : 'browser tab'}</span><b>${kb} KB</b></div>
      ${full ? '<div class="pwarn">⚠️ This device ran out of room, so the oldest recordings were removed to keep progress safe.</div>' : ''}
      <div class="pbtns"><button class="btn" id="btnBackup">💾 Save backup file</button><button class="btn blue" id="btnRestore">📂 Load backup</button></div>
      ${note ? `<div class="pnote">${escHtml(note)}</div>` : ''}
      <p class="ptip">Safari can erase saved progress if the app isn't opened for a while, and on an iPad the Safari tab and the home-screen app each keep their own progress. Save a backup to Files now and then. Loading a backup adds its eggs, lessons, songs and recordings to what's here; nothing is lost.</p>
    </div>`;
  }
  function saveBackup() {
    const b = makeBackup(app.store);
    const file = new File([JSON.stringify(b)], backupName(b.at), { type: 'application/json' });
    const done = () => { writeJSON(app.store, KEYS.backupAt, b.at); note = '✅ Backup saved.'; render(); };
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Chicken Piano backup' }).then(done).catch((e) => { if (e.name !== 'AbortError') { download(file); done(); } });
    } else { download(file); done(); }
  }
  function download(file: File) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.json,application/json';
  picker.style.display = 'none';
  document.body.appendChild(picker);
  picker.addEventListener('change', () => {
    const f = picker.files && picker.files[0];
    picker.value = '';
    if (f) f.text().then(loadBackup, () => { note = '❌ Couldn\'t read that file.'; render(); });
  });
  // exposed for tests: load a backup's text
  function loadBackup(text: string) {
    const b = parseBackup(text);
    if (!b) { note = '❌ That isn\'t a Chicken Piano backup (or it\'s from a newer version).'; render(); return null; }
    const r = mergeBackup(app.store, b, app.maxPlayers, app.limits);
    app.reload();
    const names = (l: string[]) => l.join(', ');
    note = `✅ Loaded the backup from ${new Date(b.at).toLocaleDateString()}.`
      + (r.merged.length ? ` Added to: ${names(r.merged)}.` : '') + (r.added.length ? ` New: ${names(r.added)}.` : '')
      + (r.skipped.length ? ` No room for: ${names(r.skipped)} (${app.maxPlayers} players max).` : '');
    render();
    return r;
  }
  document.addEventListener('click', (e) => {
    const t = (e.target as Element).closest('#btnBackup, #btnRestore');
    if (!t) return;
    if (t.id === 'btnBackup') saveBackup(); else picker.click();
  });

  /* ---------- private songs card: songs from the family's own private GitHub repo ---------- */
  let privNote = '', privBusy = false;
  const esc = (t: string) => t.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' } as Record<string, string>)[c]);
  function privateCard() {
    const src = app.privateSongs.source(), r = app.privateSongs.result();
    return `<div class="pcard" id="privCard">
      <div class="phead">🔐 <b>Private songs</b></div>
      ${src ? `<div class="prow"><span>From</span><b>${esc(src.repo)}</b></div>
      <div class="prow"><span>Songs added</span><b>${r.added}</b></div>
      <div class="prow sub"><span>Last downloaded</span><b>${src.at ? ago(src.at) : 'never'}</b></div>
      ${src.error ? `<div class="pwarn">⚠️ ${esc(src.error)}${src.at ? ' Using the copy from last time.' : ''}</div>` : ''}
      ${r.skipped.length ? `<div class="pwarn">Skipped ${r.skipped.length}: ${r.skipped.slice(0, 8).map((x) => `<b>${esc(x.id)}</b> (${esc(x.why)})`).join(', ')}</div>` : ''}` : ''}
      <label class="pfield"><span>GitHub repo</span><input id="privRepo" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="chrisstrahl/chicken-piano-songs" value="${src ? esc(src.repo) : ''}"></label>
      <label class="pfield"><span>Token${src?.token ? ' (saved; leave empty to keep)' : ''}</span><input id="privToken" type="password" autocomplete="off" placeholder="github_pat_…"></label>
      <div class="pbtns"><button class="btn" id="btnPrivLoad"${privBusy ? ' disabled' : ''}>${privBusy ? '⏳ Loading…' : src ? '🔄 Load songs again' : '⬇️ Load songs'}</button>${src ? '<button class="btn blue" id="btnPrivForget">🗑 Remove</button>' : ''}</div>
      ${privNote ? `<div class="pnote">${privNote}</div>` : ''}
      <p class="ptip">Songs that can't go in the public app (like your own versions of today's hits) can live in a private GitHub repo as songs.json. They show up at the end of their level, open for everyone, on this device only. The token needs only read access to that one repo's Contents; it stays on this device and isn't put in backup files. The app checks for new songs each time it opens.</p>
    </div>`;
  }
  async function privLoad() {
    const repo = ($('#privRepo') as HTMLInputElement).value, token = ($('#privToken') as HTMLInputElement).value;
    privBusy = true; privNote = ''; render();
    const err = await app.privateSongs.connect(repo, token);
    privBusy = false;
    const r = app.privateSongs.result();
    privNote = err ? `❌ ${esc(err)}` : `✅ ${r.added} song${r.added === 1 ? '' : 's'} ready.`;
    render();
  }
  document.addEventListener('click', (e) => {
    const t = (e.target as Element).closest('#btnPrivLoad, #btnPrivForget');
    if (!t) return;
    if (t.id === 'btnPrivLoad') { if (!privBusy) privLoad(); } else { app.privateSongs.forget(); privNote = 'Private songs removed from this device.'; render(); }
  });


  /* ---------- add a song: a score file (MusicXML or MIDI) becomes a song every kid can play ---------- */
  let draft: Draft | null = null, upNote = '', playing = false;
  const LEVEL_WORDS = ['', 'C D E', 'C to G', 'rests', 'up high', 'down low', '3/4 time', 'eighth notes', 'sharps and flats', 'bass clef', 'everything'];
  // 'F#m' -> 'F sharp minor' (words, not symbols: the iPad's fonts can lack music signs)
  const keyWords = (k: string) => k[0] + (k[1] === '#' ? ' sharp' : k[1] === 'b' ? ' flat' : '') + (k.endsWith('m') ? ' minor' : ' major');
  const levelName = (n: number) => `Level ${n}${LEVEL_WORDS[n] ? ` (${LEVEL_WORDS[n]})` : ''}`;
  function uploadCard() {
    const list = app.uploads.list(), skipped = app.uploads.skipped();
    let body = '';
    if (draft) {
      const s = draft.song, long = draft.notes > 300;
      body = `<div class="pdraft">
        <label class="pfield"><span>Song name</span><input id="upTitle" maxlength="60" value="${esc(s.title)}"></label>
        <label class="pfield"><span>Put it in</span><select id="upLevel">${Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `<option value="${n}"${n === s.level ? ' selected' : ''}>${levelName(n)}${n === s.level ? ' (our guess)' : ''}</option>`).join('')}</select></label>
        <div class="prow"><span>Notes in the tune</span><b>${draft.notes}</b></div>
        <div class="prow"><span>Key, time, speed</span><b>${esc(keyWords(s.key))} · ${s.time} · ${s.tempo} a minute</b></div>
        <div class="prow"><span>Left hand</span><b>${draft.hasLh ? 'from the file' : 'the app makes one'}</b></div>
        ${draft.warnings.map((w) => `<div class="pwarn">${esc(w)}</div>`).join('')}
        ${long ? '<div class="pwarn">This is a long piece. Kids usually do best with songs under 100 notes; an easy arrangement of just the tune works best.</div>' : ''}
        <div class="pbtns"><button class="btn" id="btnUpHear">${playing ? '⏹ Stop' : '▶️ Hear the start'}</button><button class="btn green" id="btnUpAdd">➕ Add song</button><button class="btn blue" id="btnUpCancel">✖ Cancel</button></div>
      </div>`;
    } else body = `<div class="pbtns"><button class="btn" id="btnUpPick">📂 Choose a score file</button></div>`;
    return `<div class="pcard" id="uploadCard">
      <div class="phead">🎼 <b>Add a song</b></div>
      ${body}
      ${upNote ? `<div class="pnote">${upNote}</div>` : ''}
      ${list.length ? `<div class="psec">Added songs <small>(${list.length} of ${app.uploads.max})</small></div>
      <div class="pups">${list.map((u) => `<div class="prow"><span>🎼 ${esc(u.title)} <small>${levelName(u.level)}</small></span><button class="btn small blue" data-unsong="${esc(u.id)}" aria-label="Remove ${esc(u.title)}">🗑</button></div>`).join('')}</div>` : ''}
      ${skipped.length ? `<div class="pwarn">Couldn't load ${skipped.length}: ${skipped.slice(0, 5).map((x) => `<b>${esc(x.id)}</b> (${esc(x.why)})`).join(', ')}</div>` : ''}
      <p class="ptip">Pick a score file: MusicXML (.musicxml, .mxl) or MIDI (.mid). MuseScore and most notation apps can export these, and many free scores online come as MusicXML or MIDI. No audio track is needed: the chicken plays the notes on its own piano and listens for them like any other song. Easy one-hand arrangements work best. The song shows up at the end of its level, open for every kid on this device, and goes along in backup files.</p>
    </div>`;
  }
  const picker2 = document.createElement('input');
  picker2.type = 'file'; // no accept list: iPad greys out .mid/.mxl files it doesn't recognise, so the app checks the file itself
  picker2.style.display = 'none';
  document.body.appendChild(picker2);
  picker2.addEventListener('change', async () => {
    const f = picker2.files && picker2.files[0];
    picker2.value = '';
    if (!f) return;
    upNote = ''; draft = null;
    try {
      if (f.size > 8 * 1024 * 1024) throw new Error('That file is too big to be a score (over 8 MB).');
      draft = app.uploads.read(f.name, new Uint8Array(await f.arrayBuffer()));
    } catch (e) { upNote = `❌ ${esc((e as Error).message || String(e))}`; }
    render();
  });
  function stopHearing() { if (playing && draft) app.uploads.preview(draft.song); playing = false; }
  function readDraftFields() {
    if (!draft) return;
    const t = ($('#upTitle') as HTMLInputElement).value.replace(/[<>&"]/g, '').trim();
    if (t) draft.song.title = t.slice(0, 60);
    draft.song.level = +($('#upLevel') as HTMLSelectElement).value || draft.song.level;
  }
  document.addEventListener('click', (e) => {
    const t = (e.target as Element).closest('#btnUpPick, #btnUpHear, #btnUpAdd, #btnUpCancel, [data-unsong]') as HTMLElement | null;
    if (!t) return;
    if (t.id === 'btnUpPick') { picker2.click(); return; }
    if (t.dataset.unsong) {
      const u = app.uploads.list().find((x) => x.id === t.dataset.unsong);
      app.uploads.remove(t.dataset.unsong);
      upNote = u ? `Removed ${esc(u.title)}.` : '';
    } else if (t.id === 'btnUpHear' && draft) { readDraftFields(); playing = app.uploads.preview(draft.song); }
    else if (t.id === 'btnUpCancel') { stopHearing(); draft = null; upNote = ''; }
    else if (t.id === 'btnUpAdd' && draft) {
      readDraftFields(); stopHearing();
      if (app.uploads.add(draft.song)) { upNote = `✅ Added ${esc(draft.song.title)} to ${levelName(draft.song.level)}.`; draft = null; }
      else upNote = `❌ Couldn't save it: this device is full, or there are already ${app.uploads.max} added songs.`;
    }
    render();
  });
  /* ---------- what's new card: the newest days of CHANGELOG.md, built in by build.mjs ---------- */
  function newsCard() {
    if (!WHATSNEW.length) return '';
    return `<div class="pcard" id="newsCard">
      <div class="phead">🆕 <b>What's new</b></div>
      ${WHATSNEW.map((d) => `<div class="psec">${d.date}</div><ul class="pnews">${d.items.map((i) => `<li>${i}</li>`).join('')}</ul>`).join('')}
    </div>`;
  }

  function render() {
    $('#parentCards').innerHTML = app.players().map((pl) => {
      const s = summarize(app.progressOf(pl.id), app.levels, app.songs, app.recordingsOf(pl.id));
      return `<div class="pcard">
        <div class="phead">${app.avatar(pl)}<b>${esc(pl.name)}</b></div>
        <div class="prow"><span>🔥 Streak</span><b>${s.streak} day${s.streak === 1 ? '' : 's'}</b></div>
        <div class="prow"><span>📅 Practiced</span><b>${s.practiced} of the last 28 days</b></div>
        <div class="prow"><span>🎓 Lessons</span><b>${s.lessons} / ${s.lessonsOf}</b>${bar(s.lessons, s.lessonsOf)}</div>
        <div class="prow sub"><span>Working on level ${s.atLevel}</span><b>${s.levelsDone} level${s.levelsDone === 1 ? '' : 's'} finished</b></div>
        <div class="prow"><span>🎵 Songs played</span><b>${s.songs} / ${s.songsOf}</b>${bar(s.songs, s.songsOf)}</div>
        <div class="prow sub"><span>Perfect (3 eggs)</span><b>${s.perfect}</b></div>
        <div class="psec">Games (eggs won)</div>
        ${s.games.map((g) => `<div class="prow"><span>${g.name}</span><b>${g.eggs} / ${g.max}</b>${bar(g.eggs, g.max)}</div>`).join('')}
        ${s.fastestRush ? `<div class="prow sub"><span>Fastest Egg Rush</span><b>${(s.fastestRush / 1000).toFixed(1)} s</b></div>` : ''}
        <div class="prow"><span>🎙️ Recordings</span><b>${s.recordings}</b></div>
        <div class="psec">Notes missed most <small>(songs and Fresh Tunes)</small></div>
        <div class="pmiss">${s.missed.length ? s.missed.map(([n, c]) => `<span><b>${esc(n)}</b> ${Number(c) || 0}×</span>`).join('') : '<i>Nothing yet</i>'}</div>
      </div>`;
    }).join('') + uploadCard() + backupCard() + privateCard() + newsCard();
  }
  return { screens: { parent: () => { note = ''; privNote = ''; upNote = ''; render(); } }, loadBackup, privLoad };
}
