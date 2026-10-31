// Record and share: the big red button in Free Play and songs, the "Mine" shelf of saved recordings,
// playback with the keys lighting up, and sending a recording (sound or video) to the family.
import { parse, nameOf, letterOf, isBlack, COLORS } from './music.js';
import { playNote, stopPiano, pianoSamples, say, stopTalking, cluck, bawk, audioContext } from './audio.js';
import { drawStaff, focusNote } from './staff.js';
import { throwAwayAsk } from './lines.js';
import { makeKeyboard } from './keyboard.js';
import type { RecInfo, Recording, NoteSource, Note } from './types';
import { makeRecorder, toTokens, guessTempo, lengthMs, listRecordings, saveRecording, deleteRecording, renderAudio, MAX_MS } from './recorder.js';

// every element looked up here is in index.html, so a missing one is a bug worth a loud error
const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector<T>(s)!;
const clock = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const colorOf = (m: number) => (COLORS as Record<string, string>)[letterOf(m)];
const fileName = (rec: Recording, ext: string) => `${rec.title.replace(/[^\w ']+/g, '').trim() || 'My song'} - Chicken Piano.${ext}`;

// What the app hands over: screens, messages and the current player
export interface RecordingsApp {
  show: (screen: string) => void;
  toast: (text: string) => void;
  ask: (icon: string, question: string, onYes: () => void) => void;
  bubble: (el: HTMLElement, text: string) => void;
  bigLetter: (m: number) => string;
  player: () => string;
}
// The sound file for the open recording; ready once made
type ShareFile = { id: string; ready: File | null; p: Promise<File> };

