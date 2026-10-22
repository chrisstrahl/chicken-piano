// Turns a stream of audio frames into "a key was pressed" events.
// Pure logic (no Web Audio), so it can be tested offline with recorded piano notes (test/octaves.mjs).
//
// Two detectors work together:
//  1. Pitchy (McLeod pitch method) names any note it hears clearly.
//  2. When Pitchy isn't sure (quiet tablet mic, echoey room, very low or high notes), a harmonic
//     spectrum check (FFT via fft.js) confirms the note the app is waiting for. It only ever confirms
//     the expected note, so it can't invent wrong notes.
import { PitchDetector } from 'pitchy';
import FFT from 'fft.js';

const CLARITY = 0.8;
const REPEAT_WAIT = 180;
const PITCH_SIZE = 2048;
const GATE = 2; // how far above the room's background noise a note must be
const MIN_GATE = 0.0002; // absolute floor, low enough for quiet tablet mics (the noise-relative gate does the real work)
// semitones above a held note where its own overtones show up (octave+5th, 2 octaves+3rd, ...)
const OVERTONES = [19, 28, 31, 34];
const FLUX_K = 1.6;
const FLUX_MIN = 0.35;
const TARGET_RATIO = 1.35;
// Input gain: quiet tablet mics get boosted until the room noise sits near NOISE_TARGET, the level the
// thresholds above were tuned at. It can't add signal over noise, but it stops quiet-but-clean input
// from falling under fixed thresholds.
const NOISE_TARGET = 0.0009;
const MAX_GAIN = 16; // expected note must beat every other note name by this much

export class NoteListener {
  constructor(size) {
    this.size = size;
    // pitch from the newest ~43ms only: a longer window blends the old and new note into a fake low note
    this.pitchSize = Math.min(size, PITCH_SIZE);
    this.detector = PitchDetector.forFloat32Array(this.pitchSize);
    this.fft = new FFT(size);
    this.win = new Float32Array(size).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
    this.frame = new Float32Array(size);
    this.spec = this.fft.createComplexArray();
    this.mag = new Float32Array(size / 2);
    this.armed = true; this.lastMidi = null; this.stable = 0; this.lastAccept = -1e9; this.lastPc = -1; this.lastAcceptMidi = -99;
    this.rawNoise = 0.004; this.gain = 1; this.scaled = new Float32Array(size);
    this.targetHits = 0; this.noise = 0.004; this.recent = []; this.peak = 0; this.notePeak = 0;
    this.prevLog = new Float32Array(size / 2); this.fluxHist = []; this.onsetAt = -1e9; this.specReady = false;
  }

