// Sound: Tone.js sampler with real piano samples, plus synthesized chicken noises and a talking chicken.
import * as Tone from 'tone';
import { SAMPLES } from './samples.generated.js';

let piano = null;
let fx = null;
let started = false;
const listeners = { busy: [] }; // tell the mic to ignore our own sounds

export function onBusy(fn) { listeners.busy.push(fn); }
function busy(ms) { listeners.busy.forEach((f) => f(ms)); }

function b64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function loadPiano() {
  const raw = Tone.getContext().rawContext;
  const urls = {};
  await Promise.all(Object.entries(SAMPLES).map(async ([note, b64]) => {
    const buf = await raw.decodeAudioData(b64ToArrayBuffer(b64));
    urls[note] = new Tone.ToneAudioBuffer(buf);
  }));
  piano = new Tone.Sampler({ urls, release: 1.2 }).toDestination();
  piano.volume.value = -3;
}

function makeFx() {
  const bp = new Tone.Filter(1400, 'bandpass').toDestination();
  bp.Q.value = 1.4;
  const cluck = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.07, sustain: 0, release: 0.02 } }).connect(bp);
  cluck.volume.value = -8;
  const hp = new Tone.Filter(2500, 'highpass').toDestination();
  const peck = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } }).connect(hp);
  peck.volume.value = -14;
  const vib = new Tone.Vibrato(9, 0.25).toDestination();
  const bawk = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.15 } }).connect(new Tone.Filter(2200, 'lowpass').connect(vib));
  bawk.volume.value = -12;
  return { cluck, peck, bawk };
}

// Must be called from a tap (iOS needs a user gesture to start audio)
export async function startAudio() {
  if (!started) {
    started = true;
    await Tone.start();
    fx = makeFx();
    loadPiano().catch((e) => console.warn('piano load failed', e));
  } else if (Tone.getContext().state !== 'running') {
    await Tone.getContext().resume();
  }
}

export function audioContext() { return Tone.getContext(); }

const toNote = (m) => Tone.Frequency(m, 'midi').toNote();

export function playNote(m, dur = 0.9, when) {
  if (!piano || !piano.loaded) return;
  busy(dur * 1000 + 350);
  piano.triggerAttackRelease(toNote(m), dur, when);
}

export function cluck(n = 2) {
  if (!fx) return;
  busy(n * 140 + 200);
  const t = Tone.now();
  for (let i = 0; i < n; i++) {
    const s = t + i * 0.13;
    fx.cluck.triggerAttackRelease(900, 0.06, s);
    fx.cluck.frequency.setValueAtTime(950, s);
    fx.cluck.frequency.exponentialRampToValueAtTime(380, s + 0.06);
  }
}

export function peck() {
  if (!fx) return;
  fx.peck.triggerAttackRelease(0.03);
}

export function bawk() {
  if (!fx) return;
  busy(1600);
  const t = Tone.now();
  fx.bawk.triggerAttackRelease(420, 0.5, t);
  fx.bawk.frequency.setValueAtTime(420, t);
  fx.bawk.frequency.exponentialRampToValueAtTime(980, t + 0.12);
  fx.bawk.frequency.exponentialRampToValueAtTime(640, t + 0.5);
  [60, 64, 67, 72].forEach((m, i) => playNote(m, 0.6, t + 0.6 + i * 0.12));
}

// Plays a list of {m,d} notes; calls onNote(i) as each starts. Returns a stop() function.
export function playSequence(notes, tempo, onNote, onDone) {
  const beat = 60 / tempo;
  let i = 0;
  let timer = null;
  let stopped = false;
  const step = () => {
    if (stopped) return;
    if (i >= notes.length) { onDone && onDone(); return; }
    const n = notes[i];
    const beats = { q: 1, h: 2, w: 4 }[n.d] || 1;
    playNote(n.m, beats * beat * 0.95);
    onNote && onNote(i);
    i++;
    timer = setTimeout(step, beats * beat * 1000);
  };
  step();
  return () => { stopped = true; clearTimeout(timer); };
}

// Talking chicken (built-in Web Speech API)
let voice = null;
function pickVoice() {
  const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  const en = vs.filter((v) => /^en[-_]/i.test(v.lang));
  voice = en.find((v) => /samantha|karen|moira|tessa|google us english|female/i.test(v.name)) || en.find((v) => v.localService) || en[0] || null;
}
if (window.speechSynthesis) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
export function say(text) {
  if (!window.speechSynthesis || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.pitch = 1.35;
    // roughly how long the sentence takes, so the mic ignores it
    busy(600 + text.length * 70);
    u.onend = () => busy(300);
    speechSynthesis.speak(u);
  } catch (e) { /* speech is optional */ }
}
export function stopTalking() { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} }

export { Tone };
