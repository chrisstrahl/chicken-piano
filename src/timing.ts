// When a played key was really struck, on the performance.now() clock.
//
// Each kind of input arrives a little after the key went down: the mic needs a few frames to be sure of a
// note, a USB keyboard's message passes through the browser (or a MIDI-browser app), and a busy page
// handles a tap a moment late. Every input stamps its own strike time, and struckAt() uses that.
// What's left (the speaker's and the mic's own delay, which iPad Safari doesn't always report) is measured
// once per device by the grown-ups' tap-along check (hold 🥁 in free play for 2 seconds) and kept here.
import type { NoteSource } from './types.ts';
import { lastHeardAt } from './mic.js';
import { MIC_LAG } from './beat.js';

const KEY = 'chicken-piano-lag';
type Lags = Partial<Record<NoteSource, number>>;
function load(): Lags {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
}
let lags: Lags = load();
export const lagOf = (source: NoteSource) => lags[source] || 0;
export function setLag(source: NoteSource, ms: number) {
  lags = { ...lags, [source]: Math.round(ms) };
  try { localStorage.setItem(KEY, JSON.stringify(lags)); } catch (e) {}
}

// strike times stamped by the inputs themselves (event timestamps)
let tapAt = 0, midiAt = 0;
export const markTap = (t: number) => { tapAt = t; };
export const markMidi = (t: number) => { midiAt = t; };

// A stamp is used only if it is recent and on this clock (some MIDI-browser apps stamp 0 or wall-clock time).
const fresh = (t: number, now: number, fallback: number) => (t > 0 && t <= now + 5 && now - t < 400 ? Math.min(t, now) : now - fallback);
// raw: without this device's calibration (what the tap-along check measures)
export function struckAt(source: NoteSource, raw = false, now = performance.now()): number {
  const t = source === 'mic' ? fresh(lastHeardAt(), now, MIC_LAG) : fresh(source === 'midi' ? midiAt : tapAt, now, 0);
  return raw ? t : t - lagOf(source);
}
