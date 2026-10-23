// Offline test: people talking near the piano must not turn into notes.
// usage: node test/speech.mjs <speech f32 dir>   (48 kHz mono float32 clips, e.g. decoded dist/voice/*.mp3)
// LEVEL: speech peak relative to a played piano note (1 = as loud as the piano), EXPECT=1 simulates a song waiting for a note
import fs from 'node:fs';
const { NoteListener } = await import(process.env.LISTENER || '../src/listener.ts');
const dir = process.argv[2];
const SR = 48000, SIZE = 4096, HOP = Math.round(SR * 0.04);
const LEVEL = +(process.env.LEVEL || 1), noise = +(process.env.NOISE || 0.003);
const PIANO_PEAK = 0.08 * 0.6; // about how loud the piano samples peak in the other tests
let seed = 5;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
const clips = fs.readdirSync(dir).filter((f) => f.endsWith('.f32')).sort().map((f) => new Float32Array(fs.readFileSync(`${dir}/${f}`).buffer.slice(0)));
let total = 0, falseNotes = 0, secs = 0;
for (const c of clips) {
  let peak = 0;
  for (const v of c) peak = Math.max(peak, Math.abs(v));
  const g = (PIANO_PEAK * LEVEL) / (peak || 1);
  const sig = new Float32Array(c.length + SR);
  for (let i = 0; i < sig.length; i++) sig[i] = (i >= SR / 2 && i - SR / 2 < c.length ? c[i - SR / 2] * g : 0) + rand() * noise;
  const L = new NoteListener(SIZE);
  const expect = process.env.EXPECT ? [0, 2, 4, 5, 7][total % 5] : null;
  for (let end = SIZE; end <= sig.length; end += HOP) {
    const r = L.process(sig.subarray(end - SIZE, end), SR, (end / SR) * 1000, false, expect);
    if (r.midi !== null) falseNotes++;
  }
  total++;
  secs += c.length / SR;
}
console.log(`speech: ${falseNotes} false notes in ${secs.toFixed(0)}s of talking (${clips.length} clips, level ${LEVEL}${process.env.EXPECT ? ', waiting for a note' : ''})`);
