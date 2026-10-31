// Runs inside the page before the app (page.addInitScript). Gives the robot kid:
//  - a fake microphone: a little synth piano the kid "plays on the Casio", plus the app's own sound leaking
//    from the tablet speaker back into the mic (like a real iPad propped on a keyboard)
//  - a pretend device voice, so lines without a recorded clip are still "heard" (and noted)
//  - logs of what the kid saw and heard: page changes, sounds, chicken lines, notes the mic heard
(() => {
  const K = (window.__kid = {
    changes: 0, lastChange: 0, sounds: [], lines: [], heard: [], strikes: [], keyTaps: [], bleed: 0.25, loud: 0, lastLoud: 0, loudLog: [],
  });
  const now = () => performance.now();

  /* ---------- what the kid sees change ---------- */
  const watch = () => {
    new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (!el || el.closest('.confetti')) continue;
        // a note the mic heard (main.ts writes its name into the mic pill)
        if (el.closest('#mic .heard') && m.type === 'childList' && el.textContent && el.textContent !== '·') K.heard.push({ t: now(), name: el.textContent });
        K.changes++; K.lastChange = now();
      }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true, attributeFilter: ['class', 'style', 'hidden'] });
  };
  if (document.documentElement) watch(); else document.addEventListener('DOMContentLoaded', watch);

  // screen keys the kid pressed (and how long they held them)
  const downs = {};
  addEventListener('pointerdown', (e) => { const k = e.target.closest && e.target.closest('.kb [data-m]'); if (k) downs[e.pointerId] = { t: now(), m: +k.dataset.m }; }, true);
  addEventListener('pointerup', (e) => { const d = downs[e.pointerId]; if (d) { delete downs[e.pointerId]; K.keyTaps.push({ ...d, held: Math.round(now() - d.t) }); } }, true);

  /* ---------- what the kid hears ---------- */
  // voice clips: fetched from voice/<id>.mp3, decoded, then played as a buffer
  const voiceBufs = new WeakMap(); // ArrayBuffer or AudioBuffer -> clip id
  const ofetch = window.fetch;
  window.fetch = function (url, ...a) {
    const p = ofetch.call(this, url, ...a);
    const m = String(url).match(/voice\/([0-9a-f]+)\.mp3/);
    if (!m) return p;
    return p.then((r) => { const ab = r.arrayBuffer.bind(r); r.arrayBuffer = () => ab().then((b) => { voiceBufs.set(b, m[1]); return b; }); return r; });
  };
  const odecode = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (b, ...a) {
    const id = voiceBufs.get(b);
    return odecode.call(this, b, ...a).then((buf) => { if (id) voiceBufs.set(buf, id); return buf; });
  };
  // AudioBufferSourceNode has its own start(), so both get the same watcher
  const ostart = AudioScheduledSourceNode.prototype.start;
  const obstart = AudioBufferSourceNode.prototype.start;
  const watchStart = (orig) => function (when, ...a) {
    if (this.context !== mic.ctx) {
      const at = now() + Math.max(0, ((when || 0) - this.context.currentTime) * 1000);
      const id = this.buffer && voiceBufs.get(this.buffer);
      if (id) K.lines.push({ t: at, id, ms: this.buffer.duration * 1000, clip: true });
      else K.sounds.push({ t: at, ms: this.buffer ? this.buffer.duration * 1000 : 300 });
      if (K.sounds.length > 400) K.sounds.splice(0, 200);
    }
    return orig.call(this, when, ...a);
  };
  AudioScheduledSourceNode.prototype.start = watchStart(ostart);
  AudioBufferSourceNode.prototype.start = watchStart(obstart);
  // A device voice that only pretends to talk (headless browsers have none): lines without a clip land here.
  class Utt { constructor(text) { this.text = text; } }
  const synth = {
    speaking: false, _t: 0,
    getVoices: () => [],
    speak(u) {
      const ms = 600 + u.text.length * 70;
      K.lines.push({ t: now(), text: u.text, ms, clip: false });
      this.speaking = true;
      setTimeout(() => u.onstart && u.onstart(), 30);
      clearTimeout(this._t);
      this._t = setTimeout(() => { this.speaking = false; u.onend && u.onend(); }, ms);
    },
    cancel() { clearTimeout(this._t); this.speaking = false; },
    set onvoiceschanged(f) {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth });
  window.SpeechSynthesisUtterance = Utt;

  /* ---------- fake microphone ---------- */
  const mic = { ctx: null, out: null, taps: [] };
  // the app's speakers: everything it sends to its speakers also goes, quieter, into the fake mic
  const oconnect = AudioNode.prototype.connect;
  const tapOf = (ctx) => {
    let t = mic.taps.find((x) => x.ctx === ctx);
    if (!t) { t = { ctx, dest: ctx.createMediaStreamDestination(), wired: false }; mic.taps.push(t); wire(); }
    return t;
  };
  AudioNode.prototype.connect = function (dest, ...a) {
    const r = oconnect.call(this, dest, ...a);
    if (dest instanceof AudioDestinationNode && dest.context !== mic.ctx) oconnect.call(this, tapOf(dest.context).dest);
    return r;
  };
  function wire() {
    if (!mic.ctx) return;
    for (const t of mic.taps) {
      if (t.wired) continue;
      t.wired = true;
      const src = mic.ctx.createMediaStreamSource(t.dest.stream);
      const g = mic.ctx.createGain();
      g.gain.value = K.bleed;
      t.gain = g;
      oconnect.call(oconnect.call(src, g), mic.out);
      // listen to the speaker too: anything the app plays counts as "something happened"
      const an = mic.ctx.createAnalyser();
      an.fftSize = 1024;
      oconnect.call(src, an);
      const buf = new Float32Array(an.fftSize);
      setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let e = 0;
        for (const x of buf) e += x * x;
        if (Math.sqrt(e / buf.length) > 0.002) { K.loud++; K.lastLoud = now(); K.loudLog.push(now()); if (K.loudLog.length > 6000) K.loudLog.splice(0, 3000); }
      }, 50);
    }
  }
  function openMic() {
    if (mic.ctx) return;
    mic.ctx = new AudioContext();
    mic.out = mic.ctx.createMediaStreamDestination();
    // room noise: a quiet hiss all the time
    const n = mic.ctx.sampleRate * 2, b = mic.ctx.createBuffer(1, n, mic.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.004;
    const s = mic.ctx.createBufferSource();
    s.buffer = b; s.loop = true;
    oconnect.call(s, mic.out);
    obstart.call(s);
    wire();
  }
  addEventListener('pointerdown', () => { openMic(); mic.ctx.resume(); }, true);
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async () => {
      openMic();
      await mic.ctx.resume();
      K.micOpened = (K.micOpened || 0) + 1;
      return mic.out.stream.clone();
    };
  }
  // The kid strikes a key on the real piano: a plucked, decaying tone with overtones, held for holdMs.
  K.strike = (m, holdMs = 300, vel = 0.8) => {
    openMic();
    const c = mic.ctx, t = c.currentTime + 0.005, f = 440 * 2 ** ((m - 69) / 12);
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.35 * vel, t + 0.006);
    env.gain.setTargetAtTime(0.12 * vel, t + 0.01, 0.25);
    env.gain.setTargetAtTime(0, t + holdMs / 1000, 0.05);
    oconnect.call(env, mic.out);
    for (let h = 1; h <= 8; h++) {
      if (f * h > 9000) break;
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = f * h * (1 + 0.0004 * h * h);
      g.gain.value = 1 / h ** 1.3;
      oconnect.call(oconnect.call(o, g), env);
      ostart.call(o, t);
      o.stop(t + holdMs / 1000 + 0.4);
    }
    K.strikes.push({ t: now(), m, holdMs });
  };
  K.setBleed = (v) => { K.bleed = v; mic.taps.forEach((t) => t.gain && (t.gain.gain.value = v)); };
})();
