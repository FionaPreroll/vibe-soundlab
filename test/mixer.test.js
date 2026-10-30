import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHANNELS,
  EQ_BANDS,
  FADER_MIN_DB,
  channelGain,
  dbToGain,
  defaultMix,
  formatDb,
  isAudible,
  isDefaultMix,
  parseMix,
} from '../src/mixer.js';

test('one channel per orbit the tracks use, and eight EQ bands', () => {
  assert.deepEqual(
    CHANNELS.map((c) => c.orbit),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(EQ_BANDS.length, 8);
  assert.equal(EQ_BANDS[0].type, 'lowshelf');
  assert.equal(EQ_BANDS.at(-1).type, 'highshelf');
  const mix = defaultMix();
  assert.deepEqual(mix.channels[3], { gain: 0, mute: false, solo: false, eq: [0, 0, 0, 0, 0, 0, 0, 0] });
  assert.deepEqual(mix.master, { gain: 0, eq: [0, 0, 0, 0, 0, 0, 0, 0] });
  assert.ok(isDefaultMix(mix));
});

test('stored settings are checked and clamped', () => {
  const mix = parseMix(
    JSON.stringify({
      channels: { 2: { gain: 99, mute: true, solo: 'yes', eq: [3, -40, 'x', null] }, 5: 'nope' },
      master: { gain: -3, eq: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    }),
  );
  assert.deepEqual(mix.channels[2], { gain: 6, mute: true, solo: false, eq: [3, -12, 0, 0, 0, 0, 0, 0] });
  assert.deepEqual(mix.channels[5], defaultMix().channels[5]);
  assert.deepEqual(mix.master, { gain: -3, eq: [1, 2, 3, 4, 5, 6, 7, 8] });
  assert.ok(!isDefaultMix(mix));
  assert.deepEqual(parseMix('{not json'), defaultMix());
  assert.deepEqual(parseMix('null'), defaultMix());
  assert.deepEqual(parseMix('{"master": 4}'), defaultMix());
  assert.deepEqual(parseMix(JSON.stringify({ channels: { 1: { gain: -100 } } })).channels[1].gain, FADER_MIN_DB);
});

test('decibels', () => {
  assert.equal(dbToGain(0), 1);
  assert.ok(Math.abs(dbToGain(-6) - 0.501) < 0.001);
  assert.ok(Math.abs(dbToGain(6) - 1.995) < 0.001);
  assert.equal(dbToGain(FADER_MIN_DB), 0, 'the bottom of the fader is silence');
  assert.equal(formatDb(FADER_MIN_DB), 'off');
  assert.equal(formatDb(0.01), '0.0');
  assert.equal(formatDb(3.5), '+3.5');
  assert.equal(formatDb(-12), '−12.0');
});

test('mute and solo decide which channels are heard', () => {
  const mix = defaultMix();
  mix.channels[2].gain = -6;
  assert.ok(isAudible(mix, 1));
  assert.ok(Math.abs(channelGain(mix, 2) - 0.501) < 0.001);
  mix.channels[1].mute = true;
  assert.equal(channelGain(mix, 1), 0);
  mix.channels[3].solo = true;
  assert.equal(isAudible(mix, 2), false, 'with a solo on, the others go quiet');
  assert.equal(channelGain(mix, 3), 1);
  mix.channels[1].solo = true;
  assert.equal(isAudible(mix, 1), false, 'mute wins over solo');
});
