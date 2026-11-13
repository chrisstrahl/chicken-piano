// Reads CHANGELOG.md for the in-app 🆕 What's new card (build.mjs) and checks its shape (test/changelog.mjs).
// Format: "## <day> <Month> <year>" headings, newest first, each followed by "- " lines.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Parses the changelog into [{ date, time, items: [markdown line] }], newest first, and lists problems. */
export function parseChangelog(text) {
  const sections = [];
  const problems = [];
  const body = text.replace(/<!--[\s\S]*?-->/g, '');
  for (const [i, line] of body.split('\n').entries()) {
    const h = line.match(/^## (.+)$/);
    if (h) {
      const m = h[1].trim().match(/^(\d{1,2}) ([A-Z][a-z]+) (\d{4})$/);
      const month = m ? MONTHS.indexOf(m[2]) : -1;
      if (!m || month < 0) problems.push(`line ${i + 1}: heading "${h[1]}" should look like "13 November 2026"`);
      sections.push({ date: h[1].trim(), time: m && month >= 0 ? Date.UTC(+m[3], month, +m[1]) : NaN, items: [] });
    } else if (line.startsWith('- ')) {
      if (!sections.length) problems.push(`line ${i + 1}: entry before the first date heading`);
      else sections.at(-1).items.push(line.slice(2).trim());
    } else if (line.trim() && sections.length) {
      problems.push(`line ${i + 1}: under a date, every line should start with "- "`);
    }
  }
  if (!sections.length) problems.push('no "## <date>" sections');
  sections.forEach((s, i) => {
    if (!s.items.length) problems.push(`"${s.date}" has no entries`);
    if (i && !(s.time < sections[i - 1].time)) problems.push(`"${s.date}" should come after "${sections[i - 1].date}" (newest first, one heading per day)`);
  });
  return { sections, problems };
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One changelog line as safe HTML for the app: **bold** kept, links become their text, PR numbers dropped. */
export function itemHtml(md) {
  const plain = md.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s*\((?:#\d+(?:,? (?:and |to )?)?)+\)/g, '').replace(/`/g, '');
  return esc(plain).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

/** The newest `count` days for the app: [{ date, items: [html] }]. */
export function whatsNew(text, count = 2) {
  return parseChangelog(text).sections.slice(0, count).map((s) => ({ date: s.date, items: s.items.map(itemHtml) }));
}
