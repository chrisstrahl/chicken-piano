// Left-hand helper for songs.js. Two jobs:
//   node tools/lefthand.mjs suggest <id>   guess chord symbols for a song, one or two per bar
//   node tools/lefthand.mjs write [--save] redo lh, lhFingers and fingers from each song's chords
//                                          (lists the songs that would change; --save writes songs.js)
// The chords are the hand-checked part; the left hand is drawn from them with the pattern its
// level teaches, so a fix to a chord fixes its bass too. A song can keep a hand-written lh by
// setting lhStyle: 'own'; lhStyle: 'block' plays level 10 chords as blocks instead of Alberti.
//
// Graded left-hand styles (Chris, 2026-10-23):
//   L1-2  one whole note per bar, root, hand stays in C position (C3-G3)
//   L3    roots: one note per bar (or per chord)
//   L4    root and fifth, one after the other
//   L5    root and fifth together
//   L6    waltz: root, then the rest of the chord (oom-pah-pah) in 3/4; root-fifth in 4/4
//   L7    broken chords (root, fifth, third, fifth) in quarters
//   L8    broken chords, keys with sharps and flats
//   L10   Alberti bass in eighths, or block chords
// Level 9 songs are already played by the left hand in bass clef, so they get no lh.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const WHITE = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const LETTERS = 'CDEFGAB';
export const BEATS = { 8: 0.5, q: 1, qd: 1.5, h: 2, hd: 3, w: 4 };
const DUR_OF = Object.fromEntries(Object.entries(BEATS).map(([k, v]) => [v, k]));
const TOKEN = /^(R|[A-G][#b]?\d?(?:\+[A-G][#b]?\d?)*)(?::(8|qd|q|hd|h|w))?(~)?$/;
const PITCH = /^([A-G])([#b]?)(\d?)$/;
const BAR = { '4/4': 4, '3/4': 3, '6/8': 3 };

export const pitch = (p) => {
  const [, l, acc, oct] = p.match(PITCH);
  const o = +(oct || 4);
  return { l, acc, o, m: 12 * (o + 1) + STEP[l] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0), w: 7 * o + WHITE[l] };
};
export function parseTokens(str) {
  const out = [];
  let tied = false;
  for (const tok of str.trim().split(/\s+/)) {
    const [, body, dur = 'q', tie] = tok.match(TOKEN);
    out.push({ rest: body === 'R', dur, beats: BEATS[dur], keys: body === 'R' ? [] : body.split('+').map(pitch), cont: tied, tie: !!tie });
    tied = !!tie;
  }
  return out;
}

// ---- chords ----
// chord symbol -> pitch classes (root first) and spelled letters
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], sus2: [0, 2, 7], sus4: [0, 5, 7] };
export function chordTones(sym) {
  const [, root, acc, q] = sym.match(/^([A-G])([#b]?)(.*)$/);
  const r = (STEP[root] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12;
  // spell each tone by stacking letters in thirds from the root
  const ri = LETTERS.indexOf(root);
  const letterSteps = { 0: 0, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 10: 6, 11: 6 };
  return QUAL[q].map((iv) => {
    const L = LETTERS[(ri + letterSteps[iv]) % 7];
    const pc = (r + iv) % 12;
    let d = (pc - STEP[L] + 12) % 12;
    if (d > 6) d -= 12;
    return { pc, name: L + (d === 1 ? '#' : d === -1 ? 'b' : d === 2 ? '##' : d === -2 ? 'bb' : '') };
  });
}
export function parseChords(s) {
  return s.chords.trim().split(/\s+/).map((t) => { const [sym, d = 'w'] = t.split(':'); return { sym, beats: BEATS[d] }; });
}

// Bars of the melody after the pickup: [{start, notes: [{m, at, beats}]}]
function melodyBars(s) {
  const bar = BAR[s.time];
  const out = [];
  let pos = -(s.pickup || 0);
  for (const n of parseTokens(s.notes)) {
    if (!n.rest && !n.cont && pos >= 0) {
      const b = Math.floor(pos / bar + 1e-9);
      (out[b] = out[b] || []).push({ m: n.keys[n.keys.length - 1].m, at: pos - b * bar, beats: n.beats });
    }
    pos += n.beats;
  }
  const total = Math.round(pos / bar);
  return Array.from({ length: total }, (_, i) => out[i] || []);
}

const KEYS = {
  C: ['C', 'F', 'G', 'Am', 'Dm', 'Em', 'G7'], G: ['G', 'C', 'D', 'Em', 'Am', 'D7'], F: ['F', 'Bb', 'C', 'Dm', 'Gm', 'C7'],
  D: ['D', 'G', 'A', 'Bm', 'Em', 'A7'], Am: ['Am', 'Dm', 'E', 'F', 'C', 'G', 'E7'], Cm: ['Cm', 'Fm', 'G', 'Ab', 'Eb', 'G7'],
  'F#': ['F#', 'B', 'C#', 'D#m', 'C#7'],
};
export function suggest(s) {
  const bar = BAR[s.time];
  const cands = KEYS[s.key] || KEYS.C;
  const bars = melodyBars(s);
  const fit = (sym, notes, strong) => {
    const pcs = chordTones(sym).map((t) => t.pc);
    let sc = 0;
    for (const n of notes) {
      const w = n.beats * (n.at === 0 ? 2 : Math.abs(n.at - strong) < 1e-9 ? 1.5 : 1);
      sc += pcs.includes(n.m % 12) ? w : -w * 0.8;
    }
    return sc - cands.indexOf(sym) * 0.15 - (sym.includes('7') ? 0.4 : 0);
  };
  const out = [];
  bars.forEach((notes, i) => {
    const last = i === bars.length - 1;
    const best = (ns) => cands.slice().sort((a, b) => fit(b, ns, bar === 4 ? 2 : 0) - fit(a, ns, bar === 4 ? 2 : 0))[0];
    if (last) return out.push(cands[0] + ':' + DUR_OF[bar]);
    const one = best(notes);
    if (bar === 4) {
      const a = notes.filter((n) => n.at < 2), b = notes.filter((n) => n.at >= 2);
      const ca = best(a.length ? a : notes), cb = best(b.length ? b : notes);
      if (ca !== cb && fit(ca, a, 0) + fit(cb, b, 2) > fit(one, notes, 2) + 1.5) return out.push(ca + ':h', cb + ':h');
    }
    out.push(one + ':' + DUR_OF[bar]);
  });
  // merge repeats into whole bars only (keep one symbol per bar for readability)
  return out.join(' ').replace(/:w/g, '').replace(/(\S+):h \1:h/g, '$1');
}


// ---- left hand from chords ----
const NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// a note name (C, F#, Bb) placed at or above the midi floor
function place(name, floor) {
  const acc = name.length > 1 ? (name[1] === '#' ? 1 : -1) : 0;
  let o = 1;
  while (12 * (o + 1) + NAT[name[0]] + acc < floor) o++;
  return { name: name + o, m: 12 * (o + 1) + NAT[name[0]] + acc, w: 7 * o + WHITE[name[0]] };
}
// chord -> left-hand pitches: root from F2 up to E3 (C position roots for levels 1-3), then fifth and third above it
// (songs whose melody dips below middle C get the left hand an octave lower, C2..B2, so the hands don't meet)
function voicing(sym, level, low) {
  const [r, t, f] = chordTones(sym).map((x) => x.name);
  const root = low ? place(r, 36) : level <= 3 ? place(r, 48) : place(r, 41); // C2.., C3.. or F2..
  const up = (n) => place(n, root.m + 1);
  return { root, third: up(t), fifth: up(f) };
}
const tok = (ps, beats) => ps.map((p) => p.name).join('+') + ':' + DUR_OF[beats];
// split a chord's length into the pieces a pattern needs
function pattern(level, v, beats, s) {
  const { root: R, third: T, fifth: F } = v;
  const each = (ps, d) => { const n = Math.round(beats / d); return Array.from({ length: n }, (_, i) => tok([ps[i % ps.length]], d)); };
  if (level <= 3) return [tok([R], beats)];
  if (level === 4) return beats >= 2 && beats % 2 === 0 ? [tok([R], beats / 2), tok([F], beats / 2)] : beats === 3 ? [tok([R], 2), tok([F], 1)] : [tok([R], beats)];
  if (level === 5) return [tok([R, F], beats)];
  if (level === 6) return beats === 3 ? [tok([R], 2), tok([F], 1)] : beats === 4 ? [tok([R], 2), tok([F], 2)] : [tok([R], beats)];
  if (level === 7) return Number.isInteger(beats) ? each([R, F, T, F], 1) : [tok([R], beats)];
  if (level === 8) return Number.isInteger(beats) ? each([R, T, F, T], 1) : [tok([R], beats)];
  // level 10
  if (s.lhStyle === 'block') return [tok([R, T, F], beats)];
  return Number.isInteger(beats * 2) ? each([R, F, T, F], 0.5) : [tok([R], beats)];
}
// Returns { lh, lhFingers }. Levels 1-3 keep the hand in C position (pinky C3 ... thumb G3);
// later levels put the pinky on each chord's root and move with the chords.
export function leftHand(s) {
  const bar = BAR[s.time];
  const chords = parseChords(s);
  const toks = [], fingers = [];
  if (s.pickup) toks.push('R:' + DUR_OF[s.pickup]);
  const groups = [];
  const low = Math.min(...parseTokens(s.notes).flatMap((n) => n.keys.map((k) => k.m))) < 60;
  if (s.level <= 2) {
    // one whole note per bar: the chord on its downbeat
    const bars = Math.round(chords.reduce((a, c) => a + c.beats, 0) / bar);
    for (let b = 0; b < bars; b++) {
      let at = 0, c = chords[0];
      for (const x of chords) { if (at <= b * bar + 1e-9) c = x; at += x.beats; }
      if (b === bars - 1) c = chords[chords.length - 1]; // end on the last chord, not a half-bar one before it
      groups.push([tok([voicing(c.sym, s.level, low).root], bar)]);
    }
  } else for (const c of chords) groups.push(pattern(s.level, voicing(c.sym, s.level, low), c.beats, s));
  const C3 = pitch('C3').w;
  for (const g of groups) {
    const notes = parseTokens(g.join(' ')).filter((n) => !n.rest);
    const ws = notes.flatMap((n) => n.keys.map((k) => k.w));
    const base = s.level <= 3 && Math.min(...ws) >= C3 && Math.max(...ws) <= C3 + 4 ? C3 : Math.min(...ws);
    for (const n of notes) fingers.push(n.keys.map((k) => 5 - (k.w - base)).sort((a, b) => b - a).join('+'));
    toks.push(...g);
  }
  return { lh: toks.join(' '), lhFingers: fingers.join(' ') };
}

// ---- finger numbers ----
// Cut the part into the fewest stretches that fit under five white keys; in each stretch the
// thumb (right hand) or pinky (left hand) takes the lowest key, or C/G/F when one fits.
export function fingerings(str, hand) {
  const notes = parseTokens(str).filter((n) => !n.rest && !n.cont);
  const segs = [];
  let cur = null;
  for (const n of notes) {
    const ws = n.keys.map((k) => k.w);
    if (cur && Math.max(cur.hi, ...ws) - Math.min(cur.lo, ...ws) <= 4) { cur.lo = Math.min(cur.lo, ...ws); cur.hi = Math.max(cur.hi, ...ws); cur.n.push(n); }
    else segs.push((cur = { lo: Math.min(...ws), hi: Math.max(...ws), n: [n] }));
  }
  const out = [];
  for (const g of segs) {
    let base = g.lo;
    for (let w = g.lo; w >= g.hi - 4; w--) if ([0, 4, 3].includes(w % 7)) { base = w; break; }
    for (const n of g.n) out.push(n.keys.map((k) => (hand === 'r' ? 1 + k.w - base : 5 - (k.w - base))).sort((a, b) => (hand === 'r' ? a - b : b - a)).join('+'));
  }
  return out.join(' ');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { SONG_DATA } = await import('../src/songs.js');
  const [cmd, id] = process.argv.slice(2);
  if (cmd === 'suggest') {
    for (const s of SONG_DATA.filter((x) => (id ? x.id === id : x.clef !== 'bass'))) console.log(`${s.id}: "${suggest(s)}"`);
  } else if (cmd === 'write') {
    const file = new URL('../src/songs.js', import.meta.url);
    let src = fs.readFileSync(file, 'utf8');
    let changed = 0;
    for (const s of SONG_DATA) {
      if (s.clef === 'bass' || !s.chords || s.lhStyle === 'own') continue;
      const { lh, lhFingers } = leftHand(s);
      const want = { lh, fingers: fingerings(s.notes, 'r'), lhFingers };
      const at = src.indexOf(`id: "${s.id}"`), end = src.indexOf('\n  },', at);
      let block = src.slice(at, end);
      for (const [k, v] of Object.entries(want)) {
        const line = `    ${k}: ${JSON.stringify(v)},`;
        const re = new RegExp(`^    ${k}: .*,$`, 'm');
        block = re.test(block) ? block.replace(re, () => line) : block.replace(/^    chords: .*,$/m, (m) => (k === 'lh' ? line + '\n' + m : m + '\n' + line));
      }
      if (block !== src.slice(at, end)) { changed++; console.log('changed', s.id); src = src.slice(0, at) + block + src.slice(end); }
    }
    if (process.argv.includes('--save')) fs.writeFileSync(file, src);
    console.log(`${changed} song(s) ${process.argv.includes('--save') ? 'updated' : 'would change (add --save)'}`);
  }
}
