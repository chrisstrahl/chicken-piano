// Lists every line the chicken can say as JSON [{id, text}], for tools/voice/render.py.
// Sources: say/hint text in songs and lessons, templated lines in src/lines.js, and literal say('...') calls in src/.
import fs from 'node:fs';
import { SONGS, LEVELS } from '../src/music.js';
import { templatedLines, lineId } from '../src/lines.js';

const texts = new Set();
const walk = (o) => {
  if (Array.isArray(o)) return o.forEach(walk);
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if ((k === 'say' || k === 'hint') && typeof v === 'string') texts.add(v);
      else walk(v);
    }
  }
};
walk(LEVELS);
walk(SONGS);
templatedLines(SONGS, LEVELS).forEach((t) => texts.add(t));
for (const f of fs.readdirSync('src').filter((f) => /\.[jt]s$/.test(f))) {
  const src = fs.readFileSync(`src/${f}`, 'utf8');
  for (const m of src.matchAll(/\bsay\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/g)) texts.add(m[2].replace(/\\(.)/g, '$1'));
}
const lines = [...texts].filter((t) => t.trim()).map((text) => ({ id: lineId(text), text }));
process.stdout.write(JSON.stringify(lines, null, 1) + '\n');
console.error(`${lines.length} lines`);
