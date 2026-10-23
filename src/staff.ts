// Sheet music drawn with VexFlow: colored notes, letter bubbles (with finger numbers) and lyrics under the staff.
// One staff (treble or bass), or a grand staff when a left-hand part is given: right hand on top, left hand below,
// chord symbols above. Handles 4/4, 3/4 and 6/8, pickups, rests, dots, eighth beams, ties, repeats, chords,
// key signatures and sharps/flats.
import { Renderer, Stave, StaveNote, StaveConnector, Voice, Formatter, BarNote, Accidental, Barline, Beam, Dot, StaveTie } from 'vexflow/bravura';
import { BEATS, INK, BLACK_INK, COLORS } from './music.js';
import type { Note, Pitch, KeySig, Finger, ChordSpan } from './types.ts';

// One hand built for VexFlow: its voice, a StaveNote per note, eighth pairs to beam, ties, and each note's beat
type Part = { voice: Voice; vnotes: StaveNote[]; beams: StaveNote[][]; ties: [StaveNote, StaveNote][]; beats: number[]; beamObjs?: Beam[] };
// Where one hand's notes were drawn: x per note, their SVG elements, and each note's beat
export type DrawnPart = { xs: number[]; noteEls: (SVGElement | undefined)[]; letterEls: SVGElement[]; lyricEls: SVGElement[]; beats: number[] };
export type Drawn = DrawnPart & {
  width: number; svg: SVGSVGElement; cur: SVGElement; H: number; lh: DrawnPart | null; beatX: (beat: number) => number;
  countEls: SVGElement[]; // with opts.counts: one "1 2 3 4" number per beat
  countAt: (beat: number) => number; // where a beat sits, also in the middle of a long note
};
export interface StaffOpts {
  scroll?: boolean; letters?: boolean; lyrics?: boolean; minWidth?: number; bars?: boolean; clef?: string;
  time?: string | null; pickup?: number; repeat?: boolean;
  onTap?: ((i: number) => void) | null; onTapBeat?: ((beat: number) => void) | null;
  pack?: boolean; key?: string | null; sig?: KeySig; lh?: Note[] | null;
  counts?: boolean; // count the beats under the staff, with a band under each note as long as it lasts
  chords?: Pick<ChordSpan, 'beat' | 'chord'>[] | null; fingers?: Finger[] | null; lhFingers?: Finger[] | null;
}

// VexFlow counts 16384 ticks in a whole note
const QUARTER_TICKS = 16384 / 4;
const SVGNS = 'http://www.w3.org/2000/svg';
const H1 = 165; // one staff
const H2 = 280; // grand staff

function svgEl(tag: string, attrs: Record<string, string | number>, parent?: Element | null): SVGElement {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  parent && parent.appendChild(e);
  return e;
}

const vfKey = (k: Pitch) => `${k.letter.toLowerCase()}${k.acc}/${k.oct}`;
const inkOf = (k: Pitch) => (k.acc ? BLACK_INK : INK[k.letter]);
const bubbleOf = (k: Pitch) => (k.acc ? '#666' : COLORS[k.letter]);
const perBarOf = (time: string | null) => (time ? (+time.split('/')[0] * 4) / +time.split('/')[1] : 4);
// Room the music needs: every moment a note starts (in either hand) gets at least a letter bubble's width,
// longer gaps get more, accidentals a little extra.
function widthOf(parts: Note[][], perBeat: number, min: number) {
  const at = new Map<number, number>();
  for (const notes of parts) {
    let b = 0;
    for (const n of notes) {
      const k = Math.round(b * 1000);
      at.set(k, Math.max(at.get(k) || 0, n.keys.some((x) => x.acc) ? 14 : 0));
      b += BEATS[n.d];
    }
    at.set(Math.round(b * 1000), at.get(Math.round(b * 1000)) || 0);
  }
  const ks = [...at.keys()].sort((x, y) => x - y);
  let w = 0;
  for (let i = 0; i < ks.length - 1; i++) w += Math.max(min, 44 + perBeat * ((ks[i + 1] - ks[i]) / 1000 - 1)) + at.get(ks[i])!;
  return w;
}

