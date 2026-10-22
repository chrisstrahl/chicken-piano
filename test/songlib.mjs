// Checks every song in src/songs.js: tokens parse, bars add up, lyrics line up with notes,
// and each song only uses what its level has taught. Also builds every note in VexFlow.
// Run: node test/songlib.mjs
import { SONG_DATA } from '../src/songs.js';

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const BEATS = { 8: 0.5, q: 1, qd: 1.5, h: 2, hd: 3, w: 4 };
const BAR = { '4/4': 4, '3/4': 3 };
const TOKEN = /^(R|[A-G][#b]?\d?(?:\+[A-G][#b]?\d?)*)(?::(8|qd|q|hd|h|w))?(~)?$/;
const PITCH = /^([A-G])([#b]?)(\d?)$/;
const midi = (p) => {
  const [, l, acc, oct] = p.match(PITCH);
  return 12 * (+(oct || 4) + 1) + STEP[l] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
};
const NAME = (m) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m % 12] + (Math.floor(m / 12) - 1);

// What each level may use. Features carry forward to later levels.
const RULES = {
  1: { lo: 'C4', hi: 'E4', durs: ['q'] },
  2: { lo: 'C4', hi: 'G4', durs: ['q'] },
  3: { lo: 'C4', hi: 'G4', durs: ['q', 'h', 'w'], rests: true },
  4: { lo: 'C4', hi: 'F5', durs: ['q', 'h', 'w'], rests: true },
  5: { lo: 'G3', hi: 'F5', durs: ['q', 'h', 'w'], rests: true },
  6: { lo: 'G3', hi: 'F5', durs: ['q', 'h', 'w', 'hd'], rests: true, waltz: true },
  7: { lo: 'G3', hi: 'F5', durs: ['8', 'q', 'qd', 'h', 'hd', 'w'], rests: true, waltz: true, ties: true },
  8: { lo: 'G3', hi: 'A5', durs: ['8', 'q', 'qd', 'h', 'hd', 'w'], rests: true, waltz: true, ties: true, accidentals: true },
  9: { lo: 'C3', hi: 'G3', durs: ['8', 'q', 'qd', 'h', 'hd', 'w'], rests: true, waltz: true, ties: true, accidentals: true, bass: true },
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
    if (!tie && pos > barStart + bar + 1e-9) err(`"${tok}" crosses a bar line at beat ${start + (s.pickup || 0)}`);
    tied = !!tie;
  }
  const leftover = ((pos % bar) + bar) % bar;
  if (leftover > 1e-9 && Math.abs(leftover - (bar - (s.pickup || 0))) > 1e-9) err(`last bar is incomplete (${leftover} of ${bar} beats)`);
  const words = s.lyrics.trim().split(/\s+/);
  if (words.length !== sounding) err(`${words.length} lyric words for ${sounding} notes`);
}

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
