// On-screen piano keyboard, colored by note letter. The range changes per song or lesson (default C4 to E5).
import { COLORS, letterOf, isBlack } from './music.js';
import { markTap } from './timing.js';

export const LOW = 60;
export const HIGH = 76;

// A range that starts on C or F and shows at least `minWhite` white keys.
export function fitRange(lo: number, hi: number, minWhite = 10): [number, number] {
  hi = Math.max(hi, lo);
  while (!['C', 'F'].includes(letterOf(lo)) || isBlack(lo)) lo--;
  if (isBlack(hi)) hi++;
  const whites = () => { let n = 0; for (let m = lo; m <= hi; m++) if (!isBlack(m)) n++; return n; };
  while (whites() < minWhite) { hi++; if (isBlack(hi)) hi++; }
  return [lo, hi];
}

// MIDI number -> finger number shown on that key
export type FingerMap = Record<number, number | number[] | null>;
export type Keyboard = ReturnType<typeof makeKeyboard>;

export function makeKeyboard(root: HTMLElement, onPress: (m: number) => void, onRelease: (m: number) => void = () => {}) {
  root.className = 'kb';
  root.dataset.letters = 'all';
  let keys: Record<number, HTMLElement> = {};
  let lo = LOW;
  let hi = HIGH;
  let state: { target: number | number[] | null | undefined; hl: number[]; fingers: FingerMap } = { target: null, hl: [], fingers: {} };

  function build() {
    root.innerHTML = '';
    keys = {};
    const whites: number[] = [];
    for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
    root.style.setProperty('--bw', (100 / whites.length) * 0.6 + '%');
    root.classList.toggle('many', whites.length > 12);
    whites.forEach((m) => {
      const k = document.createElement('div');
      k.className = 'wkey';
      k.dataset.m = String(m);
      k.style.setProperty('--c', COLORS[letterOf(m)]);
      k.innerHTML = `<span class="fg"></span><span class="kl">${letterOf(m)}</span>${letterOf(m) === 'C' && m === 60 ? '<span class="mid">⭐</span>' : ''}`;
      root.appendChild(k);
      keys[m] = k;
    });
    for (let m = lo; m <= hi; m++) {
      if (!isBlack(m)) continue;
      const idx = whites.indexOf(m - 1) + 1;
      const k = document.createElement('div');
      k.className = 'bkey';
      k.dataset.m = String(m);
      k.dataset.g = [1, 3].includes(m % 12) ? '2' : '3';
      k.style.left = `calc(${(idx / whites.length) * 100}% - var(--bw) / 2)`;
      k.innerHTML = '<span class="fg"></span>';
      root.appendChild(k);
      keys[m] = k;
    }
    api.setTarget(state.target);
    api.setHL(state.hl);
    api.setFingers(state.fingers);
  }

  // pointer id -> key it pressed, so lifting the finger releases the right note
  const down: Record<number, number> = {};
  root.addEventListener('pointerdown', (e) => {
    const k = (e.target as Element).closest<HTMLElement>('[data-m]');
    if (!k) return;
    e.preventDefault();
    const m = +k.dataset.m!;
    down[e.pointerId] = m;
    markTap(e.timeStamp); // when the finger touched, even if the page is busy drawing
    k.classList.add('held');
    flash(m, 'down', 180);
    onPress(m);
  });
  const up = (e: PointerEvent) => {
    const m = down[e.pointerId];
    if (m === undefined) return;
    delete down[e.pointerId];
    keys[m] && keys[m].classList.remove('held');
    onRelease(m);
  };
  (['pointerup', 'pointercancel'] as const).forEach((ev) => root.addEventListener(ev, up));
  window.addEventListener('pointerup', up);

  function flash(m: number, cls: string, ms = 400) {
    const k = keys[m];
    if (!k) return;
    k.classList.remove(cls);
    void k.offsetWidth;
    k.classList.add(cls);
    setTimeout(() => k.classList.remove(cls), ms);
  }
  // Find the on-screen key for a heard note: same note in our range, else the nearest key with that name.
  function keyFor(m: number): number | null {
    if (keys[m]) return m;
    let best: number | null = null;
    for (let x = lo; x <= hi; x++) if ((x - m) % 12 === 0 && (best === null || Math.abs(x - m) < Math.abs(best - m))) best = x;
    return best;
  }

  const api = {
    get keys() { return keys; },
    get range(): [number, number] { return [lo, hi]; },
    keyFor,
    flash: (m: number, cls: string, ms?: number) => { const k = keyFor(m); if (k !== null) flash(k, cls, ms); },
    setRange(a: number, b: number) {
      [a, b] = fitRange(a, b);
      if (a === lo && b === hi) return;
      lo = a; hi = b;
      build();
    },
    // one MIDI number, a list (two hands / chord), or null
    setTarget(m: number | number[] | null | undefined) {
      state.target = m;
      Object.values(keys).forEach((k) => k.classList.remove('target'));
      if (m == null) return;
      (Array.isArray(m) ? m : [m]).forEach((x) => {
        const k = keyFor(x);
        if (k !== null) keys[k].classList.add('target');
      });
    },
    setHL(list: number[] = []) {
      state.hl = list;
      Object.values(keys).forEach((k) => k.classList.toggle('hl', list.includes(+k.dataset.m!)));
    },
    // { midi: fingerNumber }
    setFingers(map: FingerMap = {}) {
      state.fingers = map;
      Object.values(keys).forEach((k) => { k.querySelector('.fg')!.textContent = String(map[+k.dataset.m!] || ''); });
    },
    setLetters(mode: string) { root.dataset.letters = mode; },
    setGroups(on: boolean) { root.classList.toggle('bgroups', !!on); },
    reset() { this.setTarget(null); this.setHL([]); this.setFingers({}); this.setGroups(false); },
  };
  build();
  return api;
}
