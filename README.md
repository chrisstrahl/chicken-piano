# Chicken Piano 🐔🎹

**A free, friendly piano teacher for kids, with a chicken in charge.**

### ▶️ Play now: **[chicken-piano.netlify.app](https://chicken-piano.netlify.app)**

No download, no sign-up, no ads. Open it in a browser, prop your tablet on the piano like sheet music, and start playing.

<p align="center">
  <img src="shots/ipad-home.png" width="32%" alt="Chicken Piano home screen">
  <img src="shots/ipad-map.png" width="32%" alt="Ten levels to explore">
  <img src="shots/ipad-step-seq-walk.png" width="32%" alt="Playing a song with notes on the staff and the keyboard">
</p>

---

## Why Chicken Piano?

Chicken Piano started as a dad project. My 8-year-old wanted to learn piano, he loves chickens, and his 6-year-old brother wanted in too. Most piano apps are either too wordy for little kids, cost a monthly subscription, or don't actually listen to the piano. So we built the one we wanted: a cheerful chicken who teaches real piano skills, hears what you play, and cheers when you get it right.

## What it does

🎤 **It listens.** Play your real piano or keyboard and Chicken Piano hears each note through the microphone. Right note? The chicken moves on. Wrong note? A gentle nudge to try again.

🎼 **Real music, not just colored blocks.** Every song is shown as proper sheet music on a staff, with an on-screen keyboard right below that lights up the key to press. Kids learn to read notes without even noticing.

🗺️ **10 levels, 40 bite-sized lessons.** Start by finding middle C and work all the way up to finger numbers, note lengths and rests, reading the staff, waltz time, eighth notes, sharps and flats, the bass clef, scales and chords. Each lesson is hands-on: you learn it by playing it.

🎶 **108 songs to play.** Favorites get a chicken makeover: *Scrambled Eggs* (Hot Cross Buns), *Twinkle Little Chick*, *Jingle Clucks*, *Happy Hens* (Ode to Joy), *The Coop Is Falling Down* (London Bridge), *Happy Hatch Day* and lots more. The original name is always shown underneath, so grown-ups know the tune.

🥚 **Eggs and chicks to collect.** Finish a lesson, earn an egg. Play a song well, earn up to three. Complete a whole level and a chick hatches into your coop.

🗣️ **A warm, friendly voice.** The chicken talks kids through every step, so there's almost nothing to read. Big buttons, bright pictures and sounds make it work for pre-readers too.

🎹 **Free Play.** Just want to noodle around? Free Play shows the name and the spot on the staff of anything you play, and how long you held it.

👆 **Practice at your own pace.** Any level can be picked at any time, and tapping a note in the music jumps right back to it for another try.

## 🎹 Got a keyboard with USB? Plug it in!

Many digital keyboards (Casio, Yamaha, Roland and others) have a **USB "to host" port** that sends notes digitally. Chicken Piano can read those notes directly. It's faster and more accurate than the microphone, and it works even in a noisy room or with headphones on.

When a keyboard is connected, the **🎹 button turns green** and Chicken Piano listens to the keyboard instead of the mic.

| Device | How to connect |
| --- | --- |
| **Laptop or desktop** (Windows, Mac, Linux) | Plug the keyboard in with a USB cable and open the site in **Chrome, Edge or Firefox**. |
| **Android tablet or phone, Chromebook** | Use a USB cable (or USB-C adapter) and open the site in **Chrome**. |
| **iPad or iPhone** | Safari doesn't support MIDI keyboards yet. Install the free **[MIDIWeb Browser](https://apps.apple.com/app/id6757226617)** app, open **chicken-piano.netlify.app** inside it, and connect the keyboard with a USB-C cable (or Apple's Lightning to USB Camera Adapter on older iPads). |

No USB port on your keyboard? No problem: the microphone works with any piano, acoustic or electric.

## Tips for grown-ups

- **Landscape works best.** Stand the tablet or phone on the music rest, sideways.
- **Tap the 🐣 egg** on the first screen to wake up the chicken (this also lets the browser use sound and the mic).
- **Allow the microphone** when asked. Chicken Piano only listens for notes, right on the device; no audio is ever uploaded.
- **Turn the volume up** so kids can hear the chicken's instructions.
- Progress is saved on the device, so each tablet keeps its own coop.

---

## Run it yourself / contributing

Chicken Piano is open source under the [MIT license](LICENSE). Suggestions, songs and fixes are welcome: open an issue or a pull request.

```
npm install
node build.mjs     # writes dist/index.html (one self-contained file) plus voice clips in dist/voice
```

The microphone needs HTTPS. The live site is hosted on Netlify, which publishes the committed `dist/` folder as-is, so run `node build.mjs` and commit `dist/` after changes. On a laptop, the keys A through ; play notes too.

<details>
<summary><b>Regenerating the chicken's voice</b></summary>

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
</details>

<details>
<summary><b>Testing note detection</b></summary>

`test/octaves.mjs` and `test/sequence.mjs` run the note listener offline against every piano sample
(C1–C8) and against overlapping note sequences, with optional tablet-mic effects (quiet, noisy, echoey, weak bass):

```
mkdir -p /tmp/pcm && for f in node_modules/tonejs-instrument-piano-mp3/*.mp3; do
  ffmpeg -loglevel error -y -i $f -t 2 -ac 1 -ar 48000 -f f32le /tmp/pcm/$(basename $f .mp3).f32; done
EXPECT=0 GAIN=0.05 NOISE=0.004 HPF=250 REVERB=0.6 node test/octaves.mjs /tmp/pcm
OVERLAP=0.25 node test/sequence.mjs /tmp/pcm
```
</details>

### Credits

Built on great open source work:
[Tone.js](https://tonejs.github.io/) (sound),
[VexFlow](https://www.vexflow.com/) (sheet music),
[Pitchy](https://github.com/ianprime0509/pitchy) (pitch detection),
[Kokoro](https://github.com/hexgrad/kokoro) (the chicken's voice),
and piano samples from [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) by Versilian Studios (CC BY 3.0).
Full details in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
