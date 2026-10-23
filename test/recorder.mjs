// Offline checks for recording logic: timing, mic notes, notation, storage, wav encoding.
// Usage: node test/recorder.mjs
import { makeRecorder, toTokens, guessTempo, noteValue, encodeWav, saveRecording, listRecordings, deleteRecording, deletePlayerRecordings, MAX_SAVED, lengthMs } from '../src/recorder.ts';
import { parse } from '../src/music.ts';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// a fake clock
let now = 1000;
const r = makeRecorder(() => now);
r.down(60, 'tap');
check(r.count === 0, 'nothing recorded before start');
r.start();
now += 500; r.down(60, 'tap', 0.5); now += 400; r.up(60);
now += 100; r.down(64, 'midi', 1); r.down(67, 'midi', 0.9); now += 1000; r.up(64); r.up(67);
now += 200; r.down(62, 'mic'); now += 300; r.down(64, 'mic'); now += 5000; // second mic note never "lifts"
const notes = r.stop();
check(!r.on, 'stopped');
check(eq(notes[0], [300, 60, 400, 0.5]), `first note starts 300ms in with its held length (${notes[0]})`);
check(notes[1][0] === 800 && notes[1][2] === 1000 && notes[2][1] === 67, 'chord notes keep their own timing');
check(notes[3][2] === 300, `a mic note rings until the next one (${notes[3][2]})`);
check(notes[4][2] === 1500, `the last mic note rings at most 1.5s (${notes[4][2]})`);
check(lengthMs(notes) === notes[4][0] + 1500, 'length');

r.start(); now += 2000;
check(r.stop() === null, 'an empty recording is null');

r.start(); r.down(60, 'tap'); now += 50;
const held = r.stop();
check(held[0][2] === 600, `a key still down at stop rings a bit (${held[0][2]})`);

// notation
check(noteValue(1) === 'q' && noteValue(0.45) === '8' && noteValue(2.2) === 'h' && noteValue(9) === 'w', 'note values');
const beat = 600; // 100 bpm
const tune = [[0, 60, 550, 0.8], [600, 62, 550, 0.8], [1200, 64, 1150, 0.8], [2400, 60, 550, 0.8], [2405, 64, 550, 0.8], [2410, 67, 550, 0.8], [4200, 72, 500, 0.8]];
check(guessTempo(tune) === 100, `tempo from the playing (${guessTempo(tune)})`);
const { tokens, index } = toTokens(tune, 100);
check(tokens === 'C4:q D4:q E4:h C4+E4+G4:q R:h C5:q', `tokens: ${tokens}`);
check(eq(index, [0, 1, 2, 3, 3, 3, 5]), `note index for playback: ${index}`);
check(parse(tokens).length === 6, 'tokens parse');
const sharp = toTokens([[0, 61, 300, 1], [300, 70, 300, 1], [600, 33, 300, 1]], 100).tokens;
check(sharp === 'C#4:8 A#4:8 A1:8', `black keys and low notes: ${sharp}`);
check(parse(sharp)[2].m === 33, 'low A parses back to the same key');
check(guessTempo([[0, 60, 100, 1]]) === 90, 'one note: default tempo');

// storage
const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
saveRecording('p1', { id: 'a', notes: [] }, mem);
saveRecording('p1', { id: 'b', notes: [] }, mem);
saveRecording('p2', { id: 'c', notes: [] }, mem);
check(eq(listRecordings('p1', mem).map((x) => x.id), ['b', 'a']), 'newest first, per player');
check(eq(listRecordings('p2', mem).map((x) => x.id), ['c']), 'players have their own recordings');
deleteRecording('p1', 'b', mem);
check(eq(listRecordings('p1', mem).map((x) => x.id), ['a']), 'delete one');
for (let i = 0; i < MAX_SAVED + 5; i++) saveRecording('p1', { id: 'x' + i, notes: [] }, mem);
check(listRecordings('p1', mem).length === MAX_SAVED, `keeps at most ${MAX_SAVED}`);
deletePlayerRecordings('p2', mem);
check(listRecordings('p2', mem).length === 0 && listRecordings('p1', mem).length === MAX_SAVED, 'removing a player removes only their recordings');
// a full device drops the oldest until it fits
const tiny = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { if (v.length > 200) throw new Error('quota'); this.d[k] = v; } };
for (let i = 0; i < 10; i++) saveRecording('p1', { id: 'y' + i, notes: [[0, 60, 100, 1]] }, tiny);
const kept = listRecordings('p1', tiny);
check(kept.length > 0 && kept.length < 10 && kept[0].id === 'y9', `full device keeps the newest (${kept.length} kept)`);

// wav
const wav = new DataView(encodeWav(new Float32Array([0, 1, -1, 0.5]), 44100));
const tag = (o) => String.fromCharCode(...[0, 1, 2, 3].map((i) => wav.getUint8(o + i)));
check(tag(0) === 'RIFF' && tag(8) === 'WAVE' && tag(36) === 'data', 'wav header');
check(wav.getUint32(24, true) === 44100 && wav.getUint16(34, true) === 16 && wav.getUint32(40, true) === 8, 'wav format');
check(wav.getInt16(46, true) === 32767 && wav.getInt16(48, true) === -32768, 'wav samples');

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
