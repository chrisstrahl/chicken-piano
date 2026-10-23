// Recording a performance: every played note (screen keys, microphone or a MIDI keyboard) with its timing,
// so it can be played back, drawn as music, saved per player and turned into an audio file to share.
// No DOM in here except renderAudio (needs Web Audio), so the logic can be tested in node.
import { BEATS, letterOf, isBlack } from './music.ts';
import type { RecNote, Recording, NoteSource } from './types.ts';

export const MAX_MS = 5 * 60 * 1000; // a recording stops by itself after 5 minutes
const MIC_HOLD = 1500; // the mic hears a key go down but not up: a heard note rings until the next one, at most this long
const LEAD = 300; // silence kept before the first note

// A note is [start ms, midi, length ms, velocity 0..1]
export function makeRecorder(now = () => performance.now()) {
  let t0: number | null = null;
  let notes: RecNote[] = [];
  let open = new Map<number, RecNote>(); // midi -> note still held down
  let micNote: RecNote | null = null;
  const t = () => now() - t0!;
  const close = (n: RecNote, at: number, cap = Infinity) => { n[2] = Math.max(40, Math.min(at - n[0], cap)); };
  return {
    get on() { return t0 !== null; },
    get ms() { return t0 === null ? 0 : t(); },
    get count() { return notes.length; },
    start() { t0 = now(); notes = []; open = new Map(); micNote = null; },
    down(m: number, source: NoteSource, vel = 0.8) {
      if (t0 === null) return;
      const at = t();
      if (micNote) { close(micNote, at, MIC_HOLD); micNote = null; }
      if (open.has(m)) close(open.get(m)!, at);
      const n: RecNote = [at, m, 0, Math.round(Math.max(0.05, Math.min(1, vel)) * 100) / 100];
      notes.push(n);
      if (source === 'mic') micNote = n; else open.set(m, n);
    },
    up(m: number) {
      if (t0 === null || !open.has(m)) return;
      close(open.get(m)!, t());
      open.delete(m);
    },
    // Ends the recording and returns its notes, starting LEAD ms in (or null if nothing was played).
    // Keys still down (the last note of a song, say) ring a little longer than the stop.
    stop(): RecNote[] | null {
      if (t0 === null) return null;
      const at = t();
      if (micNote) close(micNote, Infinity, MIC_HOLD);
      open.forEach((n) => close(n, Math.max(at, n[0] + 600), 2500));
      t0 = null;
      if (!notes.length) return null;
      const shift = notes[0][0] - LEAD;
      return notes.map(([s, m, d, v]): RecNote => [Math.round(s - shift), m, Math.round(d), v]);
    },
  };
}

export const lengthMs = (notes: RecNote[]): number => (notes.length ? Math.max(...notes.map((n) => n[0] + n[2])) : 0);

/* ---------- notation ---------- */
// Children play at their own speed, so count the beat from the playing: the usual time between notes is one beat.
export function guessTempo(notes: RecNote[]): number {
  const starts = notes.map((n) => n[0]).sort((a, b) => a - b).filter((s, i, a) => i === 0 || s - a[i - 1] >= 70); // a chord is one start
  const gaps = starts.slice(1).map((s, i) => s - starts[i]).sort((a, b) => a - b);
  if (gaps.length < 2) return 90;
  // the lower middle gap: pauses and long notes shouldn't slow the count down
  return Math.round(Math.max(50, Math.min(150, 60000 / gaps[Math.floor((gaps.length - 1) / 2)])));
}

const VALUES: [number, string][] = [[0.5, '8'], [1, 'q'], [1.5, 'qd'], [2, 'h'], [3, 'hd'], [4, 'w']];
// the written length closest to a number of beats
export function noteValue(beats: number): string {
  let best = VALUES[0];
  for (const v of VALUES) if (Math.abs(Math.log(beats / v[0])) < Math.abs(Math.log(beats / best[0]))) best = v;
  return best[1];
}
// rests for a gap (at most one bar of them, so a long pause doesn't fill the page)
function restTokens(beats: number) {
  const out: string[] = [];
  beats = Math.min(beats, 4);
  while (beats >= 0.375) {
    const v = [...VALUES].reverse().find(([b]) => b <= beats + 0.25) || VALUES[0];
    out.push(`R:${v[1]}`);
    beats -= v[0];
  }
  return out;
}
const pitchToken = (m: number) => `${letterOf(m)}${isBlack(m) ? '#' : ''}${Math.floor(m / 12) - 1}`;

