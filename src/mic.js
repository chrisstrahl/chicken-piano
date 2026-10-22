// Microphone listening: Tone.UserMedia + Tone.Analyser capture audio; NoteListener (listener.js) decides
// when a key was pressed and which note it was.
//
// Turning the ears "off" only pauses listening. The microphone stream stays open, because closing and
// reopening it on iPad/iPhone Safari can leave the new stream silent.
import { NoteListener } from './listener.js';
import { Tone, onBusy } from './audio.js';

const SIZE = 4096;
const state = {
  open: false, listening: false, opening: null, media: null, analyser: null, listener: null, timer: null,
  ignoreUntil: 0, expectPc: null, onNote: null, onLevel: null,
};

onBusy((ms, exact) => {
  const t = performance.now() + ms;
  state.ignoreUntil = exact ? t : Math.max(state.ignoreUntil, t);
});

export const micSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
export const micOn = () => state.listening;

// The note the app is waiting for (MIDI number), or null. Lets the listener confirm quiet notes.
export function expectNote(m) { state.expectPc = m == null ? null : ((m % 12) + 12) % 12; }

async function open() {
  if (!micSupported()) throw new Error('unsupported');
  const media = new Tone.UserMedia();
  await media.open(); // Tone turns off echo cancellation / noise suppression for us
  const analyser = state.analyser || new Tone.Analyser('waveform', SIZE);
  media.connect(analyser);
  state.media = media;
  state.analyser = analyser;
  state.open = true;
}

export async function startMic({ onNote, onLevel }) {
  state.onNote = onNote;
  state.onLevel = onLevel;
  if (state.listening) return;
  if (!state.open) {
    state.opening = state.opening || open().finally(() => { state.opening = null; });
    await state.opening;
  }
  if (Tone.getContext().state !== 'running') await Tone.getContext().resume();
  state.listener = new NoteListener(SIZE); // fresh start: forget the old noise level and last note
  state.listening = true;
  clearInterval(state.timer);
  state.timer = setInterval(tick, 40);
}

export function stopMic() {
  state.listening = false;
  clearInterval(state.timer);
  state.onLevel && state.onLevel(0);
}

// iPad Safari suspends audio when the app goes to the background; wake it up again on return.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.listening && Tone.getContext().state !== 'running') {
    Tone.getContext().resume().catch(() => {});
  }
});

// Watchdog. After a while iOS can "interrupt" the audio context (speech, the screen dimming, another app's sound)
// or end the microphone track. Both leave the analyser reading silence forever, so check every second and repair.
let lastCheck = 0;
let reopening = false;
function watchdog(now) {
  if (now - lastCheck < 1000 || reopening) return;
  lastCheck = now;
  const ctx = Tone.getContext();
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  const stream = state.media && state.media._stream;
  const track = stream && stream.getAudioTracks()[0];
  if (!track || track.readyState === 'ended') {
    reopening = true;
    try { state.media.close(); } catch (e) {}
    state.media.dispose();
    state.open = false;
    open().catch((e) => console.warn('mic reopen failed', e)).finally(() => { reopening = false; });
  }
}

function tick() {
  const now = performance.now();
  watchdog(now);
  if (!state.open) return;
  const buf = state.analyser.getValue();
  const r = state.listener.process(buf, Tone.getContext().sampleRate, now, now < state.ignoreUntil, state.expectPc);
  state.onLevel && state.onLevel(Math.min(1, r.rms / 0.08));
  if (r.midi !== null) state.onNote && state.onNote(r.midi);
}
