// Sound: Tone.js sampler with real piano samples, plus synthesized chicken noises and a talking chicken.
import * as Tone from 'tone';
import { SAMPLES } from './samples.generated.js';
import { BEATS } from './music.js';
import { lineId } from './lines.js';
import { VOICE } from './voice.generated.js';
import { PECK } from './beat.js';

let piano = null;
let pianoBufs = null; // { 'C4': AudioBuffer, ... } for rendering recordings
let fx = null;
let started = false;
const listeners = { busy: [], peck: [] }; // tell the mic to ignore our own sounds

export function onBusy(fn) { listeners.busy.push(fn); }
// fn(ms): a metronome peck plays at performance.now() time ms
export function onPeck(fn) { listeners.peck.push(fn); }
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
  pianoBufs = Object.fromEntries(Object.entries(urls).map(([n, b]) => [n, b.get()]));
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
// The decoded piano samples, once loaded (null before the first tap)
export const pianoSamples = () => pianoBufs;
// Silence every piano note now (stops a recording's playback)
export function stopPiano() { if (piano) piano.releaseAll(); }

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
  busy(2700); // samples are trimmed to 2.5s, so a held note is silent by then
  if (held[m]) piano.triggerRelease(toNote(m));
  held[m] = true;
  piano.triggerAttack(toNote(m), undefined, vel);
}
export function noteUp(m) {
  if (!piano || !held[m]) return;
  held[m] = false;
  piano.triggerRelease(toNote(m), Tone.now() + 0.05);
  busy(1400); // the note still rings for its release; don't let the mic hear it as a second press
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

// Talking chicken. Lines are pre-recorded with a natural voice (tools/voice, clips in dist/voice);
// anything without a clip falls back to the device's built-in speech.
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
const clips = new Map(); // line id -> Promise<AudioBuffer>
function clip(text) {
  const id = lineId(text);
  if (!VOICE.has(id)) return null;
  if (!clips.has(id)) {
    const p = fetch(`voice/${id}.mp3`)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((b) => Tone.getContext().rawContext.decodeAudioData(b));
    p.catch(() => clips.delete(id));
    clips.set(id, p);
  }
  return clips.get(id);
}
// Fetch clips ahead of time so the chicken answers right away (e.g. every line of a lesson).
export function preloadVoice(lines) { lines.flat().forEach((t) => t && clip(t)); }

let talkId = 0; // only the newest sentence may un-mute the mic when it ends
let talking = null; // the clip that is playing now
// text is a sentence or a list of sentences (played back to back).
// onEnd runs when the chicken stops talking (or about when it should have, if speech is missing).
export function say(text, onEnd) {
  const parts = [].concat(text || []).filter(Boolean);
  let done = false;
  const finish = () => { if (!done) { done = true; onEnd && onEnd(); } };
  if (!parts.length) { setTimeout(finish, 0); return; }
  stopTalking();
  const id = ++talkId;
  // Short mute while the clip loads; the full length is set once playback (or device speech) starts,
  // so a device that never speaks doesn't leave the mic deaf.
  busy(1200);
  const loads = started && Tone.getContext().state === 'running' ? parts.map(clip) : [];
  if (loads.length && loads.every(Boolean)) {
    Promise.all(loads).then((bufs) => {
      if (id !== talkId) return finish();
      const ctx = Tone.getContext().rawContext;
      const out = ctx.createGain();
      out.connect(ctx.destination);
      let t = ctx.currentTime + 0.03;
      const srcs = bufs.map((b) => {
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(out);
        s.start(t);
        t += b.duration + 0.25;
        return s;
      });
      const ms = (t - ctx.currentTime) * 1000;
      busy(ms);
      const end = () => { if (talking && talking.id === id) talking = null; if (id === talkId) busy(300, true); setTimeout(finish, 250); };
      srcs[srcs.length - 1].onended = end;
      talking = { id, stop: () => { srcs.forEach((s) => { s.onended = null; try { s.stop(); } catch (e) {} }); out.disconnect(); end(); } };
    }).catch(() => { if (id === talkId) speak(parts.join(' '), id, finish); else finish(); });
  } else {
    speak(parts.join(' '), id, finish);
  }
}
// Device voices read a lone capital letter as "capital C", so spell note names out.
const LETTER_SOUND = { A: 'ay', B: 'bee', C: 'see', D: 'dee', E: 'ee', F: 'eff', G: 'gee' };
export const speakable = (text) => text
  .replace(/\b([B-G])\b(?!['’])/g, (_, l) => LETTER_SOUND[l])
  .replace(/\bA\b(?=,|\.|!|\?| sharp\b(?! sign)| flat\b(?! sign)| and\b|$)/g, 'ay')
  .replace(/♯/g, ' sharp').replace(/♭/g, ' flat');
function speak(text, id, finish) {
  if (!window.speechSynthesis) { setTimeout(finish, 300); return; }
  text = speakable(text);
  const est = 600 + text.length * 70;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.pitch = 1.35;
    // Mute the mic while the chicken talks. Only a short mute until speech actually starts: if the device
    // never speaks (no voice, blocked), the mic shouldn't stay deaf for the whole sentence.
    busy(1200);
    u.onstart = () => { if (id === talkId) busy(est); };
    u.onend = () => { if (id === talkId) busy(300, true); setTimeout(finish, 250); };
    speechSynthesis.speak(u);
    setTimeout(finish, est * 1.6 + 1500); // iOS sometimes never fires onend
  } catch (e) { setTimeout(finish, 300); }
}
export function stopTalking() {
  if (talking) talking.stop();
  try { if (window.speechSynthesis && speechSynthesis.speaking) { speechSynthesis.cancel(); busy(300, true); } } catch (e) {}
}

// Metronome: a soft chicken peck on every beat. The peck is a burst of hiss above every piano note
// (src/beat.js PECK), and the mic is told exactly when each one plays, so it never counts as a key.
// bpm: quarter beats a minute; every: quarter beats between pecks; accent(k): true for a louder peck
// onBeat(k, ms): runs at each peck (for the bouncing chicken). Returns { t0, stop } where t0 is the
// performance.now() time of peck 0.
let peckBuf = null;
export function startBeat({ bpm, every = 1, accent = (k) => k % 4 === 0, onBeat, sound = true, lead = 0.25 }) {
  const ctx = Tone.getContext().rawContext;
  if (!peckBuf) {
    const n = Math.round(ctx.sampleRate * PECK.len);
    peckBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = peckBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * PECK.decay));
  }
  const gap = (60 / bpm) * every;
  const a0 = ctx.currentTime + lead;
  // performance.now() time when peck 0 is heard (the speaker's own delay included where the browser knows it)
  const p0 = performance.now() + (lead + (ctx.outputLatency || 0)) * 1000;
  let k = 0;
  const timers = [];
  const pump = () => {
    // schedule the pecks due in the next 150 ms on the audio clock (steady even if the page is busy)
    while (a0 + k * gap < ctx.currentTime + 0.15) {
      const a = a0 + k * gap, p = p0 + k * gap * 1000, kk = k;
      if (sound && a >= ctx.currentTime) {
        const src = ctx.createBufferSource();
        src.buffer = peckBuf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = PECK.hz;
        hp.Q.value = 0.9;
        const g = ctx.createGain();
        g.gain.value = accent(kk) ? 0.5 : 0.5 * PECK.soft;
        src.connect(hp).connect(g).connect(ctx.destination);
        src.start(a);
        listeners.peck.forEach((f) => f(p));
      }
      timers.push(setTimeout(() => onBeat && onBeat(kk, p), Math.max(0, p - performance.now())));
      k++;
    }
    while (timers.length > 8) timers.shift();
  };
  pump();
  const iv = setInterval(pump, 30);
  return { t0: p0, gap: gap * 1000, stop: () => { clearInterval(iv); timers.forEach(clearTimeout); } };
}

export { Tone };
