// Song upload: turns a score file a grown-up picks (MusicXML .musicxml/.xml, compressed MusicXML .mxl, or MIDI
// .mid) into a song in the songs.js format, so it plays, scrolls, listens and scores like any built-in song.
// No audio track is needed: the app plays the notes with its own piano.
//
// What comes across: the melody (top note of the right hand / top staff / highest part), the left hand when the
// file has one (second staff, a lower part, or the low notes of a one-track MIDI file), note lengths rounded to
// sixteenths and split at bar lines with ties, key, time, tempo, pickup and (MusicXML) lyrics. What doesn't: repeats
// are played straight through as written, grace notes are dropped, triplets get rounded, and time signatures other
// than 4/4, 3/4 and 6/8 are drawn in the nearest of those (a warning says so).
import * as midiLib from '@tonejs/midi';
import { unzipSync, strFromU8 } from 'fflate';
// the browser build gets the library's ES module (Midi is a named export); Node gets its CommonJS build (under default)
const Midi: typeof midiLib.Midi = midiLib.Midi || (midiLib as unknown as { default: typeof midiLib }).default.Midi;
type Midi = InstanceType<typeof Midi>;
import type { SongData } from './types.ts';

// A spelled pitch: MIDI number plus, when the file says, its letter and accidental
export interface P { m: number; step?: string; alter?: number }
// Something sounding from t for d, both in sixteenths from the start
export interface Ev { t: number; d: number; ps: P[]; lyric?: string }
export interface Score {
  title: string;
  key: string; // one of the app's keys ('C', 'Bb', 'F#m'...)
  time: '4/4' | '3/4' | '6/8';
  tempo: number; // quarter notes a minute
  pickup: number; // sixteenths before the first full bar
  rh: Ev[];
  lh: Ev[];
  warnings: string[];
}

