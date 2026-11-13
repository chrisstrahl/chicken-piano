// The rules behind the games, checked without a browser: scoring a play-along (BeatJudge), cutting a song
// into phrases, practice streaks and the calendar, the quiz and sight-reading puzzle makers, song names,
// the HTML helpers, and that every lesson's data makes sense (notes parse, answers are among the choices).
// usage: node test/logic.mjs
import { BeatJudge, timeline, phrases, barBeats, peckEvery, peckMask, PECK_AFTER, PECK_BEFORE } from '../src/beat.ts';
import { addWin, streak, todayWins, calendar, dayKey, DAILY_GOAL } from '../src/streaks.ts';
import { parse, LEVELS, SONGS, BEATS, songsForLevel, songById, lessonById, letterOf, isBlack, nameOf, samePc } from '../src/music.ts';
import { mysteryPuzzle, moodPuzzle, opening, knownSongs, quizEggs, MYSTERY_STAGES, MOOD_STAGES } from '../src/quiz.ts';
import { freshTune, freshEggs, FRESH_STAGES } from '../src/sightread.ts';
import { songName, otherName, setRealNames } from '../src/names.ts';
import { esc } from '../src/dom.ts';
import { cleanProgress, cleanPlayer } from '../src/storage.ts';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const J = JSON.stringify;
// a seeded random, so a failure can be repeated
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/* ---------- notes ---------- */
{
  const n = parse('C D# Bb3 C5:h G:hd E:8 R:q C+E+G:w C:h~ C:h');
  check(n.length === 10 && n[0].m === 60 && n[1].m === 63 && n[2].m === 58 && n[3].m === 72, 'parse: letters, sharps, flats and octaves');
  check(n[3].d === 'h' && n[4].d === 'hd' && n[5].d === '8' && n[6].r === true && n[7].keys.length === 3 && n[8].tie === true, 'parse: lengths, rests, chords and ties');
  check(letterOf(61) === 'C' && isBlack(61) && !isBlack(60) && nameOf(61) === 'C♯' && samePc(60, 72) && !samePc(60, 61) && letterOf(-1) === 'B', 'key names');
}

/* ---------- timeline and phrases ---------- */
{
  const tl = timeline(parse('C:h~ C:h R:q D E:8 F:8'));
  check(J(tl.map((t) => t.at)) === '[0,2,4,5,6,6.5]' && J(tl.map((t) => t.play)) === '[true,false,false,true,true,true]', 'timeline: a tied-on note and a rest take time but no key press');
  check(barBeats('4/4') === 4 && barBeats('3/4') === 3 && barBeats('6/8') === 3 && peckEvery('6/8') === 1.5 && peckEvery('3/4') === 1, 'bars and pecks for 4/4, 3/4 and 6/8');
  check(peckMask([1000], 1000 - PECK_BEFORE) && peckMask([1000], 1000 + PECK_AFTER) && !peckMask([1000], 1000 + PECK_AFTER + 1) && !peckMask([], 5), 'the mic is deaf only around a peck');
  let bad = 0;
  for (const s of SONGS) {
    for (const notes of [s.notes, s.lh].filter(Boolean)) {
      const ph = phrases(notes, s);
      const tl2 = timeline(notes);
      const ok = ph.length > 0 && ph[0][0] <= tl2.findIndex((t) => t.play) && ph[ph.length - 1][1] === notes.length
        && ph.every(([a, b], i) => b > a && (i === 0 || a === ph[i - 1][1]) && tl2.slice(a, b).some((t) => t.play));
      if (!ok) { bad++; console.log('   phrases wrong for', s.id); }
    }
  }
  check(bad === 0, `every song cuts into phrases that follow on, each with a note to play (${SONGS.length} songs)`);
}

