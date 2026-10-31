// Black-key Jam (Learn → Make music): a groove loops and every black key sounds good over it (the black keys
// are a pentatonic scale), so there are no wrong notes. Each jam records itself into My Songs.
// With the microphone on, the groove is drums only, so the chicken's ears hear just the piano; with screen
// keys or a USB keyboard it adds soft chords.
import { playNote, say, startBeat, audioContext } from './audio.js';
import { makeKeyboard } from './keyboard.js';
import { isBlack } from './music.js';
import { JAM_START, JAM_STOP } from './lines.js';
import type { NoteSource, RecInfo } from './types';

const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector<T>(s)!;

// A groove: speed, the chords (one per bar, looping; [bass, ...chord]) and which eighths get a drum.
// F♯ major, D♯ minor and G♯ minor only use notes that sit well under the black keys.
const Fs = [42, 54, 58, 61], Ds = [39, 51, 54, 58], Gs = [44, 56, 59, 63];
export const GROOVES = [
  { id: 'slow', emoji: '🐢', bpm: 76, chords: [Fs, Ds], kick: [0, 4], snare: [2, 6], vel: 0.35 },
  { id: 'fast', emoji: '🐇', bpm: 112, chords: [Fs, Gs, Ds, Fs], kick: [0, 3, 4], snare: [2, 6], vel: 0.3 },
  { id: 'moon', emoji: '🌙', bpm: 64, chords: [Ds, Gs], kick: [0], snare: [], vel: 0.3 },
];
type Groove = (typeof GROOVES)[number];

export interface JamApp {
  setInput: (onNote: (m: number, source: NoteSource) => void) => void;
  noteIn: (m: number, source: NoteSource) => void;
  keyUp: (m: number) => void;
  bubble: (el: HTMLElement, html: string) => void;
  bigLetter: (m: number) => string;
  act: (chicken: Element | null, cls: string, ms?: number) => void;
  // true while the microphone is what hears the piano (then the groove leaves out the chords)
  micEars: () => boolean;
  // starts a recording without a word (and the 🔴 button shows it); finishing it saves into My Songs
  record: (b: HTMLElement, what: RecInfo) => void;
  stopRecording: () => boolean; // true if a jam was saved
}

// Drums made on the spot: a thump that slides down (no steady pitch, so the mic doesn't take it for a key)
// and a short hiss.
function drum(kind: 'kick' | 'snare', vel: number) {
  const ctx = audioContext().rawContext as AudioContext;
  const t = ctx.currentTime + 0.01;
  const g = ctx.createGain();
  g.connect(ctx.destination);
  if (kind === 'kick') {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.2);
  } else {
    const n = Math.round(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    g.gain.value = vel * 0.8;
    src.connect(bp).connect(g);
    src.start(t);
  }
}

export function setupJam(app: JamApp) {
  const onRelease = ((m: number) => app.keyUp(m)) as unknown as () => void;
  const kb = makeKeyboard($('#jamKb'), (m: number) => app.noteIn(m, 'tap'), onRelease);
  const chicken = () => document.querySelector('#jamChicken');
  const J = { groove: null as Groove | null, beat: null as ReturnType<typeof startBeat> | null, notes: 0, tok: 0 };

  function paint() {
    document.querySelectorAll<HTMLElement>('#jam [data-groove]').forEach((b) => b.classList.toggle('on', !!J.groove && b.dataset.groove === J.groove.id));
    chicken()?.classList.toggle('dance', !!J.groove);
  }
  function stop() {
    if (J.beat) J.beat.stop();
    J.beat = null;
    J.groove = null;
    paint();
  }
  function play(g: Groove) {
    stop();
    J.groove = g;
    J.notes = 0;
    paint();
    const t = ++J.tok;
    // eighth-note pecks are the hi-hat (the mic knows they're ours); the drums and chords ride along
    J.beat = startBeat({
      bpm: g.bpm, every: 0.5, accent: (k) => k % 8 === 0,
      onBeat: (k, _p) => {
        if (t !== J.tok) return;
        const e = k % 8;
        if (g.kick.includes(e)) drum('kick', 0.9);
        if (g.snare.includes(e)) drum('snare', 0.6);
        if (e === 0 && !app.micEars()) {
          const c = g.chords[Math.floor(k / 8) % g.chords.length];
          playNote(c, (60 / g.bpm) * 4 * 0.95, undefined, g.vel);
        }
      },
    });
    app.record($('#jamRec'), { title: 'Black-key Jam', emoji: '⚫', song: null });
  }

  function render() {
    stop();
    kb.reset();
    kb.setRange(54, 78);
    kb.setLetters('none');
    kb.setGroups(true);
    app.setInput(input);
    app.bubble($('#jamBubble'), '⚫ 🎹 🎶');
    say(JAM_START);
  }
  function input(m: number) {
    J.notes++;
    kb.flash(m, isBlack(m) ? 'good' : 'down', 300);
    app.act(chicken(), J.notes % 3 ? 'peck' : 'happy', 400);
    app.bubble($('#jamBubble'), app.bigLetter(m));
  }

  document.querySelectorAll<HTMLElement>('#jam [data-groove]').forEach((b) => b.addEventListener('click', () => {
    const g = GROOVES.find((x) => x.id === b.dataset.groove)!;
    if (J.groove === g) { stop(); if (app.stopRecording()) say(JAM_STOP); return; }
    play(g);
  }));

  return {
    screens: { jam: render },
    leave() { J.tok++; stop(); },
    J, // for tests
  };
}