export function setupRecordings(app: RecordingsApp) {
  const recorder = makeRecorder();
  let info: RecInfo | null = null; // what is being recorded: { title, emoji, song }
  let btn: HTMLElement | null = null; // the red button being used
  let ticker: ReturnType<typeof setInterval> | undefined;

  /* ---------- recording ---------- */
  function paint() {
    document.querySelectorAll<HTMLElement>('.recbtn').forEach((b) => {
      const on = recorder.on && b === btn;
      b.classList.toggle('on', on);
      b.querySelector('.ic')!.textContent = on ? '⏹️' : '🔴';
      b.querySelector('.tm')!.textContent = on ? clock(recorder.ms) : '';
    });
  }
  // quiet: starts by itself (Black-key Jam records every jam), so no talking over the music
  function start(b: HTMLElement, what: RecInfo, quiet = false) {
    if (!quiet) stopTalking();
    btn = b;
    info = what;
    recorder.start();
    if (!quiet) say('Recording! Play me a song!');
    clearInterval(ticker);
    ticker = setInterval(() => { if (recorder.ms > MAX_MS) finish(); else paint(); }, 250);
    paint();
  }
  // Stops and saves. open: go and listen to it now. Returns the saved recording (or null).
  function finish({ open = true } = {}): Recording | null {
    if (!recorder.on) return null;
    clearInterval(ticker);
    const notes = recorder.stop();
    paint();
    if (!notes) { if (open) say('I did not hear any notes!'); return null; }
    const rec: Recording = { id: 'r' + Date.now().toString(36), at: Date.now(), ...info!, notes };
    if (!saveRecording(app.player(), rec)) { app.toast('🎙️ 📦 ❌'); return null; }
    if (open) { openRec(rec.id); say('I saved your song! Tap play to hear it.'); }
    return rec;
  }
  // The 🔴 button on a screen. what() says what is being played when recording starts.
  function button(b: HTMLElement, what: () => RecInfo) {
    b.addEventListener('click', () => {
      if (recorder.on) return finish();
      start(b, what());
    });
  }

  /* ---------- the shelf of saved recordings ---------- */
  function renderShelf() {
    const recs = listRecordings(app.player());
    $('#recCards').innerHTML = recs.map((r) => `<button class="card reccard" data-rec="${r.id}"><div class="em">${r.emoji}</div><div class="t">${r.title}</div>
      <div class="when">${new Date(r.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${clock(lengthMs(r.notes))}</div></button>`).join('');
    $('#recEmpty').style.display = recs.length ? 'none' : '';
    if (!recs.length) say('No songs yet! Tap the red button when you play, and I will save your song.');
  }
  $('#recCards').addEventListener('click', (e) => {
    const c = (e.target as Element).closest<HTMLElement>('[data-rec]');
    if (c) openRec(c.dataset.rec!);
  });

  /* ---------- one recording: play it back, send it ---------- */
  const kb = makeKeyboard($('#recKb'), (m: number) => playNote(m, 0.9));
  const R: {
    rec: Recording | null; // the open recording
    drawn: ReturnType<typeof drawStaff> | null;
    index: (number | undefined)[]; // recorded note -> drawn note
    timer: ReturnType<typeof setTimeout>[] | null; // playing back
    file: ShareFile | null;
  } = { rec: null, drawn: null, index: [], timer: null, file: null };
  const card = $('#recStaff');
  function openRec(id: string) {
    const rec = listRecordings(app.player()).find((r) => r.id === id);
    if (!rec) return app.show('recs');
    app.show('rec');
    R.rec = rec;
    $('#recTitle').textContent = `${rec.emoji} ${rec.title}`;
    const ms = rec.notes.map((n) => n[1]);
    kb.setRange(Math.min(...ms), Math.max(...ms));
    const { tokens, index } = toTokens(rec.notes, guessTempo(rec.notes));
    const notes: Note[] = parse(tokens);
    const low = notes.filter((n) => !n.r && n.m < 60).length > notes.filter((n) => !n.r).length / 2;
    R.drawn = drawStaff(card, notes, { scroll: true, clef: low ? 'bass' : 'treble', time: null, bars: false });
    R.index = index;
    focusNote(card, R.drawn, 0);
    app.bubble($('#recBubble'), '▶️ 📤');
    paintPlay();
    prepare(rec);
  }
  function paintPlay() { $('#recPlay').textContent = R.timer ? '⏹️' : '▶️'; $('#recChicken')?.classList.toggle('dance', !!R.timer); }
  function stopPlay() {
    if (!R.timer) return;
    R.timer.forEach(clearTimeout);
    R.timer = null;
    stopPiano();
    paintPlay();
  }
  function play() {
    stopTalking();
    const notes = R.rec!.notes;
    R.timer = notes.map(([t, m, d, v], j) => setTimeout(() => {
      playNote(m, Math.max(0.15, d / 1000), undefined, v);
      kb.flash(m, 'down', Math.max(180, d));
      if (R.index[j] !== undefined) focusNote(card, R.drawn!, R.index[j]!);
      app.bubble($('#recBubble'), `🎵 ${app.bigLetter(m)}`);
    }, t));
    R.timer.push(setTimeout(() => { R.timer = null; paintPlay(); focusNote(card, R.drawn!, 0); app.bubble($('#recBubble'), '▶️ 📤'); }, lengthMs(notes) + 600));
    paintPlay();
  }
  $('#recPlay').addEventListener('click', () => (R.timer ? stopPlay() : play()));
  $('#recDelete').addEventListener('click', () => {
    stopPlay();
    app.ask('🗑️ ❓', throwAwayAsk, () => {
      deleteRecording(app.player(), R.rec!.id);
      app.show('recs');
    });
  });

  // The sound file is made as soon as the recording opens, so tapping 📤 can open the share sheet right away
  // (iPhones and iPads only allow it straight from a tap).
  function samplesReady() {
    return new Promise<NonNullable<ReturnType<typeof pianoSamples>>>((res, rej) => {
      const t0 = Date.now();
      const check = () => (pianoSamples() ? res(pianoSamples()!) : Date.now() - t0 > 15000 ? rej(new Error('no piano')) : setTimeout(check, 200));
      check();
    });
  }
  function prepare(rec: Recording) {
    if (R.file && R.file.id === rec.id) return;
    const f = { id: rec.id, ready: null } as ShareFile;
    f.p = samplesReady()
      .then((s) => renderAudio(rec.notes, s))
      .then((blob: Blob) => { f.ready = new File([blob], fileName(rec, 'wav'), { type: 'audio/wav' }); return f.ready; });
    f.p.catch((e) => console.warn('render failed', e));
    R.file = f;
  }
  const shareText = (rec: Recording) => `🐔🎹 ${rec.emoji} ${rec.title}, played on Chicken Piano!`;
  function send(file: File, rec: Recording, b: HTMLElement) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: rec.title, text: shareText(rec) })
        .then(() => { cluck(2); say('Sent! Bawk bawk!'); })
        .catch((e) => { if (e.name === 'NotAllowedError') { b.classList.add('pulse'); app.bubble($('#recBubble'), `👉 ${b.textContent}`); } else if (e.name !== 'AbortError') download(file); });
    } else download(file);
  }
  function download(file: File) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    app.toast(`💾 ${file.name}`);
  }
  $('#recShare').addEventListener('click', (e) => {
    const b = e.currentTarget as HTMLElement;
    b.classList.remove('pulse');
    stopPlay();
    const f = R.file;
    if (!f || !R.rec) return;
    if (f.ready) return send(f.ready, R.rec, b);
    // still being made: ask for one more tap once it's ready
    app.bubble($('#recBubble'), '🥚⏳');
    const id = R.rec.id;
    f.p.then(() => { if (R.rec && R.rec.id === id) { b.classList.add('pulse'); app.bubble($('#recBubble'), '👉 📤'); } },
      () => app.toast('📤 ❌'));
  });

  /* ---------- video: the keyboard lighting up, with the sound ---------- */
  const videoType = () => {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
    // mp4 first: it plays on iPhones (grandparents!) as well as everywhere else
    return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || null;
  };
  $('#recVideo').style.display = videoType() ? '' : 'none';
  $('#recVideo').addEventListener('click', async () => {
    stopPlay();
    const rec = R.rec;
    const type = videoType();
    if (!type || !R.file || !rec) return;
    const box = $('#recFilm');
    box.classList.add('show');
    $('#filmSend').style.display = 'none';
    app.bubble($('#filmBubble'), '🎬 ⏳');
    let file: File;
    try {
      const wav = await R.file.p;
      file = await filmIt(rec, wav, type, $<HTMLCanvasElement>('#filmCanvas'));
    } catch (e) {
      console.warn('video failed', e);
      box.classList.remove('show');
      app.toast('🎬 ❌');
      return;
    }
    if (!box.classList.contains('show')) return; // closed while filming
    bawk();
    app.bubble($('#filmBubble'), '🎬 ✅ 👉 📤');
    $('#filmSend').style.display = '';
    $('#filmSend').onclick = (e) => send(file, rec, e.currentTarget as HTMLElement);
  });
  $('#filmClose').addEventListener('click', () => { $('#recFilm').classList.remove('show'); filming && filming.stop(); });

  let filming: { stop: () => void } | null = null;
  // Plays the recording on a drawn keyboard in real time while MediaRecorder films the canvas and the sound.
  async function filmIt(rec: Recording, wav: Blob, type: string, canvas: HTMLCanvasElement): Promise<File> {
    const ctx = audioContext().rawContext as AudioContext;
    if (ctx.state !== 'running') await ctx.resume();
    const audio = await ctx.decodeAudioData(await wav.arrayBuffer());
    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createBufferSource();
    src.buffer = audio;
    src.connect(dest);
    src.connect(ctx.destination);
    const stream = canvas.captureStream(30);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2500000 });
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((res) => { mr.onstop = res; });
    const draw = drawer(canvas, rec);
    let t0: number | null = null;
    let raf = 0;
    const frame = () => {
      const t = t0 === null ? 0 : (ctx.currentTime - t0) * 1000;
      draw(t);
      if (t0 !== null && t > audio.duration * 1000 + 200) { if (mr.state === 'recording') mr.stop(); return; }
      raf = requestAnimationFrame(frame);
    };
    draw(0);
    mr.start(500);
    filming = { stop: () => { cancelAnimationFrame(raf); try { src.stop(); } catch (e) {} if (mr.state === 'recording') mr.stop(); } };
    // a short still title card first, then the music
    await new Promise((r) => setTimeout(r, 600));
    t0 = ctx.currentTime + 0.05;
    src.start(t0);
    raf = requestAnimationFrame(frame);
    await done;
    filming = null;
    src.disconnect();
    const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm';
    return new File(chunks, fileName(rec, ext), { type: type.split(';')[0] });
  }

  return {
    button, finish, openRec, R,
    begin: (b: HTMLElement, what: RecInfo) => { if (!recorder.on) start(b, what, true); },
    get on() { return recorder.on; },
    down: (m: number, source: NoteSource, vel?: number) => { recorder.down(m, source, vel); },
    up: (m: number) => recorder.up(m),
    screens: { recs: renderShelf },
    leave(to: string) { if (to !== 'rec') stopPlay(); if (recorder.on && finish({ open: false })) app.toast('🎙️ ✅'); },
  };
}