/* ---------- BeatJudge: scoring a play-along ---------- */
{
  const notes = parse('C D E:h R:q G');
  const mk = () => new BeatJudge(notes, 500, 1000); // 120 beats a minute, first note at 1000 ms
  let j = mk();
  check(j.items.length === 4 && J(j.items.map((x) => x.t)) === '[1000,1500,2000,3500]', 'only notes are judged, each at its beat');
  check(j.input(60, 400) === null, 'a key long before the first note is nobody\'s');
  const a = j.input(60, 1010), b = j.input(62, 1500 - j.onTime - 20), c = j.input(64, 2000 + j.onTime + 20), d = j.input(55, 3500);
  check(a.grade === 'good' && b.grade === 'early' && c.grade === 'late' && d.grade === 'good' && j.done, 'on the beat, a bit early, a bit late');
  check(J(j.counts()) === J({ good: 2, early: 1, late: 1, miss: 0 }) && j.eggs() === 2, 'counts and eggs (2 on the beat + 2 near = two eggs)');
  j = mk();
  check(j.input(72, 1000).grade === 'good', 'the same key in another octave counts');
  check(j.input(61, 1500).grade === 'wrong' && !j.items[1].result, 'a wrong key is wrong, and the note can still be played');
  check(j.input(62, 1520).grade === 'good', '...and then it is');
  check(J(j.tick(2000)) === '[]' && J(j.tick(5000)) === '[2,3]' && j.done && j.counts().miss === 2, 'notes nobody played become misses once their time is past');
  j = mk();
  j.input(62, 1500);
  check(j.items[0].result === 'miss' && j.items[1].result === 'good', 'playing the next note skips the one before');
  j = mk();
  [1000, 1500, 2000, 3500].forEach((t, i) => j.input([60, 62, 64, 67][i], t));
  check(j.eggs() === 3 && j.current(4000) === null, 'all on the beat: three eggs, nothing left');
  j = mk();
  check(j.current(0) === 0 && (j.tick(9000), j.eggs()) === 1, 'all missed: one egg for trying');
  const slow = new BeatJudge(notes, 1200, 0), fast = new BeatJudge(notes, 300, 0);
  check(slow.onTime > fast.onTime && fast.onTime >= 170, 'slower speeds are more forgiving; fast ones never under 170 ms');
  check(fast.window(0)[1] <= (fast.items[0].t + fast.items[1].t) / 2 + fast.onTime / 2 + 1e-9, 'a late note can\'t steal the next note\'s time');
}

/* ---------- practice days ---------- */
{
  const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
  const days = {};
  const w1 = addWin(days, at(2026, 3, 1)), w2 = addWin(days, at(2026, 3, 1, 18)), w3 = addWin(days, at(2026, 3, 1, 19));
  check(!w1.laid && w2.laid && !w3.laid && w3.today === 3 && todayWins(days, at(2026, 3, 1)) === 3 && DAILY_GOAL === 2, 'the second win of a day lays its egg, once');
  check(streak(days, at(2026, 3, 1)) === 1 && streak(days, at(2026, 3, 2)) === 1 && streak(days, at(2026, 3, 3)) === 0, 'a streak lasts through the next day, then ends');
  // across a month end and both daylight-saving changes
  for (const [name, y, m, d] of [['month end', 2026, 2, 26], ['spring forward', 2026, 3, 6], ['fall back', 2026, 10, 30]]) {
    const dd = {};
    for (let i = 0; i < 5; i++) { addWin(dd, at(y, m, d + i, 23)); addWin(dd, at(y, m, d + i, 23)); }
    check(streak(dd, at(y, m, d + 4, 23)) === 5 && Object.keys(dd).length === 5, `five days in a row count as five (${name})`);
  }
  const old = { '2020-01-01': 2 };
  addWin(old, at(2026, 3, 1));
  check(!('2020-01-01' in old), 'very old days are forgotten');
  const cal = calendar(days, at(2026, 3, 4));
  const flat = cal.flat();
  check(cal.length === 4 && cal.every((r) => r.length === 7) && flat.filter((x) => x.today).length === 1 && flat.find((x) => x.key === '2026-03-01').egg && flat[flat.length - 1].future, 'calendar: four weeks, today marked, eggs shown, later days greyed');
  check(dayKey(at(2026, 1, 5)) === '2026-01-05', 'day keys sort as text');
}

