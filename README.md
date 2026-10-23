# Chicken Piano 🐔🎹

A simple piano teacher for kids. Prop a tablet or phone on the keyboard like sheet music, tap 🎤, and play.
It listens through the microphone, shows which key to press, and shows the real notes on a staff.

- 10 levels, 4 hands-on lessons each: finding keys, finger numbers, note lengths and rests, reading the staff,
  3/4 time, eighth notes, sharps and flats, bass clef, scales and chords
- 50 songs with chicken lyrics, 5 per level; each finished lesson opens more of its level's songs
- Tap any note in the music to jump back to it
- 🥁 Play with the beat: the chicken pecks a metronome (one bar to count in), the song moves along in time,
  and every note is scored for the right key at the right moment
- 🦜 Echo: the chicken plays a phrase (a bar or two), you play it back by ear, then the next phrase
- 🐇 🐢 🐌 Speed: full, three-quarter or half speed for Listen, play-with-the-beat and echo
- Free play: see the name and staff position of anything you play, with an optional 🥁 metronome
- Eggs for finished songs and lessons; every 3 eggs hatch a chick

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

## Testing note detection

`test/octaves.mjs` and `test/sequence.mjs` run the note listener offline against every piano sample
(C1–C8) and against overlapping note sequences, with optional tablet-mic effects (quiet, noisy, echoey, weak bass):

```
mkdir -p /tmp/pcm && for f in node_modules/tonejs-instrument-piano-mp3/*.mp3; do
  ffmpeg -loglevel error -y -i $f -t 2 -ac 1 -ar 48000 -f f32le /tmp/pcm/$(basename $f .mp3).f32; done
EXPECT=0 GAIN=0.05 NOISE=0.004 HPF=250 REVERB=0.6 node test/octaves.mjs /tmp/pcm
OVERLAP=0.25 node test/sequence.mjs /tmp/pcm
node test/metronome.mjs /tmp/pcm   # the metronome's peck must not change what is heard
```

The metronome tick is a "peck": a 30 ms burst of hiss above 5 kHz (`src/beat.js`), well above every piano note
the songs use. The app tells the listener when each peck plays; while one is in the listener's window it ignores
loudness jumps and the hiss and only looks for a key strike below 2.5 kHz, so keys played on the beat still count.
`test/metronome.mjs` plays the test tunes on the beat with a peck on every beat (as loud as the piano and 3x
louder, 0–100 ms speaker delay) and checks the listener hears exactly the same notes as without it.

`test/practice.cjs` plays through play-with-the-beat, echo and the speed button in a headless browser.