// Draws one video frame at time t (ms): title, chicken, and a keyboard whose keys light up in their colors.
function drawer(canvas: HTMLCanvasElement, rec: Recording) {
  const W = canvas.width = 1280;
  const H = canvas.height = 720;
  const g = canvas.getContext('2d')!;
  const ms = rec.notes.map((n) => n[1]);
  let lo = Math.min(...ms, 60);
  let hi = Math.max(...ms, 72);
  while (isBlack(lo) || letterOf(lo) !== 'C') lo--;
  while (isBlack(hi) || letterOf(hi) !== 'B') hi++;
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const kw = (W - 80) / whites.length;
  const ky = 380;
  const kh = 300;
  const xOf = (m: number) => 40 + whites.indexOf(isBlack(m) ? m - 1 : m) * kw + (isBlack(m) ? kw * 0.7 : 0);
  const font = (px: number, w = 700) => `${w} ${px}px Fredoka, 'Trebuchet MS', sans-serif`;
  return (t: number) => {
    const sounding = rec.notes.filter(([s, , d]) => t >= s && t < s + Math.max(d, 200));
    const on = new Set(sounding.map((n) => n[1]));
    g.fillStyle = '#ffe9a8';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#3b2716';
    g.font = font(54);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(`${rec.emoji} ${rec.title}`, 40, 70);
    g.font = font(110, 400);
    g.fillText('🐔', W - 190, 90 + (on.size ? -12 : 0));
    // the last note played, big and colored
    const last = [...rec.notes].reverse().find(([s]) => s <= t);
    if (last && t - last[0] < 1500) {
      const m = last[1];
      g.fillStyle = isBlack(m) ? '#555' : colorOf(m);
      g.beginPath(); g.arc(W / 2, 230, 95, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.font = font(110);
      g.textAlign = 'center';
      g.fillText(nameOf(m), W / 2, 238);
    }
    g.fillStyle = '#3b2716';
    g.fillRect(30, ky - 12, W - 60, kh + 24);
    whites.forEach((m, i) => {
      const x = 40 + i * kw;
      g.fillStyle = on.has(m) ? colorOf(m) : '#fffdf6';
      g.fillRect(x + 2, ky, kw - 4, kh);
      g.fillStyle = colorOf(m);
      g.beginPath(); g.arc(x + kw / 2, ky + kh - 34, Math.min(20, kw / 3), 0, Math.PI * 2); g.fill();
    });
    for (let m = lo; m <= hi; m++) {
      if (!isBlack(m)) continue;
      g.fillStyle = on.has(m) ? '#9b5de5' : '#2b1d0e';
      g.fillRect(xOf(m), ky, kw * 0.6, kh * 0.6);
    }
    g.fillStyle = '#3b2716';
    g.font = font(28, 500);
    g.textAlign = 'right';
    g.fillText('Chicken Piano', W - 40, 150);
  };
}