const MAJOR: Record<number, string> = { [-5]: 'Db', [-4]: 'Ab', [-3]: 'Eb', [-2]: 'Bb', [-1]: 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#' };
const MINOR: Record<number, string> = { [-4]: 'Fm', [-3]: 'Cm', [-2]: 'Gm', [-1]: 'Dm', 0: 'Am', 1: 'Em', 2: 'Bm', 3: 'F#m', 4: 'C#m' };
const FIFTHS: Record<string, number> = {};
Object.entries(MAJOR).forEach(([f, k]) => { FIFTHS[k] = +f; });
Object.entries(MINOR).forEach(([f, k]) => { FIFTHS[k] = +f; });
const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const L7 = 'CDEFGAB';

function keyName(fifths: number, minor: boolean, warnings: string[]): string {
  const k = (minor ? MINOR : MAJOR)[fifths] ?? MAJOR[fifths];
  if (k) return k;
  warnings.push('The key has too many sharps or flats for the app, so the staff shows them note by note.');
  return minor ? 'Am' : 'C';
}

// The file's time signature -> the app's nearest one, and how many sixteenths a bar has in it
function timeOf(num: number, den: number, warnings: string[]): { time: Score['time']; bar: number } {
  const q = (num * 4) / den; // quarters per bar in the file
  if (den === 8 && num % 3 === 0 && num % 2 === 0) return { time: '6/8', bar: 12 }; // 6/8, 12/8
  if (Math.abs(q - 3) < 1e-6) return { time: '3/4', bar: 12 };
  if (Math.abs(q - 4) < 1e-6 || Math.abs(q - 2) < 1e-6) return { time: '4/4', bar: 16 }; // 4/4, 2/2, 2/4 (two bars in one)
  warnings.push(`The app has no ${num}/${den} time, so the bars are drawn in 4/4. The notes are all there.`);
  return { time: '4/4', bar: 16 };
}

// Keys sounding together at the same moment become one event. Right hand: the top note only (the melody),
// held until the next one starts. Left hand: up to three keys, held until the next one starts.
function line(evs: Ev[], hand: 'rh' | 'lh'): Ev[] {
  const at = new Map<number, Ev>();
  for (const e of evs) {
    if (e.d <= 0) continue;
    const g = at.get(e.t);
    if (!g) { at.set(e.t, { t: e.t, d: e.d, ps: [...e.ps], lyric: e.lyric }); continue; }
    g.ps.push(...e.ps);
    g.d = Math.max(g.d, e.d);
    if (!g.lyric && e.lyric) g.lyric = e.lyric;
  }
  const out = [...at.values()].sort((a, b) => a.t - b.t);
  out.forEach((e, i) => {
    const seen = new Set<number>();
    e.ps = e.ps.sort((a, b) => b.m - a.m).filter((p) => !seen.has(p.m) && !!seen.add(p.m));
    // left-hand chords low to high (C3+E3+G3), at most three keys
    e.ps = hand === 'rh' ? e.ps.slice(0, 1) : e.ps.slice(-3).reverse();
    const next = out[i + 1];
    if (next && e.t + e.d > next.t) e.d = next.t - e.t;
  });
  return out.filter((e) => e.d > 0);
}

/* ---------------------------------------------- MusicXML ---------------------------------------------- */

// Only plain DOM calls (getElementsByTagName, getAttribute, textContent), so tests can use @xmldom/xmldom
type El = Element;
const kids = (el: El, tag?: string): El[] => {
  const out: El[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (!tag || (n as El).nodeName === tag)) out.push(n as El);
  return out;
};
const kid = (el: El | null | undefined, tag: string): El | null => (el ? kids(el, tag)[0] || null : null);
const txt = (el: El | null | undefined, tag: string): string => (kid(el, tag)?.textContent || '').trim();
const num = (el: El | null | undefined, tag: string, d = 0): number => { const v = parseFloat(txt(el, tag)); return isFinite(v) ? v : d; };

export function fromMusicXml(xml: string, parseXml: (x: string) => Document = (x) => new DOMParser().parseFromString(x, 'application/xml')): Score {
  const doc = parseXml(xml);
  const root = doc.documentElement;
  if (!root || root.nodeName === 'parsererror' || doc.getElementsByTagName('parsererror').length) throw new Error('This file isn\'t readable MusicXML.');
  if (root.nodeName === 'score-timewise') throw new Error('This is "timewise" MusicXML, which is rare. Export it again as regular MusicXML.');
  if (root.nodeName !== 'score-partwise') throw new Error('This file isn\'t MusicXML.');
  const warnings: string[] = [];
  const title = txt(kid(root, 'work'), 'work-title') || txt(root, 'movement-title')
    // else the biggest words on the title page (the title, not the composer)
    || Array.from(root.getElementsByTagName('credit-words')).map((c) => ({ t: (c.textContent || '').trim(), size: parseFloat(c.getAttribute('font-size') || '') || 0 }))
      .filter((c) => c.t).sort((a, b) => b.size - a.size)[0]?.t || '';

  let fifths: number | null = null, minor = false, beats = 0, beatType = 0, tempo = 0, pickup = 0, firstBar = 0;
  let graceSkipped = false, tupletSeen = false;
  // each part: its staves' events
  const parts: { name: string; staves: Map<number, Ev[]> }[] = [];
  const partNames = new Map(Array.from(root.getElementsByTagName('score-part')).map((sp) => [sp.getAttribute('id') || '', txt(sp, 'part-name')]));

  kids(root, 'part').forEach((part, pi) => {
    const staves = new Map<number, Ev[]>();
    const add = (staff: number, e: Ev) => { if (!staves.has(staff)) staves.set(staff, []); staves.get(staff)!.push(e); };
    // a tie that started: staff + pitch -> the event to lengthen
    const open = new Map<string, Ev>();
    let div = 1, pos = 0, measureStart = 0;
    kids(part, 'measure').forEach((meas, mi) => {
      measureStart = pos;
      let far = pos, lastStart = pos;
      for (const el of kids(meas)) {
        const tag = el.nodeName;
        if (tag === 'attributes') {
          div = num(el, 'divisions', div) || div;
          const key = kid(el, 'key');
          if (key && fifths === null && pi === 0) { fifths = num(key, 'fifths'); minor = txt(key, 'mode') === 'minor'; }
          const time = kid(el, 'time');
          if (time && pi === 0) {
            const b = parseInt(txt(time, 'beats')), bt = parseInt(txt(time, 'beat-type'));
            if (!beats && b && bt) { beats = b; beatType = bt; } else if (beats && b && bt && (b !== beats || bt !== beatType)) {
              if (!warnings.some((w) => w.includes('changes time'))) warnings.push('The song changes time signature partway; the app keeps the first one.');
            }
          }
        } else if (tag === 'direction' || tag === 'sound') {
          const snd = tag === 'sound' ? el : el.getElementsByTagName('sound')[0];
          const t = snd ? parseFloat(snd.getAttribute('tempo') || '') : NaN;
          const pm = parseFloat(txt(el.getElementsByTagName('metronome')[0], 'per-minute'));
          if (!tempo && isFinite(t) && t > 0) tempo = t; else if (!tempo && isFinite(pm) && pm > 0) tempo = pm;
        } else if (tag === 'backup') pos -= num(el, 'duration');
        else if (tag === 'forward') { pos += num(el, 'duration'); far = Math.max(far, pos); }
        else if (tag === 'note') {
          if (kid(el, 'grace')) { graceSkipped = true; continue; }
          if (kid(el, 'cue')) continue;
          if (kid(el, 'time-modification')) tupletSeen = true;
          const dur = num(el, 'duration');
          const chord = !!kid(el, 'chord');
          const start = chord ? lastStart : pos;
          if (!chord) { lastStart = pos; pos += dur; far = Math.max(far, pos); }
          const pitch = kid(el, 'pitch');
          if (!pitch || kid(el, 'rest')) continue;
          const step = txt(pitch, 'step'), alter = Math.round(num(pitch, 'alter')), oct = num(pitch, 'octave', 4);
          if (!(step in STEP)) continue;
          const m = 12 * (oct + 1) + STEP[step] + alter;
          const staff = parseInt(txt(el, 'staff')) || 1;
          const t16 = Math.round((start * 4) / div), d16 = Math.round(((start + dur) * 4) / div) - t16;
          const ties = Array.from(el.getElementsByTagName('tie')).map((x) => x.getAttribute('type'));
          const id = `${staff}:${m}`;
          const prev = open.get(id);
          if (ties.includes('stop') && prev && prev.t + prev.d === t16) {
            prev.d += d16;
            if (!ties.includes('start')) open.delete(id);
            continue;
          }
          const lyr = kid(el, 'lyric');
          let lyric: string | undefined;
          if (lyr) {
            const word = txt(lyr, 'text').replace(/\s+/g, '');
            const syl = txt(lyr, 'syllabic');
            if (word) lyric = word + (syl === 'begin' || syl === 'middle' ? '-' : '');
          }
          const e: Ev = { t: t16, d: d16, ps: [{ m, step, alter }], lyric };
          add(staff, e);
          if (ties.includes('start')) open.set(id, e); else open.delete(id);
        }
      }
      pos = far;
      // the first bar is a pickup when the file says so or it's shorter than a full bar
      if (mi === 0 && pi === 0) firstBar = Math.round(((far - measureStart) * 4) / div) * (meas.getAttribute('implicit') === 'yes' ? -1 : 1);
    });
    parts.push({ name: partNames.get(part.getAttribute('id') || '') || '', staves });
  });

  if (!beats) { beats = 4; beatType = 4; }
  const { time, bar } = timeOf(beats, beatType, warnings);
  const fileBar = Math.round((beats * 16) / beatType);
  if (firstBar < 0 || (firstBar > 0 && firstBar < fileBar)) pickup = Math.abs(firstBar) % bar;
  if (graceSkipped) warnings.push('Grace notes (tiny quick notes) were left out.');
  if (tupletSeen) warnings.push('Triplets were rounded to the nearest eighths and sixteenths.');

  // Which notes are which hand: a piano part with two staves is easy. Otherwise the first part is the melody
  // and the lowest-sounding other part (if any) is the left hand.
  const avg = (l: Ev[]) => l.reduce((a, e) => a + e.ps[0].m, 0) / Math.max(1, l.length);
  const withNotes = parts.filter((p) => [...p.staves.values()].some((l) => l.length));
  if (!withNotes.length) throw new Error('No notes found in this file.');
  let rh: Ev[], lh: Ev[] = [];
  const first = withNotes[0];
  const staffNums = [...first.staves.keys()].sort();
  if (staffNums.length >= 2) {
    rh = first.staves.get(staffNums[0])!; lh = first.staves.get(staffNums[1])!;
  } else {
    rh = first.staves.get(staffNums[0])!;
    const others = withNotes.slice(1).map((p) => [...p.staves.values()].flat()).filter((l) => l.length && avg(l) < avg(rh));
    if (others.length) lh = others.sort((a, b) => avg(a) - avg(b))[0];
    if (withNotes.length > 2) warnings.push(`The file has ${withNotes.length} parts; the app uses the top one as the tune${lh.length ? ' and the lowest one as the left hand' : ''}.`);
  }
  const key = fifths === null ? guessKey([...rh, ...lh]) : keyName(fifths, minor, warnings);
  return { title, key, time, tempo: Math.round(tempo) || 100, pickup, rh: line(rh, 'rh'), lh: line(lh, 'lh'), warnings };
}

// File bytes -> text: UTF-8, or UTF-16 when the file starts with its byte-order mark (some older exports)
export function decodeText(b: Uint8Array): string {
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  return new TextDecoder('utf-8').decode(b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? b.subarray(3) : b);
}

// .mxl is a zip holding the MusicXML (META-INF/container.xml names it)
export function unzipMxl(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch (e) { throw new Error('This .mxl file couldn\'t be opened.'); }
  const names = Object.keys(files);
  const container = files['META-INF/container.xml'] ? strFromU8(files['META-INF/container.xml']) : '';
  const named = container.match(/full-path="([^"]+)"/)?.[1];
  const main = named && files[named] ? named : names.find((n) => !n.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(n));
  if (!main) throw new Error('No music found inside this .mxl file.');
  return decodeText(files[main]);
}

