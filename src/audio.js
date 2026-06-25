// src/audio.js
// Web Audio SFX, synthesized in code (no audio files, so the APK ships offline and
// asset-light). Presentation only: NO game rules, no seeded RNG (Math.random for
// noise is fine here, it is feel not logic). Browser-only (uses window).
//
// The AudioContext is created lazily and resumed on the first play() that follows a
// user gesture, per the browser autoplay policy. Since every SFX is triggered by a
// tap/commit, the context wakes on the first interaction. Mute persists in localStorage.

const KEY = 'letterRide.muted';
let ctx = null;
let muted = (() => { try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; } })();

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = !!m;
  try { window.localStorage.setItem(KEY, muted ? '1' : '0'); } catch {}
}
export function toggleMuted() { setMuted(!muted); return muted; }

function ac() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// A decaying oscillator tone, with an optional pitch glide (freqEnd).
function tone(c, { type = 'sine', freq = 440, freqEnd = null, dur = 0.15, gain = 0.2, delay = 0, attack = 0.005 }) {
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

// A filtered white-noise burst (the mechanical transient).
function noise(c, { dur = 0.1, gain = 0.15, delay = 0, type = 'lowpass', freq = 1000, q = 1 }) {
  const t0 = c.currentTime + delay;
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const filt = c.createBiquadFilter(); filt.type = type; filt.frequency.value = freq; filt.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(g).connect(c.destination);
  src.start(t0); src.stop(t0 + dur + 0.03);
}

// The SFX set. Warm + tactile; modest gains so simultaneous tones stay well clear of clipping.
const SFX = {
  // tile select: a soft, short type-sort click
  tap(c)      { tone(c, { type: 'triangle', freq: 1400, dur: 0.045, gain: 0.09 }); },
  // commit / the platen coming down: a low thunk + a mechanical transient
  chunk(c)    { tone(c, { type: 'sine', freq: 150, freqEnd: 55, dur: 0.18, gain: 0.28 });
                noise(c, { dur: 0.06, gain: 0.14, type: 'lowpass', freq: 1100 }); },
  // score payoff: a warm rising triad
  flourish(c) { tone(c, { type: 'triangle', freq: 523, dur: 0.10, gain: 0.15, delay: 0.00 });
                tone(c, { type: 'triangle', freq: 659, dur: 0.10, gain: 0.15, delay: 0.07 });
                tone(c, { type: 'triangle', freq: 880, dur: 0.18, gain: 0.16, delay: 0.14 }); },
  // cash-out: two bright metallic dings
  cash(c)     { tone(c, { type: 'square', freq: 1318, dur: 0.09, gain: 0.09 });
                tone(c, { type: 'square', freq: 1760, dur: 0.12, gain: 0.09, delay: 0.06 }); },
  // boss-round entry: an ominous downward sting
  boss(c)     { tone(c, { type: 'sawtooth', freq: 220, freqEnd: 90, dur: 0.5, gain: 0.15 });
                tone(c, { type: 'sine', freq: 155, dur: 0.5, gain: 0.11 }); },
};

export function play(name) {
  const c = ac();
  if (!c) return;
  const fn = SFX[name];
  if (fn) { try { fn(c); } catch {} }
}
