// Frequency response of the EQ, computed with the same filter formulas the
// Web Audio API uses for its BiquadFilterNode (the "Audio EQ Cookbook"), so the
// curve can be drawn before any audio has started.
import { EQ_BANDS, EQ_Q } from './mixer.js';

function coefficients(type, freq, gainDb, q, sampleRate) {
  const A = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * freq) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  if (type === 'peaking') {
    const alpha = sin / (2 * q);
    return { b: [1 + alpha * A, -2 * cos, 1 - alpha * A], a: [1 + alpha / A, -2 * cos, 1 - alpha / A] };
  }
  // Shelves: the Web Audio API fixes the shelf slope at 1.
  const alpha = sin / Math.SQRT2;
  const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
  if (type === 'lowshelf') {
    return {
      b: [A * (A + 1 - (A - 1) * cos + twoSqrtAAlpha), 2 * A * (A - 1 - (A + 1) * cos), A * (A + 1 - (A - 1) * cos - twoSqrtAAlpha)],
      a: [A + 1 + (A - 1) * cos + twoSqrtAAlpha, -2 * (A - 1 + (A + 1) * cos), A + 1 + (A - 1) * cos - twoSqrtAAlpha],
    };
  }
  return {
    b: [A * (A + 1 + (A - 1) * cos + twoSqrtAAlpha), -2 * A * (A - 1 + (A + 1) * cos), A * (A + 1 + (A - 1) * cos - twoSqrtAAlpha)],
    a: [A + 1 - (A - 1) * cos + twoSqrtAAlpha, 2 * (A - 1 - (A + 1) * cos), A + 1 - (A - 1) * cos - twoSqrtAAlpha],
  };
}

/** Gain in dB of one biquad band at `freq`. */
export function bandResponseDb({ type, freq: f0 }, gainDb, freq, sampleRate = 48000, q = EQ_Q) {
  if (gainDb === 0) return 0;
  const { b, a } = coefficients(type, f0, gainDb, q, sampleRate);
  const w = (2 * Math.PI * freq) / sampleRate;
  // |H(e^jw)| with z^-1 = e^-jw
  const re = (c) => c[0] + c[1] * Math.cos(w) + c[2] * Math.cos(2 * w);
  const im = (c) => -(c[1] * Math.sin(w) + c[2] * Math.sin(2 * w));
  const num = Math.hypot(re(b), im(b));
  const den = Math.hypot(re(a), im(a));
  return 20 * Math.log10(num / den);
}

/** Gain in dB of the whole EQ (all bands in series) at `freq`. */
export function eqResponseDb(gains, freq, sampleRate = 48000) {
  return EQ_BANDS.reduce((sum, band, i) => sum + bandResponseDb(band, gains[i] ?? 0, freq, sampleRate), 0);
}

// Log frequency axis shared by the EQ view and the channel visualizers.
export const MIN_FREQ = 20;
export const MAX_FREQ = 20000;

/** 0..1 position of a frequency on a log axis from 20 Hz to 20 kHz. */
export const freqToX = (freq) => Math.log(freq / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ);

/** Inverse of freqToX. */
export const xToFreq = (x) => MIN_FREQ * (MAX_FREQ / MIN_FREQ) ** x;