/* ------------------------------------------------ MIDI ------------------------------------------------ */

export function fromMidi(bytes: Uint8Array): Score {
  let midi: Midi;
  try { midi = new Midi(bytes); } catch (e) { throw new Error('This MIDI file couldn\'t be read.'); }
  const warnings: string[] = [];
  const ppq = midi.header.ppq || 480;
  const s16 = (ticks: number) => Math.round((ticks * 4) / ppq);
  const tracks = midi.tracks.filter((t) => t.notes.length && !t.instrument.percussion && t.channel !== 9);
  if (!tracks.length) throw new Error('No notes found in this MIDI file.');
  const ts = midi.header.timeSignatures[0]?.timeSignature || [4, 4];
  const { time, bar } = timeOf(ts[0], ts[1], warnings);
  const evs = (t: (typeof tracks)[number]): Ev[] => t.notes.map((n) => ({ t: s16(n.ticks), d: Math.max(1, s16(n.ticks + n.durationTicks) - s16(n.ticks)), ps: [{ m: n.midi }] }));
  const avg = (l: Ev[]) => l.reduce((a, e) => a + e.ps[0].m, 0) / Math.max(1, l.length);
  let rh: Ev[], lh: Ev[] = [];
  if (tracks.length === 1) {
    // one piano track: split at middle C. A low note on its own (nothing else starting or still sounding) is
    // the tune dipping low, so it stays in the right hand.
    const all = evs(tracks[0]);
    const alone = (e: Ev) => !all.some((o) => o !== e && o.t <= e.t && o.t + o.d > e.t);
    rh = all.filter((e) => e.ps[0].m >= 60 || alone(e)); lh = all.filter((e) => e.ps[0].m < 60 && !alone(e));
    if (!rh.length || rh.length < lh.length / 4) { rh = all; lh = []; }
  } else {
    const ls = tracks.map(evs).sort((a, b) => avg(b) - avg(a));
    rh = ls[0]; lh = ls[ls.length - 1];
    if (tracks.length > 2) warnings.push(`The file has ${tracks.length} tracks; the app uses the highest one as the tune and the lowest as the left hand.`);
  }
  // the song starts at the first note's bar; a first note partway into it makes a pickup
  const firstT = Math.min(...[...rh, ...lh].map((e) => e.t));
  const shift = Math.floor(firstT / bar) * bar;
  let pickup = 0;
  const into = firstT - shift;
  if (into > 0) pickup = bar - into;
  const move = (l: Ev[]) => l.map((e) => ({ ...e, t: e.t - shift - into }));
  const ks = midi.header.keySignatures[0];
  let key = ks ? `${ks.key}${ks.scale === 'minor' ? 'm' : ''}` : '';
  if (!(key in FIFTHS)) key = guessKey([...rh, ...lh]);
  const bpm = midi.header.tempos[0]?.bpm || 100;
  // (track names are usually just 'Piano', so the file's name stands in when the song has none)
  return { title: (midi.name || '').trim(), key, time, tempo: Math.round(bpm), pickup, rh: line(move(rh), 'rh'), lh: line(move(lh), 'lh'), warnings };
}

