// Grown-ups' page: how each kid is doing, side by side. Opened by holding 📊 in the coop for 1.5 s, so little
// fingers don't land here. More words than the rest of the app, since it's for the grown-ups.
// summarize() is plain data (Node tests use it); setupParent() draws it.
import { RUSH_STAGES, CLUCK_STAGES, TWINKLE_STAGES } from './barnyard.js';
import { EAR_STAGES } from './ear.js';
import { MYSTERY_STAGES, MOOD_STAGES } from './quiz.js';
import { FRESH_STAGES } from './sightread.js';
import { streak, dayKey } from './streaks.js';
import type { Level, Song, Player } from './types';

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

  function render() {
    $('#parentCards').innerHTML = app.players().map((pl) => {
      const s = summarize(app.progressOf(pl.id), app.levels, app.songs, app.recordingsOf(pl.id));
      return `<div class="pcard">
        <div class="phead">${app.avatar(pl)}<b>${pl.name}</b></div>
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
        <div class="pmiss">${s.missed.length ? s.missed.map(([n, c]) => `<span><b>${n}</b> ${c}×</span>`).join('') : '<i>Nothing yet</i>'}</div>
      </div>`;
    }).join('');
  }
  return { screens: { parent: render } };
}
