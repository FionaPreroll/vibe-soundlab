import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_FREQ, MIN_FREQ, bandResponseDb, eqResponseDb, freqToX, xToFreq } from '../src/eq.js';
import { EQ_BANDS } from '../src/mixer.js';

const near = (actual, expected, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`);

test('band responses match what Chromium’s BiquadFilterNode reports', () => {
  // Measured with getFrequencyResponse() at 48 kHz, Q 1.1.
  const reference = [
    [{ type: 'lowshelf', freq: 40 }, 6, [[20, 5.624], [40, 3], [200, 0.01]]],
    [{ type: 'peaking', freq: 1500 }, -9, [[750, -2.54], [1500, -9], [3000, -2.499]]],
    [{ type: 'highshelf', freq: 14000 }, 12, [[2000, 0.002], [14000, 6], [19000, 11.425]]],
  ];
  for (const [band, gain, points] of reference) {
    for (const [freq, db] of points) near(bandResponseDb(band, gain, freq), db);
  }
});

test('a flat band changes nothing', () => {
  assert.equal(bandResponseDb(EQ_BANDS[3], 0, 600), 0);
  assert.equal(eqResponseDb([0, 0, 0, 0, 0, 0, 0, 0], 1000), 0);
});

test('the whole EQ adds up its bands', () => {
  const gains = [0, 0, 0, 0, 6, 0, 0, 0];
  near(eqResponseDb(gains, 1500), 6);
  near(eqResponseDb([3, 0, 0, 0, 0, 0, 0, 3], 1000), bandResponseDb(EQ_BANDS[0], 3, 1000) + bandResponseDb(EQ_BANDS[7], 3, 1000));
  near(eqResponseDb([4], 30), bandResponseDb(EQ_BANDS[0], 4, 30), 1e-9);
});

test('the frequency axis is logarithmic from 20 Hz to 20 kHz', () => {
  assert.equal(freqToX(MIN_FREQ), 0);
  assert.equal(freqToX(MAX_FREQ), 1);
  near(freqToX(632.46), 0.5);
  near(xToFreq(freqToX(1234)), 1234, 1e-6);
});
