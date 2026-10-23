// Arranging a song for two hands: key signatures, chord symbols, a left-hand part and finger numbers.
// Songs only store the melody (songs.js). Everything here is worked out from it, unless a song gives its own
// `chords` ('C:w F:h G:h') or `lh` (note tokens) in songs.js, which then win.
import { BEATS } from './music.js';

const L7 = 'CDEFGAB';
const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC = { '#': 1, b: -1, '': 0 };
const SHARPS = 'FCGDAEB';
const FLATS = 'BEADGCF';
// how many sharps (+) or flats (-) each key has
const KEYS = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5,
  Am: 0, Em: 1, Bm: 2, 'F#m': 3, 'C#m': 4, Dm: -1, Gm: -2, Cm: -3, Fm: -4,
};

// { F: '#', C: '#' } for D major
export function keySig(key = 'C') {
  const n = KEYS[key] ?? 0;
  const sig = {};
  for (let i = 0; i < Math.abs(n); i++) sig[n > 0 ? SHARPS[i] : FLATS[i]] = n > 0 ? '#' : 'b';
  return sig;
}
const isMinor = (key) => /m$/.test(key);

// Seven scale notes spelled for the key: [{ letter, acc, pc }]
function scale(key) {
  const sig = keySig(key);
  const tonic = key.replace('m', '');
  const t = L7.indexOf(tonic[0]);
  return [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const letter = L7[(t + i) % 7];
    const acc = sig[letter] || '';
    return { letter, acc, pc: (BASE[letter] + ACC[acc] + 12) % 12 };
  });
}
const label = (n) => n.letter + (n.acc === '#' ? '♯' : n.acc === 'b' ? '♭' : '');

// The chords a beginner song uses: I IV V vi (major) or i iv V III (minor), as spelled triads.
function chordSet(key) {
  const sc = scale(key);
  const triad = (d, raise3 = false) => {
    const notes = [sc[d % 7], sc[(d + 2) % 7], { ...sc[(d + 4) % 7] }];
    if (raise3) { // harmonic minor: the V chord's third goes up (E major in A minor)
      const third = { ...notes[1] };
      third.acc = third.acc === 'b' ? '' : '#';
      third.pc = (third.pc + 1) % 12;
      notes[1] = third;
    }
    const minor = (notes[1].pc - notes[0].pc + 12) % 12 === 3;
    return { notes, sym: label(notes[0]) + (minor ? 'm' : ''), pcs: notes.map((n) => n.pc) };
  };
  return isMinor(key)
    ? [{ ...triad(0), bonus: 0.3 }, { ...triad(4, true), bonus: 0.2 }, { ...triad(3), bonus: 0.1 }, { ...triad(2), bonus: 0 }]
    : [{ ...triad(0), bonus: 0.3 }, { ...triad(4), bonus: 0.2 }, { ...triad(3), bonus: 0.1 }, { ...triad(5), bonus: 0 }];
}

// Bars of the melody: [{ start, len, notes: [{ beat, len, pc }] }]. A pickup is its own short bar.
function bars(song) {
  const per = perBar(song.time);
  const total = song.notes.reduce((s, n) => s + BEATS[n.d], 0);
  const out = [];
  let start = 0;
  if (song.pickup) { out.push({ start: 0, len: song.pickup, pickup: true, notes: [] }); start = song.pickup; }
  while (start < total - 1e-6) { out.push({ start, len: Math.min(per, total - start), notes: [] }); start += per; }
  let beat = 0;
  for (const n of song.notes) {
    const b = out.find((x) => beat >= x.start - 1e-6 && beat < x.start + x.len - 1e-6);
    if (b && !n.r) b.notes.push({ beat: beat - b.start, len: BEATS[n.d], pcs: n.keys.map((k) => ((k.m % 12) + 12) % 12) });
    beat += BEATS[n.d];
  }
  return out;
}
export const perBar = (time = '4/4') => (+time.split('/')[0] * 4) / +time.split('/')[1];

function score(chord, notes) {
  let s = chord.bonus;
  for (const n of notes) {
    const w = n.len + (n.beat === 0 ? 1 : n.beat % 2 === 0 ? 0.4 : 0);
    s += n.pcs.some((p) => chord.pcs.includes(p)) ? w : -0.6 * w;
  }
  return s;
}
const best = (set, notes) => set.reduce((a, c) => (score(c, notes) > score(a, notes) ? c : a));

// Chord symbols: one per bar, or two in a 4-beat bar whose halves clearly want different chords.
// [{ beat, len, chord }]
export function harmonize(song) {
  const set = chordSet(song.key || 'C');
  const out = [];
  const bs = bars(song).filter((b) => !b.pickup);
  bs.forEach((b, i) => {
    const last = i === bs.length - 1;
    let c = best(set, b.notes);
    // start and end at home, if the tune allows it
    if (i === 0 ? score(set[0], b.notes) > 0 : last && score(set[0], b.notes) >= score(c, b.notes) - 1) c = set[0];
    if (b.len === 4 && !last) {
      const h1 = b.notes.filter((n) => n.beat < 2), h2 = b.notes.filter((n) => n.beat >= 2);
      const c1 = best(set, h1), c2 = best(set, h2);
      if (c1 !== c2 && h1.length && h2.length && score(c1, h1) + score(c2, h2) > score(c, b.notes) + 1.5) {
        out.push({ beat: b.start, len: 2, chord: c1 }, { beat: b.start + 2, len: 2, chord: c2 });
        return;
      }
    }
    out.push({ beat: b.start, len: b.len, chord: c });
  });
  return out;
}

