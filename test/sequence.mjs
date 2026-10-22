globalThis.__FLUX_K = process.env.FK; globalThis.__FLUX_MIN = process.env.FM; globalThis.__RISE = process.env.RI;
// Offline test: overlapping piano notes in a row (like a real performance) must be heard once each, in order.
// usage: node test/sequence.mjs <pcm dir>
import fs from 'node:fs';
const { NoteListener } = await import(process.env.LISTENER || '../src/listener.js');

const dir = process.argv[2];
const SR = 48000, SIZE = 4096, HOP = Math.round(SR * 0.04);
const OVERLAP = +(process.env.OVERLAP || 0); // seconds a key is held after the next one goes down (legato)
const PEDAL = !!+(process.env.PEDAL || 0);
const gain = +(process.env.GAIN || 0.08), noise = +(process.env.NOISE || 0.003);
const MIDI = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };
const load = (n) => new Float32Array(fs.readFileSync(`${dir}/${n}.f32`).buffer.slice(0));
const toMidi = (n) => { const [, l, o] = n.match(/^([A-G]s?)(\d)$/); return 12 * (+o + 1) + MIDI[l]; };

const SEQS = {
  'hot cross buns': 'E4 D4 C4 E4 D4 C4 C4 C4 C4 C4 D4 D4 D4 D4 E4 D4 C4',
  'mary': 'E4 D4 C4 D4 E4 E4 E4 D4 D4 D4 E4 G4 G4',
  'low left hand': 'C3 D3 E3 F3 G3 G3 F3 E3 D3 C3',
  'high notes': 'C6 D6 E6 C6 G6 G6 E6 C6',
  'bass octave 2': 'C2 G2 C2 G2 E2 E2',
  'leaps': 'C4 G4 C5 G4 E4 C4 A3 F3',
};
let seed = 3;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
let pass = 0;
for (const [name, seq] of Object.entries(SEQS)) {
  for (const gap of [0.45, 0.7]) {
    const notes = seq.split(' ');
    const len = Math.round(SR * (0.5 + gap * notes.length + 1.5));
    const sig = new Float32Array(len);
    notes.forEach((n, i) => {
      const s = load(n), at = Math.round(SR * (0.5 + gap * i));
      // key released when the next key goes down: the damper stops it within ~80ms.
      // PEDAL=1 lets every note ring on (sustain pedal down), which is much harder.
      // the same key can't overlap itself: re-striking it cuts the old sound
      const same = notes[i + 1] === n;
      const stop = i < notes.length - 1 && (!PEDAL || same) ? Math.round(SR * (gap + (same ? 0 : OVERLAP))) : s.length;
      const fade = Math.round(SR * 0.08);
      for (let k = 0; k < s.length && at + k < len; k++) {
        const g = k < stop ? 1 : Math.max(0, 1 - (k - stop) / fade);
        if (g === 0) break;
        sig[at + k] += s[k] * gain * g;
      }
    });
    for (let i = 0; i < len; i++) sig[i] += rand() * noise;
    const L = new NoteListener(SIZE);
    const heard = [];
    let exp = 0;
    for (let end = SIZE; end <= len; end += HOP) {
      const r = L.process(sig.subarray(end - SIZE, end), SR, (end / SR) * 1000, false, process.env.NOEXPECT ? null : toMidi(notes[Math.min(exp, notes.length - 1)]) % 12);
      if (r.midi !== null) { heard.push(r.midi); if (r.midi % 12 === toMidi(notes[exp] || 'C4') % 12) exp++; }
    }
    const want = notes.map(toMidi).map((m) => m % 12).join(',');
    const got = heard.map((m) => m % 12).join(',');
    const ok = want === got;
    if (ok) pass++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} (gap ${gap}s)${ok ? '' : `\n   want ${want}\n   got  ${got}`}`);
  }
}
console.log(`${pass}/${Object.keys(SEQS).length * 2} sequences exact`);