// The key whose scale holds the most of the music (fewer sharps/flats wins a tie); minor when the tune ends
// on the minor home note.
function guessKey(evs: Ev[]): string {
  const w = new Array(12).fill(0);
  evs.forEach((e) => e.ps.forEach((p) => { w[((p.m % 12) + 12) % 12] += e.d; }));
  let best = 0, bestScore = -1;
  for (let f = -5; f <= 6; f++) {
    const tonic = ((f * 7) % 12 + 12) % 12;
    const score = [0, 2, 4, 5, 7, 9, 11].reduce((a, s) => a + w[(tonic + s) % 12], 0);
    if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) < 1e-9 && Math.abs(f) < Math.abs(best))) { best = f; bestScore = score; }
  }
  const last = [...evs].sort((a, b) => a.t - b.t).pop();
  const relMinor = (((best * 7) % 12 + 12) % 12 + 9) % 12;
  if (last && MINOR[best] && last.ps.some((p) => ((p.m % 12) + 12) % 12 === relMinor)) return MINOR[best];
  return MAJOR[best];
}

/* ----------------------------------------- score -> song tokens ----------------------------------------- */

// "Bb3": the file's spelling when it has one, else spelled for the key (sharps in sharp keys and C, flats in flat keys)
export function spell(p: P, key: string): string {
  let letter: string, acc: number;
  if (p.step && p.alter !== undefined && Math.abs(p.alter) <= 1) { letter = p.step; acc = p.alter; }
  else {
    const f = FIFTHS[key] ?? 0, pc = ((p.m % 12) + 12) % 12;
    // the key's own spelling of this pitch class, if it's in the scale
    const sig: Record<string, number> = {};
    for (let i = 0; i < Math.abs(f); i++) sig[(f > 0 ? 'FCGDAEB' : 'BEADGCF')[i]] = f > 0 ? 1 : -1;
    const inKey = L7.split('').find((l) => ((STEP[l] + (sig[l] || 0)) % 12 + 12) % 12 === pc);
    if (inKey) { letter = inKey; acc = sig[inKey] || 0; }
    else {
      const nat = L7.split('').find((l) => STEP[l] === pc);
      if (nat) { letter = nat; acc = 0; }
      else if (f < 0) { letter = L7.split('').find((l) => STEP[l] === pc + 1)!; acc = -1; }
      else { letter = L7.split('').find((l) => STEP[l] === pc - 1)!; acc = 1; }
    }
  }
  const oct = Math.floor((p.m - STEP[letter] - acc) / 12) - 1;
  return letter + (acc > 0 ? '#' : acc < 0 ? 'b' : '') + oct;
}

