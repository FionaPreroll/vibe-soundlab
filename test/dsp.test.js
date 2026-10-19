import test from 'node:test';
import assert from 'node:assert/strict';
import { wavetableHarmonics, shaperCurve, fft, averageSpectrum, bandLevels, compareBands, BANDS } from '../js/dsp.js';
import { CONTROLS, START, TARGET, STEPS, stepTips, unlockedControls } from '../js/lesson.js';

test('wavetable endpoints are sine and pulse', () => {
  const sine = wavetableHarmonics(0, 16);
  assert.equal(sine[1], 1);
  assert.equal(sine[2], 0);
  const saw = wavetableHarmonics(0.5, 16);
  assert.ok(Math.abs(saw[3] - 1 / 3) < 1e-6);
});

test('shaper curves stay within -1..1 and are odd-ish at zero', () => {
  for (const t of ['soft', 'hard', 'fold', 'asym']) {
    const c = shaperCurve(t, 1025);
    assert.ok(c.every((v) => v >= -1.0001 && v <= 1.0001), t);
    assert.ok(Math.abs(c[512]) < 1e-6, t);
  }
});

test('fft finds a sine at the right bin', () => {
  const n = 1024;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 37 * i) / n);
  fft(re, im);
  let best = 0;
  for (let k = 1; k < n / 2; k++) if (Math.hypot(re[k], im[k]) > Math.hypot(re[best], im[best])) best = k;
  assert.equal(best, 37);
});

test('band comparison ignores overall volume', () => {
  const sr = 48000;
  const sig = new Float32Array(sr);
  for (let i = 0; i < sr; i++) sig[i] = [50, 200, 700, 3000, 9000].reduce((s, f, j) => s + Math.sin((2 * Math.PI * f * i) / sr) / (j + 1), 0);
  const loud = sig.map((v) => v * 4);
  const a = bandLevels(averageSpectrum(sig), sr);
  const b = bandLevels(averageSpectrum(loud), sr);
  const d = compareBands(a, b);
  for (const band of BANDS) assert.ok(Math.abs(d[band.id]) < 0.01, band.id);
});

test('every control has start and target values in range', () => {
  for (const c of CONTROLS) {
    assert.ok(c.id in START && c.id in TARGET, c.id);
    if (c.type !== 'select') {
      for (const v of [START[c.id], TARGET[c.id]]) assert.ok(v >= c.min && v <= c.max, `${c.id}=${v}`);
    }
  }
});

test('the target patch passes every step check, the start patch does not', () => {
  for (const s of STEPS) assert.deepEqual(stepTips(s, TARGET), [], s.title);
  for (const s of STEPS.filter((s) => !s.final)) assert.ok(stepTips(s, START).length > 0, s.title);
});

test('steps unlock controls cumulatively and the last step unlocks all', () => {
  assert.equal(unlockedControls(0).size, STEPS[0].controls.length);
  assert.equal(unlockedControls(STEPS.length - 1).size, CONTROLS.length);
});
