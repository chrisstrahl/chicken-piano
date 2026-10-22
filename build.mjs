// Builds dist/index.html: one self-contained file (JS, piano samples and libraries inlined).
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const SAMPLE_DIR = 'node_modules/tonejs-instrument-piano-mp3';
const NOTES = ['C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5'];
fs.mkdirSync('build', { recursive: true });
const samples = {};
for (const n of NOTES) {
  const out = `build/${n}.mp3`;
  if (!fs.existsSync(out)) {
    // trim to 2.5s mono, fade out, 64 kbps: keeps the page small
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${SAMPLE_DIR}/${n}.mp3`, '-t', '2.5', '-af', 'afade=t=out:st=1.6:d=0.9', '-ac', '1', '-b:a', '64k', out]);
  }
  samples[n.replace('s', '#')] = fs.readFileSync(out).toString('base64');
}
fs.writeFileSync('src/samples.generated.js', `export const SAMPLES = ${JSON.stringify(samples)};\n`);

const res = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: ['es2020'], legalComments: 'none', mainFields: ['module', 'main'] });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync('src/index.html', 'utf8').replace('<!--APP-->', () => `<script>${js}</script>`);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
// Artifact version: claude.ai wraps the page in its own <html>/<head>/<body>, so ship only the inner parts.
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
fs.writeFileSync('dist/artifact.html', '<title>Chicken Piano</title>\n' + head.replace('<title>Chicken Piano</title>', '').trim() + '\n' + body.trim() + '\n');
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