// Build the VexFlow notes for one hand. sig = the key signature ({ B: 'b' }): accidentals are drawn only where a
// note differs from the key (or from an earlier accidental in the same bar), naturals included.
function buildPart(notes: Note[], { clef, sig = {}, perBar, pickup, bars }: { clef: string; sig?: KeySig; perBar: number; pickup: number; bars: boolean }): Part {
  const restKey = clef === 'bass' ? 'd/3' : 'b/4';
  const vnotes: StaveNote[] = [];
  const ticks: (StaveNote | BarNote)[] = [];
  const beams: StaveNote[][] = [];
  const ties: [StaveNote, StaveNote][] = [];
  const beats: number[] = [];
  let beat = 0;
  let barAcc: Record<string, string> = {};
  notes.forEach((n, i) => {
    let sn: StaveNote;
    beats.push(beat);
    if (n.r) {
      sn = new StaveNote({ keys: [restKey], duration: n.d + 'r', clef });
      sn.setStyle({ fillStyle: '#7a6a58', strokeStyle: '#7a6a58' });
    } else {
      const p = notes[i - 1];
      const tied = !!p && !p.r && p.tie;
      sn = new StaveNote({ keys: n.keys.map(vfKey), duration: n.d, clef, auto_stem: true });
      n.keys.forEach((k, ki) => {
        const id = k.letter + k.oct;
        const now = barAcc[id] ?? sig[k.letter] ?? '';
        if (k.acc !== now && !tied) { sn.addModifier(new Accidental(k.acc || 'n'), ki); barAcc[id] = k.acc; }
        sn.setKeyStyle(ki, { fillStyle: inkOf(k), strokeStyle: inkOf(k) });
      });
      sn.setStemStyle({ fillStyle: inkOf(n.keys[0]), strokeStyle: inkOf(n.keys[0]) });
      sn.setFlagStyle({ fillStyle: inkOf(n.keys[0]), strokeStyle: inkOf(n.keys[0]) });
    }
    if (n.d.endsWith('d')) Dot.buildAndAttach([sn], { all: true });
    // two eighths that share a beat hold hands
    const prev = notes[i - 1];
    if (n.d === '8' && !n.r && prev && prev.d === '8' && !prev.r && beat % 1 === 0.5) beams.push([vnotes[i - 1], sn]);
    if (prev && !prev.r && prev.tie && !n.r) ties.push([vnotes[i - 1], sn]);
    vnotes.push(sn);
    ticks.push(sn);
    beat += BEATS[n.d];
    if (beat > 0 && Math.abs(((beat - pickup) % perBar + perBar) % perBar) < 1e-6) {
      barAcc = {};
      if (bars && i < notes.length - 1) ticks.push(new BarNote());
    }
  });
  const voice = new Voice({ num_beats: Math.max(1, Math.ceil(beat)), beat_value: 4 }).setStrict(false);
  voice.addTickables(ticks);
  return { voice, vnotes, beams, ties, beats };
}

// the beat right after a hand's last note
const lastEnd = (p: DrawnPart, notes: Note[]) => (notes.length ? p.beats[notes.length - 1] + (BEATS[notes[notes.length - 1].d] || 1) : 0);

// Letter bubbles (with a small finger number) and lyrics for one hand
function labels(svg: SVGSVGElement, part: Part, notes: Note[], y: number, { letters, fingers, lyricsY }: { letters: boolean; fingers: Finger[] | null; lyricsY: number }): DrawnPart {
  const out: DrawnPart = { xs: [], noteEls: [], letterEls: [], lyricEls: [], beats: part.beats };
  part.vnotes.forEach((sn, i) => {
    const n = notes[i];
    const head = sn.noteHeads[0];
    const x = head.getAbsoluteX() + head.getWidth() / 2;
    out.xs.push(x);
    out.noteEls.push(sn.getSVGElement());
    // chords show their fingers on the keyboard only
    const f = fingers && n.keys.length === 1 ? fingers[i] : null;
    if ((letters || f) && !n.r) {
      const g = svgEl('g', { class: 'ltg' }, svg);
      const many = n.keys.length > 1;
      const r = many ? 11 : 14;
      if (letters) {
        n.keys.forEach((k, ki) => {
          // a chord's letters stack up like its notes, lowest at the bottom
          const cx = x, cy = y + (n.keys.length - 1 - ki) * (r * 2 + 1);
          svgEl('circle', { cx, cy, r, fill: bubbleOf(k) }, g);
          const t = svgEl('text', { x: cx, y: cy + r * 0.42, 'text-anchor': 'middle', 'font-size': many ? 14 : k.acc ? 15 : 18, fill: '#fff', class: 'lt' }, g);
          t.textContent = k.label;
        });
      }
      if (f) {
        const fx = letters ? x + r * 0.95 : x, fy = letters ? y - r * 0.95 : y;
        const fg = svgEl('g', { class: 'fing' }, g);
        svgEl('circle', { cx: fx, cy: fy, r: 8, fill: '#fff', stroke: '#3b2716', 'stroke-width': 1.5 }, fg);
        const t = svgEl('text', { x: fx, y: fy + 4, 'text-anchor': 'middle', 'font-size': 12, fill: '#3b2716', class: 'lt' }, fg);
        t.textContent = String(f);
      }
      out.letterEls[i] = g;
    }
    if (lyricsY && n.lyric) {
      const t = svgEl('text', { x, y: lyricsY, 'text-anchor': 'middle', 'font-size': 15, class: 'ly' }, svg);
      t.textContent = n.lyric;
      out.lyricEls[i] = t;
    }
  });
  return out;
}

