// Sheet music drawn with VexFlow: colored notes, letter bubbles and lyrics under the staff.
import { Renderer, Stave, StaveNote, Voice, Formatter, BarNote, Accidental, Barline } from 'vexflow/bravura';
import { BEATS, INK, COLORS, letterOf, isBlack, vfKey } from './music.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const H = 165;

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent && parent.appendChild(e);
  return e;
}

/**
 * Draw notes into a .staffcard. Returns { xs, noteEls, letterEls, lyricEls, width, svg }.
 * opts.scroll: true -> long strip that can be scrolled with scrollTo(); false -> fit inside the card.
 */
export function drawStaff(card, notes, opts = {}) {
  const { scroll = false, letters = true, lyrics = false, minWidth = 0, bars = true } = opts;
  const strip = card.querySelector('.strip');
  strip.innerHTML = '';
  const perBeat = scroll ? 30 : 26;
  const noteW = notes.reduce((s, n) => s + 44 + perBeat * (BEATS[n.d] - 1), 0);
  const width = Math.max(minWidth, 110 + noteW + 30);

  const renderer = new Renderer(strip, Renderer.Backends.SVG);
  renderer.resize(width, H);
  const ctx = renderer.getContext();
  const svg = ctx.svg;
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '';
  svg.style.height = '';
  if (!scroll) svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // highlight box lives behind everything
  const cur = svgEl('rect', { class: 'cur', x: -100, y: 4, width: 44, height: H - 8, rx: 14 }, svg);

  const stave = new Stave(4, 0, width - 10);
  stave.addClef('treble');
  if (notes.length) stave.setEndBarType(Barline.type.END);
  stave.setContext(ctx).draw();

  const vnotes = [];
  const ticks = [];
  let beat = 0;
  notes.forEach((n, i) => {
    const l = letterOf(n.m);
    const sn = new StaveNote({ keys: [vfKey(n.m)], duration: n.d, auto_stem: true });
    if (isBlack(n.m)) sn.addModifier(new Accidental('#'), 0);
    const c = isBlack(n.m) ? '#555' : INK[l];
    sn.setStyle({ fillStyle: c, strokeStyle: c });
    vnotes.push(sn);
    ticks.push(sn);
    beat += BEATS[n.d];
    if (bars && beat % 4 === 0 && i < notes.length - 1) ticks.push(new BarNote());
  });

  const xs = [];
  const noteEls = [];
  const letterEls = [];
  const lyricEls = [];
  if (vnotes.length) {
    const voice = new Voice({ num_beats: Math.max(1, beat), beat_value: 4 }).setStrict(false);
    voice.addTickables(ticks);
    new Formatter().joinVoices([voice]).format([voice], width - stave.getNoteStartX() - 40);
    voice.draw(ctx, stave);

    const yBottom = stave.getYForLine(4);
    vnotes.forEach((sn, i) => {
      const head = sn.noteHeads[0];
      const x = head.getAbsoluteX() + head.getWidth() / 2;
      xs.push(x);
      noteEls.push(sn.getSVGElement());
      const l = letterOf(notes[i].m);
      if (letters) {
        const g = svgEl('g', { class: 'ltg' }, svg);
        svgEl('circle', { cx: x, cy: yBottom + 40, r: 14, fill: isBlack(notes[i].m) ? '#666' : COLORS[l] }, g);
        const t = svgEl('text', { x, y: yBottom + 46, 'text-anchor': 'middle', 'font-size': 18, fill: '#fff', class: 'lt' }, g);
        t.textContent = l + (isBlack(notes[i].m) ? '♯' : '');
        letterEls.push(g);
      }
      if (lyrics && notes[i].lyric) {
        const t = svgEl('text', { x, y: yBottom + 72, 'text-anchor': 'middle', 'font-size': 15, class: 'ly' }, svg);
        t.textContent = notes[i].lyric;
        lyricEls.push(t);
      }
    });
  }
  return { xs, noteEls, letterEls, lyricEls, width, svg, cur };
}

// Move the highlight to note i and scroll so it sits about 30% from the left.
export function focusNote(card, drawn, i) {
  const x = drawn.xs[i];
  if (x === undefined) { drawn.cur.setAttribute('x', -100); return; }
  drawn.cur.setAttribute('x', x - 22);
  const strip = card.querySelector('.strip');
  const scale = card.clientHeight / H;
  drawn.svg.style.width = drawn.width * scale + 'px';
  drawn.svg.style.height = card.clientHeight + 'px';
  const visible = card.clientWidth / scale;
  const target = Math.max(0, Math.min(x - visible * 0.32, drawn.width - visible));
  strip.style.transform = `translateX(${-target * scale}px)`;
}