// Sixteenths -> note values, longest first. A note starting off the beat is first tied up to the next beat
// (beat = a quarter, or a dotted quarter in 6/8), which is how printed music shows it too.
const VALUES: [number, string][] = [[16, 'w'], [12, 'hd'], [8, 'h'], [6, 'qd'], [4, 'q'], [2, '8'], [1, '16']];
export function pieces(len: number, from: number, beat: number): string[] {
  const out: string[] = [];
  let left = len, at = from;
  while (left > 0) {
    const off = at % beat, limit = off ? Math.min(left, beat - off) : left;
    // off the beat, eighths and sixteenths only, each on its own grid (16 then 8, not 8 then 16)
    const [v, d] = VALUES.find(([v]) => v <= limit && (!off || (v <= 2 && at % v === 0)))!;
    out.push(d);
    left -= v; at += v;
  }
  return out;
}

// Events -> note tokens (and lyric words), with rests in the gaps, split at bar lines with ties
function tokens(evs: Ev[], end: number, pickup: number, bar: number, sixEight: boolean, key: string, withLyrics: boolean): { notes: string; lyrics: string[] } {
  const toks: string[] = [], words: string[] = [];
  const barPos = (t: number) => (((t - pickup) % bar) + bar) % bar;
  const put = (t: number, len: number, body: string | null, lyric?: string) => {
    // cut at each bar line
    let at = t, left = len, firstWord = true;
    while (left > 0) {
      const room = bar - barPos(at), chunk = Math.min(left, at < pickup ? pickup - at : room);
      const ds = pieces(chunk, barPos(at), bar === 12 && sixEight ? 6 : 4);
      ds.forEach((d, i) => {
        const last = left - chunk <= 0 && i === ds.length - 1;
        if (!body) { toks.push(d === 'q' ? 'R' : `R:${d}`); return; }
        toks.push(`${body}${d === 'q' ? '' : ':' + d}${last ? '' : '~'}`);
        if (withLyrics) words.push(firstWord && lyric ? lyric : '_');
        firstWord = false;
      });
      at += chunk; left -= chunk;
    }
  };
  let t = 0;
  for (const e of evs) {
    if (e.t > t) put(t, e.t - t, null);
    put(e.t, e.d, e.ps.map((p) => spell(p, key)).join('+'), e.lyric);
    t = e.t + e.d;
  }
  if (end > t) put(t, end - t, null);
  return { notes: toks.join(' '), lyrics: words };
}

