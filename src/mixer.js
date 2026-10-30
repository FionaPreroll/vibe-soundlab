// The mixer's settings: one strip per orbit plus the master, each with a fader
// and an 8-band EQ. Pure data and math, so the rules can be tested without audio.

// Orbits as the tracks use them (see "Conventions" in the README).
export const CHANNELS = [
  { orbit: 1, name: 'Drums' },
  { orbit: 2, name: 'Bass' },
  { orbit: 3, name: 'Pad' },
  { orbit: 4, name: 'Snare' },
  { orbit: 5, name: 'Stabs' },
  { orbit: 6, name: 'Leads' },
  { orbit: 7, name: 'FX' },
  { orbit: 8, name: 'Orbit 8' },
];

// Shelves at both ends, bells in between, spaced for drum & bass:
// sub, bass, mud, body, bite, presence, sizzle, air.
export const EQ_BANDS = [
  { freq: 40, type: 'lowshelf', label: '40' },
  { freq: 100, type: 'peaking', label: '100' },
  { freq: 250, type: 'peaking', label: '250' },
  { freq: 600, type: 'peaking', label: '600' },
  { freq: 1500, type: 'peaking', label: '1.5k' },
  { freq: 3500, type: 'peaking', label: '3.5k' },
  { freq: 8000, type: 'peaking', label: '8k' },
  { freq: 14000, type: 'highshelf', label: '14k' },
];
export const EQ_Q = 1.1;
export const EQ_RANGE_DB = 12;

// Faders run from silent (FADER_MIN_DB counts as off) to +6 dB.
export const FADER_MIN_DB = -40;
export const FADER_MAX_DB = 6;

export const STORAGE_KEY = 'vibe-player:mix';

const flatEq = () => EQ_BANDS.map(() => 0);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

export function defaultMix() {
  return {
    channels: Object.fromEntries(CHANNELS.map(({ orbit }) => [orbit, { gain: 0, mute: false, solo: false, eq: flatEq() }])),
    master: { gain: 0, eq: flatEq() },
  };
}

const readEq = (eq) => EQ_BANDS.map((_, i) => clamp(number(eq?.[i], 0), -EQ_RANGE_DB, EQ_RANGE_DB));
const readGain = (gain) => clamp(number(gain, 0), FADER_MIN_DB, FADER_MAX_DB);

/** Reads stored settings, keeping what is valid and defaulting the rest. */
export function parseMix(text) {
  const mix = defaultMix();
  let saved;
  try {
    saved = JSON.parse(text);
  } catch {
    return mix;
  }
  if (!saved || typeof saved !== 'object') return mix;
  for (const { orbit } of CHANNELS) {
    const ch = saved.channels?.[orbit];
    if (!ch || typeof ch !== 'object') continue;
    mix.channels[orbit] = { gain: readGain(ch.gain), mute: ch.mute === true, solo: ch.solo === true, eq: readEq(ch.eq) };
  }
  if (saved.master && typeof saved.master === 'object') mix.master = { gain: readGain(saved.master.gain), eq: readEq(saved.master.eq) };
  return mix;
}

/** dB → linear gain; the bottom of the fader is silence. */
export function dbToGain(db) {
  return db <= FADER_MIN_DB ? 0 : 10 ** (db / 20);
}

/** "+3.5", "0.0", "−12.0" or "off" for a fader at the bottom. */
export function formatDb(db) {
  if (db <= FADER_MIN_DB) return 'off';
  if (Math.abs(db) < 0.05) return '0.0';
  return `${db > 0 ? '+' : '−'}${Math.abs(db).toFixed(1)}`;
}

/** Whether a channel is heard: muted channels never are; with any solo on, only soloed ones are. */
export function isAudible(mix, orbit) {
  const ch = mix.channels[orbit];
  if (ch.mute) return false;
  const soloing = CHANNELS.some((c) => mix.channels[c.orbit].solo);
  return !soloing || ch.solo;
}

/** The linear gain a channel's fader should have, after mute and solo. */
export function channelGain(mix, orbit) {
  return isAudible(mix, orbit) ? dbToGain(mix.channels[orbit].gain) : 0;
}

/** True when nothing differs from the defaults (used to show the reset buttons). */
export function isDefaultMix(mix) {
  return JSON.stringify(mix) === JSON.stringify(defaultMix());
}
