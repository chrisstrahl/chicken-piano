// Microphone listening: Tone.UserMedia + Tone.Analyser for audio, Pitchy (McLeod pitch method) for pitch.
// Adds simple onset logic so repeated notes (C C C C) each count once.
import { PitchDetector } from 'pitchy';
import { Tone, onBusy } from './audio.js';

const SIZE = 2048;
const state = {
  on: false, media: null, analyser: null, detector: null, timer: null,
  ignoreUntil: 0, armed: true, lastMidi: null, stable: 0, lastAccept: 0, lastPc: -1,
  noise: 0.004, recent: [], onNote: null, onLevel: null,
};

onBusy((ms) => { state.ignoreUntil = Math.max(state.ignoreUntil, performance.now() + ms); });

export const micSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
export const micOn = () => state.on;

export async function startMic({ onNote, onLevel }) {
  state.onNote = onNote;
  state.onLevel = onLevel;
  if (state.on) return;
  if (!micSupported()) throw new Error('unsupported');
  const media = new Tone.UserMedia();
  await media.open(); // Tone turns off echo cancellation / noise suppression for us
  const analyser = new Tone.Analyser('waveform', SIZE);
  media.connect(analyser);
  state.media = media;
  state.analyser = analyser;
  state.detector = PitchDetector.forFloat32Array(SIZE);
  state.on = true;
  state.timer = setInterval(tick, 40);
}

export function stopMic() {
  if (!state.on) return;
  clearInterval(state.timer);
  state.media.close();
  state.media.dispose();
  state.analyser.dispose();
  state.on = false;
}

function tick() {
  const buf = state.analyser.getValue();
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  const now = performance.now();

  // adaptive noise floor: drifts down quickly, up slowly
  state.noise = rms < state.noise ? state.noise * 0.8 + rms * 0.2 : state.noise * 0.998 + rms * 0.002;
  const gate = Math.max(0.006, state.noise * 2.5);
  state.onLevel && state.onLevel(Math.min(1, rms / 0.12));

  // onset: a sudden jump in loudness means a new key press (even the same key again)
  const minRecent = state.recent.length ? Math.min(...state.recent) : 0;
  state.recent.push(rms);
  if (state.recent.length > 4) state.recent.shift();
  if (rms > gate * 1.5 && rms > minRecent * 1.4 && now - state.lastAccept > 150) state.armed = true;

  if (rms < gate) { state.armed = true; state.stable = 0; state.lastMidi = null; return; }
  if (now < state.ignoreUntil) { state.stable = 0; return; }

  const [freq, clarity] = state.detector.findPitch(buf, Tone.getContext().sampleRate);
  if (clarity < 0.88 || freq < 60 || freq > 2100) { state.stable = 0; return; }
  const midiF = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.round(midiF);
  if (Math.abs(midiF - midi) > 0.4) return;

  state.stable = midi === state.lastMidi ? state.stable + 1 : 1;
  state.lastMidi = midi;
  if (state.stable < 2) return;
  if (!state.armed && midi % 12 !== state.lastPc) state.armed = true; // moved to a different note
  if (state.armed && now - state.lastAccept > 130) {
    state.armed = false;
    state.lastAccept = now;
    state.lastPc = midi % 12;
    state.recent = [rms];
    state.onNote && state.onNote(midi);
  }
}