/* ---------- quizzes and sight reading ---------- */
{
  let bad = 0;
  for (const st of MYSTERY_STAGES) {
    const rnd = seeded(st.choices + 3);
    let last = null;
    for (let i = 0; i < 200; i++) {
      const p = mysteryPuzzle(st, SONGS, last, rnd);
      const emojis = new Set(p.cards.map((c) => c.emoji));
      if (!p.answer || p.answer.id === last || !p.cards.includes(p.answer) || p.cards.length !== st.choices || emojis.size !== p.cards.length
        || p.cards.some((c) => c.level < st.levels[0] || c.level > st.levels[1])) bad++;
      last = p.answer.id;
    }
  }
  check(bad === 0, 'Mystery Melodies: the answer is on a card, never twice running, all pictures differ, right levels');
  check(knownSongs(SONGS).length >= 20 && knownSongs(SONGS).every((s) => s.sub), 'there are plenty of well-known tunes to guess');
  const op = opening(parse('R:q C:h~ C:h D E F G'), 3);
  check(op.length === 5 && op[4].m === 64, 'a tune\'s opening counts played notes, not rests or ties');
  bad = 0;
  const moods = { happy: 0, sad: 0 };
  for (const st of MOOD_STAGES) {
    const rnd = seeded(11);
    for (let i = 0; i < 300; i++) {
      const p = moodPuzzle(st, null, rnd);
      moods[p.mood]++;
      const chord = p.steps[p.steps.length - 1][0];
      if (chord.length !== 3 || chord[1] - chord[0] !== (p.mood === 'happy' ? 4 : 3) || chord[2] - chord[0] !== 7) bad++;
      if (p.steps.some(([ms, beats]) => !ms.length || beats <= 0 || ms.some((m) => m < 55 || m > 84))) bad++;
    }
  }
  check(bad === 0 && moods.happy > 250 && moods.sad > 250, 'Happy or Sad: major for happy, minor for sad, about half each');
  check(quizEggs(0) === 3 && quizEggs(2) === 2 && quizEggs(9) === 1 && freshEggs(1) === 3 && freshEggs(4) === 2 && freshEggs(5) === 1, 'eggs for misses');
  bad = 0;
  for (const st of FRESH_STAGES) {
    const rnd = seeded(st.len * 7 + 1);
    for (let i = 0; i < 200; i++) {
      const notes = parse(freshTune(st, rnd));
      const ms = notes.map((n) => n.m);
      if (notes.length !== st.len || ms.some((m) => !st.pool.includes(m)) || ms[ms.length - 1] !== st.pool[0]
        || ms.some((m, k) => k > 1 && m === ms[k - 1] && m === ms[k - 2]) || (!st.long && notes.some((n) => n.d !== 'q'))) bad++;
    }
  }
  check(bad === 0, 'Fresh Tunes: right length, only the nest\'s keys, ends on home, never three of a key in a row');
}

/* ---------- song names ---------- */
{
  const withReal = SONGS.find((s) => otherName(s)), made = SONGS.find((s) => !otherName(s));
  setRealNames(false);
  const chickenName = songName(withReal), small = otherName(withReal);
  setRealNames(true);
  check(chickenName === withReal.title && songName(withReal) === small && otherName(withReal) === withReal.title, 'real names swap the big and small name');
  check(!made || (songName(made) === made.title && otherName(made) === null), 'a song written for the app keeps its chicken name');
  setRealNames(false);
}

/* ---------- text that goes on the page ---------- */
{
  check(esc('<img src=x onerror="a(1)">\'&') === '&lt;img src=x onerror=&quot;a(1)&quot;&gt;&#39;&amp;' && esc(null) === '' && esc(5) === '5', 'esc() turns markup into plain text');
  check(cleanPlayer({ id: 'p1', avatar: 'sunny', name: '  <b>Max</b>  the   great  one ' }).name === 'bMax/b the g' && cleanPlayer({ id: 'a b', avatar: 'sunny' }) === null && cleanPlayer(null) === null, 'player names and ids from a file are cleaned');
  check(J(cleanProgress({ a: 1, b: true, c: 'lh', d: 'two words', e: [1], f: { g: 2, h: null }, i: NaN })) === J({ a: 1, b: true, c: 'lh', f: { g: 2 } }) && J(cleanProgress('x')) === '{}', 'progress from a file keeps only numbers, yes/no and one-word settings');
}

