// Sound: Tone.js sampler with real piano samples, plus synthesized chicken noises and a talking chicken.
import * as Tone from 'tone';
import { SAMPLES } from './samples.generated.js';
import { BEATS } from './music.js';

let piano = null;
let fx = null;
let started = false;
const listeners = { busy: [] }; // tell the mic to ignore our own sounds

export function onBusy(fn) { listeners.busy.push(fn); }
// exact: replace the current quiet time instead of extending it (speech ended early, so listen again sooner)
function busy(ms, exact = false) { listeners.busy.forEach((f) => f(ms, exact)); }

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

// m: one MIDI number or a list (chord). vel: 0..1 (soft..loud)
export function playNote(m, dur = 0.9, when, vel = 0.8) {
  if (!piano || !piano.loaded) return;
  busy(dur * 1000 + 350);
  const ms = Array.isArray(m) ? m : [m];
  piano.triggerAttackRelease(ms.map(toNote), dur, when, vel);
}

export function cluck(n = 2) {
  if (!fx) return;
  busy(n * 140 + 200);
  // Tone refuses to schedule a synth earlier than its last note, so queue after any cluck still playing
  if ((fx.cluckAt || 0) > Tone.now() + 0.5) return; // don't pile up a backlog
  const t = Math.max(Tone.now(), fx.cluckAt || 0);
  fx.cluckAt = t + n * 0.13;
  for (let i = 0; i < n; i++) {
    const s = t + i * 0.13;
    fx.cluck.triggerAttackRelease(900, 0.06, s);
    fx.cluck.frequency.setValueAtTime(950, s);
    fx.cluck.frequency.exponentialRampToValueAtTime(380, s + 0.06);
  }
}

export function peck() {
  if (!fx) return;
  const t = Math.max(Tone.now(), fx.peckAt || 0);
  fx.peckAt = t + 0.04;
  fx.peck.triggerAttackRelease(0.03, t);
}

export function bawk() {
  if (!fx) return;
  busy(1600);
  const t = Math.max(Tone.now(), fx.bawkAt || 0);
  fx.bawkAt = t + 0.6;
  fx.bawk.triggerAttackRelease(420, 0.5, t);
  fx.bawk.frequency.setValueAtTime(420, t);
  fx.bawk.frequency.exponentialRampToValueAtTime(980, t + 0.12);
  fx.bawk.frequency.exponentialRampToValueAtTime(640, t + 0.5);
  [60, 64, 67, 72].forEach((m, i) => playNote(m, 0.6, t + 0.6 + i * 0.12));
}

// Held keys: the note rings while the key is down (up to the sample's length) and stops on release.
const held = {};
export function noteDown(m, vel = 0.8) {
  if (!piano || !piano.loaded) return;
  busy(2500);
  if (held[m]) piano.triggerRelease(toNote(m));
  held[m] = true;
  piano.triggerAttack(toNote(m), undefined, vel);
}
export function noteUp(m) {
  if (!piano || !held[m]) return;
  held[m] = false;
  piano.triggerRelease(toNote(m), Tone.now() + 0.05);
  busy(400, true);
}

// A silly hello: a rising "bu-bu-bu-BAWK!" with a squeaky slide at the end.
export function silly() {
  if (!fx) return;
  busy(1800);
  const t = Math.max(Tone.now() + 0.05, fx.bawkAt || 0);
  fx.bawkAt = t + 1.2;
  [0, 0.14, 0.28].forEach((d, i) => {
    fx.cluck.triggerAttackRelease(700 + i * 120, 0.06, t + d);
  });
  fx.cluckAt = t + 0.45;
  const s = t + 0.45;
  fx.bawk.triggerAttackRelease(380, 0.65, s);
  fx.bawk.frequency.setValueAtTime(380, s);
  fx.bawk.frequency.exponentialRampToValueAtTime(1300, s + 0.15);
  fx.bawk.frequency.exponentialRampToValueAtTime(520, s + 0.65);
}

// Plays parsed notes (rests, chords and ties too); calls onNote(i) as each starts. Returns a stop() function.
// vel: one velocity, or a list with one per note.
export function playSequence(notes, tempo, onNote, onDone, vel = 0.8) {
  const beat = 60 / tempo;
  let i = 0;
  let timer = null;
  let stopped = false;
  const step = () => {
    if (stopped) return;
    if (i >= notes.length) { onDone && onDone(); return; }
    const n = notes[i];
    const beats = BEATS[n.d] || 1;
    // a tie holds the note through the next one
    let hold = beats;
    for (let j = i; notes[j] && notes[j].tie && notes[j + 1]; j++) hold += BEATS[notes[j + 1].d] || 1;
    const tied = i > 0 && notes[i - 1].tie;
    if (!n.r && !tied) playNote(n.keys.map((k) => k.m), hold * beat * 0.95, undefined, Array.isArray(vel) ? vel[i] ?? 0.8 : vel);
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
let talkId = 0; // only the newest sentence may un-mute the mic when it ends
// onEnd runs when the chicken stops talking (or about when it should have, if speech is missing).
export function say(text, onEnd) {
  let done = false;
  const finish = () => { if (!done) { done = true; onEnd && onEnd(); } };
  const est = 600 + (text || '').length * 70;
  if (!window.speechSynthesis || !text) { setTimeout(finish, text ? 300 : 0); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.pitch = 1.35;
    // roughly how long the sentence takes, so the mic ignores it
    busy(est);
    const id = ++talkId;
    u.onend = () => { if (id === talkId) busy(300, true); setTimeout(finish, 250); };
    speechSynthesis.speak(u);
    setTimeout(finish, est * 1.6 + 1500); // iOS sometimes never fires onend
  } catch (e) { setTimeout(finish, 300); }
}
export function stopTalking() { try { if (window.speechSynthesis && speechSynthesis.speaking) { speechSynthesis.cancel(); busy(300, true); } } catch (e) {} }

export { Tone };
