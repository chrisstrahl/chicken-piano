// Song upload (src/scoreimport.ts): MusicXML, .mxl and MIDI files become songs the app can play.
// Builds small files here, imports them, and checks the notes, bars, ties, pickup, key, lyrics and left hand,
// then runs each result through the app's own song builder (music.ts) the way an uploaded song is loaded.
// Run: node test/scoreimport.mjs
import { DOMParser } from '@xmldom/xmldom';
import { zipSync, strToU8 } from 'fflate';
import pkg from '@tonejs/midi';
import { importScore, spell, pieces } from '../src/scoreimport.ts';
import { setPrivateSongs, SONGS } from '../src/music.ts';
import { cleanSong } from '../src/privatesongs.ts';

const { Midi } = pkg;
const xml = (x) => new DOMParser().parseFromString(x, 'application/xml');
let bad = 0;
const eq = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
};
const BEATS = { 16: 0.25, 8: 0.5, q: 1, qd: 1.5, h: 2, hd: 3, w: 4 };
// every bar adds up (after the pickup), and no note crosses a bar line
function barsOk(notes, perBar, pickup = 0) {
  let beat = -pickup;
  for (const tok of notes.split(/\s+/)) {
    const d = BEATS[tok.replace('~', '').split(':')[1] || 'q'];
    const start = beat; beat += d;
    if (Math.floor(start / perBar + 1e-9) !== Math.floor((beat - 1e-9) / perBar) && start >= 0) return `${tok} crosses a bar line at beat ${start}`;
  }
  return true;
}
// what the app does with a saved upload: clean it and build it
function load(song) {
  const c = cleanSong(song);
  if (!('song' in c)) return `cleanSong: ${c.why}`;
  const r = setPrivateSongs([c.song], 'up-');
  if (r.skipped.length) return r.skipped[0].why;
  const s = SONGS.find((x) => x.id === 'up-' + song.id);
  return s && s.notes.length ? true : 'not added';
}

/* ---- MusicXML: piano, two staves, pickup, tie across the bar, lyrics, a chord in the right hand ---- */
const note = (step, oct, dur, type, { alter, staff = 1, chord, tie, lyric, syl, voice = 1 } = {}) => `<note>${chord ? '<chord/>' : ''}<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${oct}</octave></pitch><duration>${dur}</duration>${tie ? `<tie type="${tie}"/>` : ''}<voice>${voice}</voice><type>${type}</type><staff>${staff}</staff>${lyric ? `<lyric number="1"><syllabic>${syl || 'single'}</syllabic><text>${lyric}</text></lyric>` : ''}</note>`;
const rest = (dur, staff = 1) => `<note><rest/><duration>${dur}</duration><voice>1</voice><staff>${staff}</staff></note>`;
const back = (dur) => `<backup><duration>${dur}</duration></backup>`;
// divisions 2 (an eighth = 1). Key F major, 3/4, one-beat pickup.
const musicxml = `<?xml version="1.0"?><score-partwise version="3.1"><work><work-title>Happy Hen Day</work-title></work>
<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
<part id="P1">
<measure number="0" implicit="yes"><attributes><divisions>2</divisions><key><fifths>-1</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>
<direction><sound tempo="90"/></direction>
${note('C', 4, 1, 'eighth', { lyric: 'Hap', syl: 'begin' })}${note('C', 4, 1, 'eighth', { lyric: 'py' , syl: 'end'})}${back(2)}${rest(2, 2)}</measure>
<measure number="1">${note('D', 4, 2, 'quarter', { lyric: 'hen' })}${note('C', 4, 2, 'quarter', { lyric: 'day' })}${note('F', 4, 2, 'quarter', { lyric: 'to' })}${note('A', 3, 2, 'quarter', { chord: true })}${back(6)}${note('F', 3, 6, 'half', { staff: 2 })}${note('A', 3, 6, 'half', { staff: 2, chord: true })}</measure>
<measure number="2">${note('E', 4, 6, 'half', { lyric: 'you', tie: 'start' })}</measure>
<measure number="3">${note('E', 4, 2, 'quarter', { tie: 'stop' })}${note('B', 4, 2, 'quarter', { alter: -1 })}${rest(2)}${back(6)}${note('C', 3, 6, 'half', { staff: 2 })}</measure>
</part></score-partwise>`;
const d1 = importScore('happy-hen.musicxml', strToU8(musicxml), 'hhd', xml);
eq('MusicXML title', d1.song.title, 'Happy Hen Day');
eq('MusicXML key, time, tempo, pickup', [d1.song.key, d1.song.time, d1.song.tempo, d1.song.pickup], ['F', '3/4', 90, 1]);
eq('MusicXML tune (top notes, tie across the bar, rests)', d1.song.notes, 'C4:8 C4:8 D4 C4 F4 E4:hd~ E4 Bb4 R');
eq('MusicXML lyrics line up', d1.song.lyrics, 'Hap- py hen day to you _ _');
eq('MusicXML left hand (chord, padded with rests)', d1.song.lh, 'R F3+A3:hd R:hd C3:hd');
eq('MusicXML bars add up', barsOk(d1.song.notes, 3, 1), true);
eq('MusicXML left-hand bars add up', barsOk(d1.song.lh, 3, 1), true);
eq('MusicXML song loads in the app', load(d1.song), true);