/* ---------- lessons: the data every screen relies on ---------- */
{
  const problems = [];
  const ids = new Set();
  const toks = (t, where) => { try { const n = parse(t); if (!n.length) problems.push(`${where}: no notes in "${t}"`); return n; } catch (e) { problems.push(`${where}: "${t}" doesn't parse`); return []; } };
  const pcs = (t, where) => new Set(toks(t, where).filter((n) => !n.r).flatMap((n) => n.keys.map((k) => ((k.m % 12) + 12) % 12)));
  check(LEVELS.length === 10 && LEVELS.every((lv, i) => lv.n === i + 1 && lv.lessons.length === 4), 'ten levels of four lessons');
  for (const lv of LEVELS) for (const les of lv.lessons) {
    if (ids.has(les.id)) problems.push(`lesson id ${les.id} used twice`);
    ids.add(les.id);
    if (!les.steps.length || !les.title || !les.emoji) problems.push(`${les.id}: empty`);
    if (lessonById(les.id)?.level !== lv) problems.push(`${les.id}: lessonById finds another level`);
    les.steps.forEach((s, i) => {
      const w = `${les.id} step ${i + 1} (${s.type})`;
      if (!s.say || typeof s.say !== 'string') problems.push(`${w}: nothing to say`);
      // most lines are about 10 words; a few are still around 20. Nothing longer than that should be added.
      if (s.say && s.say.split(/\s+/).length > 24) problems.push(`${w}: the spoken line is long for a 6-year-old (${s.say.split(/\s+/).length} words); move the detail to "more"`);
      if (s.type === 'show') {
        if (!pcs(s.goal, w).size) problems.push(`${w}: no goal`);
        if (s.staff) toks(s.staff, w);
        if (s.hear) toks(s.hear, w);
        if (s.lh) toks(s.lh, w);
        if (s.keys?.hl) { const hl = pcs(s.keys.hl, w); for (const p of pcs(s.goal, w)) if (!hl.has(p)) problems.push(`${w}: a goal key isn't one of the glowing keys`); }
      } else if (s.type === 'key') toks(s.targets, w);
      else if (s.type === 'seq') { if (!s.seqs.length) problems.push(`${w}: no tunes`); s.seqs.forEach((q) => { if (toks(q, w).some((n) => n.r)) problems.push(`${w}: a rest in a tune to play`); }); }
      else if (s.type === 'name') toks(s.notes, w).forEach((n) => { if (!s.pool.includes(n.letter)) problems.push(`${w}: ${n.letter} isn't among the answers "${s.pool}"`); });
      else if (s.type === 'beats') s.durs.forEach((d) => { if (!BEATS[d]) problems.push(`${w}: unknown length ${d}`); });
      else if (s.type === 'choice') {
        if (!s.rounds.length) problems.push(`${w}: no rounds`);
        s.rounds.forEach((r, k) => {
          if (!r.options.includes(r.answer)) problems.push(`${w} round ${k + 1}: the answer isn't one of the choices`);
          if (new Set(r.options).size !== r.options.length) problems.push(`${w} round ${k + 1}: a choice is there twice`);
          if (r.staff) toks(r.staff, w);
          if (r.hear) toks(r.hear, w);
          if (r.hl) toks(r.hl, w);
        });
      } else if (s.type === 'rhythm') {
        const judged = toks(s.play || s.staff, w);
        toks(s.staff, w);
        if (s.lh) toks(s.lh, w);
        if (judged.filter((n) => !n.r).length < 2) problems.push(`${w}: fewer than two notes to play`);
        if (s.time && !['4/4', '3/4', '6/8'].includes(s.time)) problems.push(`${w}: time ${s.time}`);
      } else problems.push(`${w}: unknown kind of step`);
    });
  }
  problems.slice(0, 20).forEach((p) => console.log('   ' + p));
  check(problems.length === 0, `every lesson step is well formed (${[...ids].length} lessons)`);
  const lv = LEVELS.map((l) => songsForLevel(l.n).length);
  check(lv.every((n) => n >= 5) && SONGS.every((s) => songById(s.id) === s), `every level has at least five songs (${lv.join(' ')})`);
}

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
