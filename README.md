# Chicken Piano 🐔🎹

A simple piano teacher for kids. Prop a tablet or phone on the keyboard like sheet music, tap 🎤, and play.
It listens through the microphone, shows which key to press, and shows the real notes on a staff.

- 10 songs with chicken lyrics, easiest first: Moonlight Chicks, Scrambled Eggs, Clucky's Egg, Happy Hens, Jingle Clucks, When the Chicks Go Marching In, The Coop Is Falling Down, Old MacDonald's Chicks, Twinkle Little Chick, Roll Roll Roll Your Egg
- 4 lessons: finding C, the musical alphabet, the staff, note lengths
- Free play: see the name and staff position of anything you play
- Eggs for finished songs and lessons; every 3 eggs hatch a chick

Built with [Tone.js](https://tonejs.github.io/) (sound), [Pitchy](https://github.com/ianprime0509/pitchy) (pitch detection),
[VexFlow](https://www.vexflow.com/) (sheet music) and piano samples from
[tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments).

## Build

```
npm install
node build.mjs     # writes dist/index.html (one self-contained file)
```

The microphone needs the page served over HTTPS (it is deployed on Netlify; `netlify.toml` publishes the committed `dist/` as-is, so run `node build.mjs` and commit `dist/` after changes). On a laptop, keys A–; play the notes.

## Testing note detection

`test/octaves.mjs` and `test/sequence.mjs` run the note listener offline against every piano sample
(C1–C8) and against overlapping note sequences, with optional tablet-mic effects (quiet, noisy, echoey, weak bass):

```
mkdir -p /tmp/pcm && for f in node_modules/tonejs-instrument-piano-mp3/*.mp3; do
  ffmpeg -loglevel error -y -i $f -t 2 -ac 1 -ar 48000 -f f32le /tmp/pcm/$(basename $f .mp3).f32; done
EXPECT=0 GAIN=0.05 NOISE=0.004 HPF=250 REVERB=0.6 node test/octaves.mjs /tmp/pcm
OVERLAP=0.25 node test/sequence.mjs /tmp/pcm
```
