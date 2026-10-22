// Offline accuracy test: feeds every piano sample (C1..C8) through the NoteListener,
// at a quiet "propped on the piano" level with background noise, and reports what it heard.
// usage: node test/octaves.mjs <pcm dir>
import fs from 'node:fs';
const { NoteListener } = await import(process.env.LISTENER || '../src/listener.js');

const dir = process.argv[2];
const SR = 48000, SIZE = +(process.env.SIZE || 4096), HOP = Math.round(SR * 0.04);
const NAMES = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.f32'));
const notes = files.map((f) => { const [, n, o] = f.match(/^([A-G]s?)(\d)/); return { f, midi: 12 * (+o + 1) + NAMES[n] }; }).sort((a, b) => a.midi - b.midi);

let seed = 1;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
const EXPECT = process.env.EXPECT || 'none'; // 'none' | offset in semitones from the real note (0 = waiting for the right note)
const gain = +(process.env.GAIN || 0.15), noise = +(process.env.NOISE || 0.003);
// tablet-mic simulation: weak bass (high-pass), small-room reverb
const HPF = +(process.env.HPF || 0), REVERB = +(process.env.REVERB || 0);
function highpass(x, fc) {
  if (!fc) return x;
  const w = 2 * Math.PI * fc / SR, q = 0.707, a = Math.sin(w) / (2 * q), c = Math.cos(w);
  const b0 = (1 + c) / 2, b1 = -(1 + c), b2 = (1 + c) / 2, a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return highpass2(y, fc);
}
function highpass2(x) { return x; }
function reverb(x, amt) {
  if (!amt) return x;
  const y = Float32Array.from(x);
  for (const [d, g] of [[0.011, .6], [0.023, .5], [0.037, .4], [0.053, .35], [0.071, .3], [0.097, .25], [0.13, .2]])
    { const k = Math.round(d * SR); for (let i = k; i < y.length; i++) y[i] += x[i - k] * g * amt; }
  return y;
}
const byOct = {};
for (const { f, midi } of notes) {
  const raw = reverb(highpass(new Float32Array(fs.readFileSync(`${dir}/${f}`).buffer.slice(0)), HPF), REVERB);
  const pad = SR * 0.5; // half a second of room noise first
  const sig = new Float32Array(pad + raw.length);
  for (let i = 0; i < sig.length; i++) sig[i] = (i >= pad ? raw[i - pad] * gain : 0) + rand() * noise;
  const L = new NoteListener(SIZE);
  const heard = [];
  for (let end = SIZE; end <= sig.length; end += HOP) {
    const r = L.process(sig.subarray(end - SIZE, end), SR, (end / SR) * 1000, false, EXPECT === 'none' ? null : (midi + (+EXPECT || 0)) % 12);
    if (r.midi !== null) heard.push({ m: r.midi, t: Math.round((end - pad) / SR * 1000) });
  }
  const first = heard[0];
  const ok = first && first.m % 12 === midi % 12;
  const oct = Math.floor(midi / 12) - 1;
  (byOct[oct] ||= { n: 0, ok: 0, extra: 0, miss: [] }).n++;
  if (ok) byOct[oct].ok++; else byOct[oct].miss.push(f.replace('.f32', '') + '→' + (first ? first.m : 'none'));
  if (heard.length > 1) { byOct[oct].extra++; if (process.env.SHOW) console.log('  extra', f, midi, JSON.stringify(heard)); }
}
let tot = 0, totOk = 0, totExtra = 0;
for (const [o, s] of Object.entries(byOct)) {
  tot += s.n; totOk += s.ok; totExtra += s.extra;
  console.log(`octave ${o}: ${s.ok}/${s.n} right first note, ${s.extra} double-counted  ${s.miss.slice(0, 6).join(' ')}`);
}
console.log(`TOTAL ${totOk}/${tot} right, ${totExtra} double-counted`);