// Recorded notes -> note tokens for parse() (keys pressed together become a chord; pauses become rests).
// index[j] is the written note for recorded note j, so playback can move along the music.
export function toTokens(notes: RecNote[], tempo = 90): { tokens: string; index: number[] } {
  const beat = 60000 / tempo;
  const sorted = notes.map((n, j) => ({ n, j })).sort((a, b) => a.n[0] - b.n[0]);
  const groups: { t: number; items: { n: RecNote; j: number }[] }[] = [];
  for (const x of sorted) {
    const g = groups[groups.length - 1];
    if (g && x.n[0] - g.t < 70) g.items.push(x); else groups.push({ t: x.n[0], items: [x] });
  }
  const tokens: string[] = [];
  const index: number[] = [];
  groups.forEach((g, i) => {
    const next = groups[i + 1];
    const held = Math.max(...g.items.map((x) => x.n[2]));
    const gap = next ? next.t - g.t : held;
    const ms = [...new Set(g.items.map((x) => x.n[1]))].sort((a, b) => a - b);
    const pause = next && gap > held + beat * 0.75;
    g.items.forEach((x) => { index[x.j] = tokens.length; });
    tokens.push(`${ms.map(pitchToken).join('+')}:${noteValue((pause ? held : gap) / beat)}`);
    if (pause) tokens.push(...restTokens((gap - held) / beat));
  });
  return { tokens: tokens.join(' '), index };
}

/* ---------- saved recordings, per player ---------- */
export const STORE_KEY = 'chicken-piano-recordings-v1';
export const MAX_SAVED = 30; // per player; the oldest goes when a new one comes
type Store = Pick<Storage, 'getItem' | 'setItem'>;
type All = Record<string, Recording[]>;
function readAll(storage: Store): All { try { return JSON.parse(storage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { return {}; } }
function writeAll(storage: Store, all: All) { try { storage.setItem(STORE_KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
export function listRecordings(pid: string, storage: Store = localStorage): Recording[] { return readAll(storage)[pid] || []; }
// Newest first. Returns false if the device is out of room.
export function saveRecording(pid: string, rec: Recording, storage: Store = localStorage): boolean {
  const all = readAll(storage);
  const mine = [rec, ...(all[pid] || []).filter((r) => r.id !== rec.id)];
  all[pid] = mine.slice(0, MAX_SAVED);
  while (!writeAll(storage, all)) {
    if (all[pid].length <= 1) return false;
    all[pid].pop();
  }
  return true;
}
export function deleteRecording(pid: string, id: string, storage: Store = localStorage) {
  const all = readAll(storage);
  all[pid] = (all[pid] || []).filter((r) => r.id !== id);
  writeAll(storage, all);
}
// A grown-up removed a player: their recordings go too
export function deletePlayerRecordings(pid: string, storage: Store = localStorage) {
  const all = readAll(storage);
  delete all[pid];
  writeAll(storage, all);
}

/* ---------- audio file ---------- */
// mono float samples -> 16-bit PCM .wav (plays on iPhones, Android phones and computers)
export function encodeWav(samples: ArrayLike<number>, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

const NOTE_M: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const sampleMidi = (name: string) => { const [, p, o] = name.match(/^([A-G]#?)(\d)$/)!; return 12 * (+o + 1) + NOTE_M[p]; };

// Plays the notes through the app's own piano samples (the clean sound, even when the mic did the listening)
// in an offline audio context. samples: { 'C4': AudioBuffer, ... }. Returns a .wav Blob.
export async function renderAudio(notes: RecNote[], samples: Record<string, AudioBuffer>, sampleRate = 44100): Promise<Blob> {
  const banks = Object.entries(samples).map(([name, b]) => ({ m: sampleMidi(name), b }));
  const end = lengthMs(notes) / 1000 + 1.6;
  // older Safari only has the webkit-prefixed one
  const Ctx: typeof OfflineAudioContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const ctx = new Ctx(1, Math.ceil(end * sampleRate), sampleRate);
  for (const [t, m, d, v] of notes) {
    const bank = banks.reduce((a, b) => (Math.abs(b.m - m) < Math.abs(a.m - m) ? b : a));
    const src = ctx.createBufferSource();
    src.buffer = bank.b;
    src.playbackRate.value = Math.pow(2, (m - bank.m) / 12);
    const g = ctx.createGain();
    const s = t / 1000;
    const off = s + d / 1000;
    g.gain.setValueAtTime(v * 0.7, s);
    g.gain.setValueAtTime(v * 0.7, off);
    g.gain.setTargetAtTime(0, off, 0.25); // the release, like the on-screen piano's
    src.connect(g).connect(ctx.destination);
    src.start(s);
    src.stop(Math.min(end, off + 1.5));
  }
  const out = await new Promise<AudioBuffer>((res, rej) => {
    ctx.oncomplete = (e) => res(e.renderedBuffer);
    const p = ctx.startRendering();
    if (p && p.then) p.then(res, rej);
  });
  const data = out.getChannelData(0);
  // even out the loudness: big chords don't clip, a soft performance isn't too quiet
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const gain = peak > 0 ? Math.min(3, 0.89 / peak) : 1;
  for (let i = 0; i < data.length; i++) data[i] *= gain;
  return new Blob([encodeWav(data, sampleRate)], { type: 'audio/wav' });
}