/**
 * Draw music into a .staffcard.
 * notes: the right hand (or the only part). opts.lh: left-hand notes -> grand staff.
 * opts.scroll: true -> long strip moved with focusX(); false -> fit inside the card.
 * opts.onTap(i): the child tapped note i (one staff). opts.onTapBeat(beat): tapped the notes starting at `beat`.
 * opts.pack: keep notes at a steady spacing from the left (free play) instead of spreading them across the width.
 * opts.key: key signature ('F', 'G', 'Am'...), sig: its accidentals. opts.chords: [{ beat, chord: { sym } }].
 * opts.fingers / lhFingers: finger number per note (null = none).
 * opts.counts: beat numbers under the staff (1 2 3 4, starting over each bar), each note (or rest) sitting on a band
 *   as wide as its beats, so a half note's band holds "1 2".
 * Returns { width, svg, cur, H, xs, noteEls, letterEls, lyricEls, beats, lh, beatX(beat), countEls, countAt(beat) }
 * (top level = right hand).
 */
export function drawStaff(card: HTMLElement, notes: Note[], opts: StaffOpts = {}): Drawn {
  const {
    scroll = false, letters = true, lyrics = false, minWidth = 0, bars = true, clef = 'treble', time = null, pickup = 0,
    repeat = false, onTap = null, onTapBeat = null, pack = false, key = null, sig = {}, lh = null, chords = null,
    fingers = null, lhFingers = null, counts = false,
  } = opts;
  const strip = card.querySelector<HTMLElement>('.strip')!;
  strip.innerHTML = '';
  const grand = !!lh;
  const perBar = perBarOf(time);
  const common = { sig, perBar, pickup, bars };
  const rh = notes.length ? buildPart(notes, { ...common, clef: grand ? 'treble' : clef }) : null;
  const lp = lh && lh.length ? buildPart(lh, { ...common, clef: 'bass' }) : null;
  // Notes far below a staff push its letter bubbles (and everything under them) down, so bubbles never hide notes.
  // (bubbles sit y0 under the bottom line, radius 14; a note on line L has its head bottom at (1 - L) * 10 + 5)
  const lowLine = (p: Part) => Math.min(1, ...p.vnotes.filter((sn) => !sn.isRest()).flatMap((sn) => sn.getKeyProps().map((k) => k.line)));
  const stack = (p: Part) => (Math.max(1, ...p.vnotes.map((sn) => sn.keys.length)) - 1) * 23;
  const drop = (p: Part | null, y0: number) => (p ? Math.max(0, (1 - lowLine(p)) * 10 + 25 - y0) : 0);
  const dropR = drop(rh, grand ? 30 : 40);
  const dropL = drop(lp, 28);
  const stackR = rh && letters ? stack(rh) : 0, stackL = lp && letters ? stack(lp) : 0;
  const H = (grand ? H2 : H1) + dropR + stackR + dropL + stackL;
  const perBeat = scroll ? 30 : 26;
  const noteW = widthOf(lh ? [notes, lh] : [notes], perBeat, letters ? 46 : 34);
  const keyW = key ? Object.keys(sig).length * 11 + 6 : 0;
  const width = Math.max(minWidth, 110 + (time ? 30 : 0) + keyW + noteW + 30);

  const renderer = new Renderer(strip as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(width, H);
  const ctx = renderer.getContext();
  const svg = (ctx as unknown as { svg: SVGSVGElement }).svg;
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '';
  svg.style.height = '';
  if (!scroll) svg.setAttribute('preserveAspectRatio', pack ? 'xMinYMid meet' : 'xMidYMid meet');
  card.dataset.h = String(H);

  // highlight box lives behind everything
  const cur = svgEl('rect', { class: 'cur', x: -10000, y: 4, width: 44, height: H - 8, rx: 14 }, svg);

  const staves: Stave[] = [];
  const mk = (y: number, c: string) => {
    const st = new Stave(grand ? 14 : 4, y, width - (grand ? 20 : 10));
    st.addClef(c);
    if (key) st.addKeySignature(key);
    if (time) st.addTimeSignature(time);
    if (notes.length) st.setEndBarType(repeat ? Barline.type.REPEAT_END : Barline.type.END);
    staves.push(st);
    return st;
  };
  const top = mk(grand ? 14 : 0, grand ? 'treble' : clef);
  const bot = grand ? mk(126 + dropR + stackR, 'bass') : null;
  staves.forEach((st) => st.setContext(ctx).draw());
  if (bot) {
    new StaveConnector(top, bot).setType('brace').setContext(ctx).draw();
    new StaveConnector(top, bot).setType('singleLeft').setContext(ctx).draw();
  }

  const empty: DrawnPart = { xs: [], noteEls: [], letterEls: [], lyricEls: [], beats: [] };
  let R = empty;
  let Lh: DrawnPart | null = null;
  if (rh) {
    const voices = [rh.voice].concat(lp ? [lp.voice] : []);
    const f = new Formatter();
    voices.forEach((v) => f.joinVoices([v]));
    const startX = Math.max(...staves.map((st) => st.getNoteStartX()));
    staves.forEach((st) => st.setNoteStartX(startX));
    f.format(voices, pack ? Math.max(40, noteW * 1.3) : width - startX - 40);
    // VexFlow leaves long scores bunched up on the left: stretch the spacing to fill the staff.
    if (!pack) {
      const { list, map } = f.getTickContexts()!;
      const tcs = list.map((t) => map[t]);
      const x0 = tcs[0].getX(), last = tcs[tcs.length - 1];
      const room = width - startX - 40 - last.getWidth();
      const k = (room - x0) / (last.getX() - x0 || 1);
      if (counts) {
        // counting beats: space the notes by how long they last, so every beat gets the same room
        const total = Math.max(...[notes, lh || []].map((ns) => ns.reduce((a, n) => a + (BEATS[n.d] || 1), 0)));
        const per = (width - startX - 34 - x0) / (total || 1);
        list.forEach((t) => map[t].setX(x0 + (t / QUARTER_TICKS) * per));
      } else if (k > 1.02) tcs.forEach((tc) => tc.setX(x0 + (tc.getX() - x0) * k));
    }
    const parts: [Part, Stave][] = [[rh, top]];
    if (lp && bot) parts.push([lp, bot]);
    parts.forEach(([p]) => { p.beamObjs = p.beams.map((b) => new Beam(b, true)); });
    parts.forEach(([p, st]) => {
      p.voice.draw(ctx, st);
      p.beamObjs!.forEach((b) => b.setContext(ctx).draw());
      p.ties.forEach(([a, b]) => new StaveTie({ first_note: a, last_note: b, first_indices: [0], last_indices: [0] }).setContext(ctx).draw());
    });
    const yR = top.getYForLine(4) + (grand ? 30 : 40) + dropR;
    R = labels(svg, rh, notes, yR, { letters, fingers, lyricsY: lyrics && !grand ? top.getYForLine(4) + 72 + dropR + stackR : 0 });
    if (lp && bot && lh) {
      const yL = bot.getYForLine(4) + 28 + dropL;
      Lh = labels(svg, lp, lh, yL, { letters, fingers: lhFingers, lyricsY: 0 });
    }
    if (grand && lyrics) {
      // the words go with the melody, which is the left hand in bass-clef songs
      const [src, part]: [Note[], DrawnPart] = !notes.some((n) => n.lyric) && Lh && lh ? [lh, Lh] : [notes, R];
      src.forEach((n, i) => {
        if (!n.lyric) return;
        const t = svgEl('text', { x: part.xs[i], y: H - 12, 'text-anchor': 'middle', 'font-size': 15, class: 'ly' }, svg);
        t.textContent = n.lyric;
        part.lyricEls[i] = t;
      });
    }
  }

  // where a beat sits across the page: a note starting then (either hand), else in between
  const marks: [number, number][] = [];
  [R, Lh].forEach((p) => p && p.beats.forEach((b, i) => marks.push([b, p.xs[i]])));
  marks.sort((a, b) => a[0] - b[0]);
  const beatX = (b: number) => {
    const hit = marks.find((m) => Math.abs(m[0] - b) < 1e-6);
    if (hit) return hit[1];
    const after = marks.find((m) => m[0] > b);
    return after ? after[1] : marks.length ? marks[marks.length - 1][1] : 0;
  };

  if (chords && chords.length) {
    chords.forEach(({ beat, chord }) => {
      const t = svgEl('text', { x: beatX(beat), y: 20, 'text-anchor': 'middle', 'font-size': 17, class: 'chordsym' }, svg);
      t.textContent = chord.sym;
    });
  }

  // in between notes: spread the beats evenly from one note to the next (and to the end of the staff after the last)
  const countAt = (b: number) => {
    const before = [...marks].reverse().find((m) => m[0] <= b + 1e-6);
    const after = marks.find((m) => m[0] > b + 1e-6);
    if (!before) return after ? after[1] : 0;
    const [b1, x1] = after || [Math.max(...[R, Lh].flatMap((p) => (p ? [lastEnd(p, p === R ? notes : lh!)] : []))), width - 34];
    return before[1] + ((x1 - before[1]) * (b - before[0])) / (b1 - before[0] || 1);
  };
  const countEls: SVGElement[] = [];
  if (counts && rh) {
    const y = grand ? H - 12 : top.getYForLine(4) + (letters ? 72 : 40) + dropR + stackR;
    const total = Math.max(...[R, Lh].flatMap((p) => (p ? [lastEnd(p, p === R ? notes : lh!)] : [])));
    // one band per note of the top part (one staff only: two hands would need two rows)
    if (!grand) notes.forEach((n, i) => {
      const b = R.beats[i], len = BEATS[n.d] || 1;
      const x0 = countAt(b) - 13, x1 = countAt(b + len - 1) + 13;
      svgEl('rect', { x: x0, y: y - 19, width: Math.max(26, x1 - x0), height: 26, rx: 13, class: n.r ? 'cband rest' : 'cband', fill: n.r ? '#e9e2d6' : bubbleOf(n.keys[0]) }, svg);
    });
    for (let b = 0; b < total - 1e-6; b++) {
      const num = (((b - pickup) % perBar) + perBar) % perBar + 1;
      const t = svgEl('text', { x: countAt(b), y, 'text-anchor': 'middle', 'font-size': 17, class: 'cnum' }, svg);
      t.textContent = String(Math.floor(num));
      countEls.push(t);
    }
    // eighth notes off the beat are counted "and"
    new Set([R, Lh].flatMap((p) => (p ? p.beats : [])).filter((b) => Math.abs(b % 1 - 0.5) < 1e-6)).forEach((b) => {
      svgEl('text', { x: countAt(b), y, 'text-anchor': 'middle', 'font-size': 15, class: 'cnum and' }, svg).textContent = '&';
    });
  }

  // big invisible tap targets on top
  const taps: [number, number][] = onTapBeat ? [...new Map(marks.map(([b, x]) => [b, x])).entries()].sort((a, b) => a[0] - b[0]) : onTap ? R.xs.map((x, i) => [i, x]) : [];
  if (taps.length) {
    const g = svgEl('g', { class: 'taps' }, svg);
    taps.forEach(([id, x], i) => {
      const left = i ? (taps[i - 1][1] + x) / 2 : x - 30;
      const right = i < taps.length - 1 ? (x + taps[i + 1][1]) / 2 : x + 30;
      svgEl('rect', { x: left, y: 0, width: Math.max(1, right - left), height: H, fill: 'transparent', stroke: 'none', 'data-i': id }, g);
    });
    g.addEventListener('pointerdown', (e) => {
      const r = (e.target as Element).closest<SVGElement>('[data-i]');
      if (!r) return;
      e.preventDefault();
      if (onTapBeat) onTapBeat(+r.dataset.i!); else onTap?.(+r.dataset.i!);
    });
  }
  // nothing under the staff (note-reading quizzes): crop to the staff so the note is drawn big
  if (!scroll && !letters && !lyrics && !grand && !counts) {
    const y0 = top.getYForLine(0) - 36;
    svg.setAttribute('viewBox', `0 ${y0} ${width} ${top.getYForLine(4) + 36 - y0}`);
  }
  return { width, svg, cur, H, ...R, lh: Lh, beatX, countEls, countAt };
}

// Move the highlight to x and scroll so it sits about 30% from the left.
export function focusX(card: HTMLElement, drawn: Drawn, x: number | null | undefined) {
  if (x === undefined || x === null) { drawn.cur.setAttribute('x', '-10000'); return; }
  drawn.cur.setAttribute('x', String(x - 22));
  const strip = card.querySelector<HTMLElement>('.strip')!;
  const scale = card.clientHeight / drawn.H;
  drawn.svg.style.width = drawn.width * scale + 'px';
  drawn.svg.style.height = card.clientHeight + 'px';
  const visible = card.clientWidth / scale;
  const target = Math.max(0, Math.min(x - visible * 0.32, drawn.width - visible));
  strip.style.transform = `translateX(${-target * scale}px)`;
}
// ...or to note i of the (right-hand) part
export const focusNote = (card: HTMLElement, drawn: Drawn, i: number) => focusX(card, drawn, drawn.xs[i]);
