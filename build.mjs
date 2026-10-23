// Builds dist/index.html: one self-contained file (JS, piano samples and libraries inlined).
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const SAMPLE_DIR = 'node_modules/tonejs-instrument-piano-mp3';
const NOTES = ['C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5'];
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
// Recorded voice clips (tools/voice); the page only asks for clips it knows exist.
const voiceIds = fs.existsSync('dist/voice/manifest.json') ? Object.keys(JSON.parse(fs.readFileSync('dist/voice/manifest.json', 'utf8'))) : [];
fs.writeFileSync('src/voice.generated.js', `export const VOICE = new Set(${JSON.stringify(voiceIds)});\n`);
fs.writeFileSync('src/samples.generated.js', `export const SAMPLES = ${JSON.stringify(samples)};\n`);

const res = await build({ entryPoints: ['src/main.ts'], bundle: true, minify: true, format: 'iife', write: false, target: ['es2020'], legalComments: 'none', mainFields: ['module', 'main'] });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
// build stamp shown small on the home screen, so a bug report says which version was running
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const html = fs.readFileSync('src/index.html', 'utf8').replace('<!--APP-->', () => `<script>${js}</script>`).replace('<!--VERSION-->', stamp)
  // the bundled libraries' licenses travel with the built page
  .replace('</body>', () => `<!--\nChicken Piano, MIT License, Copyright (c) 2026 Chris Strahl\n\n${fs.readFileSync('THIRD_PARTY_NOTICES.md', 'utf8').replace(/--/g, '- -')}-->\n</body>`);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
// Home-screen app: manifest and the offline service worker (icons come from tools/icons.cjs)
fs.writeFileSync('dist/manifest.webmanifest', JSON.stringify({
  name: 'Chicken Piano', short_name: 'Chicken Piano', id: './', start_url: './', scope: './',
  display: 'standalone', orientation: 'landscape', background_color: '#ffd84d', theme_color: '#ffd84d',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 1) + '\n');
fs.writeFileSync('dist/sw.js', fs.readFileSync('src/sw.js', 'utf8').replace('__BUILD__', stamp));
// Artifact version: claude.ai wraps the page in its own <html>/<head>/<body>, so ship only the inner parts.
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
fs.writeFileSync('dist/artifact.html', '<title>Chicken Piano</title>\n' + head.replace('<title>Chicken Piano</title>', '').trim() + '\n' + body.trim() + '\n');
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
