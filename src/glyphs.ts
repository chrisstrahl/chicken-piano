// Little music pictures (♩ ♪ ♫ 𝅗𝅥 𝅝 𝄞 𝄢 𝄽 ...) drawn as inline SVG from the same Bravura shapes as the staff.
// iPad fonts have no Unicode "musical symbols", so typed 𝅗𝅥 / 𝅝 / 𝄽 showed up as empty rectangles. Any of these
// characters that lands in the page (lesson bubbles, quiz buttons, Write a Song buttons...) is swapped for a picture.
import { Glyph } from 'vexflow/bravura';

const P = 38; // VexFlow point size: a staff space is about 10 units
const STEM = 32;

// a canvas-like recorder that turns VexFlow's glyph outlines into SVG path data and tracks the bounds
class Pen {
  d = '';
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
  pt(x: number, y: number) { this.x0 = Math.min(this.x0, x); this.x1 = Math.max(this.x1, x); this.y0 = Math.min(this.y0, y); this.y1 = Math.max(this.y1, y); return `${x.toFixed(1)} ${y.toFixed(1)}`; }
  beginPath() {}
  fill() {}
  closePath() { this.d += 'Z'; }
  moveTo(x: number, y: number) { this.d += 'M' + this.pt(x, y); }
  lineTo(x: number, y: number) { this.d += 'L' + this.pt(x, y); }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) { this.d += 'Q' + this.pt(cx, cy) + ' ' + this.pt(x, y); }
  bezierCurveTo(ax: number, ay: number, bx: number, by: number, x: number, y: number) { this.d += 'C' + this.pt(ax, ay) + ' ' + this.pt(bx, by) + ' ' + this.pt(x, y); }
  glyph(code: string, x: number, y: number) {
    const m = Glyph.renderGlyph(this as never, x, y, P, code) as unknown as { x_min: number; x_max: number; font: { getResolution(): number }; scale: number };
    return ((m.x_max - m.x_min) * P * 72 * m.scale) / (m.font.getResolution() * 100);
  }
  rect(x: number, y: number, w: number, h: number) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); }
  poly(pts: [number, number][]) { this.d += pts.map(([x, y], i) => (i ? 'L' : 'M') + this.pt(x, y)).join('') + 'Z'; }
}

// one note with a stem up; returns where its stem is
function note(p: Pen, head: string, x: number, stem = true) {
  const w = p.glyph(head, x, 0);
  const sx = x + w - 1.3;
  if (stem) p.rect(sx, -STEM, 1.3, STEM - 1.5);
  return { sx, w };
}

const DRAW: Record<string, (p: Pen) => void> = {
  whole: (p) => { note(p, 'noteheadWhole', 0, false); },
  half: (p) => { note(p, 'noteheadHalf', 0); },
  halfDot: (p) => { const { w } = note(p, 'noteheadHalf', 0); p.glyph('augmentationDot', w + 4, -1); },
  halfTie: (p) => {
    const a = note(p, 'noteheadHalf', 0), b = note(p, 'noteheadHalf', 30);
    // a curved tie under the two heads
    const l = a.w / 2 + 2, r = 30 + b.w / 2 - 2;
    p.d += `M${l} 7Q${(l + r) / 2} 17 ${r} 7Q${(l + r) / 2} 13 ${l} 7Z`;
    p.pt(l, 7); p.pt(r, 17);
  },
  quarter: (p) => { note(p, 'noteheadBlack', 0); },
  eighth: (p) => { const { sx } = note(p, 'noteheadBlack', 0); p.glyph('flag8thUp', sx, -STEM); },
  sixteenth: (p) => { const { sx } = note(p, 'noteheadBlack', 0); p.glyph('flag16thUp', sx, -STEM); },
  beamed: (p) => {
    const a = note(p, 'noteheadBlack', 0), b = note(p, 'noteheadBlack', 20);
    p.poly([[a.sx, -STEM], [b.sx + 1.3, -STEM], [b.sx + 1.3, -STEM + 5], [a.sx, -STEM + 5]]);
  },
  treble: (p) => { p.glyph('gClef', 0, 0); },
  bass: (p) => { p.glyph('fClef', 0, -10); },
  rest: (p) => { p.glyph('restQuarter', 0, -10); },
};

