import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REPEAT_LABELS, REPEAT_MODES, hasEnded, nextRepeatMode, parseRepeatMode, trackAfter } from '../src/playlist.js';

const ids = ['a', 'b', 'c'];

test('repeat cycles off → all → one → off', () => {
  assert.equal(nextRepeatMode('off'), 'all');
  assert.equal(nextRepeatMode('all'), 'one');
  assert.equal(nextRepeatMode('one'), 'off');
  assert.equal(nextRepeatMode('weird'), 'off');
  for (const mode of REPEAT_MODES) assert.ok(REPEAT_LABELS[mode]);
});

test('stored modes are checked', () => {
  assert.equal(parseRepeatMode('one'), 'one');
  assert.equal(parseRepeatMode(null), 'off');
  assert.equal(parseRepeatMode('loud'), 'off');
});

test('off plays through and stops after the last track', () => {
  assert.equal(trackAfter(ids, 'a', 'off'), 'b');
  assert.equal(trackAfter(ids, 'c', 'off'), null);
});

test('all wraps around', () => {
  assert.equal(trackAfter(ids, 'b', 'all'), 'c');
  assert.equal(trackAfter(ids, 'c', 'all'), 'a');
});

test('one repeats the track', () => {
  assert.equal(trackAfter(ids, 'b', 'one'), 'b');
});

test('a removed or unknown track continues from the top', () => {
  assert.equal(trackAfter(ids, 'gone', 'one'), 'a');
  assert.equal(trackAfter(ids, 'gone', 'off'), 'a');
  assert.equal(trackAfter([], 'a', 'all'), null);
});

test('a track ends at its last bar, unknown lengths never end', () => {
  assert.equal(hasEnded(119.99, 120), false);
  assert.equal(hasEnded(120, 120), true);
  assert.equal(hasEnded(500, undefined), false);
  assert.equal(hasEnded(null, 120), false);
});
