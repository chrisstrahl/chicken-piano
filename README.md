# Chicken Piano 🐔🎹

A simple piano teacher for kids. Prop a tablet or phone on the keyboard like sheet music, tap 🎤, and play.
It listens through the microphone, shows which key to press, and shows the real notes on a staff.

- 10 levels, 4 hands-on lessons each: finding keys, finger numbers, note lengths and rests, reading the staff,
  3/4 time, eighth notes, sharps and flats, bass clef, scales and chords
- 50 songs with chicken lyrics, 5 per level; each finished lesson opens more of its level's songs
- Tap any note in the music to jump back to it
- Free play: see the name and staff position of anything you play
- Eggs for finished songs and lessons; every 3 eggs hatch a chick
- Players: each kid picks a chicken (and an optional name) and keeps their own eggs, chicks and open songs;
  tap the chicken at the top left of the home screen to switch
- Works as a home-screen app: on an iPad, Share → Add to Home Screen. It opens full screen and works without wifi
  (a service worker saves the page and the chicken's voice; a new version loads on the next launch when online)

Built with [Tone.js](https://tonejs.github.io/) (sound), [Pitchy](https://github.com/ianprime0509/pitchy) (pitch detection),
[VexFlow](https://www.vexflow.com/) (sheet music) and piano samples from
[tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments).

## License

MIT, see [LICENSE](LICENSE). The bundled libraries and piano samples have their own licenses;
the piano samples are CC BY 3.0 and need credit. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Build

```
npm install
node build.mjs     # writes dist/index.html (one self-contained file, plus voice clips in dist/voice)
```

The microphone needs the page served over HTTPS (it is deployed on Netlify; `netlify.toml` publishes the committed `dist/` as-is, so run `node build.mjs` and commit `dist/` after changes). On a laptop, keys A–; play the notes.

## The chicken's voice

Spoken lines are pre-recorded with [Kokoro-82M](https://github.com/hexgrad/kokoro) (open source neural TTS, voice
`af_heart`, runs locally with no API key) into small mp3 clips in `dist/voice/`, named by a hash of the sentence.
The app plays the clip for a sentence when it has one and falls back to the device's built-in speech otherwise.

After changing anything the chicken says (lesson `say`/`hint` text, songs, or the templates in `src/lines.js`):

```
mkdir -p build && pip install -r tools/voice/requirements.txt   # once; needs ffmpeg too
npm run voice      # records only new or changed lines, deletes unused clips
node build.mjs
```

The first run downloads the model (~350 MB) into `~/.cache/chicken-piano-voice`. If a word comes out wrong,
add a regex spelling fix to `tools/voice/pronounce.json` (it changes what the voice reads, not what the app shows).

## Home-screen icons

`node tools/icons.cjs` redraws `dist/icons` from the chicken in `src/chicken.js` (needs Playwright's Chromium).
`node build.mjs` writes `dist/manifest.webmanifest` and `dist/sw.js` (stamped with the build time).
`test/profiles.cjs` and `test/offline.cjs` check players and the offline cache.

## Testing note detection

`test/octaves.mjs` and `test/sequence.mjs` run the note listener offline against every piano sample
(C1–C8) and against overlapping note sequences, with optional tablet-mic effects (quiet, noisy, echoey, weak bass):

```
mkdir -p /tmp/pcm && for f in node_modules/tonejs-instrument-piano-mp3/*.mp3; do
  ffmpeg -loglevel error -y -i $f -t 2 -ac 1 -ar 48000 -f f32le /tmp/pcm/$(basename $f .mp3).f32; done
EXPECT=0 GAIN=0.05 NOISE=0.004 HPF=250 REVERB=0.6 node test/octaves.mjs /tmp/pcm
OVERLAP=0.25 node test/sequence.mjs /tmp/pcm
```
