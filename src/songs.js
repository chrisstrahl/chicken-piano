// Song library, grouped by level. music.js parses these strings into playable notes.
//
// notes:  space-separated tokens. Letter + optional # or b + optional octave (default 4),
//         then optional :dur (8, q (default), qd, h, hd, w). R = rest (R:h). C+E+G:w = chord.
//         A trailing ~ ties a note to the next one.
// lyrics: one word per sounding note, "_" = no word.
// key:    the song's key. Accidentals are spelled for that key (Bb in F, F# in G) so flats
//         and key signatures can be drawn later without retranscribing.
// diff:   difficulty 1-100 from tools/difficulty.mjs (range, hand moves, rhythm, accidentals,
//         speed, length...). test/songlib.mjs checks it; rerun the tool after changing notes.
// Two-hand data (optional; the engine fills in anything left out):
//   lh:        left-hand part, same tokens as notes, octaves written out (C3), same total beats
//              as the melody including the pickup (pickup beats are rests)
//   chords:    chord symbols from after the pickup, e.g. 'C:w F:h G:h' (duration defaults to w)
//   fingers:   one finger number per sounding melody note ('_' = none, '1+3+5' for a chord)
//   lhFingers: the same for lh
//
// Within a level, songs are listed easiest first (lowest diff): they unlock in that order as
// the lessons are done. Each melody appears once in the library (the test rejects two songs that
// share a long run of the same tune); playing a song with the other hand or clef is a toggle in
// the app, not a separate song. Titles are chicken versions of public domain tunes (sub names
// the original) or new songs written for Chicken Piano (sub: 'New song').

