import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CEIL_DB, FLOOR_DB, createMeter, drawChannel, drawEq, eqCurve, meterHeight, peakDb, spectrumBands, spectrumHeight } from '../src/meters.js';
import { fakeCanvasContext } from './support/fake-audio.js';

test('spectrum heights tilt by 3 dB per octave around 1 kHz', () => {
  assert.equal(spectrumHeight(FLOOR_DB, 1000), 0);
  assert.equal(spectrumHeight(CEIL_DB, 1000), 1);
  assert.equal(spectrumHeight(-200, 1000), 0);
  const mid = (FLOOR_DB + CEIL_DB) / 2;
  assert.ok(Math.abs(spectrumHeight(mid - 3, 2000) - 0.5) < 1e-9, 'an octave up gets 3 dB more');
  assert.ok(Math.abs(spectrumHeight(mid + 3, 500) - 0.5) < 1e-9);
  assert.ok(spectrumHeight(mid, 0) < 0.5 && spectrumHeight(mid, 0) > 0, 'the DC bin counts as 1 Hz instead of blowing up');
});

test('FFT bins are grouped into log-spaced bands', () => {
  const data = new Float32Array(1024).fill(-200);
  data[4] = CEIL_DB; // 4 × 23.4 Hz ≈ 105 Hz
  const bands = spectrumBands(data, 48000, 12);
  assert.equal(bands.length, 12);
  const loud = bands.flatMap((b, i) => (b > 0 ? [i] : []));
  assert.ok(loud.length >= 1 && loud.length <= 2, 'low bins are narrower than a band, so one bin can light two');
  assert.ok(loud.every((i) => i >= 2 && i <= 4 && bands[i] > 0.8), `the loud bin shows up in the bass bands (${loud})`);
  assert.deepEqual(spectrumBands(new Float32Array(1024).fill(-200), 48000, 4), [0, 0, 0, 0]);
});

test('peak level and meter height', () => {
  assert.equal(peakDb([0, 0]), -Infinity);
  assert.ok(Math.abs(peakDb([0.1, -0.5, 0.2]) - -6.02) < 0.01);
  assert.equal(meterHeight(-Infinity), 0);
  assert.equal(meterHeight(-30), 0.5);
  assert.equal(meterHeight(3), 1);
});

test('the meter falls back slowly and holds its peak', () => {
  const meter = createMeter({ fallDbPerSecond: 30, holdMs: 1000 });
  assert.deepEqual(meter.update(-6, 0), { level: -6, peak: -6 });
  assert.deepEqual(meter.update(-40, 100), { level: -9, peak: -6 }, '3 dB down after 100 ms');
  assert.deepEqual(meter.update(-40, 600), { level: -24, peak: -6 }, 'the peak stays');
  assert.deepEqual(meter.update(-40, 1200), { level: -40, peak: -40 }, 'until the hold time is over');
  assert.equal(meter.update(-3, 1300).peak, -3);
});

test('the EQ curve sits in the middle when flat and rises with a boost', () => {
  const flat = eqCurve([0, 0, 0, 0, 0, 0, 0, 0], { steps: 10 });
  assert.equal(flat.length, 11);
  assert.ok(flat.every((p) => p.y === 0.5));
  const boosted = eqCurve([0, 0, 0, 0, 12, 0, 0, 0], { steps: 100, rangeDb: 12 });
  const top = Math.min(...boosted.map((p) => p.y));
  assert.ok(top < 0.01, 'a 12 dB bell reaches the top of a ±12 dB view');
  const clipped = eqCurve([12, 12, 12, 12, 12, 12, 12, 12], { steps: 4, rangeDb: 6 });
  assert.ok(clipped.every((p) => p.y >= 0));
});

test('a channel draws its spectrum bars and a meter', () => {
  const g = fakeCanvasContext();
  drawChannel(g, { width: 56, height: 72, bands: [0, 0.5, 1, 0], level: -12, peak: -0.5, color: '#f00', muted: false });
  assert.equal(g.count('clearRect'), 1);
  // two bars, the meter background, the level and the peak line
  assert.equal(g.count('fillRect'), 5);
  assert.equal(g.fillStyle, '#ff6b6b', 'a peak near 0 dBFS shows red');
  assert.equal(g.globalAlpha, 1);

  const quiet = fakeCanvasContext();
  drawChannel(quiet, { width: 56, height: 72, bands: [0, 0], level: -Infinity, peak: -Infinity, color: '#0f0', muted: true });
  assert.equal(quiet.count('fillRect'), 2, 'only the meter background and an empty level');
  const hot = fakeCanvasContext();
  drawChannel(hot, { width: 56, height: 72, bands: [0], level: -0.5, peak: -20, color: '#0f0', muted: false });
  assert.equal(hot.calls.filter((c) => c[0] === 'fillRect').length, 3);
});

test('the EQ view draws a grid, the spectrum when there is one, and the curve', () => {
  const colors = { grid: '#333', spectrum: '#0f05', curve: '#0f0' };
  const g = fakeCanvasContext();
  drawEq(g, { width: 200, height: 100, data: null, sampleRate: 48000, gains: [0, 0, 0, 0, 0, 0, 0, 0], colors });
  assert.equal(g.count('stroke'), 2, 'grid and curve');
  assert.equal(g.count('fill'), 0);
  const withSpectrum = fakeCanvasContext();
  drawEq(withSpectrum, { width: 200, height: 100, data: new Float32Array(1024).fill(-50), sampleRate: 48000, gains: [3, 0, 0, 0, 0, 0, 0, 0], colors });
  assert.equal(withSpectrum.count('fill'), 1);
  assert.equal(withSpectrum.strokeStyle, '#0f0');
});
