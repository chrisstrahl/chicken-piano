// Song library, grouped by level. music.js parses these strings into playable notes.
//
// notes:  space-separated tokens. Letter + optional # or b + optional octave (default 4),
//         then optional :dur (8, q (default), qd, h, hd, w). R = rest (R:h). C+E+G:w = chord.
//         A trailing ~ ties a note to the next one.
// lyrics: one word per sounding note, "_" = no word.
// key:    the song's key. Accidentals are spelled for that key (Bb in F, F# in G) so flats
//         and key signatures can be drawn later without retranscribing.
// Reserved for the next version (the engine ignores them for now):
//   lh:     left-hand part, same tokens as notes
//   chords: chord symbols, one per beat group, e.g. 'C:w F:h G:h'
//
// Within a level, the first five songs are the easiest (they unlock with the lessons);
// the rest of the level follows. Titles are chicken versions of public domain tunes
// (sub names the original) or new songs written for Chicken Piano (sub: 'New song').

export const SONG_DATA = [
  // ───────────── Level 1: C D E only ─────────────
  {
    id: 'peck3', level: 1, emoji: '🐤', title: 'Peck Peck Peck', sub: 'New song', key: 'C', time: '4/4', tempo: 96,
    notes: 'E D C C E D C C C D E E D D C C',
    lyrics: 'Peck, peck, peck, peck, seeds on the ground, lit- tle chick- ens eat them all up!',
  },
  {
    id: 'threeeggs', level: 1, emoji: '🥚', title: 'One Two Three Eggs', sub: 'New song', key: 'C', time: '4/4', tempo: 96,
    notes: 'C D E C C D E C E D C D E E C C',
    lyrics: 'One, two, three eggs, one, two, three eggs, in the nest so warm and co- zy.',
  },
  {
    id: 'clucksong', level: 1, emoji: '🐔', title: 'Cluck Cluck Song', sub: 'New song', key: 'C', time: '4/4', tempo: 100,
    notes: 'E E D D C C D D E E D D C C C C',
    lyrics: 'Cluck cluck, cluck cluck, hens in the hay, cluck cluck, cluck cluck, lay an egg now!',
  },
  {
    id: 'chicksteps', level: 1, emoji: '👣', title: 'Chick Steps', sub: 'New song', key: 'C', time: '4/4', tempo: 100,
    notes: 'C D E D C D E D C E C E D D C C',
    lyrics: 'Step, step, step, back, step, step, step, back, hop, hop, hop, hop, home we go now!',
  },
  {
    id: 'eggroll', level: 1, emoji: '🫕', title: 'Roll the Egg', sub: 'New song', key: 'C', time: '4/4', tempo: 104,
    notes: 'E D C D E D C D E D C C E D E C',
    lyrics: 'Roll the egg down, roll the egg down, down, down, down, down, crack! Hel- lo chick!',
  },
  {
    id: 'sleepychick', level: 1, emoji: '😴', title: 'Sleepy Chick', sub: 'New song', key: 'C', time: '4/4', tempo: 84,
    notes: 'E E E E D D D D C D E D C C C C',
    lyrics: 'Shh, shh, shh, shh, sleep, lit- tle chick, close your eyes now, dream a- bout seeds.',
  },

  // ───────────── Level 2: C D E F G (five-finger C position) ─────────────
  {
    id: 'fiveeggs', level: 2, emoji: '🖐️', title: 'Five Little Eggs', sub: 'New song', key: 'C', time: '4/4', tempo: 100,
    notes: 'C D E F G G G G G F E D C C C C C E G E C E G E G F E D C C C C',
    lyrics: 'One, two, three, four, five eggs to hatch! Five, four, three, two, one, crack, peep, peep! Up and down and up and down and five, four, three, two, all chicks home now!',
  },
  {
    id: 'clucktown', level: 2, emoji: '🐓', title: 'Little Red Hen', sub: 'New song', key: 'C', time: '4/4', tempo: 104,
    notes: 'C C D D E E E E F F E E D D D D E E F F G G G G G F E D C C C C',
    lyrics: 'Cluck cluck cluck cluck, lit- tle red hen, where did you hide your eggs to- day? Un- der the hay- stack, here they are! One, two, three, four, hoo- ray, hoo- ray!',
  },
  {
    id: 'wakeup', level: 2, emoji: '🌅', title: 'Rooster Wake-Up', sub: 'New song', key: 'C', time: '4/4', tempo: 108,
    notes: 'G G E C G G E C D E F E D D D D G G E C G G E C F E D E C C C C',
    lyrics: 'Cock- a- doo- dle doo! Wake up now! Sun is up in the big blue sky. Cock- a- doo- dle doo! Time to play! Peck and scratch and run all day long!',
  },
  {
    id: 'henhop', level: 2, emoji: '🐇', title: 'Hen House Hop', sub: 'New song', key: 'C', time: '4/4', tempo: 112,
    notes: 'C C E E G G E E F F D D E E C C C D E F G G G G G F E D C C C C',
    lyrics: 'Hop, hop, in the hen house, hop, hop, flap your wings up high, then hop, hop, turn a- round and wig- gle, wig- gle, wave your feath- ers, bye, bye, bye, bye!',
  },
  {
    id: 'chickmarch', level: 2, emoji: '🥁', title: 'Chicken March', sub: 'New song', key: 'C', time: '4/4', tempo: 112,
    notes: 'C E G E C E G E F D F D E C E C C E G G F D F F G F E D C C C C',
    lyrics: 'March, march, march, march, lit- tle chicks march, left, right, left, right, all a- round the barn- yard we go, one, two, three, four, now we stop and say cluck, cluck, cluck!',
  },
  {
    id: 'cornlunch', level: 2, emoji: '🌽', title: 'Corn for Lunch', sub: 'New song', key: 'C', time: '4/4', tempo: 104,
    notes: 'E F G G E F G G G F E D E E C C D D E F E E D D E F G E D D C C',
    lyrics: 'Corn for lunch, yum! Corn for lunch, yum! Peck it, peck it, peck it up now! Seeds for din- ner, worms for snack- time, hap- py, hap- py chick- ens love food!',
  },

  // ───────────── Level 3: half notes, whole notes and rests ─────────────
  {
    id: 'saints2', level: 3, emoji: '🎺', title: 'Oh When the Chicks', sub: 'When the Saints Go Marching In', key: 'C', time: '4/4', tempo: 132,
    notes: "R C E F G:w R C E F G:w R C E F G:h E:h C:h E:h D:w R E E D C:h C E G:h G F F:w R C E F G:h E:h C:h D:h C:w",
    lyrics: 'Oh when the chicks go march- ing in, oh when the chicks go march- ing in, oh how I want to be in that num- ber, oh when the chicks go march- ing in!',
  },
  {
    id: 'lightly', level: 3, emoji: '🌾', title: 'Lightly Peck', sub: 'Lightly Row', key: 'C', time: '4/4', tempo: 104,
    notes: 'G E E:h F D D:h C D E F G G G:h G E E:h F D D:h C E G G C:w D D D D D E F:h E E E E E F G:h G E E:h F D D:h C E G G C:w',
    lyrics: 'Light- ly peck, light- ly peck, in the yard the chick- ens go; hop and skip, hop and skip, all a- round the yard. Ev- ery chick- en loves to play, peck- ing seeds the whole long day; light- ly peck, light- ly peck, home to roost we go.',
  },
  {
    id: 'aunthenny', level: 3, emoji: '👵', title: 'Go Tell Aunt Henny', sub: 'Go Tell Aunt Rhody', key: 'C', time: '4/4', tempo: 100,
    notes: 'E:h E D C:h C:h D:h D F E:h D:h G:h G F E:h E:h D D C D E:h C:h',
    lyrics: 'Go tell Aunt Hen- ny, go tell Aunt Hen- ny, go tell Aunt Hen- ny her eggs are in the nest.',
  },
  {
    id: 'brownhens', level: 3, emoji: '🐔', title: 'Three Brown Hens', sub: 'Three Blind Mice', key: 'C', time: '4/4', tempo: 104,
    notes: 'E D C:h E D C:h G F E:h G F E:h G G F F E D C:h',
    lyrics: 'Three brown hens, three brown hens, see them run, see them run, hap- py hap- py lit- tle hens!',
  },
  {
    id: 'sleepyhen', level: 3, emoji: '🌙', title: 'Sleepy Hen', sub: 'New song', key: 'C', time: '4/4', tempo: 80,
    notes: 'E:w D:w C:h D:h E:w G:h F:h E:h D:h C:w',
    lyrics: 'Shh, shh, sleep- y hen, close your eyes and rest.',
  },
  {
    id: 'peckrest', level: 3, emoji: '🤫', title: 'Peck and Rest', sub: 'New song', key: 'C', time: '4/4', tempo: 100,
    notes: 'C D E R E D C R C E G R G E C R C D E F G R G R G F E D C:w',
    lyrics: 'Peck, peck, peck, peck, peck, peck, scratch, scratch, scratch, scratch, scratch, scratch, lit- tle chick- ens, shh, shh, time to take a nap.',
  },

  // ───────────── Level 4: reading up to C5 (and a little higher) ─────────────
  {
    id: 'ladder', level: 4, emoji: '🪜', title: 'Chicken Ladder', sub: 'New song', key: 'C', time: '4/4', tempo: 100,
    notes: 'C E G:h E G A:h A G E:h G E C:h C E G C5 C5:w C5 G E C C:w',
    lyrics: 'Up we climb, to the top, down we go, to the coop. Up, up, up, so high! Down, down, down, to bed.',
  },
  {
    id: 'egghunt', level: 4, emoji: '🔍', title: 'Egg Hunt', sub: 'New song', key: 'C', time: '4/4', tempo: 104,
    notes: 'C E G E A:h G:h F D F A G:w A G E C D:h F:h E D E D C:w',
    lyrics: 'Look a- round the hen- house, where\'s the egg to- day? Peek be- hind the big hay, there it is! Hoo- ray!',
  },
  {
    id: 'higgledy', level: 4, emoji: '🖤', title: 'Higgledy Piggledy', sub: 'Old rhyme, new tune', key: 'C', time: '4/4', tempo: 112,
    notes: 'C:h E E G:h E E F F E:h D D E E F G E:h A A G G F F E:h C:h E E G:h E E D D C:h',
    lyrics: 'Hig- gle- dy pig- gle- dy, my black hen, she lays eggs for gen- tle- men; some- times nine and some- times ten, hig- gle- dy pig- gle- dy, my black hen!',
  },
  {
    id: 'redhen', level: 4, emoji: '🌾', title: 'The Little Red Hen', sub: 'New song', key: 'C', time: '4/4', tempo: 100,
    notes: 'C D E F G G A:h A G F E D:h C:h E E D D C:w G G F F E:h C:h',
    lyrics: 'Who will help me plant the wheat? said the lit- tle red hen. Not I, said the duck. Then I will, said the hen!',
  },
  {
    id: 'rainrain', level: 4, emoji: '🌧️', title: 'Rain Rain Go Away', sub: 'Rain Rain Go Away', key: 'C', time: '4/4', tempo: 100,
    notes: 'G:h E:h G G E:h G G E E A G E:h G:h E:h G G E:h G G E E A G E:h',
    lyrics: 'Rain, rain, go a- way, lit- tle chicks want out to play. Sun, sun, come and stay, lit- tle chicks can peck all day.',
  },
  {
    id: 'morning', level: 4, emoji: '🐓', title: 'Rooster Morning', sub: 'New song', key: 'C', time: '4/4', tempo: 108,
    notes: 'G G E C G G E:h A A G E D:w G G E C G G E:h F E D E C:w',
    lyrics: 'Cock- a- doo- dle- doo! Wake up! Sun is in the sky. Cock- a- doo- dle- doo! Get up! Time to peck and play!',
  },
  {
    id: 'canon', level: 4, emoji: '🎻', title: 'Hens in a Row', sub: 'Pachelbel: Canon', key: 'C', time: '4/4', tempo: 72,
    notes: 'E5:h D5:h C5:h B:h A:h G:h A:h B:h C5:h B:h A:h G:h F:h E:h F:h D:h E5:h D5:h C5:h B:h A:h G:h F:h G:h C5:w',
    lyrics: "Here come the hens, all in a row, one by one, out in the snow. Here come the chicks, all side by side, hel- lo!",
  },
  {
    id: 'barnclock', level: 4, emoji: '🕰️', title: 'Barn Clock', sub: 'Westminster Chimes', key: 'F', time: '4/4', tempo: 84,
    notes: 'A:h F:h G:h C:h F:h G:h A:h F:h A:h G:h F:h C:h C:h G:h A:h F:h F:w',
    lyrics: "Ding, dong, the clock says time to eat corn, the hens all run to- geth- er now!",
  },

  // ───────────── Level 5: A, B, G position, notes down to G3 ─────────────
  {
    id: 'doodle', level: 5, emoji: '🪶', title: 'Chicken Doodle', sub: 'Yankee Doodle', key: 'C', time: '4/4', tempo: 116,
    notes: 'C C D E C E D G3 C C D E C:h B3:h C C D E F E D C B3 G3 A3 B3 C:h C:h',
    lyrics: 'Chick- en Doo- dle went to town a- rid- ing on a pig- gy, stuck a feath- er in his cap and called it chick- a- ro- ni!',
  },
  {
    id: 'surprise', level: 5, emoji: '😲', title: 'Surprise Egg', sub: 'Haydn: Surprise Symphony', key: 'C', time: '4/4', tempo: 100,
    notes: 'C C E E G G E:h F F D D B3 B3 G3:h C C E E G G C5:h F F D D G3 B3 C:h',
    lyrics: 'Tip- toe, tip- toe, lit- tle chicks, qui- et, qui- et, shh, shh, shh. Tip- toe, tip- toe, lit- tle chicks, then the egg goes CRACK! Sur- prise!',
  },
  {
    id: 'wenceslas', level: 5, emoji: '❄️', title: 'Good King Rooster', sub: 'Good King Wenceslas', key: 'C', time: '4/4', tempo: 104,
    notes: 'C C C D C C G3:h A3 G3 A3 B3 C:h C:h C C C D C C G3:h A3 G3 A3 B3 C:h C:h G F E D E D C:h A3 G3 A3 B3 C:h C:h G3 G3 A3 B3 C C D:h G F E D C:h F:h C:w',
    lyrics: 'Good King Roost- er looked out on the snow- y farm- yard; all the hens were tucked in tight, sleep- ing in the barn- yard. Bright- ly shone the moon that night, though the frost was cru- el, when a lit- tle chick came by, look- ing for some corn and gru- el.',
  },
  {
    id: 'skiplou', level: 5, emoji: '💃', title: 'Skip to My Coop', sub: 'Skip to My Lou', key: 'C', time: '4/4', tempo: 112,
    notes: 'E E C C E E G:h D D B3 B3 D D F:h E E C C E E G:h D E F E D:h C:h',
    lyrics: "Lost my eggs, now what'll I do? Lost my eggs, now what'll I do? Lost my eggs, now what'll I do? Skip to my coop, dar- ling.",
  },
  {
    id: 'gparade', level: 5, emoji: '🎉', title: 'Hen Parade', sub: 'New song', key: 'G', time: '4/4', tempo: 108,
    notes: 'G A B C5 D5 D5 D5:h D5 C5 B A G:w B C5 D5 B C5 A B:h A B G A G:w',
    lyrics: "Here comes the big hen pa- rade! Up, up, here we go! Look at them strut- ting a- round, march- ing in a row!",
  },
  {
    id: 'gswing', level: 5, emoji: '🌳', title: 'Swing High Chick', sub: 'New song', key: 'G', time: '4/4', tempo: 100,
    notes: 'G B D5:h D5 B G:h A C5 B A G:w D5 C5 B A B C5 D5:h D5 B A B G:w',
    lyrics: 'Swing so high, swing so low, back and forth we go. Lit- tle chick is on the swing, wheee! Up to the sky!',
  },

  // ───────────── Level 6: 3/4 time, dotted half notes, pickups ─────────────
  {
    id: 'henny', level: 6, emoji: '🚲', title: 'Henny Henny', sub: 'Daisy Bell', key: 'C', time: '3/4', tempo: 132,
    notes: 'G:hd E:hd C:hd G3:hd A3 B3 C A3:h C G3:hd R:hd D:hd G:hd E:hd C:hd A3 B3 C D:h E D:hd R:hd E D C D:h G3 C:hd',
    lyrics: 'Hen- ny, Hen- ny, give me your an- swer, do! I\'m half cra- zy, all for the love of you. You are my fav- \'rite hen!',
  },
  {
    id: 'grace', level: 6, emoji: '🕊️', title: 'Amazing Hens', sub: 'Amazing Grace', key: 'F', time: '3/4', tempo: 84, pickup: 1,
    notes: 'C F:h A A:h G F:h D C:h C F:h A A:h G C5:hd R:h A C5:h A A:h G F:h D C:h C F:h A A:h G F:hd',
    lyrics: 'A- maz- ing hens, how sweet the sound, they cluck from dawn till night. They peck the corn and lay their eggs, and sleep when stars are bright.',
  },
  {
    id: 'featherwaltz', level: 6, emoji: '🪶', title: 'Feather Waltz', sub: 'New song', key: 'C', time: '3/4', tempo: 120,
    notes: "C E G G:hd A G F E:hd F E D C:hd C E G C5:hd B A G A F D C:hd",
    lyrics: "One, two, three, spin! Round and round and round we go now! One, two, three, twirl! Feath- ers float- ing high and low!",
  },
  {
    id: 'rockingnest', level: 6, emoji: '🪺', title: 'Rocking Nest', sub: 'New song', key: 'F', time: '3/4', tempo: 96, pickup: 1,
    notes: 'C F:h A G:h F A:hd R:h C F:h A G:h E F:hd R:h A C5:h A G:h F G:h E F:hd',
    lyrics: "Rock, rock, the lit- tle nest, rock, rock, the eggs can rest, sleep, lit- tle ones, sleep now and rest.",
  },
  {
    id: 'barnwaltz', level: 6, emoji: '🏚️', title: 'Barnyard Waltz', sub: 'New song', key: 'G', time: '3/4', tempo: 126, pickup: 2,
    notes: "D E G:h B A:h G E:hd R D E G:h B A:h G D5:hd R:h D5 C5:h B A:h G E:h D G:hd",
    lyrics: "Come to the barn- yard and dance, twirl with the hens and the chicks, round and a- round and then we bow.",
  },

  // ───────────── Level 7: eighth notes, ties, repeats ─────────────
  {
    id: 'oldhen', level: 7, emoji: '👵', title: 'This Old Hen', sub: 'This Old Man', key: 'C', time: '4/4', tempo: 112,
    notes: 'G E G:h G E G:h A G F E D E F E:8 F:8 G C C:8 C:8 C C:8 D:8 E:8 F:8 G:h G D D F E D C:h',
    lyrics: 'This old hen, she laid one, she laid one egg in the sun, with a cluck cluck pec- ky peck, give the chick a crumb, this old hen came strut- ting home.',
  },
  {
    id: 'sleephen', level: 7, emoji: '🛌', title: 'Are You Sleeping, Mother Hen?', sub: 'Frère Jacques', key: 'C', time: '4/4', tempo: 104,
    notes: 'C D E C C D E C E F G:h E F G:h G:8 A:8 G:8 F:8 E C G:8 A:8 G:8 F:8 E C C G3 C:h C G3 C:h',
    lyrics: 'Are you sleep- ing, are you sleep- ing, Moth- er Hen? Moth- er Hen? Morn- ing bells are ring- ing, morn- ing bells are ring- ing, cluck, cluck, cluck! Cluck, cluck, cluck!',
  },
  {
    id: 'spring', level: 7, emoji: '🌸', title: 'Spring Chicks', sub: 'Vivaldi: Spring', key: 'C', time: '4/4', tempo: 100, pickup: 1,
    notes: 'C E E E D:8 C:8 G:hd G:8 F:8 E E E D:8 C:8 G:hd G:8 F:8 E F:8 G:8 F E D:h R:h',
    lyrics: "Spring is here, the chicks are out to play, flow- ers bloom- ing, birds all sing- ing, such a sun- ny, fun day!",
  },
  {
    id: 'hatchday', level: 7, emoji: '🎂', title: 'Happy Hatch Day', sub: 'Happy Birthday', key: 'C', time: '3/4', tempo: 100, pickup: 1,
    notes: 'G3:8 G3:8 A3 G3 C B3:h G3:8 G3:8 A3 G3 D C:h G3:8 G3:8 G E C B3 A3 F:8 F:8 E C D C:hd',
    lyrics: 'Hap- py hatch day to you, hap- py hatch day to you, hap- py hatch day, dear chick- y, hap- py hatch day to you!',
  },
  {
    id: 'henodefull', level: 7, emoji: '🎶', title: 'Happy Hens (Big Song)', sub: 'Beethoven: Ode to Joy', key: 'C', time: '4/4', tempo: 104,
    notes: 'E E F G G F E D C C D E E:qd D:8 D:h E E F G G F E D C C D E D:qd C:8 C:h D D E C D E:8 F:8 E C D E:8 F:8 E D C D G3:h E E F G G F E D C C D E D:qd C:8 C:h',
    lyrics: "Hap- py hens are in the hen- house, lay- ing eggs and sing- ing songs. Peck- ing corn and flap- ping feath- ers, cluck- ing all the whole day long. Lit- tle chicks come run- ning, run- ning, hop- ping, flap- ping, peep- ing, peep- ing too, ev- ery- bo- dy in the barn- yard, sing- ing hap- py songs with you!",
  },
  {
    id: 'sleighride', level: 7, emoji: '🛷', title: 'Jingle Clucks (Sleigh Ride)', sub: 'Jingle Bells', key: 'C', time: '4/4', tempo: 120,
    notes: 'G3 E D C G3:hd G3:8 G3:8 G3 E D C A3:w A3 F E D B3:w G G F D E:w G3 E D C G3:w G3 E D C A3:hd A3 A3 F E D G G G G A G F D C:h G:h E E E:h E E E:h E G C:qd D:8 E:w F F F:qd F:8 F E E E:8 E:8 E D D E D:h G:h E E E:h E E E:h E G C:qd D:8 E:w F F F F F E E E:8 E:8 G G F D C:w',
    lyrics: 'Dash- ing through the snow, in a one- hen o- pen sleigh, o\'er the fields we go, cluck- ing all the way. Bells on feath- ers ring, mak- ing spir- its bright, what fun it is to ride and sing a sleigh- ing song to- night! Oh! Jin- gle clucks, jin- gle clucks, jin- gle all the way! Oh what fun it is to ride in a one- hen o- pen sleigh, hey! Jin- gle clucks, jin- gle clucks, jin- gle all the way! Oh what fun it is to ride in a one- hen o- pen sleigh!',
  },
  {
    id: 'susanna', level: 7, emoji: '🪕', title: 'Oh Henrietta', sub: 'Oh! Susanna', key: 'C', time: '4/4', tempo: 112, pickup: 1,
    notes: "C:8 D:8 E G G:qd A:8 G E C:qd D:8 E E D C D:hd C:8 D:8 E G G:qd A:8 G E C:qd D:8 E E D D C:hd R F:h A:h A:qd G:8 G E C:qd D:8 E D C:h R C:8 D:8 E G G:qd A:8 G E C:qd D:8 E E D D C:hd R",
    lyrics: "I come from way down the farm- yard with my ban- jo on my knee, oh I'm go- ing to the big hen- house, my true love there to see. Oh Hen- ri- et- ta, oh don't you cry for me, for I come from down the farm- yard with my ban- jo on my knee.",
  },
  {
    id: 'camptown', level: 7, emoji: '🏁', title: 'Chicken Races', sub: 'Camptown Races', key: 'C', time: '4/4', tempo: 112,
    notes: "G:8 G:8 E:8 G:8 A:8 G:8 E E:8 D:qd E:8 D:qd G:8 G:8 E:8 G:8 A:8 G:8 E D:8 D:8 E:8 D:8 C:h C:qd C:8 E:8 G:8 C5 A:qd A:8 C5:8 A:8 G G:8 G:8 E:8 G:8 A:8 G:8 E D:8 D:8 E:8 D:8 C:h",
    lyrics: "Chick- en run- ners sing this song, doo- dah, doo- dah, chick- en race is five miles long, oh, the doo- dah day! Gon- na run all night, gon- na run all day, bet my corn on the brown hen, who will win to- day?",
  },
  {
    id: 'auldlang', level: 7, emoji: '🥂', title: 'Old Friends in the Coop', sub: 'Auld Lang Syne', key: 'F', time: '4/4', tempo: 92, pickup: 1,
    notes: 'C F:qd F:8 F A G:qd F:8 G A F:qd F:8 A C5 D5:hd D5 C5:qd A:8 A F G:qd F:8 G A F:qd D:8 D C F:hd',
    lyrics: 'Should old friends in the coop for- get the times we used to play? We\'ll peck to- geth- er side by side and cluck the night a- way.',
  },
  {
    id: 'goinghome', level: 7, emoji: '🏡', title: 'Going Home to Roost', sub: 'Dvořák: New World Symphony (Largo)', key: 'C', time: '4/4', tempo: 66,
    notes: 'E:qd G:8 G:h E:qd D:8 C:h D:qd E:8 G:qd E:8 D:w E:qd G:8 G:h E:qd D:8 C:h D:qd E:8 D:qd C:8 C:w',
    lyrics: "Go- ing home, go- ing home, I'm a- go- ing home. Qui- et- ly, qui- et- ly, hens are go- ing home.",
  },
  {
    id: 'mycoop', level: 7, emoji: '🏠', title: 'My Coop, \'Tis of Thee', sub: 'America (My Country, \'Tis of Thee)', key: 'C', time: '3/4', tempo: 96,
    notes: 'C C D B3:qd C:8 D E E F E:qd D:8 C D C B3 C:hd G G G G:qd F:8 E F F F F:qd E:8 D E F:8 E:8 D:8 C:8 E:qd F:8 G A:8 F:8 E D C:hd',
    lyrics: "My lit- tle coop, of thee, sweet home for hens and me, of thee I sing. Home where the roost- ers crow, home where the corn will grow, from ev- ery lit- tle red barn- yard, let the cluck- ing ring!",
  },

  // ───────────── Level 8: sharps and flats ─────────────
  {
    id: 'minuet', level: 8, emoji: '👑', title: 'Fancy Hen Minuet', sub: 'Petzold: Minuet in G', key: 'G', time: '3/4', tempo: 112,
    notes: 'D5 G:8 A:8 B:8 C5:8 D5 G G E5 C5:8 D5:8 E5:8 F#5:8 G5 G G C5 D5:8 C5:8 B:8 A:8 B C5:8 B:8 A:8 G:8 F# G:8 A:8 B:8 G:8 A:hd D5 G:8 A:8 B:8 C5:8 D5 G G E5 C5:8 D5:8 E5:8 F#5:8 G5 G G C5 D5:8 C5:8 B:8 A:8 B C5:8 B:8 A:8 G:8 A B:8 A:8 G:8 F#:8 G:hd',
    lyrics: "Fan- cy lit- tle hen in a gown, danc- ing all a- round the big town, sil- ver shoes and gold crown up- on her head, curt- sy left and right, bow! Fan- cy lit- tle hen in a gown, danc- ing all a- round the big town, twirl- ing all night long, un- til she is tired, curt- sy, then good- night, bow!",
  },
  {
    id: 'deckhalls', level: 8, emoji: '🎄', title: 'Deck the Coop', sub: 'Deck the Halls', key: 'C', time: '4/4', tempo: 116,
    notes: 'G:qd F:8 E D C D E C D:8 E:8 F:8 D:8 E:qd D:8 C B3 C:h G:qd F:8 E D C D E C D:8 E:8 F:8 D:8 E:qd D:8 C B3 C:h D:qd E:8 F D E:qd F:8 G D E:8 F#:8 G A:8 B:8 C5 B A G:h G:qd F:8 E D C D E C A:8 A:8 A:8 A:8 G:qd F:8 E D C:h',
    lyrics: 'Deck the coop with straw and hol- ly, fa la la la la, la la la la. Tis the sea- son to be jol- ly, fa la la la la, la la la la. Hens in all their gay ap- par- el, fa la la la la la la la la, cluck the an- cient yule- tide car- ol, fa la la la la, la la la la!',
  },
  {
    id: 'wewish', level: 8, emoji: '🎁', title: 'We Wish You a Merry Chickmas', sub: 'We Wish You a Merry Christmas', key: 'G', time: '3/4', tempo: 132, pickup: 1,
    notes: 'D G G:8 A:8 G:8 F#:8 E E E A A:8 B:8 A:8 G:8 F# D D B B:8 C5:8 B:8 A:8 G E D:8 D:8 E A F# G:hd',
    lyrics: 'We wish you a mer- ry Chick- mas, we wish you a mer- ry Chick- mas, we wish you a mer- ry Chick- mas and a hap- py new year!',
  },
  {
    id: 'clementine', level: 8, emoji: '⛏️', title: 'Oh My Darling Chickentine', sub: 'Oh My Darling, Clementine', key: 'F', time: '3/4', tempo: 112, pickup: 1,
    notes: 'F:8 F:8 F C A:8 A:8 A F F:8 A:8 C5:qd Bb:8 A:8 G:8 G:h G:8 A:8 Bb Bb A:8 G:8 A F F:8 A:8 G:qd C:8 E:8 G:8 F:hd',
    lyrics: 'Oh my dar- ling, oh my dar- ling, oh my dar- ling Chick- en- tine, you are lost and gone for- ev- er, dread- ful sor- ry, Chick- en- tine.',
  },
  {
    id: 'fifth', level: 8, emoji: '⚡', title: 'Cluck Cluck Cluck CLUCK!', sub: 'Beethoven: Symphony No. 5', key: 'Cm', time: '4/4', tempo: 108,
    notes: 'R:8 G:8 G:8 G:8 Eb:h R:8 F:8 F:8 F:8 D:h R:8 G:8 G:8 G:8 R:8 Ab:8 Ab:8 Ab:8 G:8 Eb5:8 Eb5:8 Eb5:8 C5:h R:8 G:8 G:8 G:8 Eb:h R:8 F:8 F:8 F:8 D:h R:8 G:8 G:8 G:8 Eb:8 Eb:8 D:8 D:8 C:w',
    lyrics: "Cluck cluck cluck CLUCK! Peck peck peck PECK! Cluck cluck cluck, peck peck peck, hen- ny sings so LOUD! Cluck cluck cluck CLUCK! Peck peck peck PECK! Cluck cluck cluck, hens are done, the end!",
  },
  {
    id: 'mountainking', level: 8, emoji: '⛰️', title: 'In the Hall of the Rooster King', sub: 'Grieg: In the Hall of the Mountain King', key: 'Am', time: '4/4', tempo: 112,
    notes: 'A:8 B:8 C5:8 D5:8 E5:8 C5:8 E5 D#5:8 B:8 D#5 D5:8 Bb:8 D5 A:8 B:8 C5:8 D5:8 E5:8 C5:8 E5:8 A5:8 G5:8 E5:8 C5:8 E5:8 G5:h A:8 B:8 C5:8 D5:8 E5:8 C5:8 E5 D#5:8 B:8 D#5 D5:8 Bb:8 D5 A:8 B:8 C5:8 D5:8 E5:8 C5:8 E5:8 A5:8 G5:8 E5:8 C5:8 E5:8 A5:h',
    lyrics: "Tip- toe, tip- toe, to the king, shh, shh, shh, shh, shh, shh, the roost- er king is sleep- ing in his big cas- tle, shh! Tip- toe, tip- toe, to the king, shh, shh, shh, shh, shh, shh, the roost- er king is wak- ing up, run, run, run, run, RUN!",
  },
  {
    id: 'elise', level: 8, emoji: '💌', title: 'Für Eggs-lise', sub: 'Beethoven: Für Elise', key: 'Am', time: '3/4', tempo: 72, pickup: 1,
    notes: 'E5:8 D#5:8 E5:8 D#5:8 E5:8 B:8 D5:8 C5:8 A R:8 C:8 E:8 A:8 B R:8 E:8 G#:8 B:8 C5 R:8 E:8 E5:8 D#5:8 E5:8 D#5:8 E5:8 B:8 D5:8 C5:8 A R:8 C:8 E:8 A:8 B R:8 E:8 C5:8 B:8 A:hd',
    lyrics: "Hen- ny, hen- ny, where did you go? To the big barn? To the hay- stack? Now come back home, what did you find out there? Some- thing round and white, an egg, yes! Peep!",
  },
  {
    id: 'greensleeves', level: 8, emoji: '💚', title: 'Green Feathers', sub: 'Greensleeves', key: 'Am', time: '3/4', tempo: 100, pickup: 1,
    notes: 'A C5:h D5 E5:qd F5:8 E5 D5:h B G:qd A:8 B C5:h A A:qd G#:8 A B:h G# E:h A C5:h D5 E5:qd F5:8 E5 D5:h B G:qd A:8 B C5:qd B:8 A G#:qd F#:8 G# A:hd',
    lyrics: "A- las, my hen, you flew a- way, so far from the coop where you liked to stay, I miss your cluck and your green feath- ers, come home to the nest, please come home and stay!",
  },

  // ───────────── Level 9: bass clef, left hand (C3–G3) ─────────────
  {
    id: 'bigrooster', level: 9, emoji: '🐓', title: 'Big Rooster Walk', sub: 'New song', key: 'C', time: '4/4', tempo: 96, clef: 'bass',
    notes: 'C3 D3 E3 C3 C3 D3 E3 C3 E3 F3 G3:h E3 F3 G3:h G3 F3 E3 D3 C3:w',
    lyrics: "Big old Roost- er, big old Roost- er, walks so slow, walks so slow, stomp, stomp, stomp, stomp, home.",
  },
  {
    id: 'lowode', level: 9, emoji: '🎶', title: 'Grandpa Rooster\'s Song', sub: 'Beethoven: Ode to Joy', key: 'C', time: '4/4', tempo: 96, clef: 'bass',
    notes: 'E3 E3 F3 G3 G3 F3 E3 D3 C3 C3 D3 E3 E3 D3 D3:h E3 E3 F3 G3 G3 F3 E3 D3 C3 C3 D3 E3 D3 C3 C3:h',
    lyrics: 'Grand- pa Roost- er sings so low, his voice is deep and big and slow, all the chicks sit down to lis- ten, then they sing a- long, you know!',
  },
  {
    id: 'lowsaints', level: 9, emoji: '🥾', title: 'When the Roosters Go Marching In', sub: 'When the Saints Go Marching In', key: 'C', time: '4/4', tempo: 132, clef: 'bass', pickup: 3,
    notes: 'C3 E3 F3 G3:w R C3 E3 F3 G3:w R C3 E3 F3 G3:h E3:h C3:h E3:h D3:w R E3 E3 D3 C3:h C3 E3 G3:h G3 F3 F3:w R C3 E3 F3 G3:h E3:h C3:h D3:h C3:w',
    lyrics: 'Oh when the roost- ers march- ing in, oh when the roost- ers march- ing in, oh how I want to be in that num- ber, when the roost- ers go march- ing in!',
  },
  {
    id: 'lowcluck', level: 9, emoji: '🐻', title: 'Deep Cluck', sub: 'New song', key: 'C', time: '4/4', tempo: 100, clef: 'bass',
    notes: 'G3 G3 E3:h F3 F3 D3:h E3 F3 G3 E3 D3:w G3 G3 E3:h F3 F3 D3:h C3 E3 D3 E3 C3:w',
    lyrics: 'Cluck, cluck, low, cluck, cluck, slow, deep down in the barn. Cluck, cluck, low, cluck, cluck, slow, sleep- y in the barn.',
  },
  {
    id: 'lowrow', level: 9, emoji: '🌊', title: 'Rooster Row', sub: 'Lightly Row', key: 'C', time: '4/4', tempo: 104, clef: 'bass',
    notes: 'G3 E3 E3:h F3 D3 D3:h C3 D3 E3 F3 G3 G3 G3:h G3 E3 E3:h F3 D3 D3:h C3 E3 G3 G3 C3:w',
    lyrics: 'Roost- er row, roost- er row, down the riv- er off we go; roost- er row, roost- er row, home a- gain we go.',
  },
  {
    id: 'grumpy', level: 9, emoji: '😠', title: 'Grumpy Rooster', sub: 'New song', key: 'C', time: '4/4', tempo: 92, clef: 'bass',
    notes: 'C3 C3 C3 R D3 D3 D3 R E3 F3 G3 F3 E3:h R:h G3 G3 G3 R F3 F3 F3 R E3 D3 E3 D3 C3:w',
    lyrics: "Grr, grr, grr, hmph, hmph, hmph, I don't want to wake! Grr, grr, grr, hmph, hmph, hmph, five more min- utes, please!",
  },

  // ───────────── Level 10: C scale, chords, everything ─────────────
  {
    id: 'cscale', level: 10, emoji: '🪜', title: 'Chicken Scale', sub: 'New song', key: 'C', time: '4/4', tempo: 100,
    notes: 'C D E F G A B C5 C5 B A G F E D C C+E+G:w',
    lyrics: "Up, up, up the stairs we go, top! Down, down, down the stairs we come, home! Yay!",
  },
  {
    id: 'chordcluck', level: 10, emoji: '🎹', title: 'Chord Clucks', sub: 'New song', key: 'C', time: '4/4', tempo: 92,
    notes: 'C+E+G:h G:h F+A+C5:h A:h G+B+D5:h B:h C+E+G:w C+E+G E G C5 F+A+C5 A F C G+B+D5 D5 B G C+E+G:w',
    lyrics: "Cluck, cluck! Peck, peck! Flap, flap! Yay! Three notes to- geth- er make a chord, play them all, hoo- ray!",
  },
  {
    id: 'joyworld', level: 10, emoji: '🌟', title: 'Joy to the Farm', sub: 'Joy to the World', key: 'C', time: '4/4', tempo: 100,
    notes: 'C5:h B:qd A:8 G:hd F E:h D:h C:hd G A:hd A B:hd B C5:hd C5 C5 B A G G:qd F:8 E C5 C5 B A G G:qd F:8 E E E E E E:8 F:8 G:hd F:8 E:8 D D D D:8 E:8 F:hd E:8 D:8 C C5:h A G:qd F:8 E F E:h D:h C:w',
    lyrics: "Joy to the farm, the sun is up, let hens come out to play! Let ev- ery chick come out and peck, and ev- ery roost- er crow and crow, cows and pigs and goats and sheep, and hors- es and the don- keys too, all the an- i- mals on the farm come out to play!",
  },
  {
    id: 'korobeiniki', level: 10, emoji: '🧱', title: 'Dancing Hens', sub: 'Korobeiniki (Russian folk song)', key: 'Am', time: '4/4', tempo: 132,
    notes: 'E5 B:8 C5:8 D5 C5:8 B:8 A A:8 C5:8 E5 D5:8 C5:8 B:qd C5:8 D5 E5 C5 A A:h R:8 D5 F5:8 A5 G5:8 F5:8 E5:qd C5:8 E5 D5:8 C5:8 B B:8 C5:8 D5 E5 C5 A A:h',
    lyrics: "Hens are danc- ing, hens are spin- ning, round and round they go, kick- ing high, kick- ing low! Oh, flap- ping wings and hop- ping, hop- ping, all a- round the big barn- yard, hoo- ray!",
  },
  {
    id: 'cancan', level: 10, emoji: '💃', title: 'Chicken Can-Can', sub: 'Offenbach: Can-Can', key: 'C', time: '4/4', tempo: 120,
    notes: "C D:8 F:8 E:8 D:8 G G G:8 A:8 E:8 F:8 D D D:8 F:8 E:8 D:8 C:8 C5:8 B:8 A:8 G:8 F:8 E:8 D:8 C C D:8 F:8 E:8 D:8 G G G:8 A:8 E:8 F:8 D D D:8 F:8 E:8 D:8 G:8 E:8 C:h R:h",
    lyrics: "Kick! Kick- ing up our legs, hens, hens, kick- ing in a row, hens, hens, kick- ing up and down and all a- round the yard! Kick! Kick- ing up our legs, hens, hens, kick- ing in a row, hens, hens, now we take a bow!",
  },
  {
    id: 'nachtmusik', level: 10, emoji: '🌃', title: 'A Little Night Cluck', sub: 'Mozart: Eine kleine Nachtmusik', key: 'G', time: '4/4', tempo: 120,
    notes: 'G R:8 D:8 G R:8 D:8 G:8 D:8 G:8 B:8 D5 R C5 R:8 A:8 C5 R:8 A:8 C5:8 A:8 F#:8 A:8 D R G R:8 D:8 G R:8 D:8 G:8 D:8 G:8 B:8 D5 R C5:8 A:8 F#:8 A:8 D:8 F#:8 A:8 F#:8 G:w',
    lyrics: "Cluck, cluck, cluck, the hens are in the barn, peep, peep, peep, the chicks are snug and warm, cluck, cluck, cluck, the hens are in the barn, good night, lit- tle chicks, good night, it's late!",
  },
  {
    id: 'silentnight', level: 10, emoji: '🌌', title: 'Silent Nest', sub: 'Silent Night', key: 'C', time: '3/4', tempo: 84,
    notes: 'G:qd A:8 G E:hd G:qd A:8 G E:hd D5:h D5 B:hd C5:h C5 G:hd A:h A C5:qd B:8 A G:qd A:8 G E:hd A:h A C5:qd B:8 A G:qd A:8 G E:hd D5:h D5 F5:qd D5:8 B C5:hd E5:hd C5 G E G:qd F:8 D C:hd',
    lyrics: "Si- lent nest, shh, ho- ly nest, shh, all is calm, all is bright, round the barn the moon- light is glow- ing, lit- tle chicks are tucked in so tight- ly, sleep, sleep in hea- ven- ly peace, sleep, sleep in hea- ven- ly peace.",
  },
];
