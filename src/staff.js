// Sheet music drawn with VexFlow: colored notes, letter bubbles and lyrics under the staff.
// Handles treble and bass clef, 4/4 and 3/4, pickups, rests, dots, eighth beams, ties, repeats, chords and sharps/flats.
import { Renderer, Stave, StaveNote, Voice, Formatter, BarNote, Accidental, Barline, Beam, Dot, StaveTie } from 'vexflow/bravura';
import { BEATS, INK, BLACK_INK, COLORS } from './music.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const H = 165;

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent && parent.appendChild(e);
  return e;
}

const vfKey = (k) => `${k.letter.toLowerCase()}${k.acc}/${k.oct}`;
const inkOf = (k) => (k.acc ? BLACK_INK : INK[k.letter]);
const bubbleOf = (k) => (k.acc ? '#666' : COLORS[k.letter]);

/**
 * Draw notes into a .staffcard. Returns { xs, noteEls, letterEls, lyricEls, width, svg, cur }.
 * opts.scroll: true -> long strip that can be scrolled with focusNote(); false -> fit inside the card.
 * opts.onTap(i): the child tapped note i.
 * opts.pack: keep notes at a steady spacing from the left (free play) instead of spreading them across the width.
 */
export function drawStaff(card, notes, opts = {}) {
  const { scroll = false, letters = true, lyrics = false, minWidth = 0, bars = true, clef = 'treble', time = null, pickup = 0, repeat = false, onTap = null, pack = false } = opts;
  const strip = card.querySelector('.strip');
  strip.innerHTML = '';
  const perBeat = scroll ? 30 : 26;
  const noteW = notes.reduce((s, n) => s + Math.max(34, 44 + perBeat * (BEATS[n.d] - 1)) + (n.keys.some((k) => k.acc) ? 14 : 0), 0);
  const width = Math.max(minWidth, 110 + (time ? 30 : 0) + noteW + 30);

  const renderer = new Renderer(strip, Renderer.Backends.SVG);
  renderer.resize(width, H);
  const ctx = renderer.getContext();
  const svg = ctx.svg;
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '';
  svg.style.height = '';
  if (!scroll) svg.setAttribute('preserveAspectRatio', pack ? 'xMinYMid meet' : 'xMidYMid meet');

  // highlight box lives behind everything
  const cur = svgEl('rect', { class: 'cur', x: -10000, y: 4, width: 44, height: H - 8, rx: 14 }, svg);

  const stave = new Stave(4, 0, width - 10);
  stave.addClef(clef);
  if (time) stave.addTimeSignature(time);
  if (notes.length) stave.setEndBarType(repeat ? Barline.type.REPEAT_END : Barline.type.END);
  stave.setContext(ctx).draw();

  // beats per bar, counted in quarter notes (6/8 = 3)
  const perBar = time ? (+time.split('/')[0] * 4) / +time.split('/')[1] : 4;
  const restKey = clef === 'bass' ? 'd/3' : 'b/4';
  const vnotes = [];
  const ticks = [];
  const beams = [];
  const ties = [];
  let beat = 0;
  notes.forEach((n, i) => {
    let sn;
    if (n.r) {
      sn = new StaveNote({ keys: [restKey], duration: n.d + 'r', clef });
      sn.setStyle({ fillStyle: '#7a6a58', strokeStyle: '#7a6a58' });
    } else {
      sn = new StaveNote({ keys: n.keys.map(vfKey), duration: n.d, clef, auto_stem: true });
      n.keys.forEach((k, ki) => {
        if (k.acc) sn.addModifier(new Accidental(k.acc), ki);
        sn.setKeyStyle(ki, { fillStyle: inkOf(k), strokeStyle: inkOf(k) });
      });
      sn.setStemStyle({ fillStyle: inkOf(n.keys[0]), strokeStyle: inkOf(n.keys[0]) });
      sn.setFlagStyle({ fillStyle: inkOf(n.keys[0]), strokeStyle: inkOf(n.keys[0]) });
    }
    if (n.d.endsWith('d')) Dot.buildAndAttach([sn], { all: true });
    // two eighths that share a beat hold hands
    const prev = notes[i - 1];
    if (n.d === '8' && !n.r && prev && prev.d === '8' && !prev.r && beat % 1 === 0.5) beams.push([vnotes[i - 1], sn]);
    if (prev && prev.tie && !n.r) ties.push([vnotes[i - 1], sn]);
    vnotes.push(sn);
    ticks.push(sn);
    beat += BEATS[n.d];
    if (bars && i < notes.length - 1 && beat > 0 && (beat - pickup) % perBar === 0) ticks.push(new BarNote());
  });

  const xs = [];
  const noteEls = [];
  const letterEls = [];
  const lyricEls = [];
  if (vnotes.length) {
    const voice = new Voice({ num_beats: Math.max(1, Math.ceil(beat)), beat_value: 4 }).setStrict(false);
    voice.addTickables(ticks);
    const beamObjs = beams.map((b) => new Beam(b, true));
    new Formatter().joinVoices([voice]).format([voice], pack ? Math.max(40, noteW * 1.3) : width - stave.getNoteStartX() - 40);
    voice.draw(ctx, stave);
    beamObjs.forEach((b) => b.setContext(ctx).draw());
    ties.forEach(([a, b]) => new StaveTie({ first_note: a, last_note: b, first_indices: [0], last_indices: [0] }).setContext(ctx).draw());

    const yBottom = stave.getYForLine(4);
    vnotes.forEach((sn, i) => {
      const n = notes[i];
      const head = sn.noteHeads[0];
      const x = head.getAbsoluteX() + head.getWidth() / 2;
      xs.push(x);
      noteEls.push(sn.getSVGElement());
      if (letters && !n.r) {
        const g = svgEl('g', { class: 'ltg' }, svg);
        const many = n.keys.length > 1;
        const r = many ? 11 : 14;
        n.keys.forEach((k, ki) => {
          const cx = x + (ki - (n.keys.length - 1) / 2) * (r * 2 + 2);
          svgEl('circle', { cx, cy: yBottom + 40, r, fill: bubbleOf(k) }, g);
          const t = svgEl('text', { x: cx, y: yBottom + 40 + r * 0.42, 'text-anchor': 'middle', 'font-size': many ? 14 : k.acc ? 15 : 18, fill: '#fff', class: 'lt' }, g);
          t.textContent = k.label;
        });
        letterEls[i] = g;
      }
      if (lyrics && n.lyric) {
        const t = svgEl('text', { x, y: yBottom + 72, 'text-anchor': 'middle', 'font-size': 15, class: 'ly' }, svg);
        t.textContent = n.lyric;
        lyricEls[i] = t;
      }
    });
    // big invisible tap targets on top, one per note
    if (onTap) {
      const g = svgEl('g', { class: 'taps' }, svg);
      xs.forEach((x, i) => {
        const left = i ? (xs[i - 1] + x) / 2 : x - 30;
        const right = i < xs.length - 1 ? (x + xs[i + 1]) / 2 : x + 30;
        svgEl('rect', { x: left, y: 0, width: right - left, height: H, fill: 'transparent', 'data-i': i }, g);
      });
      g.addEventListener('pointerdown', (e) => {
        const r = e.target.closest('[data-i]');
        if (r) { e.preventDefault(); onTap(+r.dataset.i); }
      });
    }
  }
  // nothing under the staff (note-reading quizzes): crop to the staff so the note is drawn big
  if (!scroll && !letters && !lyrics) {
    const y0 = stave.getYForLine(0) - 36;
    svg.setAttribute('viewBox', `0 ${y0} ${width} ${stave.getYForLine(4) + 36 - y0}`);
  }
  return { xs, noteEls, letterEls, lyricEls, width, svg, cur };
}

// Move the highlight to note i and scroll so it sits about 30% from the left.
export function focusNote(card, drawn, i) {
  const x = drawn.xs[i];
  if (x === undefined) { drawn.cur.setAttribute('x', -10000); return; }
  drawn.cur.setAttribute('x', x - 22);
  const strip = card.querySelector('.strip');
  const scale = card.clientHeight / H;
  drawn.svg.style.width = drawn.width * scale + 'px';
  drawn.svg.style.height = card.clientHeight + 'px';
  const visible = card.clientWidth / scale;
  const target = Math.max(0, Math.min(x - visible * 0.32, drawn.width - visible));
  strip.style.transform = `translateX(${-target * scale}px)`;
}
