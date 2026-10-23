// Difficulty score for a song, 1-100, from its melody (the `notes` string).
// songs.js stores the result as `diff`; test/songlib.mjs checks it matches and that each
// level lists its songs easiest first. Run `node tools/difficulty.mjs` for a table.
//
// What counts, and roughly how much (points are summed, then capped at 100):
//   range       span from lowest to highest note, in white-key steps          ~2 per step past a 3rd
//   notes       how many different keys the song uses                         ~1.5 per key past 3
//   positions   hand moves needed to keep every note under a five-finger spot ~3 per move
//   leaps       jumps bigger than a 3rd                                        ~0.6 each, up to 8
//   repeats     share of bars that are new (not a repeat of an earlier bar)    up to 5
//   rhythm      kinds of tricky note length, rests, dots, eighths, ties, pickup ~1-6 each
//   meter       3/4 or 6/8 instead of 4/4                                      3 / 6
//   reading     different keys outside the first five (C4 to G4)              1.5 each
//   accidentals sharp or flat notes, and how many different ones              ~2 per kind + share
//   chords      notes played together                                         4 + share
//   speed       fastest notes per second at the song's tempo                   ~3 per note/s past 2
//   length      number of notes to play                                        ~1 per 6 notes
//   bass clef   reading the low staff                                         4

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const WHITE = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const BEATS = { 8: 0.5, q: 1, qd: 1.5, h: 2, hd: 3, w: 4 };
const TOKEN = /^(R|[A-G][#b]?\d?(?:\+[A-G][#b]?\d?)*)(?::(8|qd|q|hd|h|w))?(~)?$/;
const PITCH = /^([A-G])([#b]?)(\d?)$/;

export function features(s) {
  const notes = [];
  let tied = false;
  for (const tok of s.notes.trim().split(/\s+/)) {
    const [, body, dur = 'q', tie] = tok.match(TOKEN);
    const rest = body === 'R';
    const keys = rest ? [] : body.split('+').map((p) => {
      const [, l, acc, oct] = p.match(PITCH);
      const o = +(oct || 4);
      return { m: 12 * (o + 1) + STEP[l] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0), w: 7 * o + WHITE[l], acc };
    });
    notes.push({ rest, dur, keys, cont: tied, tie: !!tie });
    tied = !!tie;
  }
  const played = notes.filter((n) => !n.rest && !n.cont);
  const top = played.map((n) => n.keys[n.keys.length - 1]);
  const ws = played.flatMap((n) => n.keys.map((k) => k.w));
  const lo = Math.min(...ws), hi = Math.max(...ws);
  // five-finger positions: cut the tune into the fewest stretches that each fit under five
  // white keys (greedy longest stretch is optimal); each new stretch is a hand move
  let moves = -1, a = Infinity, b = -Infinity;
  for (const n of played) {
    const na = Math.min(a, ...n.keys.map((k) => k.w)), nb = Math.max(b, ...n.keys.map((k) => k.w));
    if (nb - na > 4 || moves < 0) { moves++; a = Math.min(...n.keys.map((k) => k.w)); b = Math.max(...n.keys.map((k) => k.w)); } else { a = na; b = nb; }
  }
  let leaps = 0;
  for (let i = 1; i < top.length; i++) if (Math.abs(top[i].w - top[i - 1].w) > 2) leaps++;
  // cut into bars (pickup first) and count the ones not seen before
  const bar = { '4/4': 4, '3/4': 3, '6/8': 3 }[s.time] || 4;
  const bars = [];
  let pos = bar - (s.pickup || 0), cur = '';
  for (const n of notes) {
    if (pos >= bar - 1e-9) { if (cur) bars.push(cur); cur = ''; pos = 0; }
    cur += (n.rest ? 'R' : n.keys.map((k) => k.m).join('+')) + ':' + n.dur + ' ';
    pos += BEATS[n.dur];
  }
  if (cur) bars.push(cur);
  // long notes are easy; count the kinds of note length that need counting (eighth, dotted)
  const durs = new Set(notes.filter((n) => !n.rest && ['8', 'qd', 'hd'].includes(n.dur)).map((n) => n.dur));
  const share = (f) => played.filter(f).length / played.length;
  const accKeys = played.flatMap((n) => n.keys).filter((k) => k.acc);
  const shortest = Math.min(...notes.map((n) => BEATS[n.dur]));
  return {
    range: hi - lo,
    distinct: new Set(played.flatMap((n) => n.keys.map((k) => k.m))).size,
    outside: new Set(played.flatMap((n) => n.keys.map((k) => k.m)).filter((m) => m < 60 || m > 67)).size,
    moves,
    leaps,
    durs: durs.size,
    newBars: new Set(bars).size / bars.length,
    rests: notes.filter((n) => n.rest).length,
    dotted: notes.some((n) => n.dur === 'qd'),
    eighths: share((n) => n.dur === '8'),
    ties: notes.filter((n) => n.tie).length,
    pickup: !!s.pickup,
    meter: s.time,
    accKinds: new Set(accKeys.map((k) => k.m % 12)).size,
    accShare: accKeys.length / played.length,
    chordShare: share((n) => n.keys.length > 1),
    speed: (s.tempo / 60) / shortest, // fastest notes per second
    length: played.length,
    bass: s.clef === 'bass',
  };
}

export function difficulty(s) {
  const f = features(s);
  let d = 0;
  d += 2 * Math.max(0, f.range - 2);
  d += 1.5 * Math.max(0, f.distinct - 3);
  d += 1.5 * f.outside;
  d += 3 * Math.min(f.moves, 8);
  d += 0.6 * Math.min(f.leaps, 14);
  d += 1.5 * f.durs;
  d += 5 * f.newBars;
  d += f.rests ? 2 + 0.2 * Math.min(f.rests, 10) : 0;
  d += f.dotted ? 5 : 0;
  d += f.eighths ? 3 + 8 * f.eighths : 0;
  d += f.ties ? 3 : 0;
  d += f.pickup ? 2 : 0;
  d += f.meter === '3/4' ? 3 : f.meter === '6/8' ? 6 : 0;
  d += f.accKinds ? 2 * f.accKinds + 10 * f.accShare : 0;
  d += f.chordShare ? 4 + 10 * f.chordShare : 0;
  d += 3 * Math.max(0, f.speed - 2);
  d += f.length / 6;
  d += f.bass ? 4 : 0;
  return Math.max(1, Math.min(100, Math.round(d)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { SONG_DATA } = await import('../src/songs.js');
  for (const s of SONG_DATA) {
    const f = features(s);
    console.log(`L${s.level}`.padEnd(4), String(difficulty(s)).padStart(3), String(s.diff ?? '').padStart(3), s.id.padEnd(14),
      `range ${f.range} keys ${f.distinct} moves ${f.moves} leaps ${f.leaps} durs ${f.durs} speed ${f.speed.toFixed(1)} n ${f.length}`);
  }
}
