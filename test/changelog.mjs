// CHANGELOG.md must keep the shape the in-app 🆕 What's new card reads (tools/changelog.mjs).
import fs from 'node:fs';
import { parseChangelog, itemHtml, whatsNew } from '../tools/changelog.mjs';

let bad = 0;
const check = (ok, msg) => { if (!ok) { bad++; console.log('FAIL ' + msg); } };

const text = fs.readFileSync('CHANGELOG.md', 'utf8');
const { sections, problems } = parseChangelog(text);
for (const p of problems) check(false, 'CHANGELOG.md ' + p);
// The iPad has no font for music symbols (they show as empty boxes), so the card must not use them.
for (const s of sections) for (const it of s.items) check(!/[\u{1D100}-\u{1D1FF}♩-♯]/u.test(it), `music symbol in "${it.slice(0, 50)}"; write the word instead`);
check(sections.length >= 2, 'at least two dated sections');

// the app's rendering of a line
check(itemHtml('🎵 **Real names**: a <b> button. (#50)') === '🎵 <b>Real names</b>: a &lt;b&gt; button.', 'itemHtml escapes, keeps bold, drops the PR number: ' + itemHtml('🎵 **Real names**: a <b> button. (#50)'));
check(itemHtml('x (#10, #12, #14)') === 'x', 'drops a list of PR numbers');
check(itemHtml('see [the site](https://x.y) now') === 'see the site now', 'links become text');
check(itemHtml('tests (#15 to #18, #22 to #27)') === 'tests', 'drops PR ranges');
const wn = whatsNew(text);
check(wn.length === 2 && wn[0].date === sections[0].date && wn.every((s) => s.items.length && s.items.every((i) => !/#\d/.test(i))), "what's new has the newest two days, without PR numbers");

// a broken file is reported
const broken = parseChangelog('# x\n\n## 7 November 2026\n- a\n\n## 13 November 2026\n- b\nloose line\n## Nov 1\n');
check(broken.problems.length >= 3, 'order, loose lines, bad dates and empty days are reported: ' + broken.problems.join('; '));

console.log(bad ? `${bad} changelog checks failed` : `changelog ok (${sections.length} days, newest ${sections[0]?.date})`);
process.exit(bad ? 1 : 0);
