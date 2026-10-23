// A real keyboard plugged in by USB (Web MIDI): exact notes, no microphone guessing.
// Works in Chrome/Edge/Firefox on Android, Chromebooks, Windows and Mac. Not on iPad or iPhone:
// Safari (and every iOS browser, which all use Safari's engine) has no Web MIDI.

// One MIDI message -> { type: 'on' | 'off', m, vel } or null for anything that isn't a key.
// Note-on with velocity 0 is how many keyboards (Casio included) send note-off.
export function parseMidi(data) {
  if (!data || data.length < 3) return null;
  const kind = data[0] & 0xf0;
  const m = data[1], v = data[2];
  if (kind === 0x90 && v > 0) return { type: 'on', m, vel: v / 127 };
  if (kind === 0x80 || kind === 0x90) return { type: 'off', m, vel: 0 };
  return null;
}

export const midiSupported = (nav = globalThis.navigator) => !!(nav && nav.requestMIDIAccess);

// Has this site already been allowed to use MIDI? Then we can connect without asking (no prompt).
// iPad "Web MIDI browser" apps (e.g. MIDIWeb Browser) add requestMIDIAccess themselves, with no prompt
// to show, so connect straight away there too.
export async function midiAllowed(nav = globalThis.navigator) {
  if (!/\[native code\]/.test(Function.prototype.toString.call(nav.requestMIDIAccess))) return true;
  try { return (await nav.permissions.query({ name: 'midi' })).state === 'granted'; } catch { return false; }
}

// Listens to every connected keyboard, including ones plugged in later.
// handlers: onDown(m, vel), onUp(m), onChange(names) with the names of connected inputs.
export async function startMidi({ onDown, onUp, onChange }, nav = globalThis.navigator) {
  const access = await nav.requestMIDIAccess();
  const held = new Set();
  const hook = () => {
    const names = [];
    access.inputs.forEach((input) => {
      if (input.state === 'disconnected') return;
      names.push(input.name || 'Keyboard');
      input.onmidimessage = (e) => {
        const ev = parseMidi(e.data);
        if (!ev) return;
        if (ev.type === 'on') { held.add(ev.m); onDown(ev.m, ev.vel); }
        else if (held.delete(ev.m)) onUp(ev.m);
      };
    });
    // unplugged mid-note: let go of anything still held so nothing sticks
    if (!names.length) { held.forEach((m) => onUp(m)); held.clear(); }
    onChange(names);
  };
  access.onstatechange = hook;
  hook();
  return access;
}
