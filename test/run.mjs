// Runs the test suite and prints one line per test. `npm test` runs the quick Node checks (the same ones
// as the required "typecheck" check on GitHub); `npm run test:all` adds the browser tests (test/*.cjs,
// Playwright, on the built dist/index.html, so run `node build.mjs` first).
// A test fails when it exits with an error or prints FAIL / PAGEERROR. Run one alone for its full output.
// Not run here: the offline mic tests (octaves, sequence, metronome, speech) need decoded piano samples
// passed as an argument, and the robot kids (`npm run kid`) take many minutes.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const quick = ['songlib.mjs', 'recorder.mjs', 'storage.mjs', 'privatesongs.mjs', 'changelog.mjs', 'scoreimport.mjs'];
const browser = process.argv.includes('--all') ? fs.readdirSync('test').filter((f) => f.endsWith('.cjs')).sort() : [];
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const tests = [...quick, ...browser].filter((t) => !only.length || only.some((o) => t.includes(o)));

// voice.cjs loads the page over http (the voice clips are fetched), from this little server for dist/
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = tests.some((t) => t === 'voice.cjs') ? http.createServer((req, res) => {
  const f = path.join('dist', decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!path.resolve(f).startsWith(path.resolve('dist')) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8765) : null;

let failed = 0;
for (const t of tests) {
  const t0 = Date.now();
  // spawnSync would block the server above, so voice.cjs runs async
  const r = t === 'voice.cjs' ? await runAsync(t) : spawnSync(process.execPath, [`test/${t}`], { encoding: 'utf8', timeout: 30 * 60 * 1000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const bad = r.status !== 0 || /\bFAIL\b|PAGEERROR/.test(out);
  if (bad) failed++;
  console.log(`${bad ? 'FAIL' : 'ok  '} ${t} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  if (bad) console.log(out.split('\n').filter((l) => /FAIL|PAGEERROR|Error|error/.test(l)).slice(0, 8).map((l) => '     ' + l).join('\n'));
}
server?.close();
console.log(failed ? `${failed} of ${tests.length} failed` : `all ${tests.length} passed`);
process.exit(failed ? 1 : 0);

function runAsync(t) {
  return new Promise((ok) => {
    const c = spawn(process.execPath, [`test/${t}`]);
    let stdout = '';
    c.stdout.on('data', (d) => { stdout += d; });
    c.stderr.on('data', (d) => { stdout += d; });
    c.on('close', (status) => ok({ status, stdout, stderr: '' }));
  });
}
