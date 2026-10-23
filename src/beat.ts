// The metronome's sound and timing rules, shared by the app (audio.js, mic.js) and the offline test
// (test/metronome.mjs). No Web Audio here.
//
// The tick is a chicken peck: a very short burst of hiss above every piano note the songs use, so it has
// no pitch for the listener to mistake for a key. The mic is still told when each peck plays (peckMask),
// and while one is in its listening window it only looks at the low, piano part of the sound.
import type { Note } from './types.ts';

export const PECK = {
  hz: 5000, // high-pass corner: nothing below this
  decay: 0.004, // seconds for the burst to fall to 1/e
  len: 0.03, // seconds of sound
  soft: 0.55, // off-beats are this loud next to beat 1
};
// The listener reads the newest ~85 ms of sound, and the speaker reaches the mic a little late,
// so a peck can be in its window from just before it was scheduled to ~150 ms after.
export const PECK_BEFORE = 20;
export const PECK_AFTER = 190;
// times: ms (same clock as now) of pecks played or about to play
export const peckMask = (times: number[], now: number): boolean => times.some((t) => now >= t - PECK_BEFORE && now <= t + PECK_AFTER);

/* ---------- timing: play with the beat, echo phrases ---------- */
// Note lengths in quarter-note beats (same as music.js BEATS; repeated so this file has no imports).
const LEN: Record<string, number> = { 8: 0.5, q: 1, qd: 1.5, h: 2, hd: 3, w: 4 };
const len = (n: Note) => LEN[n.d] || 1;
// quarter beats in one bar, and how far apart the metronome pecks (6/8 pecks on each dotted quarter)
export const barBeats = (time = '4/4'): number => (+time.split('/')[0] * 4) / +time.split('/')[1];
export const peckEvery = (time = '4/4'): number => (time === '6/8' ? 1.5 : 1);
// Speeds the kid can pick: snail, turtle, bunny.
export const SPEEDS = [0.5, 0.75, 1];

// When each note starts, in beats from the first note. Rests and the tied-on half of a note get no key
// press, so they are left out (play: false) but still take their time.
export interface TimelineItem { i: number; at: number; len: number; play: boolean }
export function timeline(notes: Note[]): TimelineItem[] {
  let at = 0;
  return notes.map((n, i) => {
    const prev = notes[i - 1];
    const t = { i, at, len: len(n), play: !n.r && !(prev && !prev.r && prev.tie) };
    at += t.len;
    return t;
  });
}

// The mic hears a key about this long after it was struck (the listener needs a steady pitch for a few frames).
export const MIC_LAG = 160;

// Scores a play-along: each note has a moment it should be played. Feed key presses with input() and the
// clock with tick(); notes nobody played turn into misses once their moment is well past.
export type Grade = 'good' | 'early' | 'late' | 'wrong';
type Result = Grade | 'miss' | null;
type JudgeItem = TimelineItem & { t: number; result: Result };