export const SONG_DATA = [
  // ───────────── Level 1: C D E ─────────────
  {
    id: "eggs", level: 1, emoji: "🍳", title: "Scrambled Eggs", sub: "Hot Cross Buns", key: "C", time: "4/4", tempo: 96, diff: 6,
    notes: "E D C:h E D C:h C C C C D D D D E D C:h",
    lyrics: "Scram- bled eggs, Scram- bled eggs, One a pen- ny, two a pen- ny, Scram- bled eggs!",
  },
  {
    id: "walk", level: 1, emoji: "🐾", title: "Chicken Walk", sub: "New song", key: "C", time: "4/4", tempo: 96, diff: 6,
    notes: "C D E E D C D:h C D E E D D C:h",
    lyrics: "Walk- ing to the barn, cluck, cluck! Walk- ing back a- gain, cluck, cluck!",
  },
  {
    id: "moon", level: 1, emoji: "🌙", title: "Moonlight Chicks", sub: "Au Clair de la Lune", key: "C", time: "4/4", tempo: 96, diff: 6,
    notes: "C C C D E:h D:h C E D D C:w C C C D E:h D:h C E D D C:w",
    lyrics: "In the moon- light, lit- tle chick- ens go to sleep. Snug- gle in the nest now, ti- ny chicks, good night!",
  },
  {
    id: "onetwothree", level: 1, emoji: "🥚", title: "One Two Three Eggs", sub: "New song", key: "C", time: "4/4", tempo: 96, diff: 6,
    notes: "C D E C C D E C E D C D E E C C",
    lyrics: "One, two, three eggs, one, two, three eggs, in the nest so warm and co- zy.",
  },
  {
    id: "clucksong", level: 1, emoji: "🐔", title: "Cluck Cluck Song", sub: "New song", key: "C", time: "4/4", tempo: 100, diff: 6,
    notes: "E E D D C C D D E E D D C C C C",
    lyrics: "Cluck cluck, cluck cluck, hens in the hay, cluck cluck, cluck cluck, lay an egg now!",
  },
  {
    id: "chicksteps", level: 1, emoji: "👣", title: "Chick Steps", sub: "New song", key: "C", time: "4/4", tempo: 100, diff: 6,
    notes: "C D E D C D E D C E C E D D C C",
    lyrics: "Step, step, step, back, step, step, step, back, hop, hop, hop, hop, home we go now!",
  },
  {
    id: "eggroll", level: 1, emoji: "🫕", title: "Roll the Egg", sub: "New song", key: "C", time: "4/4", tempo: 104, diff: 6,
    notes: "E D C D E D C D E D C C E D E C",
    lyrics: "Roll the egg down, roll the egg down, down, down, down, down, crack! Hel- lo chick!",
  },
  {
    id: "peck", level: 1, emoji: "🌽", title: "Peck Peck Peck", sub: "New song", key: "C", time: "4/4", tempo: 96, diff: 7,
    notes: "E E E:h D D D:h C D E D C:w",
    lyrics: "Peck, peck, peck! Peck, peck, peck! Pick- ing up the corn!",
  },
  {
    id: "threeeggs", level: 1, emoji: "🐣", title: "Little Eggies", sub: "New song", key: "C", time: "4/4", tempo: 96, diff: 7,
    notes: "C C D D E:h E:h E E D D C:h C:h",
    lyrics: "Lit- tle eg- gies, crack! crack! Lit- tle chick- ies, hel- lo!",
  },
  {
    id: "sleepychick", level: 1, emoji: "😴", title: "Sleepy Chick", sub: "New song", key: "C", time: "4/4", tempo: 84, diff: 8,
    notes: "E E E E D D D D C D E D C C C C",
    lyrics: "Shh, shh, shh, shh, sleep, lit- tle chick, close your eyes now, dream a- bout seeds.",
  },

  // ───────────── Level 2: C to G ─────────────
  {
    id: "rain", level: 2, emoji: "🌧️", title: "Rain, Rain, Go Away", sub: "Rain, Rain, Go Away", key: "C", time: "4/4", tempo: 100, diff: 11,
    notes: "G:h E:h G G E:h G G E A G G E:h G:h E:h G G E:h G G E A G G E:h",
    lyrics: "Rain, rain, go a- way, chick- ens want to come and play! Sun, sun, come and stay, chick- ens want to peck all day!",
  },
  {
    id: "clucky", level: 2, emoji: "🥚", title: "Clucky's Egg", sub: "Mary Had a Little Lamb", key: "C", time: "4/4", tempo: 104, diff: 14,
    notes: "E D C D E E E:h D D D:h E G G:h E D C D E E E E D D E D C:w",
    lyrics: "Clu- cky had a lit- tle egg, lit- tle egg, lit- tle egg, Clu- cky had a lit- tle egg, its shell was white as snow!",
  },
  {
    id: "hens", level: 2, emoji: "🐔", title: "Happy Hens", sub: "Ode to Joy", key: "C", time: "4/4", tempo: 100, diff: 15,
    notes: "E E F G G F E D C C D E E D D:h E E F G G F E D C C D E D C C:h",
    lyrics: "Hap- py hens are in the hen- house, lay- ing eggs and sing- ing songs. Peck- ing corn and flap- ping feath- ers, clu- cking all the whole day long!",
  },
  {
    id: "fiveeggs", level: 2, emoji: "🖐️", title: "Five Little Eggs", sub: "New song", key: "C", time: "4/4", tempo: 100, diff: 15,
    notes: "C D E F G G G G G F E D C C C C C E G E C E G E G F E D C C C C",
    lyrics: "One, two, three, four, five eggs to hatch! Five, four, three, two, one, crack, peep, peep! Up and down and up and down and five, four, three, two, all chicks home now!",
  },
  {
    id: "jingle", level: 2, emoji: "🔔", title: "Jingle Clucks", sub: "Jingle Bells", key: "C", time: "4/4", tempo: 112, diff: 17,
    notes: "E E E:h E E E:h E G C D E:w F F F F F E E E E D D E D:h G:h",
    lyrics: "Jin- gle clucks, jin- gle clucks, jin- gle all the way! Oh what fun it is to peck in a big red barn to- day!",
  },
  {
    id: "clucktown", level: 2, emoji: "🐓", title: "Cluck Cluck Hen", sub: "New song", key: "C", time: "4/4", tempo: 104, diff: 17,
    notes: "C C D D E E E E F F E E D D D D E E F F G F E G F E D F E D C C",
    lyrics: "Cluck cluck cluck cluck, lit- tle red hen, where did you hide your eggs to- day? Un- der the hay- stack, here they are! One, two, three, four, hoo- ray, hoo- ray!",
  },
  {
    id: "chickmarch", level: 2, emoji: "🥁", title: "Chicken March", sub: "New song", key: "C", time: "4/4", tempo: 112, diff: 17,
    notes: "C E G E C E G E F D F D E C E C C E G G F D F F G F E D C C C C",
    lyrics: "March, march, march, march, lit- tle chicks march, left, right, left, right, all a- round the barn- yard we go, one, two, three, four, now we stop and say cluck, cluck, cluck!",
  },
  {
    id: "cornlunch", level: 2, emoji: "🌽", title: "Corn for Lunch", sub: "New song", key: "C", time: "4/4", tempo: 104, diff: 17,
    notes: "E F G G E F G G G F E D E E C C D D E F E E D D E F G E D D C C",
    lyrics: "Corn for lunch, yum! Corn for lunch, yum! Peck it, peck it, peck it up now! Seeds for din- ner, worms for snack- time, hap- py, hap- py chick- ens love food!",
  },
  {
    id: "wakeup", level: 2, emoji: "🌅", title: "Rooster Wake-Up", sub: "New song", key: "C", time: "4/4", tempo: 108, diff: 18,
    notes: "G G E C G G E C D E F E D D D D G G E C G G E C F E D E C C C C",
    lyrics: "Cock- a- doo- dle doo! Wake up now! Sun is up in the big blue sky. Cock- a- doo- dle doo! Time to play! Peck and scratch and run all day long!",
  },
  {
    id: "lightly", level: 2, emoji: "🚣", title: "Lightly Peck", sub: "Lightly Row", key: "C", time: "4/4", tempo: 104, diff: 19,
    notes: "G E E:h F D D:h C D E F G G G:h G E E:h F D D:h C E G G C:w D D D D D E F:h E E E E E F G:h G E E:h F D D:h C E G G C:w",
    lyrics: "Light- ly peck, light- ly peck, pick- ing up the corn we go. Light- ly peck, light- ly peck, chick- ens in a row. Let the chick- ens all come out, fluff their feath- ers, run a- bout. Light- ly peck, light- ly peck, chick- ens in a row!",
  },

  // ───────────── Level 3: half notes, whole notes, rests ─────────────
  {
    id: "holdnote", level: 3, emoji: "⏳", title: "Hold That Note", sub: "New song", key: "C", time: "4/4", tempo: 100, diff: 12,
    notes: "C:w E:w G:h F:h E:w D:h E:h F:h D:h C:w",
    lyrics: "Cluck! Cluck! Hold the note! Long and slow, the end!",
  },
  {
    id: "brownhens", level: 3, emoji: "🐔", title: "Three Brown Hens", sub: "Three Blind Mice", key: "C", time: "4/4", tempo: 104, diff: 13,
    notes: "E D C:h E D C:h G F E:h G F E:h G G F F E D C:h",
    lyrics: "Three brown hens, three brown hens, see them run, see them run, hap- py hap- py lit- tle hens!",
  },
  {
    id: "hushhen", level: 3, emoji: "🌙", title: "Goodnight, Hen", sub: "New song", key: "C", time: "4/4", tempo: 80, diff: 13,
    notes: "E:w D:w C:h D:h E:w G:h F:h E:h D:h C:w",
    lyrics: "Shh, shh, sleep- y hen, close your eyes and rest.",
  },
  {
    id: "aunthenny", level: 3, emoji: "👵", title: "Go Tell Aunt Henny", sub: "Go Tell Aunt Rhody", key: "C", time: "4/4", tempo: 100, diff: 16,
    notes: "E:h E D C:h C:h D:h D F E:h D:h G:h G F E:h E:h D D C D E:h C:h",
    lyrics: "Go tell Aunt Hen- ny, go tell Aunt Hen- ny, go tell Aunt Hen- ny her eggs are in the nest.",
  },
  {
    id: "eggtimer", level: 3, emoji: "⏲️", title: "Egg Timer", sub: "New song", key: "C", time: "4/4", tempo: 100, diff: 16,
    notes: "E:h E:h D:h D:h C:w R:w G:h G:h F:h E:h D:w C:w",
    lyrics: "Tick, tock, tick, tock, ding! Eggs are al- most done, yum!",
  },
  {
    id: "reststop", level: 3, emoji: "🤫", title: "Rest Stop", sub: "New song", key: "C", time: "4/4", tempo: 100, diff: 18,
    notes: "C E G R:q G E C R:q D E F R:q E D C R:q C E G R:q G F E D C:h R:h",
    lyrics: "Cluck cluck cluck, cluck cluck cluck, peck peck peck, peck peck peck, flap flap flap, hush now ti- ny chick.",
  },
  {
    id: "march", level: 3, emoji: "🥁", title: "When the Chicks Go Marching In", sub: "When the Saints Go Marching In", key: "C", time: "4/4", tempo: 120, bars: false, diff: 18,
    notes: "C E F G:w C E F G:w C E F G:h E:h C:h E:h D:w E E D C:h C E G:h G F:w E F G:h E:h C:h D:h C:w",
    lyrics: "Oh when the chicks go march- ing in, oh when the chicks go march- ing in, Oh I want to be in that num- ber, when the chicks go march- ing in!",
  },
  {
    id: "peckrest", level: 3, emoji: "🤫", title: "Peck and Rest", sub: "New song", key: "C", time: "4/4", tempo: 100, diff: 19,
    notes: "C D E R E D C R E F G R G F E R C D E F G R G R G F E D C:w",
    lyrics: "Peck, peck, peck, peck, peck, peck, scratch, scratch, scratch, scratch, scratch, scratch, lit- tle chick- ens, shh, shh, time to take a nap.",
  },
  {
    id: "michael", level: 3, emoji: "⛵", title: "Chickens Row the Boat Ashore", sub: "Michael, Row the Boat Ashore", key: "C", time: "4/4", tempo: 104, bars: false, diff: 27,
    notes: "C E G:h E G A G:h E G A G:w E G G:h E F E D:w C D E D C:w",
    lyrics: "Chick- ens row the boat a- shore, cluck cluck cluck cluck! Chick- ens row the boat a- shore, cluck cluck cluck cluck cluck!",
  },
  {
    id: "twinkle", level: 3, emoji: "⭐", title: "Twinkle Little Chick", sub: "Twinkle Twinkle Little Star", key: "C", time: "4/4", tempo: 100, diff: 36,
    notes: "C C G G A A G:h F F E E D D C:h G G F F E E D:h G G F F E E D:h C C G G A A G:h F F E E D D C:h",
    lyrics: "Twin- kle twin- kle lit- tle chick, peck- ing seeds so ve- ry quick. Up a- bove the barn so high, like a feath- er in the sky. Twin- kle twin- kle lit- tle chick, peck- ing seeds so ve- ry quick!",
  },

  // ───────────── Level 4: reading the staff, up to C5 and beyond ─────────────
  {
    id: "races", level: 4, emoji: "🏁", title: "Chicken Races", sub: "Camptown Races", key: "C", time: "4/4", tempo: 112, diff: 23,
    notes: "G G E G A G E:h E D:h R:q E D:h R:q G G E G A G E:h D D E D C:w",
    lyrics: "Chick- en la- dies sing this song, doo- dah! doo- dah! Chick- en race- track five miles long, oh de doo- dah day!",
  },
  {
    id: "coop", level: 4, emoji: "🔨", title: "The Coop Is Falling Down", sub: "London Bridge", key: "C", time: "4/4", tempo: 104, diff: 24,
    notes: "G A G F E F G:h D E F:h E F G:h G A G F E F G:h D:h G:h E:h C:h",
    lyrics: "Chick- en coop is fall- ing down, fall- ing down, fall- ing down. Chick- en coop is fall- ing down, fix it, chick- ens!",
  },
  {
    id: "egghunt", level: 4, emoji: "🔍", title: "Egg Hunt", sub: "New song", key: "C", time: "4/4", tempo: 104, diff: 27,
    notes: "C E G E A:h G:h F D F A G:w A G E C D:h F:h E D E D C:w",
    lyrics: "Look a- round the hen- house, where's the egg to- day? Peek be- hind the big hay, there it is! Hoo- ray!",
  },
  {
    id: "higgledy", level: 4, emoji: "🖤", title: "Higgledy Piggledy", sub: "Old rhyme, new tune", key: "C", time: "4/4", tempo: 112, diff: 27,
    notes: "C:h E E G:h E E F F E:h D D E E F G E:h A A G G F F E:h C:h E E G:h E E D D C:h",
    lyrics: "Hig- gle- dy pig- gle- dy, my black hen, she lays eggs for gen- tle- men; some- times nine and some- times ten, hig- gle- dy pig- gle- dy, my black hen!",
  },
  {
    id: "redhen", level: 4, emoji: "🌾", title: "The Little Red Hen", sub: "New song", key: "C", time: "4/4", tempo: 100, diff: 28,
    notes: "C D E F G G A:h A G F E D:h C:h E E D D C:w G G F F E:h C:h",
    lyrics: "Who will help me plant the wheat? said the lit- tle red hen. Not I, said the duck. Then I will, said the hen!",
  },
  {
    id: "barnclock", level: 4, emoji: "🕰️", title: "Barn Clock", sub: "Westminster Chimes", key: "F", time: "4/4", tempo: 84, diff: 30,
    notes: "A:h F:h G:h C:h F:h G:h A:h F:h A:h G:h F:h C:h C:h G:h A:h F:h F:w",
    lyrics: "Ding, dong, the clock says time to eat corn, the hens all run to- geth- er now!",
  },
  {
    id: "roll", level: 4, emoji: "🛶", title: "Roll, Roll, Roll Your Egg", sub: "Row, Row, Row Your Boat", key: "C", time: "4/4", tempo: 104, diff: 33,
    notes: "C C C D E:h E D E F G:h C5 C5 C5 G G G E E E C C C G F E D C:w",
    lyrics: "Roll, roll, roll your egg, gent- ly down the lane. Mer- ri- ly, mer- ri- ly, mer- ri- ly, mer- ri- ly, chick- ens love the game!",
  },
  {
    id: "ladder", level: 4, emoji: "🪜", title: "Chicken Ladder", sub: "New song", key: "C", time: "4/4", tempo: 100, diff: 38,
    notes: "C E G:h E G A:h A G E:h G E C:h C E G C5 C5:w C5 G E C C:w",
    lyrics: "Up we climb, to the top, down we go, to the coop. Up, up, up, so high! Down, down, down, to bed.",
  },
  {
    id: "farm", level: 4, emoji: "🚜", title: "Old MacDonald's Chicks", sub: "Old MacDonald Had a Farm", key: "C", time: "4/4", tempo: 108, diff: 45,
    notes: "C5 C5 C5 G A A G:h E5 E5 D5 D5 C5:w C5 C5 C5 G A A G:h E5 E5 D5 D5 C5:w G G C5:h G G C5:h C5 C5 C5 G A A G:h E5 E5 D5 D5 C5:w",
    lyrics: "Old Mac- Don- ald had a farm, E- I- E- I- O! On that farm he had some chicks, E- I- E- I- O! Chick chick here, chick chick there, Old Mac- Don- ald had a farm, E- I- E- I- O!",
  },
  {
    id: "canon", level: 4, emoji: "🎻", title: "Hens in a Row", sub: "Pachelbel: Canon", key: "C", time: "4/4", tempo: 72, diff: 49,
    notes: "E5:h D5:h C5:h B:h A:h G:h A:h B:h C5:h B:h A:h G:h F:h E:h F:h D:h E5:h D5:h C5:h B:h A:h G:h F:h G:h C5:w",
    lyrics: "Here come the hens, all in a row, one by one, out in the snow. Here come the chicks, all side by side, hel- lo!",
  },
  {
    id: "linespace", level: 4, emoji: "🪜", title: "Line and Space Race", sub: "New song", key: "C", time: "4/4", tempo: 96, bars: false, diff: 57,
    notes: "E G B D5 F5:h F A C5 E5:h E5 C5 A F:h F5 D5 B G E:h",
    lyrics: "Every Good Chick Does Fine! F A C E! Back down a- gain, down the lines we go!",
  },

  // ───────────── Level 5: A, B, G position, down to G3 ─────────────
  {
    id: "wenceslas", level: 5, emoji: "👑", title: "Good Hen Wenceslas", sub: "Good King Wenceslas", key: "C", time: "4/4", tempo: 100, diff: 20,
    notes: "C C C D C C G3:h A3 G3 A3 B3 C:h C:h C C C D C C G3:h A3 G3 A3 B3 C:h C:h",
    lyrics: "Good Hen Wen- ces- las looked out, on the feast of Ste- phen. When the snow lay round a- bout, deep and crisp and e- ven.",
  },
  {
    id: "goodmorning", level: 5, emoji: "🌅", title: "Good Morning, Chicks", sub: "New song (G position)", key: "C", time: "4/4", tempo: 104, diff: 22,
    notes: "G A B C5 D5:h D5:h C5 B A B G:w D5 C5 B A G:h A:h B C5 D5 B G:w",
    lyrics: "Good morn- ing, lit- tle chicks, it's time to wake up! The sun is in the sky, so stretch your wings up!",
  },
  {
    id: "gswing", level: 5, emoji: "🌳", title: "Swing High Chick", sub: "New song", key: "G", time: "4/4", tempo: 100, diff: 22,
    notes: "G B D5:h D5 B G:h A C5 B A G:w D5 C5 B A B C5 D5:h D5 B A B G:w",
    lyrics: "Swing so high, swing so low, back and forth we go. Lit- tle chick is on the swing, wheee! Up to the sky!",
  },
  {
    id: "morning", level: 5, emoji: "☀️", title: "Sunrise in the Coop", sub: "Morning Mood (Grieg)", key: "C", time: "4/4", tempo: 96, bars: false, diff: 26,
    notes: "G E D C D E G E D C D E D E G E G A E A G E D C:w",
    lyrics: "",
  },
  {
    id: "hushchick", level: 5, emoji: "🌛", title: "Hush Little Chicky", sub: "New song", key: "C", time: "4/4", tempo: 84, diff: 26,
    notes: "E:h D C B3:h C:h D:h E D C:w G:h F E D:h E:h D C B3 D C:w",
    lyrics: "Hush, lit- tle chick- y, close your eyes, rest. Moth- er hen is sing- ing you to sleep now.",
  },
  {
    id: "skiplou", level: 5, emoji: "💃", title: "Skip to My Coop", sub: "Skip to My Lou", key: "C", time: "4/4", tempo: 112, diff: 27,
    notes: "E E C C E E G:h D D B3 B3 D D F:h E E C C E E G:h D E F E D:h C:h",
    lyrics: "Lost my eggs, now what'll I do? Lost my eggs, now what'll I do? Lost my eggs, now what'll I do? Skip to my coop, dar- ling.",
  },
  {
    id: "deck", level: 5, emoji: "🎄", title: "Deck the Coop", sub: "Deck the Halls", key: "C", time: "4/4", tempo: 108, diff: 30,
    notes: "G F E D C D E C D E F D E:h D C B3:h C:h G F E D C D E C D E F D E:h D C B3:h C:h",
    lyrics: "Deck the coop with straw so co- zy, fa la la la la, la la la la! Chicks and hens are snug and hap- py, fa la la la la, la la la la!",
  },
  {
    id: "underfence", level: 5, emoji: "🙈", title: "Under the Fence", sub: "New song", key: "C", time: "4/4", tempo: 100, diff: 30,
    notes: "C B3 A3 G3 A3 B3 C:h E D C B3 A3:w G3 A3 B3 D C B3 A3:h B3 C D B3 C:w",
    lyrics: "Un- der the fence, lit- tle chick, creep- ing down so low, un- der the gate, hide and seek, here I am! Peep! Boo!",
  },
  {
    id: "yankee", level: 5, emoji: "🎩", title: "Yankee Chicken", sub: "Yankee Doodle", key: "C", time: "4/4", tempo: 112, diff: 37,
    notes: "C C D E C E D G3 C C D E C:h B3:h C C D E F E D C B3 G3 A3 B3 C:h C:h",
    lyrics: "Yan- kee Chick- en went to town a- rid- ing on a tur- key, stuck a feath- er in his cap and called it mac- a- ro- ni!",
  },
  {
    id: "surprise", level: 5, emoji: "😲", title: "Surprise Egg", sub: "Haydn: Surprise Symphony", key: "C", time: "4/4", tempo: 100, diff: 51,
    notes: "C C E E G G E:h F F D D B3 B3 G3:h C C E E G G C5:h F F D D G3 B3 C:h",
    lyrics: "Tip- toe, tip- toe, lit- tle chicks, qui- et, qui- et, shh, shh, shh. Tip- toe, tip- toe, lit- tle chicks, then the egg goes CRACK! Sur- prise!",
  },

  // ───────────── Level 6: 3/4, dotted half notes, pickups ─────────────
  {
    id: "gateswing", level: 6, emoji: "🪵", title: "Swing on the Gate", sub: "New song", key: "C", time: "3/4", tempo: 104, diff: 25,
    notes: "G B D5 C5:h A B G A G:hd D5 C5 B A:h B C5 B A G:hd",
    lyrics: "Swing on the gate, back and forth we go! Hold on so tight, lit- tle hen, hel- lo!",
  },
  {
    id: "sleepyhen", level: 6, emoji: "😴", title: "Sleepy Hen", sub: "New song", key: "C", time: "3/4", tempo: 92, diff: 31,
    notes: "E D C D:h E F E D C:hd G F E F:h G A G F E D D C:hd",
    lyrics: "Sleep- y hen, nod your head, go to bed. Close your eyes, tuck your beak, dream till dawn, dream till dawn.",
  },
  {
    id: "waltz", level: 6, emoji: "💃", title: "Chicken Waltz", sub: "New song", key: "C", time: "3/4", tempo: 112, diff: 48,
    notes: "C E G C5:h G A G F E:hd D F A B:h A G F D C:hd",
    lyrics: "One, two, three, waltz with me, round and round! Flap your wings, turn a- round and then bow!",
  },
  {
    id: "rockingnest", level: 6, emoji: "🪺", title: "Rocking Nest", sub: "New song", key: "F", time: "3/4", tempo: 96, pickup: 1, diff: 50,
    notes: "C F:h A G:h F A:hd R:h C F:h A G:h E F:hd R:h A C5:h A G:h F G:h E F:hd",
    lyrics: "Rock, rock, the lit- tle nest, rock, rock, the eggs can rest, sleep, lit- tle ones, sleep now and rest.",
  },
  {
    id: "henny", level: 6, emoji: "🚲", title: "Henny Henny", sub: "Daisy Bell", key: "C", time: "3/4", tempo: 132, diff: 51,
    notes: "G:hd E:hd C:hd G3:hd A3 B3 C A3:h C G3:hd R:hd D:hd G:hd E:hd C:hd A3 B3 C D:h E D:hd R:hd E D C D:h G3 C:hd",
    lyrics: "Hen- ny, Hen- ny, give me your an- swer, do! I'm half cra- zy, all for the love of you. You are my fav- 'rite hen!",
  },
  {
    id: "grace", level: 6, emoji: "🕊️", title: "Amazing Hens", sub: "Amazing Grace", key: "F", time: "3/4", tempo: 84, pickup: 1, diff: 51,
    notes: "C F:h A A:h G F:h D C:h C F:h A A:h G C5:hd R:h A C5:h A A:h G F:h D C:h C F:h A A:h G F:hd",
    lyrics: "A- maz- ing hens, how sweet the sound, they cluck from dawn till night. They peck the corn and lay their eggs, and sleep when stars are bright.",
  },
  {
    id: "barnwaltz", level: 6, emoji: "🏚️", title: "Barnyard Waltz", sub: "New song", key: "G", time: "3/4", tempo: 126, pickup: 2, diff: 52,
    notes: "D E G:h B A:h G E:hd R D E G:h B A:h G D5:hd R:h D5 C5:h B A:h G E:h D G:hd",
    lyrics: "Come to the barn- yard and dance, twirl with the hens and the chicks, round and a- round and then we bow.",
  },
  {
    id: "bday", level: 6, emoji: "🎂", title: "Happy Hatch Day", sub: "Happy Birthday", key: "C", time: "3/4", tempo: 100, pickup: 1, diff: 61,
    notes: "G3:8 G3:8 A3 G3 C B3:h G3:8 G3:8 A3 G3 D C:h G3:8 G3:8 G E C B3 A3 F:8 F:8 E C D C:hd",
    lyrics: "Hap- py hatch day to you, hap- py hatch day to you, hap- py hatch day dear chick- en, hap- py hatch day to you!",
  },
  {
    id: "merry", level: 6, emoji: "🎁", title: "Merry Clucks-mas", sub: "We Wish You a Merry Christmas", key: "C", time: "3/4", tempo: 112, pickup: 1, diff: 63,
    notes: "G3 C C:8 D:8 C:8 B3:8 A3 A3 A3 D D:8 E:8 D:8 C:8 B3 G3 G3 E E:8 F:8 E:8 D:8 C A3 G3:8 G3:8 A3 D B3 C:hd",
    lyrics: "We wish you a mer- ry Clucks- mas, we wish you a mer- ry Clucks- mas, we wish you a mer- ry Clucks- mas and a hap- py new year!",
  },
  {
    id: "silent", level: 6, emoji: "🌟", title: "Quiet Night", sub: "Silent Night", key: "C", time: "3/4", tempo: 84, diff: 73,
    notes: "G A G E:hd G A G E:hd D5:h D5 B:hd C5:h C5 G:hd A:h A C5 B A G A G E:hd A:h A C5 B A G A G E:hd D5:h D5 F5 D5 B C5:hd E5:hd C5 G E G F D C:hd",
    lyrics: "Qui- et _ night, sleep- y _ night, hens tuck in, chicks hold tight. 'Round the nest the lit- tle ones lie _ dream- ing of corn and sun- shine and sky, sleep in heav- en- ly peace _ sleep in heav- en- ly peace _",
  },

  // ───────────── Level 7: eighth notes, ties ─────────────
  {
    id: "goinghome", level: 7, emoji: "🏡", title: "Going Home to Roost", sub: "Dvořák: New World Symphony (Largo)", key: "C", time: "4/4", tempo: 66, diff: 27,
    notes: "E:qd G:8 G:h E:qd D:8 C:h D:qd E:8 G:qd E:8 D:w E:qd G:8 G:h E:qd D:8 C:h D:qd E:8 D:qd C:8 C:w",
    lyrics: "Go- ing home, go- ing home, I'm a- go- ing home. Qui- et- ly, qui- et- ly, hens are go- ing home.",
  },
  {
    id: "spring", level: 7, emoji: "🌸", title: "Spring Chicks", sub: "Vivaldi: Spring", key: "C", time: "4/4", tempo: 100, pickup: 1, diff: 33,
    notes: "C E E E D:8 C:8 G:hd G:8 F:8 E E E D:8 C:8 G:hd G:8 F:8 E F:8 G:8 F E D:h R:h",
    lyrics: "Spring is here, the chicks are out to play, flow- ers bloom- ing, birds all sing- ing, such a sun- ny, fun day!",
  },
  {
    id: "oldhen", level: 7, emoji: "👵", title: "This Old Hen", sub: "This Old Man", key: "C", time: "4/4", tempo: 104, diff: 38,
    notes: "G E G:h G E G:h A G F E D E F:h E:8 F:8 G C C:8 C:8 C C:8 D:8 E:8 F:8 G G:8 D:8 D:8 F:8 E D C:w",
    lyrics: "This old hen, she laid one, she laid eggs out in the sun, with a cluck cluck pad- dy- whack, give the chick some corn, this old hen came rol- ling home.",
  },
  {
    id: "gallop", level: 7, emoji: "🏇", title: "Chicken Gallop", sub: "New song", key: "C", time: "4/4", tempo: 100, diff: 52,
    notes: "C:qd D:8 E C E:qd F:8 G:h G:qd A:8 G E F:qd E:8 D:h C:qd D:8 E C E:qd F:8 G E D:qd E:8 D B3 C:w",
    lyrics: "Gal- lop, gal- lop, o- ver hill, gal- lop, gal- lop, nev- er still, feath- ers fly- ing, up and a- way, gal- lop all the day!",
  },
  {
    id: "hopstop", level: 7, emoji: "🛑", title: "Hop and Stop", sub: "New song", key: "C", time: "4/4", tempo: 96, diff: 54,
    notes: "C:8 D:8 E:8 F:8 G:h G:8 F:8 E:8 D:8 C:h E:8 E:8 G:8 G:8 A:h~ A G:h R F:8 F:8 A:8 A:8 G:h E:8 E:8 G:8 G:8 F:h D:8 E:8 F:8 D:8 E:qd D:8 C:w",
    lyrics: "Hop, hop, hop, hop, stop! Back, back, back, back, stop! Flap, flap, flap, flap, wings up! Run, run, run, run, round, peck, peck, peck, peck, corn, now we all hop to the nest!",
  },
  {
    id: "frere", level: 7, emoji: "⏰", title: "Brother Chick", sub: "Frère Jacques", key: "C", time: "4/4", tempo: 104, diff: 55,
    notes: "C D E C C D E C E F G:h E F G:h G:8 A:8 G:8 F:8 E C G:8 A:8 G:8 F:8 E C C G3 C:h C G3 C:h",
    lyrics: "Are you sleep- ing, are you sleep- ing, Broth- er Chick? Broth- er Chick? Morn- ing eggs are hatch- ing, morn- ing eggs are hatch- ing, cock- a- doo! cock- a- doo!",
  },
  {
    id: "mycoop", level: 7, emoji: "🏠", title: "My Coop, 'Tis of Thee", sub: "America (My Country, 'Tis of Thee)", key: "C", time: "3/4", tempo: 96, diff: 59,
    notes: "C C D B3:qd C:8 D E E F E:qd D:8 C D C B3 C:hd G G G G:qd F:8 E F F F F:qd E:8 D E F:8 E:8 D:8 C:8 E:qd F:8 G A:8 F:8 E D C:hd",
    lyrics: "My lit- tle coop, of thee, sweet home for hens and me, of thee I sing. Home where the roost- ers crow, home where the corn will grow, from ev- ery lit- tle red barn- yard, let the cluck- ing ring!",
  },
  {
    id: "auldlang", level: 7, emoji: "🥂", title: "Old Friends in the Coop", sub: "Auld Lang Syne", key: "F", time: "4/4", tempo: 92, pickup: 1, diff: 64,
    notes: "C F:qd F:8 F A G:qd F:8 G A F:qd F:8 A C5 D5:hd D5 C5:qd A:8 A F G:qd F:8 G A F:qd D:8 D C F:hd",
    lyrics: "Should old friends in the coop for- get the times we used to play? We'll peck to- geth- er side by side and cluck the night a- way.",
  },
  {
    id: "susanna", level: 7, emoji: "🪕", title: "Oh Henrietta", sub: "Oh! Susanna", key: "C", time: "4/4", tempo: 112, pickup: 1, diff: 73,
    notes: "C:8 D:8 E G G:qd A:8 G E C:qd D:8 E E D C D:hd C:8 D:8 E G G:qd A:8 G E C:qd D:8 E E D D C:hd R F:h A:h A:qd G:8 G E C:qd D:8 E D C:h R C:8 D:8 E G G:qd A:8 G E C:qd D:8 E E D D C:hd R",
    lyrics: "I come from way down the farm- yard with my ban- jo on my knee, oh I'm go- ing to the big hen- house, my true love there to see. Oh Hen- ri- et- ta, oh don't you cry for me, for I come from down the farm- yard with my ban- jo on my knee.",
  },
  {
    id: "boogie", level: 7, emoji: "🕺", title: "Chicken Boogie", sub: "New song", key: "C", time: "4/4", tempo: 100, diff: 84,
    notes: "C:8 E:8 G:8 A:8 G:8 E:8 C C:8 E:8 G:8 A:8 G:8 E:8 C F:8 A:8 C5:8 D5:8 C5:8 A:8 F C:8 E:8 G:8 A:8 G:8 E:8 C G:8 B:8 D5:8 E5:8 D5:8 B:8 G F:8 A:8 C5:8 D5:8 C5:8 A:8 F C:8 E:8 G:8 A:8 G:8 E:8 C G:h C:h",
    lyrics: "",
  },

  // ───────────── Level 8: sharps and flats ─────────────
  {
    id: "sneaky", level: 8, emoji: "🥷", title: "Sneaky Chick", sub: "New song", key: "C", time: "4/4", tempo: 92, diff: 29,
    notes: "C C# D D# E:w E D# D C# C:w G F# F E D# D C# D C:w",
    lyrics: "Tip- toe, tip- toe, sneak! Tip- toe, tip- toe, back! Sneak- y, sneak- y, qui- et lit- tle peep!",
  },
  {
    id: "flathen", level: 8, emoji: "♭", title: "Flat Little Hen", sub: "New song (B flat)", key: "F", time: "4/4", tempo: 100, diff: 31,
    notes: "F G A Bb C5:h A:h Bb A G F G:w A Bb C5 A Bb G A F G E F G F:w",
    lyrics: "Flat hen, flat hen, B flat is your fav- 'rite note, play the black key, then the white keys, back home a- gain now.",
  },
  {
    id: "strut", level: 8, emoji: "🐓", title: "Strutting Rooster", sub: "New song (D major)", key: "D", time: "4/4", tempo: 100, diff: 42,
    notes: "D E F# G A:h A:h B G A F# E:w D F# A F# G E C# E D F# E C# D:w",
    lyrics: "Strut a- round the barn- yard, fluff your feath- ers out! Sharp and snap- py, proud as can be, strut, strut, strut, strut, home!",
  },
  {
    id: "sharpchick", level: 8, emoji: "♯", title: "Sharp Little Chick", sub: "New song (F sharp)", key: "G", time: "4/4", tempo: 100, diff: 46,
    notes: "G A B G F#:h D:h G A B C5 D5:w D5 C5 B A G F# E F# G B A F# G:w",
    lyrics: "Sharp lit- tle chick, F sharp, hop- ping up so high, down, down, down, down, step on the black key, then hop back home!",
  },
  {
    id: "mountain", level: 8, emoji: "⛰️", title: "In the Hall of the Rooster King", sub: "In the Hall of the Mountain King", key: "Am", time: "4/4", tempo: 104, diff: 54,
    notes: "A B C5 D5 E5 C5 E5:h D#5 B D#5:h D5 Bb D5:h A B C5 D5 E5 C5 E5 A5 G5 E5 C5 E5 G5:w",
    lyrics: "",
  },
  {
    id: "bounce", level: 8, emoji: "🏀", title: "Black Key Bounce", sub: "New song", key: "F#", time: "4/4", tempo: 104, diff: 56,
    notes: "F# G# A# C#5 D#5:h D#5:h C#5 A# G# A# F#:w D#5 C#5 A# G# F#:h G#:h A# C#5 A# G# F#:w",
    lyrics: "",
  },
  {
    id: "clementine", level: 8, emoji: "⛏️", title: "Oh My Darling Chickentine", sub: "Oh My Darling, Clementine", key: "F", time: "3/4", tempo: 112, pickup: 1, diff: 68,
    notes: "F:8 F:8 F C A:8 A:8 A F F:8 A:8 C5:qd Bb:8 A:8 G:8 G:h G:8 A:8 Bb Bb A:8 G:8 A F F:8 A:8 G:qd C:8 E:8 G:8 F:hd",
    lyrics: "Oh my dar- ling, oh my dar- ling, oh my dar- ling Chick- en- tine, you are lost and gone for- ev- er, dread- ful sor- ry, Chick- en- tine.",
  },
  {
    id: "fifth", level: 8, emoji: "⚡", title: "Cluck Cluck Cluck CLUCK!", sub: "Beethoven: Symphony No. 5", key: "Cm", time: "4/4", tempo: 108, diff: 70,
    notes: "R:8 G:8 G:8 G:8 Eb:h R:8 F:8 F:8 F:8 D:h R:8 G:8 G:8 G:8 R:8 Ab:8 Ab:8 Ab:8 G:8 Eb5:8 Eb5:8 Eb5:8 C5:h R:8 G:8 G:8 G:8 Eb:h R:8 F:8 F:8 F:8 D:h R:8 G:8 G:8 G:8 Eb:8 Eb:8 D:8 D:8 C:w",
    lyrics: "Cluck cluck cluck CLUCK! Peck peck peck PECK! Cluck cluck cluck, peck peck peck, hen- ny sings so LOUD! Cluck cluck cluck CLUCK! Peck peck peck PECK! Cluck cluck cluck, hens are done, the end!",
  },
  {
    id: "greensleeves", level: 8, emoji: "💚", title: "Green Feathers", sub: "Greensleeves", key: "Am", time: "3/4", tempo: 100, pickup: 1, diff: 87,
    notes: "A C5:h D5 E5:qd F5:8 E5 D5:h B G:qd A:8 B C5:h A A:qd G#:8 A B:h G# E:h A C5:h D5 E5:qd F5:8 E5 D5:h B G:qd A:8 B C5:qd B:8 A G#:qd F#:8 G# A:hd",
    lyrics: "A- las, my hen, you flew a- way, so far from the coop where you liked to stay, I miss your cluck and your green feath- ers, come home to the nest, please come home and stay!",
  },
  {
    id: "elise", level: 8, emoji: "🎹", title: "Für Eggs-lise", sub: "Für Elise (Beethoven)", key: "Am", time: "4/4", tempo: 80, bars: false, diff: 95,
    notes: "E5:8 D#5:8 E5:8 D#5:8 E5:8 B:8 D5:8 C5:8 A:q R:8 C:8 E:8 A:8 B:q R:8 E:8 G#:8 B:8 C5:q R:8 E:8 E5:8 D#5:8 E5:8 D#5:8 E5:8 B:8 D5:8 C5:8 A:q R:8 C:8 E:8 A:8 B:q R:8 E:8 C5:8 B:8 A:h",
    lyrics: "",
  },

  // ───────────── Level 9: bass clef, left hand ─────────────
  {
    id: "lowslow", level: 9, emoji: "🐢", title: "Low and Slow", sub: "New song", key: "C", time: "4/4", tempo: 92, clef: "bass", diff: 26,
    notes: "C3:h D3:h E3:w E3:h D3:h C3:w C3 D3 E3 F3 G3:w G3 F3 E3 D3 C3:w",
    lyrics: "Low and slow, low and slow, up the big hill, top! Down the big hill, home!",
  },
  {
    id: "rumble", level: 9, emoji: "🐓", title: "Rooster Rumble", sub: "New song", key: "C", time: "4/4", tempo: 104, clef: "bass", diff: 27,
    notes: "C3 E3 G3 E3 C3 E3 G3:h F3 D3 F3 D3 C3:w G3 F3 E3 D3 C3 D3 E3:h G3 F3 E3 D3 C3:w",
    lyrics: "",
  },
  {
    id: "lowcluck", level: 9, emoji: "🐻", title: "Deep Cluck", sub: "New song", key: "C", time: "4/4", tempo: 100, clef: "bass", diff: 27,
    notes: "G3 G3 E3:h F3 F3 D3:h E3 F3 G3 E3 D3:w G3 G3 E3:h F3 F3 D3:h C3 E3 D3 E3 C3:w",
    lyrics: "Cluck, cluck, low, cluck, cluck, slow, deep down in the barn. Cluck, cluck, low, cluck, cluck, slow, sleep- y in the barn.",
  },
  {
    id: "grumpy", level: 9, emoji: "😠", title: "Grumpy Rooster", sub: "New song", key: "C", time: "4/4", tempo: 92, clef: "bass", diff: 30,
    notes: "C3 C3 C3 R D3 D3 D3 R E3 F3 G3 F3 E3:h R:h G3 G3 G3 R F3 F3 F3 R E3 D3 E3 D3 C3:w",
    lyrics: "Grr, grr, grr, hmph, hmph, hmph, I don't want to wake! Grr, grr, grr, hmph, hmph, hmph, five more min- utes, please!",
  },
  {
    id: "bigrooster", level: 9, emoji: "🐓", title: "Big Rooster Walk", sub: "New song", key: "C", time: "4/4", tempo: 96, clef: "bass", diff: 37,
    notes: "C3 C3 E3 G3 C3 C3 E3 G3 A3 G3 E3:h F3 E3 D3:h E3 E3 D3 D3 C3:w",
    lyrics: "Big old Roost- er, big old Roost- er, walks so slow, walks so slow, stomp, stomp, stomp, stomp, home.",
  },
  {
    id: "owl", level: 9, emoji: "🦉", title: "Owl at the Coop", sub: "New song", key: "C", time: "3/4", tempo: 100, clef: "bass", diff: 41,
    notes: "C3 E3 G3 G3:hd F3 E3 D3 E3:hd C3 E3 G3 A3:h G3 F3 E3 D3 C3:hd",
    lyrics: "Who's in the coop? Who's in the barn? Hoo, hoo, hoo, says the owl to the hens!",
  },
  {
    id: "lownest", level: 9, emoji: "🪺", title: "Low Down Nest", sub: "New song (B flat)", key: "F", time: "4/4", tempo: 96, clef: "bass", diff: 44,
    notes: "F3 G3 A3 Bb3 A3:h F3:h G3 A3 G3 E3 F3:w C3 F3 A3 F3 Bb3 A3 G3:h A3 G3 F3 E3 F3:w",
    lyrics: "Down in the low nest, hen sits on her eggs warm. Soon the eggs will crack, crack, crack, peep, peep, peep, peep, hi!",
  },
  {
    id: "bigwaltz", level: 9, emoji: "🎻", title: "Big Hen Waltz", sub: "New song", key: "C", time: "3/4", tempo: 104, pickup: 1, clef: "bass", diff: 44,
    notes: "G3 C3:h E3 G3:h E3 F3 E3 D3 E3:hd D3:h F3 A3:h G3 F3 D3 E3 C3:h",
    lyrics: "Big hen dan- cing so slow in the barn, spin- ning a- round on her big feet!",
  },
  {
    id: "tractor", level: 9, emoji: "🛻", title: "Tractor Chug", sub: "New song", key: "C", time: "4/4", tempo: 96, clef: "bass", diff: 60,
    notes: "C3:8 C3:8 E3 G3 R G3:8 G3:8 F3 E3 R D3:8 D3:8 F3 A3 R G3:8 F3:8 E3 D3 R C3:8 C3:8 E3 G3 R A3:8 G3:8 F3 E3 R D3:8 E3:8 F3 D3 E3 C3:h R:h",
    lyrics: "Chug- ga chug, chug, trac- tor go- ing, down the big road, past the red barn, chug- ga chug, chug, pull- ing the hay, chick- ens rid- ing on top!",
  },
  {
    id: "lowrooster", level: 9, emoji: "🐓", title: "Rooster in the Yard", sub: "New song (F sharp)", key: "G", time: "4/4", tempo: 92, clef: "bass", diff: 61,
    notes: "G3:8 A3:8 B3 A3 G3 D3:h G3:h E3:8 F#3:8 G3 F#3 E3 D3:w G3:8 A3:8 B3 C4 B3 A3 G3 F#3:h E3:8 F#3:8 G3 A3 F#3 G3:w",
    lyrics: "Roo- ster in the yard, big, proud, walk- ing up and down, slow, cock- a- doo- dle doo, loud, so loud, wak- ing up the whole farm!",
  },

  // ───────────── Level 10: scales, chords, longer pieces ─────────────
  {
    id: "scale", level: 10, emoji: "🪜", title: "Chicken Scale March", sub: "New song (C major scale)", key: "C", time: "4/4", tempo: 104, diff: 37,
    notes: "C D E F G A B C5 C5 B A G F E D C C E G E C:w",
    lyrics: "Up the lad- der, climb- ing high- er, down the lad- der, back a- gain now, hop, hop, hop, hop, home!",
  },
  {
    id: "chordhop", level: 10, emoji: "🎶", title: "Chord Hop", sub: "New song (C, F and G chords)", key: "C", time: "4/4", tempo: 100, diff: 50,
    notes: "C E G E C:h R:h F A C5 A F:h R:h G B D5 B G:h R:h C E G:h C5:w",
    lyrics: "",
  },
  {
    id: "joy", level: 10, emoji: "🎉", title: "Joy to the Coop", sub: "Joy to the World", key: "C", time: "4/4", tempo: 96, bars: false, diff: 50,
    notes: "C5:h B A G:hd F E:h D:h C:w G A:hd A B:hd B C5:hd C5 C5 B A G:h G F E:w C5 B A G F E D C:w",
    lyrics: "Joy to the coop, the chicks have come! Let all the hens re- joice! Let ev- ery chick pre- pare a room, sing, chick- ens, sing, a hap- py song!",
  },
  {
    id: "itsybitsy", level: 10, emoji: "🕷️", title: "Itsy Bitsy Chicken", sub: "The Itsy Bitsy Spider", key: "C", time: "6/8", tempo: 100, pickup: 0.5, diff: 50,
    notes: "G:8 C:q C:8 C:q D:8 E:qd E:q E:8 D:q C:8 D:q E:8 C:qd R:q E:8 E:qd F:q G:8 G:qd R:q G:8 F:q E:8 F:q G:8 E:qd R:q C:8 C:qd D:q E:8 E:qd R:q E:8 D:q C:8 D:q E:8 C:qd R:q G:8 C:q C:8 C:q D:8 E:qd E:q E:8 D:q C:8 D:q E:8 C:qd R:qd",
    lyrics: "The it- sy bit- sy chick- en went up the gar- den path, down came the rain and washed the chick- en a- way, out came the sun and dried up all the rain, so the it- sy bit- sy chick- en went up the path a- gain.",
  },
  {
    id: "popegg", level: 10, emoji: "🍿", title: "Pop Goes the Egg", sub: "Pop Goes the Weasel", key: "C", time: "6/8", tempo: 100, diff: 51,
    notes: "C:q C:8 D:q D:8 E:8 G:8 E:8 C:qd C:q C:8 D:q D:8 E:qd C:qd C:q C:8 D:q D:8 E:8 G:8 E:8 C:qd A:qd D:q F:8 E:qd C:qd",
    lyrics: "All a- round the big hen- house yard, the roost- er chased the egg, the roost- er thought 'twas all in fun, pop! goes the egg- shell!",
  },
  {
    id: "chordcluck", level: 10, emoji: "🎹", title: "Chord Clucks", sub: "New song", key: "C", time: "4/4", tempo: 92, diff: 65,
    notes: "C+E+G:h G:h F+A+C5:h A:h G+B+D5:h B:h C+E+G:w C+E+G E G C5 F+A+C5 A F C G+B+D5 D5 B G C+E+G:w",
    lyrics: "Cluck, cluck! Peck, peck! Flap, flap! Yay! Three notes to- geth- er make a chord, play them all, hoo- ray!",
  },
  {
    id: "korobeiniki", level: 10, emoji: "🧱", title: "Dancing Hens", sub: "Korobeiniki (Russian folk song)", key: "Am", time: "4/4", tempo: 132, diff: 71,
    notes: "E5 B:8 C5:8 D5 C5:8 B:8 A A:8 C5:8 E5 D5:8 C5:8 B:qd C5:8 D5 E5 C5 A A:h R:8 D5 F5:8 A5 G5:8 F5:8 E5:qd C5:8 E5 D5:8 C5:8 B B:8 C5:8 D5 E5 C5 A A:h",
    lyrics: "Hens are danc- ing, hens are spin- ning, round and round they go, kick- ing high, kick- ing low! Oh, flap- ping wings and hop- ping, hop- ping, all a- round the big barn- yard, hoo- ray!",
  },
  {
    id: "cancan", level: 10, emoji: "💃", title: "Chicken Can-Can", sub: "Offenbach: Can-Can", key: "C", time: "4/4", tempo: 120, diff: 74,
    notes: "C D:8 F:8 E:8 D:8 G G G:8 A:8 E:8 F:8 D D D:8 F:8 E:8 D:8 C:8 C5:8 B:8 A:8 G:8 F:8 E:8 D:8 C C D:8 F:8 E:8 D:8 G G G:8 A:8 E:8 F:8 D D D:8 F:8 E:8 D:8 G:8 E:8 C:h R:h",
    lyrics: "Kick! Kick- ing up our legs, hens, hens, kick- ing in a row, hens, hens, kick- ing up and down and all a- round the yard! Kick! Kick- ing up our legs, hens, hens, kick- ing in a row, hens, hens, now we take a bow!",
  },
  {
    id: "nachtmusik", level: 10, emoji: "🌃", title: "A Little Night Cluck", sub: "Mozart: Eine kleine Nachtmusik", key: "G", time: "4/4", tempo: 120, diff: 75,
    notes: "G R:8 D:8 G R:8 D:8 G:8 D:8 G:8 B:8 D5 R C5 R:8 A:8 C5 R:8 A:8 C5:8 A:8 F#:8 A:8 D R G R:8 D:8 G R:8 D:8 G:8 D:8 G:8 B:8 D5 R C5:8 A:8 F#:8 A:8 D:8 F#:8 A:8 F#:8 G:w",
    lyrics: "Cluck, cluck, cluck, the hens are in the barn, peep, peep, peep, the chicks are snug and warm, cluck, cluck, cluck, the hens are in the barn, good night, lit- tle chicks, good night, it's late!",
  },
  {
    id: "minuet", level: 10, emoji: "🎻", title: "Hen Minuet", sub: "Minuet in G (Petzold)", key: "G", time: "3/4", tempo: 100, diff: 94,
    notes: "D5 G:8 A:8 B:8 C5:8 D5 G G E5 C5:8 D5:8 E5:8 F#5:8 G5 G G C5 D5:8 C5:8 B:8 A:8 B C5:8 B:8 A:8 G:8 F# G:8 A:8 B:8 G:8 A:hd D5 G:8 A:8 B:8 C5:8 D5 G G E5 C5:8 D5:8 E5:8 F#5:8 G5 G G C5 D5:8 C5:8 B:8 A:8 B C5:8 B:8 A:8 G:8 A B:8 A:8 G:8 F#:8 G:hd",
    lyrics: "",
  },
];
