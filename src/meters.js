// Turns analyser data into what the mixer draws: spectrum bars per channel,
// a level meter with peak hold, and the EQ curve. The math is pure; the draw
// functions only need a 2D canvas context.
import { MAX_FREQ, MIN_FREQ, eqResponseDb, freqToX, xToFreq } from './eq.js';

export const FLOOR_DB = -95;
export const CEIL_DB = -15;
// Music has far more energy down low than up high. Like most mixing analysers,
// the display adds 3 dB per octave above 1 kHz (and takes it off below), so a
// balanced mix looks roughly level.
export const TILT_DB_PER_OCTAVE = 3;

/** 0..1 display height of an FFT value in dB at a frequency. */
export const spectrumHeight = (db, freq) =>
  Math.min(1, Math.max(0, (db + TILT_DB_PER_OCTAVE * Math.log2(Math.max(freq, 1) / 1000) - FLOOR_DB) / (CEIL_DB - FLOOR_DB)));

/**
 * Groups FFT bins (dB values from getFloatFrequencyData) into `count` bands on a
 * log frequency axis and returns their heights from 0 (silent) to 1 (loud).
 */
export function spectrumBands(data, sampleRate, count = 24) {
  const binHz = sampleRate / 2 / data.length;
  const bands = [];
  for (let i = 0; i < count; i++) {
    const lo = xToFreq(i / count);
    const hi = xToFreq((i + 1) / count);
    let first = Math.floor(lo / binHz);
    let last = Math.min(data.length - 1, Math.max(first, Math.ceil(hi / binHz) - 1));
    first = Math.min(first, last);
    let peak = 0;
    for (let b = first; b <= last; b++) peak = Math.max(peak, spectrumHeight(data[b], (b + 0.5) * binHz));
    bands.push(peak);
  }
  return bands;
}

/** Peak level of a block of samples in dBFS (−Infinity for silence). */
export function peakDb(samples) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  return peak === 0 ? -Infinity : 20 * Math.log10(peak);
}

/** 0..1 height of a level on a meter from −60 dBFS to 0 dBFS. */
export const meterHeight = (db) => Math.min(1, Math.max(0, (db + 60) / 60));

/**
 * A level meter that falls back slowly and holds its peak for a moment, like a
 * hardware meter. `update` takes the level of the newest block and the time in ms.
 */
export function createMeter({ fallDbPerSecond = 30, holdMs = 1200 } = {}) {
  let level = -Infinity;
  let peak = -Infinity;
  let peakAt = 0;
  let last = null;
  return {
    update(db, now) {
      const dt = last === null ? 0 : (now - last) / 1000;
      last = now;
      level = Math.max(db, level - fallDbPerSecond * dt);
      if (db >= peak || now - peakAt > holdMs) {
        peak = db;
        peakAt = now;
      }
      return { level, peak };
    },
  };
}

/** Points (x, y in 0..1, y = 0.5 at 0 dB) of the EQ curve across the width. */
export function eqCurve(gains, { steps = 120, rangeDb = 15, sampleRate = 48000 } = {}) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    const db = eqResponseDb(gains, xToFreq(x), sampleRate);
    points.push({ x, y: 0.5 - Math.max(-1, Math.min(1, db / rangeDb)) / 2 });
  }
  return points;
}

/** Spectrum bars plus a level meter on the right edge of a channel's canvas. */
export function drawChannel(g, { width, height, bands, level, peak, color, muted }) {
  g.clearRect(0, 0, width, height);
  const meterWidth = Math.max(3, Math.round(width * 0.12));
  const barsWidth = width - meterWidth - 2;
  const step = barsWidth / bands.length;
  g.globalAlpha = muted ? 0.35 : 1;
  g.fillStyle = color;
  bands.forEach((h, i) => {
    const barHeight = Math.round(h * height);
    if (barHeight > 0) g.fillRect(Math.round(i * step), height - barHeight, Math.max(1, Math.ceil(step) - 1), barHeight);
  });
  const x = width - meterWidth;
  g.globalAlpha = 0.25;
  g.fillRect(x, 0, meterWidth, height);
  g.globalAlpha = muted ? 0.35 : 1;
  const levelHeight = Math.round(meterHeight(level) * height);
  g.fillStyle = level > -1 ? '#ff6b6b' : color;
  g.fillRect(x, height - levelHeight, meterWidth, levelHeight);
  if (peak > -60) {
    g.fillStyle = peak > -1 ? '#ff6b6b' : color;
    g.fillRect(x, Math.round((1 - meterHeight(peak)) * height), meterWidth, 2);
  }
  g.globalAlpha = 1;
}

const GRID_FREQS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

/** The EQ view: frequency grid, the spectrum of what the EQ outputs, and its curve. */
export function drawEq(g, { width, height, data, sampleRate, gains, colors, rangeDb = 15 }) {
  g.clearRect(0, 0, width, height);
  g.lineWidth = 1;
  g.strokeStyle = colors.grid;
  g.beginPath();
  for (const f of GRID_FREQS) {
    const x = Math.round(freqToX(f) * width) + 0.5;
    g.moveTo(x, 0);
    g.lineTo(x, height);
  }
  for (const db of [-rangeDb / 1.25, 0, rangeDb / 1.25]) {
    const y = Math.round((0.5 - db / rangeDb / 2) * height) + 0.5;
    g.moveTo(0, y);
    g.lineTo(width, y);
  }
  g.stroke();
  if (data) {
    // Spectrum as a filled area, one point per pixel column.
    const binHz = sampleRate / 2 / data.length;
    g.fillStyle = colors.spectrum;
    g.beginPath();
    g.moveTo(0, height);
    for (let px = 0; px <= width; px += 2) {
      const freq = Math.min(MAX_FREQ, Math.max(MIN_FREQ, xToFreq(px / width)));
      const db = data[Math.min(data.length - 1, Math.round(freq / binHz))];
      g.lineTo(px, height - spectrumHeight(db, freq) * height);
    }
    g.lineTo(width, height);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = colors.curve;
  g.lineWidth = 2;
  g.beginPath();
  eqCurve(gains, { rangeDb, sampleRate }).forEach(({ x, y }, i) => (i === 0 ? g.moveTo(x * width, y * height) : g.lineTo(x * width, y * height)));
  g.stroke();
}