export class BeatJudge {
  notes: Note[];
  beatMs: number;
  items: JudgeItem[];
  onTime: number;
  // notes: parsed song notes; beatMs: ms per quarter beat at the chosen speed; start: ms of the first note
  constructor(notes: Note[], beatMs: number, start: number) {
    this.notes = notes;
    this.beatMs = beatMs;
    this.items = timeline(notes).filter((t) => t.play).map((t) => ({ ...t, t: start + t.at * beatMs, result: null }));
    // "right on the beat": generous for small hands, wider at slow speeds
    this.onTime = Math.max(170, beatMs * 0.3);
  }
  // how long after a note's moment it can still be played (a little late), but never past the next note's moment
  window(k: number): [number, number] {
    const it = this.items[k], nx = this.items[k + 1];
    const late = Math.max(this.onTime, this.beatMs * 0.6);
    return [it.t - Math.max(this.onTime, this.beatMs * 0.5), nx ? Math.min(it.t + late, (it.t + nx.t) / 2 + this.onTime / 2) : it.t + late];
  }
  // m: MIDI number played; at: when it was struck (ms, already corrected for mic lag)
  // returns { k, grade } with grade 'good' (on the beat), 'early', 'late' or 'wrong'; null if no note was due
  input(m: number, at: number): { k: number; grade: Grade; dt?: number } | null {
    const pc = (x: number) => ((x % 12) + 12) % 12;
    const open = this.items.map((_, k) => k).filter((k) => !this.items[k].result && at >= this.window(k)[0] && at <= this.window(k)[1]);
    if (!open.length) return null;
    const k = open.find((j) => this.notes[this.items[j].i].keys.some((x) => pc(x.m) === pc(m)));
    if (k === undefined) return { k: open[0], grade: 'wrong' };
    // anything still waiting before it was skipped
    for (let j = 0; j < k; j++) if (!this.items[j].result) this.items[j].result = 'miss';
    const dt = at - this.items[k].t;
    const grade = Math.abs(dt) <= this.onTime ? 'good' : dt < 0 ? 'early' : 'late';
    this.items[k].result = grade;
    return { k, grade, dt };
  }
  // returns the notes that just became misses (list of item indexes)
  tick(now: number): number[] {
    const out: number[] = [];
    this.items.forEach((it, k) => { if (!it.result && now > this.window(k)[1]) { it.result = 'miss'; out.push(k); } });
    return out;
  }
  // the item whose moment is now or next
  current(now: number): number | null { const k = this.items.findIndex((it, j) => !it.result && now <= this.window(j)[1]); return k < 0 ? null : k; }
  get done() { return this.items.every((it) => it.result); }
  get end() { const last = this.items[this.items.length - 1]; return last ? this.window(this.items.length - 1)[1] : 0; }
  // eggs: on the beat counts 1, a bit early or late counts half, misses count nothing
  eggs(): number {
    const pts = this.items.reduce((a, it) => a + (it.result === 'good' ? 1 : it.result === 'early' || it.result === 'late' ? 0.5 : 0), 0);
    const share = this.items.length ? pts / this.items.length : 1;
    return share >= 0.85 ? 3 : share >= 0.5 ? 2 : 1;
  }
  counts() {
    const c = { good: 0, early: 0, late: 0, miss: 0 };
    this.items.forEach((it) => { if (it.result && it.result !== 'wrong') c[it.result]++; });
    return c;
  }
}

// Echo mode: cut a song into short phrases (one or two bars) for the chicken to play and the kid to copy.
// Returns [start, end) note-index pairs. A phrase takes more bars (up to four) while it has fewer than
// MIN_NOTES key presses, and never more than MAX_NOTES presses unless one bar alone has that many.
const MIN_NOTES = 4, MAX_NOTES = 8;
export function phrases(notes: Note[], { time = '4/4', pickup = 0 } = {}): [number, number][] {
  const per = barBeats(time);
  const tl = timeline(notes);
  // split into bars (the pickup is its own little bar, glued to the first full bar below)
  const bars: number[][] = [];
  let cur: number[] = [];
  let edge = pickup > 0 ? pickup : per;
  tl.forEach((t) => {
    if (t.at >= edge - 1e-6 && cur.length) { bars.push(cur); cur = []; while (t.at >= edge - 1e-6) edge += per; }
    cur.push(t.i);
  });
  if (cur.length) bars.push(cur);
  const presses = (b: number[]) => b.filter((i) => tl[i].play).length;
  if (pickup > 0 && bars.length > 1) bars.splice(0, 2, [...bars[0], ...bars[1]]);
  const out: number[][] = [];
  for (let b = 0; b < bars.length; b++) {
    let ph = [...bars[b]];
    for (let n = 1; n < 4 && presses(ph) < MIN_NOTES && bars[b + 1] && presses(ph) + presses(bars[b + 1]) <= MAX_NOTES; n++) ph = ph.concat(bars[++b]);
    out.push(ph);
  }
  // a last scrap (fewer than two presses) joins the phrase before it
  if (out.length > 1 && presses(out[out.length - 1]) < 2) { const last = out.pop()!; out[out.length - 1] = out[out.length - 1].concat(last); }
  // phrases that are only rests (shouldn't happen) are dropped; leading/trailing rests stay inside a phrase
  return out.filter((p) => presses(p) > 0).map((p): [number, number] => [p[0], p[p.length - 1] + 1]);
}
