# What's new in Chicken Piano

New things and fixes, newest first, written for grown-ups. The app updates itself: every change goes
live on [chicken-piano.vercel.app](https://chicken-piano.vercel.app) a few minutes after it's finished.
The small build stamp in the bottom-right corner of the home screen shows the date of the version you have,
so you can match it to a heading below. The newest entries also show in the app: hold 📊 in the coop for
the grown-ups' page and scroll to 🆕 What's new.

<!-- How to add an entry: put one line per change under today's date, newest date first, as
     "- <emoji> **Short name**: what changed, in plain words a parent understands. (#PR)".
     Make a new "## <day> <Month> <year>" heading when today has none. Changes nobody will notice
     (tests, tidying) go in one "Behind the scenes" line, or nowhere. Never type music symbols here;
     the in-app card can't draw them on iPad. -->

## 13 November 2026

- 🎼 **Add a song from a score file**: on the grown-ups' page, the 🎼 Add a song card takes a MusicXML (.musicxml, .mxl) or MIDI (.mid) file, from MuseScore or a free score site, and turns it into a song with its tune, left hand, key, speed and words. No audio needed. Pick its level, tap ▶️ to hear the start, and it shows up open at the end of that level for every kid. (#53)
- 🔒 **Safer backups**: loading a backup file now cleans names and titles first, so a tampered file can't do anything but show text. (#54)
- ⚡ **Smoother song play**: each note you play makes the iPad do less work, so the chicken and the staff keep up better in fast songs. (#54)
- 🆕 **What's new**: these release notes now live in the app too, on the grown-ups' page.
- 🔐 **Private songs**: grown-ups can load extra songs from the family's own private GitHub repository (grown-ups' page, 🔐 card). The songs are kept on the device, so they work offline, and they refresh each time the app opens. (#49)
- 🎵 **Real song names**: a 🐔 / 🎵 button on the Songs and Level screens switches between the chicken titles and the real tune names, and the chicken says the real name too. Each kid keeps their own setting. (#50)
- 🐢 **Listen at slow speed**: the left hand now slows down with the right hand, and the two hands no longer drift apart in long songs. (#51)
- 🥚 **Lesson party**: a finished lesson shows its one egg, instead of one egg and two empty grey ones that looked like a poor score. (#51)
- ⚡ **Smoother note lane**: the scrolling note lane does about half the work it used to, so it runs smoother on iPad. (#51)
- 🎹 **Phones with a USB keyboard**: the 🎹 button no longer covers a button in the top corner. (#51)

## 7 November 2026

- 🎸 **Scrolling note lane**: when playing in time (🥁 in songs, 🔁 tricky-spot loop, and the "play it in time" lesson steps) notes fall down onto the keys and land on an orange line right when they should be played. Hits glow, misses go grey, and the staff scrolls along above it. (#47)
- 🎼 **Note pictures on iPad**: note and rest symbols in chicken bubbles, quiz buttons and Write a Song used to show as empty boxes on iPad. They are now drawn as little pictures. Sixteenth notes are beamed like eighths, and 6/8 time is grouped in threes. (#48)
- 💾 **Backup and restore**: the grown-ups' page can save all progress to a file and load it back. Loading only ever adds (most eggs, fastest times), so it's also how to join the Safari tab and the home-screen app. If the device runs out of space, the oldest recordings are trimmed so eggs still save. (#45)
- 🎵 **Five more songs kids hear today**: The Entertainer, Bach's Toccata, Chopin's funeral march, La Cucaracha and an easy Mozart sonata, all with a left-hand part. (#46)

## 31 October 2026

- 🗂️ **Learn in five groups**: Lessons, Reading, Ears, Rhythm and Make music, each with its own games. (#32)
- 🎁 **New games**: Mystery Melodies (name the tune), Happy or Sad (major or minor), Fresh Tunes (sight-reading new little tunes) and Black-key Jam (play along on the black keys with a drum beat). (#32, #33)
- ✏️ **Write a Song**: kids compose their own song, which is saved on the device for each kid. (#36)
- 🔁 **Tricky-spot loop**: pick the hard part of a song and practise just that bit over and over. (#34)
- 📊 **Grown-ups' page**: hold 📊 in the coop for 1.5 seconds to see each kid's streak, lessons, songs, game eggs and the notes they miss most. (#35)
- 🥁 **Better beat timing on iPad**: the beat no longer lands early and presses no longer count as late. Grown-ups can tune it per device: in free play hold 🥁 for 2 seconds and play along with 12 pecks. (#37)
- 🦶 **Sustain pedal**: a pedal plugged into a USB keyboard now holds notes, and recordings keep the real note lengths and rests. (#37)
- 🎯 **Friendlier rhythm steps**: a rhythm step passes when 3 of 4 notes are on the beat, and the chicken shows hits and misses after each try. (#40)
- 💬 **Shorter lesson lines**: every lesson line is about ten words now. Tap 🎓 to hear the full explanation. (#42)
- 📱 **Song buttons fit on iPad**: the song tools no longer slide off the screen. (#41)
- Behind the scenes: robot test kids now play the app on every change and report anything that breaks (#39); README refresh with the MIDIWeb Browser link for iPad (#31). These went live on 1 November, after a hosting limit reset. (#43, #44)

## 23 October 2026

- 🎓 **New home screen**: three big buttons, Learn, Play Songs and Record a Song. Free play lives under Record a Song. (#30)
- 🥚 **Egg Rush, Echo Game, Twinkle Twist**: find ten notes against the clock, copy the chicken's rhythm, and play Twinkle with a new rhythm in every nest. New steps-and-skips lessons too. (#30)
- 👂 **Find it**: an ear game. The chicken plays a note or a little tune, and you find it on the piano. (#21)
- 🔥 **Practice streaks**: two songs or lessons a day lays the day's egg, and the coop shows a four-week egg calendar and a streak count. (#20)
- 🐔 **Hint button**: the chicken plays the next note, lights the key and says its name. It also pops up by itself when a kid is stuck. (#19)
- ⏱️ **Timing lessons**: beat counts under the lesson music and "play it in time" steps, plus the left hand joining in from the early levels. (#28)
- 🤲 **Two hands everywhere**: every song has a left-hand part, matched to the level, with chords, key signatures and finger numbers. A clef button switches between the hands, and the real tune name shows under the chicken title. (#10, #12, #14)
- 🎹 **USB keyboard**: plug a keyboard in (Chrome, Edge, Android, Chromebook, or the MIDIWeb Browser app on iPad) and the 🎹 button reads it directly. (#3)
- 🎙️ **Record and share**: record a performance, play it back, and send it as a sound or video. (#4)
- 👧 **Players**: each kid gets their own chicken and their own progress, and the app can be added to the iPad home screen and works offline. (#5)
- 🥁 **Play with the beat**: a pecking metronome, echo mode (🦜 the chicken plays, you copy), and speed control (🐇 🐢 🐌). (#6)
- 🎼 **Easier to read**: a clearer staff, note lengths that match what kids mean, and a start-over button. (#7, #8)
- 🎶 **Songs sorted easiest first** in every level, without near-duplicates. (#9)
- 🎧 **Free play hears fast notes** and writes down how long each note was held. (#29)
- Behind the scenes: moved to Vercel hosting, switched the code to TypeScript, and added automatic checks on every change. (#11, #13, #15 to #18, #22 to #27)

## 22 October 2026

- 🐣 **First version**: 10 levels of 4 hands-on lessons, songs on a real staff with an on-screen keyboard that lights up, and a microphone that hears the real piano.
- 🎶 **Song library**: 108 songs across the ten levels, mostly chicken versions of tunes kids know. (#1)
- 🗣️ **A real chicken voice**: a warm, natural recorded voice instead of the device's robot voice. Note names are said clearly ("see", not "capital C"). (#2)
- 🎤 **Hears quiet tablet mics**, keeps listening after songs and lessons open, and ignores people talking nearby.
- 🥚 **Rewards are eggs**: one per lesson, up to three per song, and a chick for each finished level. Locked songs can be opened with a friendly prompt.
