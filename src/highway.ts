// The note lane ("guitar hero" view): while a piece is played in time, each note falls down its key's
// column and reaches the line on top of the keyboard at the moment it should be played. A bar's height is
// how long the note lasts, the faint lines going by are the beats (thick ones start a bar), and a note
// that was hit lights up and sinks into its key; a missed one turns grey.
//
// It only draws: the timing (when note 0 is due, ms per beat) comes from whoever started the beat, on the
// same performance.now() clock as BeatJudge, so the picture and the scoring always agree.
import { COLORS, letterOf, isBlack, BEATS } from './music.js';
import type { Note } from './types.ts';
type Sounding = Extract<Note, { m: number }>;
import type { Keyboard } from './keyboard.ts';

export type LaneResult = 'good' | 'early' | 'late' | 'miss' | 'wrong' | null | undefined;
export interface LaneRun {
  notes: Note[]; // what is played (rests take their time, tied-on halves lengthen the note before)
  start: number; // performance.now() when notes[0] is due
  beatMs: number; // ms per quarter beat
  per?: number; // quarter beats in a bar (bar lines)
  every?: number; // quarter beats between beat lines (6/8 counts dotted quarters)
  barAt?: number; // performance.now() of any bar line (default: start)
  result?: (i: number) => LaneResult; // how note i went (BeatJudge items); nothing = not played yet
  letters?: () => boolean; // letter names on the bars
  onFrame?: (now: number) => void; // called on every frame while the lane runs (the staff follows along)
}

// how far ahead the lane looks, in beats (a note appears at the top this many beats before it is due)
export const LOOK_BEATS = 4;
const MIN_LOOK = 2.5;
const GLOW = 260; // ms a hit note's key column glows
// Light colors so the bars read on the lane's cream background
const LANE_BG = '#fff8e6';

export type Lane = ReturnType<typeof makeLane>;

