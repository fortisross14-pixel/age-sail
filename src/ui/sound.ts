/**
 * Interface sounds, synthesized with Web Audio so there is nothing to download: brass, wood and
 * parchment for the Admiralty look. Sound starts only after the player's first click (browser rule),
 * and the choice and volume are remembered in this browser.
 */
export type Sfx = 'open' | 'close' | 'tab' | 'select' | 'build' | 'train' | 'coins' | 'season' | 'toast' | 'error' | 'page';

const KEY = 'age-sail:sound';
let enabled = true;
let volume = 0.6;
try {
  const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (v && typeof v.on === 'boolean') { enabled = v.on; volume = typeof v.volume === 'number' ? v.volume : volume; }
} catch { /* storage blocked: defaults */ }

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export const soundOn = () => enabled;
export const soundVolume = () => volume;
export function setSound(on: boolean, vol = volume) {
  enabled = on;
  volume = Math.max(0, Math.min(1, vol));
  if (master) master.gain.value = volume;
  try { localStorage.setItem(KEY, JSON.stringify({ on: enabled, volume })); } catch { /* ignore */ }
}

function audio(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(comp);
    comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function env(g: GainNode, t: number, peak: number, attack: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function noise(t: number, dur: number, o: { type?: BiquadFilterType; f?: number; f2?: number; q?: number; gain?: number; attack?: number } = {}) {
  const c = ctx!;
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = o.type ?? 'bandpass'; f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.f ?? 3000, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  const g = c.createGain(); env(g, t, o.gain ?? 0.3, o.attack ?? 0.004, dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
function tone(t: number, dur: number, o: { f?: number; f2?: number; glide?: number; type?: OscillatorType; gain?: number; attack?: number } = {}) {
  const c = ctx!;
  const osc = c.createOscillator(); osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f ?? 440, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide ?? dur));
  const g = c.createGain(); env(g, t, o.gain ?? 0.25, o.attack ?? 0.005, dur);
  osc.connect(g).connect(master!); osc.start(t); osc.stop(t + dur + 0.05);
}
/** a struck brass bell or fitting: inharmonic partials */
const metal = (t: number, base: number, dur: number, gain: number) =>
  [1, 2.76, 5.4, 8.93].forEach((p, i) => tone(t, dur * (1 - i * 0.2), { f: base * p, gain: gain / (i * 1.6 + 1), attack: 0.002 }));
/** dry parchment: a scatter of tiny filtered bursts */
const rustle = (t: number, dur: number, n: number, gain = 0.18) => {
  for (let i = 0; i < n; i++) noise(t + Math.random() * dur, 0.02 + Math.random() * 0.05, { f: 1800 + Math.random() * 3500, q: 0.7, gain: gain * (1 - i / (n + 2)) });
};

const SOUNDS: Record<Sfx, (t: number) => void> = {
  // a lacquered drawer slides on its runners and stops against brass
  open: (t) => { noise(t, 0.3, { type: 'lowpass', f: 500, f2: 950, gain: 0.26, attack: 0.07 }); rustle(t + 0.12, 0.2, 5, 0.1); tone(t + 0.28, 0.14, { f: 120, f2: 70, gain: 0.45 }); noise(t + 0.28, 0.02, { type: 'highpass', f: 2600, gain: 0.25 }); },
  close: (t) => { noise(t, 0.18, { type: 'lowpass', f: 750, f2: 420, gain: 0.24, attack: 0.03 }); tone(t + 0.16, 0.16, { f: 100, f2: 55, gain: 0.5 }); noise(t + 0.16, 0.03, { type: 'highpass', f: 2000, gain: 0.28 }); },
  // a brass switch, then the page beneath turns
  tab: (t) => { noise(t, 0.012, { type: 'highpass', f: 3000, gain: 0.32 }); metal(t + 0.004, 1900, 0.16, 0.1); noise(t + 0.03, 0.09, { f: 6000, f2: 2400, q: 1.2, gain: 0.14 }); },
  page: (t) => { noise(t, 0.1, { f: 6200, f2: 2300, q: 1.2, gain: 0.18 }); rustle(t + 0.03, 0.1, 3, 0.08); },
  select: (t) => { noise(t, 0.01, { type: 'highpass', f: 3500, gain: 0.2 }); tone(t, 0.06, { f: 2400, gain: 0.03, attack: 0.002 }); },
  // a ratchet winds, a bell rings
  build: (t) => { for (let i = 0; i < 6; i++) noise(t + i * 0.045, 0.012, { f: 3200, q: 3, gain: 0.3 }); metal(t + 0.3, 880, 1.2, 0.18); },
  train: (t) => { for (let i = 0; i < 3; i++) noise(t + i * 0.05, 0.012, { f: 2800, q: 3, gain: 0.26 }); metal(t + 0.16, 1320, 0.45, 0.12); },
  // coins chink into a strongbox
  coins: (t) => { for (let i = 0; i < 5; i++) metal(t + i * 0.035 + Math.random() * 0.02, 2600 + Math.random() * 1600, 0.12, 0.06); },
  // the ship's bell for the new season
  season: (t) => { metal(t, 660, 1.5, 0.2); metal(t + 0.34, 660, 1.4, 0.15); },
  toast: (t) => { rustle(t, 0.12, 4, 0.1); metal(t + 0.05, 1500, 0.3, 0.05); },
  error: (t) => { tone(t, 0.16, { f: 92, f2: 70, gain: 0.32 }); noise(t, 0.05, { type: 'lowpass', f: 600, gain: 0.18 }); },
};

let last = 0;
export function sfx(name: Sfx) {
  const c = audio();
  if (!c) return;
  // the same sound twice in a breath is one sound
  const now = c.currentTime;
  if (name === 'select' && now - last < 0.04) return;
  last = now;
  SOUNDS[name](now + 0.01);
}