// Given chords as 'C:w F:h G7:h' from songs.js
function chordsFromData(song, str) {
  const set = chordSet(song.key || 'C');
  let beat = song.pickup || 0;
  return str.trim().split(/\s+/).map((tok) => {
    const [sym, d = 'w'] = tok.split(':');
    const name = sym.replace('#', '♯').replace(/^([A-G])b/, '$1♭');
    const chord = set.find((c) => c.sym === name) || { sym: name, pcs: [], notes: [] };
    const seg = { beat, len: BEATS[d], chord };
    beat += BEATS[d];
    return seg;
  });
}

// Note values that add up to `beats`, longest first
const DUR = [['w', 4], ['hd', 3], ['h', 2], ['qd', 1.5], ['q', 1], ['8', 0.5]];
function split(beats) {
  const out = [];
  let left = beats;
  for (const [d, b] of DUR) while (left >= b - 1e-6) { out.push(d); left -= b; }
  return out;
}
// A spelled note placed in the left hand's home range (roots from G2 up to F#3)
function low(n) {
  let oct = 3;
  let m = 12 * (oct + 1) + BASE[n.letter] + ACC[n.acc];
  if (m > 54) { oct--; m -= 12; }
  return { tok: `${n.letter}${n.acc}${oct}`, m, oct };
}
// The same letter at or just above `m`
function above(n, m) {
  let oct = 1;
  let x = 12 * (oct + 1) + BASE[n.letter] + ACC[n.acc];
  while (x <= m) { oct++; x += 12; }
  return `${n.letter}${n.acc}${oct}`;
}

// Left hand, simple at first and fuller later:
//   levels 1-3: the chord's root, held   4-6: root then fifth   7-8: broken chord   10: block chords
export function leftHand(song, chords) {
  const toks = [];
  if (song.pickup) split(song.pickup).forEach((d) => toks.push(`R:${d}`));
  for (const { len, chord } of chords) {
    if (!chord.notes.length) { split(len).forEach((d) => toks.push(`R:${d}`)); continue; }
    const r = low(chord.notes[0]);
    const third = above(chord.notes[1], r.m);
    const fifth = above(chord.notes[2], r.m);
    const whole = Number.isInteger(len);
    const lv = song.level;
    if (lv <= 3 || !whole || len < 2) split(len).forEach((d) => toks.push(`${r.tok}:${d}`));
    else if (lv <= 6) {
      toks.push(`${r.tok}:h`);
      split(len - 2).forEach((d) => toks.push(`${fifth}:${d}`));
    } else if (lv <= 8) {
      const cycle = [r.tok, third, fifth, third];
      for (let b = 0; b < len; b++) toks.push(`${cycle[b % 4]}:q`);
    } else {
      const block = `${r.tok}+${third}+${fifth}`;
      if (len === 3) toks.push(`${r.tok}:q`, `${third}+${fifth}:q`, `${third}+${fifth}:q`);
      else split(len).forEach((d) => toks.push(`${block}:${d}`));
    }
  }
  return toks.join(' ');
}

// Finger numbers. Fingers cover five white keys in a row; when a note falls outside, the hand moves so the
// thumb (right hand) or pinky (left hand) sits on the lowest note of the next stretch that fits.
const pos = (k) => (k.oct + 1) * 7 + L7.indexOf(k.letter);
export function fingering(notes, hand = 'rh') {
  const out = [];
  let b = null;
  notes.forEach((n, i) => {
    if (n.r || (i > 0 && notes[i - 1].tie)) { out.push(null); return; }
    const p = pos(n.keys[0]);
    if (b === null || p < b || p > b + 4) {
      let lo = p, hi = p;
      for (let j = i + 1; j < notes.length; j++) {
        if (notes[j].r) continue;
        const q = pos(notes[j].keys[0]);
        if (Math.max(hi, q) - Math.min(lo, q) > 4) break;
        lo = Math.min(lo, q); hi = Math.max(hi, q);
      }
      b = lo;
    }
    out.push(hand === 'rh' ? p - b + 1 : 5 - (p - b));
  });
  return out;
}

// Given fingers as '1 2 3 _ 5 1+3+5' from songs.js: one token per sounding note (rests and the second half
// of a tie are skipped), '_' for no number, 'a+b+c' for a chord (lowest key first).
export function fingersFromData(str, notes) {
  const toks = str.trim().split(/\s+/);
  let j = 0;
  return notes.map((n, i) => {
    if (n.r || (i > 0 && notes[i - 1].tie)) return null;
    const t = toks[j++];
    return !t || t === '_' ? null : t.includes('+') ? t.split('+').map(Number) : +t;
  });
}

// Everything a song needs for two hands. Bass-clef songs are already left-hand songs: no extra part.
export function arrange(song, parse) {
  song.keySig = keySig(song.key);
  song.fingers = song.fingersData ? fingersFromData(song.fingersData, song.notes) : fingering(song.notes, song.clef === 'bass' ? 'lh' : 'rh');
  if (song.clef === 'bass') { song.chords = []; song.lh = null; return song; }
  song.chords = song.chordsData ? chordsFromData(song, song.chordsData) : harmonize(song);
  song.lh = parse(song.lhData || leftHand(song, song.chords));
  song.lhFingers = song.lhFingersData ? fingersFromData(song.lhFingersData, song.lh) : fingering(song.lh, 'lh');
  return song;
}
