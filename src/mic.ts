// Microphone listening: getUserMedia + Tone.Analyser capture audio; NoteListener (listener.js) decides
// when a key was pressed and which note it was.
//
// Turning the ears "off" only pauses listening. The microphone stream stays open, because closing and
// reopening it on iPad/iPhone Safari can leave the new stream silent.
import { NoteListener } from './listener.js';
import { Tone, onBusy, onPeck } from './audio.js';
import { peckMask } from './beat.js';

const SIZE = 4096;
type MicHandlers = { onNote: (m: number) => void; onLevel: (level: number, sinceLoud?: number) => void };
const state: {
  open: boolean; listening: boolean; opening: Promise<void> | null; stream: MediaStream | null;
  source: MediaStreamAudioSourceNode | null; analyser: InstanceType<typeof Tone.Analyser> | null; listener: NoteListener | null;
  timer: ReturnType<typeof setInterval> | undefined; ignoreUntil: number; expectPc: number | null;
  onNote: MicHandlers['onNote'] | null; onLevel: MicHandlers['onLevel'] | null; pecks: number[]; lastLoud: number;
} = {
  open: false, listening: false, opening: null, stream: null, source: null, analyser: null, listener: null, timer: undefined,
  ignoreUntil: 0, expectPc: null, onNote: null, onLevel: null, pecks: [], lastLoud: 0,
};

onBusy((ms: number, exact?: boolean) => {
  const t = performance.now() + ms;
  state.ignoreUntil = exact ? t : Math.max(state.ignoreUntil, t);
});
// Metronome pecks: the listener keeps listening (keys are played on the beat!) but knows the hiss is ours.
onPeck((t: number) => { state.pecks.push(t); if (state.pecks.length > 16) state.pecks.shift(); });

export const micSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
export const micOn = () => state.listening;
// when the key of the latest heard note was struck (performance.now() ms)
let heardAt = 0;
export const lastHeardAt = () => heardAt;

// The note the app is waiting for (MIDI number), or null. Lets the listener confirm quiet notes.
export function expectNote(m: number | null | undefined) { state.expectPc = m == null ? null : ((m % 12) + 12) % 12; }

async function open() {
  if (!micSupported()) throw new Error('unsupported');
  // Raw input: no echo cancelling, noise suppression or automatic gain. The browser's auto gain squashes a key's
  // attack and swells the room noise between notes; the listener does its own steady gain instead.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = Tone.getContext();
  const source = (ctx.rawContext as AudioContext).createMediaStreamSource(stream);
  const analyser = state.analyser || new Tone.Analyser('waveform', SIZE);
  Tone.connect(source, analyser);
  state.stream = stream;
  state.source = source;
  state.analyser = analyser;
  state.open = true;
}
function close() {
  try { state.source && state.source.disconnect(); } catch (e) {}
  try { state.stream && state.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
  state.open = false;
}

export async function startMic({ onNote, onLevel }: MicHandlers) {
  state.onNote = onNote;
  state.onLevel = onLevel;
  if (state.listening) return;
  if (!state.open) {
    state.opening = state.opening || open().finally(() => { state.opening = null; });
    await state.opening;
  }
  if (Tone.getContext().state !== 'running') await Tone.getContext().resume();
  state.listener = new NoteListener(SIZE); // fresh start: forget the old noise level and last note
  state.lastLoud = performance.now();
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

// Watchdog. iOS can "interrupt" the audio context or mute/end the mic track, most often when the chicken
// starts talking (songs and lessons speak as they open; free play doesn't). Then the analyser either stops
// updating (the meter freezes on its last level) or reads silence, and no notes register. Spot that and
// reopen the microphone.
let lastCheck = 0;
let reopening = false;
const health = { sig: NaN, staleSince: 0, silentSince: 0, mutedSince: 0, lastFix: 0, fixes: 0 };
function watchdog(now: number, buf: Float32Array | null) {
  // a frozen graph hands back the very same samples every time
  const sig = buf ? buf[0] + buf[517] * 3 + buf[1999] * 7 + buf[buf.length - 1] * 11 : NaN;
  const frozen = sig === health.sig;
  health.sig = sig;
  health.staleSince = frozen ? health.staleSince || now : 0;
  let peak = 0;
  if (buf) for (let i = 0; i < buf.length; i += 16) peak = Math.max(peak, Math.abs(buf[i]));
  health.silentSince = peak < 1e-7 ? health.silentSince || now : 0;
  const track = state.stream && state.stream.getAudioTracks()[0];
  health.mutedSince = track && track.muted ? health.mutedSince || now : 0;

  if (now - lastCheck < 500 || reopening) return;
  lastCheck = now;
  const ctx = Tone.getContext();
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  const stuck = (since: number, ms: number) => since && now - since > ms;
  const broken = !track || track.readyState === 'ended' || stuck(health.mutedSince, 1500)
    || stuck(health.staleSince, 1200) || stuck(health.silentSince, 2500);
  if (broken && now - health.lastFix > 3000) {
    health.lastFix = now;
    health.fixes++;
    health.staleSince = health.silentSince = health.mutedSince = 0;
    reopening = true;
    close();
    open().then(() => ctx.resume()).catch((e) => console.warn('mic reopen failed', e)).finally(() => { reopening = false; });
  }
}
export const micHealth = () => ({ ...health, ctx: Tone.getContext().state, open: state.open });

function tick() {
  const now = performance.now();
  if (!state.open) { watchdog(now, null); return; }
  const buf = state.analyser!.getValue() as Float32Array;
  watchdog(now, buf);
  const listener = state.listener!;
  const r = listener.process(buf, Tone.getContext().sampleRate, now, now < state.ignoreUntil, state.expectPc, peckMask(state.pecks, now));
  // meter: how far above the room's noise, on a log scale (30x above noise = full), so a quiet but usable
  // signal still reads mid-meter. lastLoud lets the app say "come closer" if nothing is ever loud enough.
  const over = r.rms / Math.max(listener.noise, 1e-6);
  if (over > 4) state.lastLoud = now;
  state.onLevel && state.onLevel(Math.max(0, Math.min(1, Math.log(over) / Math.log(30))), now - state.lastLoud);
  if (r.midi !== null) { heardAt = r.at ?? now; state.onNote && state.onNote(r.midi); }
}