/* ---- .mxl: the same score zipped, with its container file ---- */
const mxl = zipSync({ 'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>'), 'score.xml': strToU8(musicxml) });
const d2 = importScore('Happy.mxl', mxl, 'hhd2', xml);
eq('.mxl gives the same song', d2.song.notes, d1.song.notes);

/* ---- MIDI: one piano track, split at middle C; D major (guessed: there's a C sharp); a note held across a bar line; a sixteenth ---- */
const midi = new Midi();
midi.header.setTempo(120);
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });
midi.header.update();
const tr = midi.addTrack();
const q = midi.header.ppq;
// tune: F#4 q, G4 8, A4 8, B4 h, (bar 2) A4 w... with the h at beat 3 tied into bar 2
[[66, 0, q], [67, q, q / 2], [69, 1.5 * q, q / 2], [71, 2 * q, 3 * q], [73, 5 * q, q / 4], [74, 5.25 * q, 2.75 * q]]
  .forEach(([m, t, d]) => tr.addNote({ midi: m, ticks: t, durationTicks: d }));
[[50, 0, 4 * q], [54, 0, 4 * q], [43, 4 * q, 4 * q]].forEach(([m, t, d]) => tr.addNote({ midi: m, ticks: t, durationTicks: d }));
tr.name = 'Piano';
const d3 = importScore('tune.mid', midi.toArray(), 'mid1');
eq('MIDI key and tempo', [d3.song.key, d3.song.time, d3.song.tempo], ['D', '4/4', 120]);
eq('MIDI tune (tied over the bar, sixteenth)', d3.song.notes, 'F#4 G4:8 A4:8 B4:h~ B4 C#5:16 D5:16~ D5:8~ D5:h');
eq('MIDI left hand', d3.song.lh, 'D3+F#3:w G2:w');
eq('MIDI bars add up', barsOk(d3.song.notes, 4), true);
eq('MIDI song loads in the app', load(d3.song), true);
eq('MIDI level guess (sixteenths: level 10)', d3.song.level, 10);

/* ---- MIDI with a pickup and no key signature (a flat key gets guessed and spelled with flats) ---- */
const m2 = new Midi();
const t2 = m2.addTrack();
const Q = m2.header.ppq;
// pickup: Bb3 on beat 4, then Eb4 h, F4 h, Bb4 w; all in Eb major
[[58, 3 * Q, Q], [63, 4 * Q, 2 * Q], [65, 6 * Q, 2 * Q], [70, 8 * Q, 2 * Q], [67, 10 * Q, Q], [68, 11 * Q, Q], [63, 12 * Q, 4 * Q]]
  .forEach(([m, t, d]) => t2.addNote({ midi: m, ticks: t, durationTicks: d }));
const d4 = importScore('song.mid', m2.toArray(), 'mid2');
eq('MIDI pickup found and key guessed', [d4.song.pickup, d4.song.key], [1, 'Eb']);
eq('MIDI flats spelled for the key', d4.song.notes, 'Bb3 Eb4:h F4:h Bb4:h G4 Ab4 Eb4:w');
eq('MIDI with pickup loads in the app', load(d4.song), true);

/* ---- odds and ends ---- */
eq('spelling: sharp key uses sharps, flat key flats', [spell({ m: 61 }, 'A'), spell({ m: 61 }, 'Ab'), spell({ m: 70 }, 'C'), spell({ m: 71, step: 'C', alter: -1 }, 'Gb')], ['C#4', 'Db4', 'A#4', 'Cb5']);
eq('off-beat notes tie up to the beat', [pieces(6, 2, 4), pieces(3, 0, 4), pieces(12, 0, 6)], [['8', 'q'], ['8', '16'], ['hd']]);
let err = '';
try { importScore('photo.jpg', new Uint8Array([255, 216, 255, 0]), 'x'); } catch (e) { err = e.message; }
eq('a wrong file says what to pick', /MusicXML/.test(err), true);
err = '';
try { importScore('empty.mid', new Midi().toArray(), 'x'); } catch (e) { err = e.message; }
eq('an empty MIDI file says no notes', /No notes/.test(err), true);

console.log(bad ? `${bad} FAILED` : 'all passed');
process.exit(bad ? 1 : 0);
