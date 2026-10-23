// The shapes of Chicken Piano's data: songs (as written in songs.js and as the app uses them after
// music.js and arrange.js fill them in), lessons and levels, and players. Types only: nothing here
// ends up in the built page. src/types.check.ts holds the real data up against these.

// Note values: 16 sixteenth, 8 eighth, q quarter, qd dotted quarter, h half, hd dotted half, w whole
export type Duration = '16' | '8' | 'q' | 'qd' | 'h' | 'hd' | 'w';
export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = '' | '#' | 'b';
// Space-separated note tokens: "C D# Bb3 C5:h G3:hd E:8 R:q C+E+G:w C:h~" (see music.js)
export type Tokens = string;

// One song as written in songs.js
export interface SongData {
  id: string;
  level: number;
  emoji: string;
  title: string;
  sub: string; // the original tune's name, or 'New song'
  key: string; // 'C', 'G', 'F', 'Am'...
  time: string; // '4/4', '3/4', '6/8'
  tempo: number;
  diff?: number; // difficulty 1-100 (tools/difficulty.mjs)
  notes: Tokens;
  lyrics: string; // one word per sounding note, '_' = none
  clef?: string; // 'treble' (default) or 'bass'
  pickup?: number; // beats before the first full bar
  bars?: boolean;
  lh?: Tokens; // left-hand part
  chords?: string; // 'C:w F:h G:h', from after the pickup
  fingers?: string; // one per sounding melody note, '_' none, '1+3+5' for a chord
  lhFingers?: string;
  lhStyle?: string; // for tools/lefthand.mjs: 'own' keeps a hand-written lh, 'block' plays chords as blocks
}

// One pitch inside a parsed note
export interface Pitch {
  m: number; // MIDI note number, 60 = middle C
  letter: string;
  acc: string;
  oct: number;
  label: string; // 'F♯', 'B♭'
}

// A parsed token (music.js parse): a rest, or one or more keys sounding together
export type Note =
  | { r: true; d: Duration | string; keys: []; lyric: string }
  | { r?: undefined; m: number; keys: Pitch[]; d: Duration | string; tie?: boolean; label: string; letter: string; lyric: string };

// A note of the key's scale, spelled: letter, '#' / 'b' / '', pitch class (0 = C)
export interface ScaleNote { letter: string; acc: string; pc: number }
export interface Chord {
  sym: string; // 'C', 'Am', 'F♯m'
  pcs: number[]; // pitch classes, 0 = C
  notes: ScaleNote[];
  bonus?: number; // how much the harmonizer favors it (home chord most)
}
// A chord held from `beat` for `len` beats
export interface ChordSpan { beat: number; len: number; chord: Chord }

// { F: '#', C: '#' } for D major
export type KeySig = Partial<Record<string, '#' | 'b'>>;

// A finger number per sounding note: 1 thumb .. 5 pinky, several for a chord, null for none
export type Finger = number | number[] | null;

// A song ready to play: notes parsed, two hands arranged (music.js song() + arrange.ts)
export interface Song extends SongInput {
  keySig: KeySig;
  melodyHand: 'rh' | 'lh'; // bass-clef songs put the melody in the left hand and chords in the right
  notes: Note[]; // right hand
  fingers: Finger[];
  chords: ChordSpan[];
  lh: Note[];
  lhFingers: Finger[];
}
// What music.js hands to arrange(): the song's own fields, with defaults filled in
export interface SongInput {
  id: string;
  level: number;
  emoji: string;
  title: string;
  sub: string;
  key: string;
  time: string;
  tempo: number;
  clef: string;
  pickup: number;
  bars: boolean;
  diff?: number;
  lhStyle?: string;
  notes: Note[];
  // the two-hand parts as written in songs.js, when given
  lhData?: Tokens;
  chordsData?: string;
  fingersData?: string;
  lhFingersData?: string;
}

// Lesson steps (music.js). Every step asks the child to do something before moving on.
export type StepType = 'show' | 'key' | 'seq' | 'name' | 'beats' | 'choice' | 'rhythm';
// Which keys the on-screen keyboard shows, lights and labels during a step
export interface KeysView {
  hl?: Tokens;
  letters?: 'none' | 'hl' | 'all';
  groups?: boolean;
  fingers?: boolean | 'lh'; // number the lit keys 1 2 3 4 5 from the left, or 5 4 3 2 1 for the left hand
  range?: string;
}
export interface ChoiceRound {
  staff?: Tokens;
  hear?: Tokens;
  clef?: string;
  tempo?: number;
  vel?: number;
  hl?: Tokens;
  time?: string;
  repeat?: boolean;
  ask?: string; // a note name shown as the question
  options: string[];
  answer: string;
}
export type LessonStep =
  | {
      type: 'show'; say: string; text: string; goal: string;
      times?: number; // goal notes to play (default: each once)
      keys?: KeysView; staff?: Tokens; clef?: string; time?: string; repeat?: boolean;
      hear?: Tokens; hearVel?: number[]; clap?: boolean;
      echo?: boolean; // the staff shows each key as it is played
      count?: boolean; // beat numbers under the staff, each note on a band as long as it lasts
      lh?: Tokens; // a left-hand part: the staff becomes a grand staff
    }
  | { type: 'key'; say: string; targets: Tokens; letters?: string; hint?: string; range?: string }
  // read: no letters and no glowing keys, so the child reads the staff
  | { type: 'seq'; say: string; seqs: Tokens[]; range?: string; read?: boolean }
  | { type: 'name'; say: string; notes: Tokens; pool: string; clef?: string; range?: string }
  | { type: 'beats'; say: string; durs: string[] }
  | { type: 'choice'; say: string; rounds: ChoiceRound[] }
  // The chicken plays the rhythm with the metronome pecking, then counts in and the child plays it back in time.
  // staff: what is drawn (and judged); lh: a left-hand part to draw (grand staff); play: what is judged
  // instead of staff when the hands take turns; tempo: beats a minute (default 72)
  | { type: 'rhythm'; say: string; staff: Tokens; lh?: Tokens; play?: Tokens; clef?: string; time?: string; tempo?: number; range?: string };

export interface Lesson { id: string; emoji: string; title: string; steps: LessonStep[] }
export interface Level { n: number; emoji: string; title: string; color: string; lessons: Lesson[] }

// Recordings (recorder.js): each played note is [start ms, MIDI note, length ms, velocity 0..1]
export type RecNote = [number, number, number, number];
// What is being recorded: a song, or Free Play (song null)
export interface RecInfo { title: string; emoji: string; song: string | null }
export interface Recording extends RecInfo { id: string; at: number; notes: RecNote[] }
// Where a played note came from
export type NoteSource = 'tap' | 'mic' | 'midi';

// Players (profiles.js)
export interface Avatar { id: string; name: string; body: string; edge: string }
export interface Player { id: string; avatar: string; name: string }

// Ear game nests (ear.js): the keys the chicken may play (MIDI numbers) and how many it plays at once
export interface EarStage { id: string; emoji: string; pool: number[]; len: number }
