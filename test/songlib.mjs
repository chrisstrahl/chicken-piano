// Checks every song in src/songs.js: tokens parse, bars add up, lyrics line up with notes,
// and each song only uses what its level has taught. Also builds every note in VexFlow.
// Run: node test/songlib.mjs
import { SONG_DATA } from '../src/songs.js';
import { difficulty } from '../tools/difficulty.mjs';

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const BEATS = { 8: 0.5, q: 1, qd: 1.5, h: 2, hd: 3, w: 4 };
const BAR = { '4/4': 4, '3/4': 3, '6/8': 3 };
const TOKEN = /^(R|[A-G][#b]?\d?(?:\+[A-G][#b]?\d?)*)(?::(8|qd|q|hd|h|w))?(~)?$/;
const PITCH = /^([A-G])([#b]?)(\d?)$/;
const midi = (p) => {
  const [, l, acc, oct] = p.match(PITCH);
  return 12 * (+(oct || 4) + 1) + STEP[l] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
};
const NAME = (m) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m % 12] + (Math.floor(m / 12) - 1);

// What each level may use. Features carry forward to later levels.
const RULES = {
  1: { lo: 'C4', hi: 'E4', durs: ['q', 'h', 'w'] },
  2: { lo: 'C4', hi: 'A4', durs: ['q', 'h', 'w'] },
  3: { lo: 'C4', hi: 'A4', durs: ['q', 'h', 'w'], rests: true },
  4: { lo: 'C4', hi: 'F5', durs: ['q', 'h', 'w'], rests: true },
  5: { lo: 'G3', hi: 'F5', durs: ['q', 'h', 'w'], rests: true },
  6: { lo: 'G3', hi: 'F5', durs: ['8', 'q', 'h', 'hd', 'w'], rests: true, waltz: true },
  7: { lo: 'G3', hi: 'F5', durs: ['8', 'q', 'qd', 'h', 'hd', 'w'], rests: true, waltz: true, ties: true },
  8: { lo: 'G3', hi: 'A5', durs: ['8', 'q', 'qd', 'h', 'hd', 'w'], rests: true, waltz: true, ties: true, accidentals: true },
  9: { lo: 'C3', hi: 'C4', durs: ['8', 'q', 'qd', 'h', 'hd', 'w'], rests: true, waltz: true, ties: true, accidentals: true, bass: true },
  10: { lo: 'G3', hi: 'A5', durs: ['8', 'q', 'qd', 'h', 'hd', 'w'], rests: true, waltz: true, ties: true, accidentals: true, chords: true },
};
const SHARP_KEYS = ['G', 'D', 'A', 'E', 'Em', 'Bm'];
const FLAT_KEYS = ['F', 'Bb', 'Eb', 'Dm', 'Gm', 'Cm'];

const errors = [];
const ids = new Set();
const perLevel = {};
for (const s of SONG_DATA) {
  const err = (msg) => errors.push(`${s.id} (L${s.level}): ${msg}`);
  for (const f of ['id', 'level', 'emoji', 'title', 'sub', 'key', 'time', 'tempo', 'notes', 'lyrics']) if (s[f] === undefined) err(`missing ${f}`);
  if (ids.has(s.id)) err('duplicate id');
  ids.add(s.id);
  const R = RULES[s.level];
  if (!R) { err('bad level'); continue; }
  perLevel[s.level] = (perLevel[s.level] || 0) + 1;
  const bar = BAR[s.time];
  if (!bar) err(`unsupported time ${s.time}`);
  if (s.time !== '4/4' && !R.waltz) err(`${s.time} before level 6`);
  if (s.pickup && !R.waltz) err('pickup before level 6');
  if (R.bass ? s.clef !== 'bass' : s.clef === 'bass') err('clef does not match level');

  let pos = -(s.pickup || 0); // beats from the first full bar line
  let sounding = 0;
  let tied = false;
  for (const tok of s.notes.trim().split(/\s+/)) {
    const t = tok.match(TOKEN);
    if (!t) { err(`bad token "${tok}"`); continue; }
    const [, body, dur = 'q', tie] = t;
    const beats = BEATS[dur];
    if (!R.durs.includes(dur)) err(`duration ${dur} not taught yet ("${tok}")`);
    if (tie && !R.ties) err(`tie before level 7 ("${tok}")`);
    if (body === 'R') {
      if (!R.rests) err('rest before level 3');
    } else {
      const ps = body.split('+');
      if (ps.length > 1 && !R.chords) err(`chord before level 10 ("${tok}")`);
      for (const p of ps) {
        const m = midi(p);
        if (m < midi(R.lo) || m > midi(R.hi)) err(`${p} outside ${R.lo}-${R.hi}`);
        if (/[#b]/.test(p)) {
          if (!R.accidentals) err(`accidental ${p} before level 8`);
          if (p.includes('#') && FLAT_KEYS.includes(s.key)) err(`${p} spelled with a sharp in ${s.key}`);
          if (p.includes('b') && SHARP_KEYS.includes(s.key)) err(`${p} spelled with a flat in ${s.key}`);
        }
      }
      if (!tied) sounding++;
    }
    // a note may not cross a bar line unless it is tied
    const start = pos;
    pos += beats;
    const barStart = Math.floor(start / bar + 1e-9) * bar;
    if (s.bars !== false && !tie && pos > barStart + bar + 1e-9) err(`"${tok}" crosses a bar line at beat ${start + (s.pickup || 0)}`);
    tied = !!tie;
  }
  const leftover = ((pos % bar) + bar) % bar;
  if (s.bars !== false && leftover > 1e-9 && Math.abs(leftover - (bar - (s.pickup || 0))) > 1e-9) err(`last bar is incomplete (${leftover} of ${bar} beats)`);
  // optional two-hand data: lh, chords, fingers, lhFingers, diff
  const total = pos + (s.pickup || 0);
  const parts = (str) => str.trim().split(/\s+/).map((tok) => tok.match(TOKEN));
  const soundingOf = (str) => { let n = 0, tie = false; for (const t of parts(str)) { if (t && t[1] !== 'R' && !tie) n++; tie = !!(t && t[3]); } return n; };
  const chordSize = (str) => { const out = []; let tie = false; for (const t of parts(str)) { if (t && t[1] !== 'R' && !tie) out.push(t[1].split('+').length); tie = !!(t && t[3]); } return out; };
  if (s.lh !== undefined) {
    let b = 0;
    for (const tok of s.lh.trim().split(/\s+/)) {
      const t = tok.match(TOKEN);
      if (!t) { err(`bad lh token "${tok}"`); continue; }
      b += BEATS[t[2] || 'q'];
      if (t[1] !== 'R') for (const p of t[1].split('+')) if (midi(p) < midi('C2') || midi(p) > midi('C5')) err(`lh ${p} outside C2-C5`);
    }
    if (Math.abs(b - total) > 1e-9) err(`lh has ${b} beats, melody has ${total}`);
  }
  if (s.chords !== undefined) {
    let b = 0;
    for (const tok of s.chords.trim().split(/\s+/)) {
      const m = tok.match(/^([A-G][#b]?(?:m|7|m7|maj7|dim|sus4|sus2)?)(?::(8|qd|q|hd|h|w))?$/);
      if (!m) err(`bad chord "${tok}"`); else b += BEATS[m[2] || 'w'];
    }
    if (Math.abs(b - (total - (s.pickup || 0))) > 1e-9) err(`chords cover ${b} beats, song has ${total - (s.pickup || 0)} after the pickup`);
  }
  for (const [f, src] of [['fingers', s.notes], ['lhFingers', s.lh]]) {
    if (s[f] === undefined) continue;
    if (src === undefined) { err(`${f} without lh`); continue; }
    const toks = s[f].trim().split(/\s+/), sizes = chordSize(src);
    if (toks.length !== soundingOf(src)) err(`${f} has ${toks.length} numbers for ${soundingOf(src)} sounding notes`);
    toks.forEach((t, i) => {
      if (t === '_') return;
      const ns = t.split('+');
      if (!ns.every((n) => /^[1-5]$/.test(n))) err(`${f}: bad finger "${t}"`);
      else if (sizes[i] && ns.length !== sizes[i]) err(`${f}: "${t}" for a ${sizes[i]}-note chord`);
    });
  }
  if (s.diff !== undefined && !(Number.isInteger(s.diff) && s.diff >= 1 && s.diff <= 100)) err('diff must be a whole number 1-100');
  const words = s.lyrics.trim() ? s.lyrics.trim().split(/\s+/) : [];
  if (words.length && words.length !== sounding) err(`${words.length} lyric words for ${sounding} notes`);
}

// Left-hand grading (Chris, 2026-10-23): every treble song has lh and chords; bass-clef songs
// (level 9, already left hand) have none. Levels 1-2: one note a bar in C position; 3: single
// notes; 4: single notes, root and fifth; 5-8: two keys at once at most; 10: chords. No black
// keys before level 8, and no left-hand note crosses a bar line.
const LH_RULES = {
  1: { perBar: 1, lo: 'C3', hi: 'G3', max: 1 }, 2: { perBar: 1, lo: 'C3', hi: 'G3', max: 1 },
  3: { max: 1 }, 4: { max: 1 }, 5: { max: 2 }, 6: { max: 2 }, 7: { max: 2 }, 8: { max: 2, acc: true }, 10: { max: 4, acc: true },
};
for (const s of SONG_DATA) {
  const err = (msg) => errors.push(`${s.id} (L${s.level}) lh: ${msg}`);
  if (s.clef === 'bass') { if (s.lh) err('bass-clef songs are already left hand; no lh'); continue; }
  if (!s.lh || !s.chords) { err('missing lh or chords'); continue; }
  if (!s.fingers || !s.lhFingers) err('missing fingers or lhFingers');
  const R = LH_RULES[s.level];
  const bar = BAR[s.time];
  let pos = -(s.pickup || 0);
  const perBar = {};
  for (const tok of s.lh.trim().split(/\s+/)) {
    const t = tok.match(TOKEN);
    if (!t) continue;
    const [, body, dur = 'q', tie] = t;
    if (body !== 'R') {
      const ps = body.split('+');
      if (ps.length > R.max) err(`"${tok}" has ${ps.length} keys at once`);
      for (const p of ps) {
        if (/[#b]/.test(p) && !R.acc) err(`black key ${p} before level 8`);
        if (R.lo && (midi(p) < midi(R.lo) || midi(p) > midi(R.hi))) err(`${p} outside ${R.lo}-${R.hi}`);
      }
      if (pos >= 0) { const b = Math.floor(pos / bar + 1e-9); perBar[b] = (perBar[b] || 0) + 1; }
    }
    const start = pos;
    pos += BEATS[dur];
    const barStart = Math.floor(start / bar + 1e-9) * bar;
    if (s.bars !== false && !tie && pos > barStart + bar + 1e-9) err(`"${tok}" crosses a bar line`);
  }
  if (R.perBar && Object.values(perBar).some((n) => n > R.perBar)) err(`more than ${R.perBar} note a bar`);
}

// Difficulty: every song stores diff = tools/difficulty.mjs's score, and each level lists its
// songs easiest first (songs unlock in that order).
for (const s of SONG_DATA) if (s.diff !== difficulty(s)) errors.push(`${s.id}: diff is ${s.diff}, score says ${difficulty(s)} (node tools/difficulty.mjs)`);
for (let i = 1; i < SONG_DATA.length; i++) {
  const [a, b] = [SONG_DATA[i - 1], SONG_DATA[i]];
  if (b.level < a.level) errors.push(`${b.id}: level ${b.level} comes after level ${a.level}`);
  if (b.level === a.level && b.diff < a.diff) errors.push(`${b.id} (diff ${b.diff}) is listed after harder ${a.id} (diff ${a.diff})`);
}
for (const lv of Object.keys(RULES)) if ((perLevel[lv] || 0) < 10) errors.push(`level ${lv} has only ${perLevel[lv] || 0} songs (want 10+)`);

// No near-duplicates: two songs may not share a run of 12+ melody intervals (same tune in any key).
const intervals = (s) => {
  const ms = s.notes.trim().split(/\s+/).filter((t) => !t.startsWith('R')).map((t) => midi(t.split(':')[0].replace('~', '').split('+').pop()));
  return ms.slice(1).map((m, i) => m - ms[i]);
};
const longestShared = (a, b) => {
  let best = 0;
  const row = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const up = row[j];
      row[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
      if (row[j] > best) best = row[j];
      diag = up;
    }
  }
  return best;
};
const ivs = SONG_DATA.map((s) => [s, intervals(s)]);
for (let i = 0; i < ivs.length; i++) for (let j = i + 1; j < ivs.length; j++) {
  const n = longestShared(ivs[i][1], ivs[j][1]);
  if (n >= 12) errors.push(`${ivs[i][0].id} and ${ivs[j][0].id} share ${n + 1} notes of the same tune`);
}
const titles = new Map();
for (const s of SONG_DATA) { if (titles.has(s.title)) errors.push(`${s.id} and ${titles.get(s.title)} are both called "${s.title}"`); titles.set(s.title, s.id); }

// Every note must also build as a VexFlow note (what the staff draws).
const { StaveNote } = await import('vexflow/bravura').catch(() => import('vexflow'));
const VF_DUR = { 8: '8', q: 'q', qd: 'qd', h: 'h', hd: 'hd', w: 'w' };
for (const s of SONG_DATA) {
  for (const tok of s.notes.trim().split(/\s+/)) {
    const t = tok.match(TOKEN);
    if (!t) continue;
    const [, body, dur = 'q'] = t;
    const keys = body === 'R' ? ['b/4'] : body.split('+').map((p) => {
      const [, l, acc, oct] = p.match(PITCH);
      return l.toLowerCase() + acc + '/' + (oct || 4);
    });
    try {
      const n = new StaveNote({ keys, duration: VF_DUR[dur] + (body === 'R' ? 'r' : ''), clef: s.clef || 'treble' });
      if (!n.getTicks()) throw new Error('no ticks');
    } catch (e) { errors.push(`${s.id}: VexFlow rejects "${tok}": ${e.message}`); }
  }
}

console.log('songs per level:', Object.keys(perLevel).sort((a, b) => a - b).map((l) => `L${l}=${perLevel[l]}`).join(' '), 'total', SONG_DATA.length);
if (errors.length) {
  console.log(errors.join('\n'));
  console.log(`\n${errors.length} problem(s)`);
  process.exit(1);
}
console.log('all songs OK');