// what to swap, longest first (𝅗𝅥 is two characters: a hollow head plus a combining stem)
const HALF = '\u{1D157}\u{1D165}';
const SWAPS: [string, string][] = [
  [HALF + '‿' + HALF, 'halfTie'], [HALF + '.', 'halfDot'], ['\u{1D15E}.', 'halfDot'], [HALF, 'half'], ['\u{1D15E}', 'half'],
  ['\u{1D15D}', 'whole'], ['\u{1D15F}', 'quarter'], ['♩', 'quarter'], ['\u{1D160}', 'eighth'], ['♪', 'eighth'],
  ['♫', 'beamed'], ['\u{1D161}', 'sixteenth'], ['♬', 'beamed'], ['\u{1D11E}', 'treble'], ['\u{1D122}', 'bass'], ['\u{1D13D}', 'rest'],
];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE = new RegExp(SWAPS.map(([s]) => esc(s)).join('|'), 'gu');
const KIND = new Map(SWAPS);

const cache = new Map<string, string>();
// the SVG markup for one picture; sized in em so it follows the text around it
export function glyphSvg(kind: string): string {
  let svg = cache.get(kind);
  if (svg) return svg;
  const p = new Pen();
  DRAW[kind](p);
  const pad = 1.5;
  const x = p.x0 - pad, y = p.y0 - pad, w = p.x1 - p.x0 + 2 * pad, h = p.y1 - p.y0 + 2 * pad;
  // notes stand on the text baseline; clefs and rests are a bit bigger
  const em = kind === 'treble' ? 1.5 : kind === 'bass' ? 0.9 : kind === 'rest' ? 1 : kind === "whole" ? 0.45 : kind === "beamed" ? 1.3 : 1.35;
  const va = kind === 'treble' ? -0.35 : kind === 'whole' ? 0.05 : -0.1;
  svg = `<svg class="mglyph" viewBox="${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" style="height:${em}em;width:auto;vertical-align:${va}em;overflow:visible" fill="currentColor" aria-hidden="true"><path d="${p.d}"/></svg>`;
  cache.set(kind, svg);
  return svg;
}

export const hasMusicChars = (s: string) => { RE.lastIndex = 0; return RE.test(s); };

// swap the music characters in every text node under el for pictures (attributes are left alone)
export function drawGlyphs(root: Node) {
  const texts: Text[] = [];
  if (root.nodeType === Node.TEXT_NODE) texts.push(root as Text);
  else {
    // drawn music (staffs, chickens) is SVG: skip it whole rather than walking hundreds of shapes on every redraw
    if (root instanceof Element && root.closest('svg')) return;
    const skipSvg = { acceptNode: (n: Node) => (n.nodeName.toLowerCase() === 'svg' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) };
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, skipSvg);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeType === Node.TEXT_NODE) texts.push(n as Text);
  }
  for (const t of texts) {
    const s = t.data;
    if (!hasMusicChars(s) || !t.parentNode || t.parentElement?.closest('svg,script,style,textarea')) continue;
    const span = document.createElement('span');
    span.className = 'mtext';
    span.setAttribute('aria-label', s);
    RE.lastIndex = 0;
    span.innerHTML = s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!).replace(RE, (m) => glyphSvg(KIND.get(m)!));
    t.parentNode.replaceChild(span, t);
  }
}

// keep doing it for anything the app adds or changes later
export function watchGlyphs(root: HTMLElement = document.body) {
  drawGlyphs(root);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') drawGlyphs(m.target);
      else m.addedNodes.forEach((n) => drawGlyphs(n));
    }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}
