// On-screen piano keyboard (C4 to E5), colored by note letter.
import { COLORS, letterOf, isBlack } from './music.js';

export const LOW = 60;
export const HIGH = 76;

export function makeKeyboard(root, onPress) {
  root.className = 'kb';
  root.dataset.letters = 'all';
  const keys = {};
  const whites = [];
  for (let m = LOW; m <= HIGH; m++) if (!isBlack(m)) whites.push(m);
  root.style.setProperty('--bw', (100 / whites.length) * 0.6 + '%');

  whites.forEach((m) => {
    const k = document.createElement('div');
    k.className = 'wkey';
    k.dataset.m = m;
    k.style.setProperty('--c', COLORS[letterOf(m)]);
    k.innerHTML = `<span class="kl">${letterOf(m)}</span>`;
    root.appendChild(k);
    keys[m] = k;
  });
  for (let m = LOW; m <= HIGH; m++) {
    if (!isBlack(m)) continue;
    const idx = whites.indexOf(m - 1) + 1;
    const k = document.createElement('div');
    k.className = 'bkey';
    k.dataset.m = m;
    k.dataset.g = [1, 3].includes(m % 12) ? 2 : 3;
    k.style.left = `calc(${(idx / whites.length) * 100}% - var(--bw) / 2)`;
    root.appendChild(k);
    keys[m] = k;
  }

  root.addEventListener('pointerdown', (e) => {
    const k = e.target.closest('[data-m]');
    if (!k) return;
    e.preventDefault();
    const m = +k.dataset.m;
    flash(m, 'down', 180);
    onPress(m);
  });

  function flash(m, cls, ms = 400) {
    const k = keys[m];
    if (!k) return;
    k.classList.remove(cls);
    void k.offsetWidth;
    k.classList.add(cls);
    setTimeout(() => k.classList.remove(cls), ms);
  }
  // Find the on-screen key for a heard note: same note in our range, else same letter.
  function keyFor(m) {
    if (keys[m]) return m;
    for (let x = LOW; x <= HIGH; x++) if (x % 12 === m % 12) return x;
    return null;
  }

  return {
    keys,
    flash: (m, cls, ms) => { const k = keyFor(m); if (k !== null) flash(k, cls, ms); },
    setTarget(m) {
      Object.values(keys).forEach((k) => k.classList.remove('target'));
      if (m != null && keys[m]) keys[m].classList.add('target');
    },
    setHL(list = []) {
      Object.values(keys).forEach((k) => k.classList.toggle('hl', list.includes(+k.dataset.m)));
    },
    setLetters(mode) { root.dataset.letters = mode; },
    setGroups(on) { root.classList.toggle('bgroups', !!on); },
    reset() { this.setTarget(null); this.setHL([]); this.setGroups(false); },
  };
}