  // buf: latest window of samples; now: ms. ignore: true while the app itself is making sound.
  // expectPc: pitch class (0-11) the app is waiting for, or null.
  // Returns { rms, midi } where midi is set only when a new key press is recognized.
  process(buf, sr, now, ignore = false, expectPc = null) {
    let raw = 0;
    for (let i = 0; i < buf.length; i++) raw += buf[i] * buf[i];
    raw = Math.sqrt(raw / buf.length);
    this.rawNoise = raw < this.rawNoise ? this.rawNoise * 0.8 + raw * 0.2 : this.rawNoise * 0.998 + raw * 0.002;
    this.gain = Math.min(MAX_GAIN, Math.max(1, NOISE_TARGET / Math.max(this.rawNoise, 1e-6)));
    let rms = raw;
    if (this.gain > 1) {
      for (let i = 0; i < buf.length; i++) this.scaled[i] = buf[i] * this.gain;
      buf = this.scaled;
      rms = raw * this.gain;
    }

    // adaptive noise floor: drifts down quickly, up slowly
    this.noise = rms < this.noise ? this.noise * 0.8 + rms * 0.2 : this.noise * 0.998 + rms * 0.002;
    const gate = Math.max(MIN_GATE, this.noise * GATE);

    // onset: a sudden jump in loudness means a new key press (even the same key again).
    // It must also get back near recent loudness, so wobbles in a ringing note don't count.
    const minRecent = this.recent.length ? Math.min(...this.recent) : 0;
    this.recent.push(rms);
    if (this.recent.length > 4) this.recent.shift();
    const flux = this.spectralFlux(buf);
    const fluxAvg = this.fluxHist.length ? this.fluxHist.reduce((a, b) => a + b, 0) / this.fluxHist.length : 0;
    this.fluxHist.push(flux);
    if (this.fluxHist.length > 8) this.fluxHist.shift();
    const loudJump = rms > minRecent * 1.4 && rms > this.peak * 0.6;
    // hammer strike: a burst of new energy across the spectrum, even while another note still rings
    const strike = flux > fluxAvg * FLUX_K && flux > FLUX_MIN;
    if (rms > gate * 1.5 && (loudJump || strike) && now - this.lastAccept > 150) { this.armed = true; this.onsetAt = now; }
    this.peak = Math.max(rms, this.peak * 0.97);
    this.notePeak = Math.max(this.notePeak, rms);

    const none = { rms, midi: null };
    if (rms < gate) { this.stable = 0; this.targetHits = 0; this.lastMidi = null; return none; }
    if (ignore) { this.stable = 0; this.targetHits = 0; return none; }

    const [freq, clarity] = this.detector.findPitch(buf.subarray(buf.length - this.pitchSize), sr);
    let midi = null;
    if (clarity >= CLARITY && freq > 27 && freq < 4300) {
      const midiF = 69 + 12 * Math.log2(freq / 440);
      if (Math.abs(midiF - Math.round(midiF)) <= 0.45) midi = Math.round(midiF);
    }

    if (midi !== null) {
      this.stable = midi === this.lastMidi ? this.stable + 1 : 1;
      this.lastMidi = midi;
      if (this.stable >= 2) {
        // moved to a different key: only if it's loud, not an overtone showing up as a held note fades
        if (!this.armed && midi % 12 !== this.lastPc && rms > this.notePeak * 0.35 && !OVERTONES.includes(midi - this.lastAcceptMidi)) this.armed = true;
        // Same note as last time? Wait a moment: right after a new key is struck, the old note
        // still rings and can hide the new one. A real repeat is still there after REPEAT_WAIT.
        const repeat = midi % 12 === this.lastPc;
        if (this.armed && now - this.lastAccept > 130 && (!repeat || now - this.onsetAt >= REPEAT_WAIT)) return this.accept(midi, rms, now);
      }
    } else {
      this.stable = 0;
    }

    // fallback: is the note we're waiting for clearly the strongest in the spectrum?
    if (expectPc !== null && this.armed && now - this.lastAccept > 130) {
      const m = this.targetCheck(buf, sr, expectPc);
      this.targetHits = m !== null ? this.targetHits + 1 : 0;
      if (this.targetHits >= 2) return this.accept(m, rms, now);
    }
    return none;
  }

  accept(midi, rms, now) {
    this.armed = false;
    this.lastAccept = now;
    this.lastPc = midi % 12;
    this.lastAcceptMidi = midi;
    this.recent = [rms];
    this.notePeak = rms;
    this.stable = 0;
    this.targetHits = 0;
    return { rms, midi };
  }

  // Harmonic salience for every piano note A0..C8; returns a midi of the expected pitch class if it wins clearly.
  // Fills this.mag with the magnitude spectrum and returns how much new energy appeared since last frame.
  spectralFlux(buf) {
    const n = this.size;
    for (let i = 0; i < n; i++) this.frame[i] = (buf[i] || 0) * this.win[i];
    this.fft.realTransform(this.spec, this.frame);
    let rise = 0, total = 0;
    for (let k = 0; k < n / 2; k++) {
      const m = Math.hypot(this.spec[2 * k], this.spec[2 * k + 1]);
      this.mag[k] = m;
      if (k > 4) { total += m; if (m > this.prevLog[k]) rise += m - this.prevLog[k]; }
      this.prevLog[k] = m;
    }
    return total > 0 ? rise / total : 0; // share of the spectrum that is new this frame
  }

  targetCheck(buf, sr, expectPc) {
    const n = this.size;
    const binHz = sr / n;
    const peakNear = (f) => {
      const k = Math.round(f / binHz);
      if (k < 1 || k >= n / 2 - 1) return 0;
      return Math.max(this.mag[k - 1], this.mag[k], this.mag[k + 1]);
    };
    const pcBest = new Float32Array(12);
    const pcMidi = new Int16Array(12);
    for (let m = 28; m <= 100; m++) {
      const f0 = 440 * Math.pow(2, (m - 69) / 12);
      if (f0 < binHz * 3) continue; // too low to resolve with this window
      let s = 0;
      for (let h = 1; h <= 6; h++) s += peakNear(f0 * h) * Math.pow(0.8, h - 1);
      const pc = m % 12;
      if (s > pcBest[pc]) { pcBest[pc] = s; pcMidi[pc] = m; }
    }
    let other = 0;
    for (let pc = 0; pc < 12; pc++) if (pc !== expectPc) other = Math.max(other, pcBest[pc]);
    return pcBest[expectPc] > other * TARGET_RATIO ? pcMidi[expectPc] : null;
  }
}