// A first guess at the level, from what the tune asks of the player. The grown-up can change it.
export function guessLevel(song: Pick<SongData, 'notes' | 'time'>): number {
  const toks = song.notes.split(/\s+/);
  const ms = toks.filter((x) => !x.startsWith('R')).map((x) => x.split(':')[0].replace('~', '').split('+')[0]);
  const midi = (n: string) => { const [, l, a, o] = n.match(/^([A-G])([#b]?)(\d)$/)!; return 12 * (+o + 1) + STEP[l] + (a === '#' ? 1 : a === 'b' ? -1 : 0); };
  const lo = Math.min(...ms.map(midi)), hi = Math.max(...ms.map(midi));
  const durs = new Set(toks.map((x) => x.replace('~', '').split(':')[1] || 'q'));
  let lv = 2;
  if (lo < 60 || hi > 67) lv = 4;
  if (lo < 60) lv = 5;
  if (song.time === '3/4' || durs.has('hd')) lv = 6;
  if (durs.has('8') || durs.has('qd') || toks.some((x) => x.endsWith('~'))) lv = 7;
  if (ms.some((n) => /[#b]/.test(n))) lv = 8;
  if (durs.has('16') || song.time === '6/8' || hi - lo > 14 || toks.some((x) => x.includes('+'))) lv = 10;
  return lv;
}

export interface Draft { song: SongData; hasLh: boolean; notes: number; warnings: string[] }

// A score -> a song ready to save (id and level filled in; the grown-up can rename it and change the level)
export function toSong(sc: Score, id: string, fallbackTitle: string): Draft {
  const warnings = [...sc.warnings];
  let rh = sc.rh, lh = sc.lh;
  if (!rh.length) throw new Error('No tune found in this file.');
  // keep the tune where little hands find it: move it by octaves so its middle sits near the C above middle C
  const mid = rh.map((e) => e.ps[0].m).sort((a, b) => a - b)[rh.length >> 1];
  const up = Math.round((66 - mid) / 12) * 12;
  if (up) {
    const move = (l: Ev[], by: number) => l.map((e) => ({ ...e, ps: e.ps.map((p) => ({ ...p, m: p.m + by })) }));
    rh = move(rh, up);
    if (lh.length) lh = move(lh, up);
    warnings.push(`The tune was moved ${Math.abs(up / 12)} octave${Math.abs(up) > 12 ? 's' : ''} ${up > 0 ? 'up' : 'down'} to fit the keyboard better.`);
  }
  // left hand: keep it in C2..C5 (or drop it), and below the tune's lowest note mostly
  if (lh.length) {
    const lmid = lh.map((e) => e.ps[0].m).sort((a, b) => a - b)[lh.length >> 1]; // ps[0] is a chord's lowest key
    const by = lmid > 60 ? -12 : lmid < 36 ? 12 : 0;
    if (by) lh = lh.map((e) => ({ ...e, ps: e.ps.map((p) => ({ ...p, m: p.m + by })) }));
    lh = lh.map((e) => ({ ...e, ps: e.ps.filter((p) => p.m >= 36 && p.m <= 72) })).filter((e) => e.ps.length);
  }
  const bar = sc.time === '4/4' ? 16 : 12;
  const pickup = sc.pickup > 0 && sc.pickup < bar ? sc.pickup : 0;
  const endOf = (l: Ev[]) => (l.length ? l[l.length - 1].t + l[l.length - 1].d : 0);
  const end = Math.max(endOf(rh), endOf(lh));
  const withLyrics = rh.some((e) => e.lyric);
  const r = tokens(rh, end, pickup, bar, sc.time === '6/8', sc.key, withLyrics);
  const l = lh.length ? tokens(lh, end, pickup, bar, sc.time === '6/8', sc.key, false) : null;
  const title = (sc.title || fallbackTitle).replace(/[<>&"]/g, '').trim().slice(0, 60) || 'My song';
  const song: SongData = {
    id, level: 1, emoji: '🎼', title, sub: '', key: sc.key, time: sc.time, tempo: Math.min(200, Math.max(40, sc.tempo)),
    notes: r.notes, lyrics: withLyrics ? r.lyrics.join(' ').replace(/[<>&"]/g, '') : '',
    ...(pickup ? { pickup: pickup / 4 } : {}),
    ...(l ? { lh: l.notes, lhStyle: 'own' } : {}),
  };
  song.level = guessLevel(song);
  return { song, hasLh: !!l, notes: r.notes.split(/\s+/).filter((x) => !x.startsWith('R')).length, warnings };
}

// A picked file -> a draft song. Throws an Error a grown-up can read.
export function importScore(name: string, bytes: Uint8Array, id: string, parseXml?: (x: string) => Document): Draft {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  const head = strFromU8(bytes.subarray(0, 4), true);
  let sc: Score;
  if (head === 'MThd' || /\.midi?$/i.test(name)) sc = fromMidi(bytes);
  else if (head.startsWith('PK') || /\.mxl$/i.test(name)) sc = fromMusicXml(unzipMxl(bytes), parseXml);
  else if (/\.(xml|musicxml)$/i.test(name) || /<score-(partwise|timewise)/.test(decodeText(bytes.subarray(0, 4000)))) sc = fromMusicXml(decodeText(bytes), parseXml);
  else throw new Error('Pick a MusicXML (.musicxml, .mxl, .xml) or MIDI (.mid) file.');
  return toSong(sc, id, base);
}