export function makeLane(canvas: HTMLCanvasElement, kb: Keyboard, kbRoot: HTMLElement) {
  let run: LaneRun | null = null;
  let raf = 0;
  // note i -> { at: beats from note 0, len: beats it sounds (ties included) }
  let spans: { i: number; at: number; len: number; keys: number[] }[] = [];
  const seen = new Map<number, number>(); // note i -> when its result was first drawn (for the glow)

  function plan(notes: Note[]) {
    spans = [];
    let at = 0;
    notes.forEach((n, i) => {
      const len = BEATS[n.d] || 1;
      const prev = notes[i - 1] as Sounding | undefined;
      if (!n.r && prev && !prev.r && prev.tie && spans.length) spans[spans.length - 1].len += len;
      else if (!n.r) spans.push({ i, at, len, keys: n.keys.map((k) => k.m) });
      at += len;
    });
  }

  // x and width of the column above key m, in canvas pixels (CSS px). The keys don't move while a piece
  // plays, so they are measured a couple of times a second (or when the window or key range changes),
  // not on every frame: measuring makes the browser lay the page out, which is slow on an iPad.
  type Col = { x: number; w: number; black: boolean; right: number } | null;
  let cols = new Map<number, Col>();
  let geo = { key: '', at: 0, W: 0, H: 0, left: 0 };
  function measure(now: number) {
    const [lo, hi] = kb.range;
    const key = `${innerWidth}x${innerHeight}:${lo}-${hi}`;
    if (key === geo.key && now - geo.at < 500) return geo;
    const box = canvas.getBoundingClientRect();
    geo = { key, at: now, W: canvas.clientWidth, H: canvas.clientHeight, left: box.left };
    cols = new Map();
    for (let k = lo; k <= hi; k++) {
      const el = kb.keys[k];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const black = isBlack(k);
      const pad = black ? 1 : Math.max(2, r.width * 0.08);
      cols.set(k, { x: r.left - box.left + pad, w: r.width - pad * 2, black, right: r.right - box.left });
    }
    return geo;
  }
  function column(m: number): Col {
    const k = kb.keyFor(m);
    return k === null ? null : cols.get(k) || null;
  }

  function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!run) return;
    // measure first, then draw; the staff follows along (onFrame) last
    draw(run);
    if (run && run.onFrame) run.onFrame(performance.now());
  }

  function draw(run: LaneRun) {
    const now = performance.now();
    const { W, H } = measure(now);
    if (!W || !H) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const g = canvas.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const { start, beatMs } = run;
    const hitY = H - 8;
    // a short lane looks fewer beats ahead so quarter notes stay big enough to read
    const look = Math.max(MIN_LOOK, Math.min(LOOK_BEATS, (hitY - 4) / 56));
    const pxBeat = (hitY - 4) / look;
    // y of a moment: due now -> on the line, LOOK_BEATS ahead -> at the top
    const yAt = (t: number) => hitY - ((t - now) / beatMs) * pxBeat;

    // the lane: one soft column per white key
    g.fillStyle = LANE_BG;
    roundRect(g, 0, 0, W, H, 16);
    g.fill();
    g.save();
    roundRect(g, 0, 0, W, H, 16);
    g.clip();
    const [lo, hi] = kb.range;
    g.strokeStyle = 'rgba(140,115,86,.12)';
    g.lineWidth = 1;
    for (let m = lo; m <= hi; m++) {
      if (isBlack(m)) continue;
      const c = column(m);
      if (!c) continue;
      const x = Math.round(c.right) + 1.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }

    // beat lines go by with the music; a bar line is thicker
    const per = run.per || 4, every = run.every || 1;
    const barAt = run.barAt ?? start;
    const first = Math.floor((now - barAt) / (beatMs * every)) - 1;
    for (let b = first; b <= first + look / every + 2; b++) {
      const y = yAt(barAt + b * every * beatMs);
      if (y < -4 || y > hitY) continue;
      const q = b * every;
      const bar = Math.abs(q / per - Math.round(q / per)) < 1e-6;
      g.fillStyle = bar ? 'rgba(140,115,86,.38)' : 'rgba(140,115,86,.16)';
      g.fillRect(0, y - (bar ? 1.5 : 0.75), W, bar ? 3 : 1.5);
    }

    // the notes
    const letters = run.letters ? run.letters() : true;
    for (const s of spans) {
      const t0 = start + s.at * beatMs, t1 = start + (s.at + s.len) * beatMs;
      const yTop = yAt(t1) + 3, yBot = yAt(t0);
      if (yBot < -2 || yTop > H) continue;
      const res = run.result ? run.result(s.i) : null;
      const hit = res === 'good' || res === 'early' || res === 'late';
      const miss = res === 'miss';
      if (res && !seen.has(s.i)) seen.set(s.i, now);
      for (const m of s.keys) {
        const c = column(m);
        if (!c) continue;
        const col = COLORS[letterOf(m)] || '#999';
        // a hit note sinks into its key: only the part above the line is drawn
        const bot = hit ? Math.min(yBot, hitY) : yBot;
        const h = bot - yTop;
        if (h <= 1) continue;
        g.globalAlpha = miss ? 0.35 : 1;
        roundRect(g, c.x, yTop, c.w, h, Math.min(12, c.w / 3));
        g.fillStyle = miss ? '#b9ada0' : col;
        g.fill();
        if (c.black) { g.lineWidth = 3; g.strokeStyle = '#2a211b'; g.stroke(); }
        if (hit) { g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke(); }
        g.globalAlpha = 1;
        // the letter sits at the bottom of the bar, the end that reaches the line first
        if (letters && !miss && h > 22 && c.w > 16) {
          g.fillStyle = c.black || letterOf(m) === 'E' ? '#3b2716' : '#ffffff';
          g.font = `700 ${Math.min(22, c.w * 0.55)}px Fredoka, ui-rounded, system-ui, sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'bottom';
          g.fillText(letterOf(m) + (isBlack(m) ? '♯' : ''), c.x + c.w / 2, Math.min(bot, hitY) - 4);
        }
      }
      // a hit glows on the line for a moment
      const when = seen.get(s.i);
      if (hit && when !== undefined && now - when < GLOW) {
        const k = 1 - (now - when) / GLOW;
        for (const m of s.keys) {
          const c = column(m);
          if (!c) continue;
          g.fillStyle = `rgba(255,216,77,${0.65 * k})`;
          roundRect(g, c.x - 6 * k, hitY - 26, c.w + 12 * k, 30, 10);
          g.fill();
        }
      }
    }
    g.restore();

    // the line where notes are played: pulses on every beat
    const phase = (((now - barAt) / (beatMs * every)) % 1 + 1) % 1;
    const pulse = Math.max(0, 1 - phase * 4);
    g.fillStyle = '#ff8a1f';
    g.globalAlpha = 0.75 + 0.25 * pulse;
    g.fillRect(0, hitY - 2 - 2 * pulse, W, 5 + 4 * pulse);
    g.globalAlpha = 1;
  }

  return {
    get on() { return !!run; },
    start(r: LaneRun) {
      run = r;
      seen.clear();
      geo.key = ''; // the lane opening moves the keys: measure again
      plan(r.notes);
      canvas.classList.add('on');
      kbRoot.closest('.stage')?.classList.add('laneOn');
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop() {
      run = null;
      cancelAnimationFrame(raf);
      raf = 0;
      canvas.classList.remove('on');
      kbRoot.closest('.stage')?.classList.remove('laneOn');
    },
  };
}
