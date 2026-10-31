// Write a Song (Learn → Make music): pick a note length, then play keys (screen, mic or USB keyboard) and each
// one is written on the staff. 🤫 adds a rest, ⌫ takes the last note back, ▶️ plays it, 💾 saves it. Saved songs
// show up in Play Songs under ✏️ and play like any other song. Storage: src/mysongs.ts.
import { parse } from './music.js';
import { playSequence, say, stopTalking, cluck } from './audio.js';
import { drawStaff, focusNote } from './staff.js';
import { makeKeyboard } from './keyboard.js';
import { listMySongs, saveMySong, deleteMySong, MAX_NOTES } from './mysongs.js';
import type { MySong } from './mysongs.ts';
import { WRITE_START, WRITE_SAVED, WRITE_EMPTY, WRITE_FULL, throwAwayAsk } from './lines.js';
import type { NoteSource } from './types';

const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector<T>(s)!;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const tokenOf = (m: number, d: string) => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}:${d}`;
export const PICTURES = ['🎵', '🐔', '🌈', '🚀', '🦄', '🐶', '🐱', '🍕', '🌟', '🎃', '🦖', '🌊'];
const TEMPO = 100;

export interface WriteApp {
  show: (screen: string) => void;
  bubble: (el: HTMLElement, html: string) => void;
  bigLetter: (m: number) => string;
  act: (chicken: Element | null, cls: string, ms?: number) => void;
  ask: (icon: string, question: string, onYes: () => void) => void;
  toast: (text: string) => void;
  player: () => { id: string; name: string };
  setInput: (onNote: (m: number, source: NoteSource) => void) => void;
  noteIn: (m: number, source: NoteSource) => void;
  keyUp: (m: number) => void;
  // the saved songs changed (Play Songs lists them)
  changed: () => void;
}

export function setupWrite(app: WriteApp) {
  const onRelease = ((m: number) => app.keyUp(m)) as unknown as () => void;
  const kb = makeKeyboard($('#writeKb'), (m: number) => app.noteIn(m, 'tap'), onRelease);
  kb.setRange(55, 79);
  const chicken = () => document.querySelector('#writeChicken');
  const W = { id: null as string | null, emoji: PICTURES[0], title: '', tokens: [] as string[], len: 'q', stop: null as null | (() => void) };

  function open(id: string | null = null) {
    const s = id ? listMySongs(app.player().id).find((x) => x.id === id) : null;
    W.id = s ? s.id : null;
    W.emoji = s ? s.emoji : PICTURES[Math.floor(Math.random() * PICTURES.length)];
    W.title = s ? s.title : '';
    W.tokens = s ? s.notes.split(' ') : [];
    app.show('write');
  }
  function render() {
    stopPlay();
    W.len = 'q';
    paintLen();
    $('#writePic').textContent = W.emoji;
    $('#writeDel').style.display = W.id ? '' : 'none';
    app.setInput(input);
    draw();
    app.bubble($('#writeBubble'), '♩ 🎹 ✏️');
    if (!W.tokens.length) say(WRITE_START);
  }
  function paintLen() {
    document.querySelectorAll<HTMLElement>('#write [data-len]').forEach((b) => b.classList.toggle('on', b.dataset.len === W.len));
  }
  function draw(at = W.tokens.length - 1) {
    const notes = W.tokens.length ? parse(W.tokens.join(' ')) : [];
    const sounding = notes.filter((n) => !n.r);
    const low = sounding.filter((n) => n.keys[0].m < 60).length > sounding.length / 2;
    const d = drawStaff($('#writeStaff'), notes, { scroll: true, clef: low ? 'bass' : 'treble', time: '4/4', minWidth: 420 });
    if (W.tokens.length) focusNote($('#writeStaff'), d, Math.max(0, at));
    $('#writeCount').textContent = W.tokens.length ? String(W.tokens.length) : '';
  }
  function add(token: string) {
    if (W.tokens.length >= MAX_NOTES) { say(WRITE_FULL); return false; }
    W.tokens.push(token);
    draw();
    return true;
  }
  function input(m: number) {
    if (W.stop) return;
    if (!add(tokenOf(m, W.len))) return;
    kb.flash(m, 'good', 250);
    app.act(chicken(), 'peck', 300);
    app.bubble($('#writeBubble'), `✏️ ${app.bigLetter(m)}`);
  }
  function stopPlay() {
    if (W.stop) { W.stop(); W.stop = null; }
    $('#writePlay').textContent = '▶️';
    chicken()?.classList.remove('dance');
  }
  function save() {
    if (!W.tokens.some((t) => !t.startsWith('R'))) { say(WRITE_EMPTY); return; }
    const pl = app.player();
    const mine = listMySongs(pl.id);
    const song: MySong = {
      id: W.id || 'u' + Date.now().toString(36), at: Date.now(), emoji: W.emoji,
      title: W.title || `${pl.name}'s song ${mine.length + 1}`, notes: W.tokens.join(' '),
    };
    if (!saveMySong(pl.id, song)) { app.toast('✏️ 📦 ❌'); return; }
    W.id = song.id; W.title = song.title;
    $('#writeDel').style.display = '';
    app.changed();
    cluck(2);
    app.act(chicken(), 'happy', 900);
    app.bubble($('#writeBubble'), `💾 ✅ ${W.emoji}`);
    say(WRITE_SAVED);
  }

  document.querySelectorAll<HTMLElement>('#write [data-len]').forEach((b) => b.addEventListener('click', () => { W.len = b.dataset.len!; paintLen(); cluck(1); }));
  $('#writeRest').addEventListener('click', () => { if (!W.stop && add(`R:${W.len}`)) app.bubble($('#writeBubble'), '✏️ 🤫'); });
  $('#writeUndo').addEventListener('click', () => { if (W.stop || !W.tokens.length) return; W.tokens.pop(); draw(); app.bubble($('#writeBubble'), '⌫'); });
  $('#writePic').addEventListener('click', () => { W.emoji = PICTURES[(PICTURES.indexOf(W.emoji) + 1) % PICTURES.length]; $('#writePic').textContent = W.emoji; });
  $('#writeSave').addEventListener('click', save);
  $('#writeDel').addEventListener('click', () => {
    if (!W.id) return;
    app.ask('🗑️', throwAwayAsk, () => { deleteMySong(app.player().id, W.id!); app.changed(); W.id = null; W.tokens = []; app.show('songs'); });
  });
  $('#writePlay').addEventListener('click', () => {
    if (W.stop) return stopPlay();
    if (!W.tokens.length) return;
    stopTalking();
    const notes = parse(W.tokens.join(' '));
    $('#writePlay').textContent = '⏹️';
    chicken()?.classList.add('dance');
    W.stop = playSequence(notes, TEMPO, (i) => {
      const n = notes[i];
      if (!n.r) n.keys.forEach((k) => kb.flash(k.m, 'hl', 300));
    }, () => { W.stop = null; stopPlay(); });
  });

  return {
    open,
    screens: { write: render },
    leave() { stopPlay(); },
    W, // for tests
  };
}
