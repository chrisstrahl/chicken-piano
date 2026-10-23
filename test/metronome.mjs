// Offline test: the metronome's peck must not change what the mic hears.
// Plays the sequence-test tunes on the beat with a peck on every beat (as loud as the piano, and louder),
// and checks the listener hears exactly the same notes as without the peck. Also: pecks over silence and
// over a held note must never become notes.
// usage: node test/metronome.mjs <pcm dir>   (48 kHz mono float32 piano samples, like test/sequence.mjs)
import fs from 'node:fs';
const { NoteListener } = await import(process.env.LISTENER || '../src/listener.js');
const { PECK, peckMask } = await import('../src/beat.ts');

const dir = process.argv[2];
const SR = 48000, SIZE = 4096, HOP = Math.round(SR * 0.04);
const MASK = process.env.MASK !== '0'; // 0: run without telling the listener about the pecks
const gain = 0.08, noise = 0.003;
const MIDI = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };
const load = (n) => new Float32Array(fs.readFileSync(`${dir}/${n}.f32`).buffer.slice(0));
const toMidi = (n) => { const [, l, o] = n.match(/^([A-G]s?)(\d)$/); return 12 * (+o + 1) + MIDI[l]; };
let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };

// The peck as the tablet's speaker plays it into its own mic: the same filtered noise burst the app
// makes (src/beat.js PECK), plus a little room echo, arriving `lag` seconds after it was scheduled.
function peckWave(accent) {
  const n = Math.round(SR * PECK.len);
  const out = new Float32Array(n);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  // RBJ high-pass at PECK.hz
  const w = 2 * Math.PI * PECK.hz / SR, a = Math.sin(w) / (2 * 0.9), c = Math.cos(w);
  const b0 = (1 + c) / 2, b1 = -(1 + c), b2 = (1 + c) / 2, a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  for (let i = 0; i < n; i++) {
    const v = rand() * 2 * Math.exp(-i / (SR * PECK.decay)) * (accent ? 1 : PECK.soft);
    const y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = v; y2 = y1; y1 = y; out[i] = y;
  }
  return out;
}
function addReverb(x) {
  const y = Float32Array.from(x);
  for (const [d, g] of [[0.011, .5], [0.023, .4], [0.037, .3], [0.061, .2], [0.097, .12]]) { const k = Math.round(d * SR); for (let i = k; i < y.length; i++) y[i] += x[i - k] * g; }
  return y;
}

// render a performance; returns notes heard (pitch classes)
function run({ notes, beat, peckLevel, lag = +(process.env.LAG || 0.03), late = 0, expect = true }) {
  const len = Math.round(SR * (0.5 + beat * (notes.length + 3)));
  const sig = new Float32Array(len);
  let pianoPeak = 0;
  notes.forEach((n, i) => {
    if (n === 'R') return;
    const s = load(n), at = Math.round(SR * (0.5 + beat * i + late * (i % 3 - 1)));
    const same = notes[i + 1] === n;
    const stop = i < notes.length - 1 ? Math.round(SR * beat) : s.length;
    const fade = Math.round(SR * 0.08);
    for (let k = 0; k < s.length && at + k < len; k++) {
      const g = k < stop ? 1 : Math.max(0, 1 - (k - stop) / fade);
      if (g === 0) break;
      sig[at + k] += s[k] * gain * g;
      pianoPeak = Math.max(pianoPeak, Math.abs(sig[at + k]));
    }
    void same;
  });
  const pecks = [];
  if (peckLevel) {
    // count-in beats too, then one peck on every beat
    for (let b = -2; b < notes.length + 2; b++) {
      const t = 0.5 + beat * b;
      if (t < 0.05) continue;
      pecks.push(t * 1000);
      const p = peckWave(b % 4 === 0);
      let pk = 0; for (const v of p) pk = Math.max(pk, Math.abs(v));
      const at = Math.round(SR * (t + lag));
      const g = (0.08 * 0.6 * peckLevel) / pk; // peckLevel 1 = as loud as a piano note
      const r = addReverb(p);
      for (let k = 0; k < r.length && at + k < len; k++) sig[at + k] += r[k] * g;
    }
  }
  for (let i = 0; i < len; i++) sig[i] += rand() * noise;
  const L = new NoteListener(SIZE);
  const heard = [];
  let exp = 0;
  const want = notes.filter((n) => n !== 'R').map(toMidi);
  for (let end = SIZE; end <= len; end += HOP) {
    const now = (end / SR) * 1000;
    const masked = MASK && peckMask(pecks, now);
    const r = L.process(sig.subarray(end - SIZE, end), SR, now, false, expect && want[exp] != null ? want[exp] % 12 : null, masked);
    if (r.midi !== null) { heard.push(r.midi % 12); if (want[exp] != null && r.midi % 12 === want[exp] % 12) exp++; }
  }
  return heard.join(',');
}

const SEQS = {
  'hot cross buns': 'E4 D4 C4 R E4 D4 C4 R C4 C4 C4 C4 D4 D4 D4 D4 E4 D4 C4',
  'mary': 'E4 D4 C4 D4 E4 E4 E4 R D4 D4 D4 R E4 G4 G4',
  'low left hand': 'C3 D3 E3 F3 G3 G3 F3 E3 D3 C3',
  'high notes': 'C5 D5 E5 C5 G5 G5 E5 C5',
  'leaps': 'C4 G4 C5 G4 E4 C4 A3 F3',
  'sharps': 'C4 Cs4 D4 Ds4 E4 F4 Fs4 G4',
};
let same = 0, total = 0, exactClean = 0, exactPeck = 0;
for (const [name, seq] of Object.entries(SEQS)) {
  const notes = seq.split(' ');
  const want = notes.filter((n) => n !== 'R').map((n) => toMidi(n) % 12).join(',');
  for (const bpm of [60, 90, 120]) {
    for (const late of [0, 0.06]) { // on the beat, or a bit early/late like a real kid
      const beat = 60 / bpm;
      const clean = run({ notes, beat, peckLevel: 0, late });
      for (const lvl of [1, 3]) {
        const withPeck = run({ notes, beat, peckLevel: lvl, late });
        total++;
        if (withPeck === clean) same++;
        if (clean === want) exactClean++;
        if (withPeck === want) exactPeck++;
        if (withPeck !== clean || process.env.SHOW) console.log(`${withPeck === clean ? 'same' : 'DIFF'} ${name} ${bpm}bpm late ${late} peck x${lvl}\n   clean ${clean}\n   peck  ${withPeck}`);
      }
    }
  }
}
console.log(`notes heard with the peck = without it: ${same}/${total} runs  (exact: ${exactClean}/${total} clean, ${exactPeck}/${total} with peck)`);

// pecks alone, and pecks over one long held note: nothing new may be heard
let ghosts = 0;
for (const bpm of [60, 90, 120, 160]) {
  for (const lvl of [1, 3, 6]) {
    const quiet = run({ notes: ['R', 'R', 'R', 'R', 'R', 'R', 'R', 'R'], beat: 60 / bpm, peckLevel: lvl, expect: false });
    const held = run({ notes: ['C4', 'R', 'R', 'R', 'R', 'R'], beat: 60 / bpm, peckLevel: lvl, expect: false });
    const g = (quiet ? quiet.split(',').length : 0) + (held ? held.split(',').length - 1 : 0);
    if (g) console.log(`GHOST ${bpm}bpm x${lvl}: silence → [${quiet}], held C → [${held}]`);
    ghosts += g;
  }
}
console.log(`ghost notes from pecks alone: ${ghosts}`);
if (same !== total || ghosts) process.exitCode = 1;
