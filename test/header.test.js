import assert from 'node:assert/strict';
import { test } from 'node:test';
import { durationSeconds, formatDuration, parseHeader, titleFromFileName } from '../src/header.js';

test('reads the @ fields at the top of a file', () => {
  const meta = parseHeader('// @title Nachtschicht\n// @bpm 174\n//   @key   F minor  \n// @bars 120\n// ===\nnote("c")\n// @title Ignored');
  assert.deepEqual(meta, { title: 'Nachtschicht', bpm: 174, key: 'F minor', bars: 120 });
});

test('skips leading blank lines and plain comments', () => {
  assert.deepEqual(parseHeader('\n\n// a comment\n// @style Liquid\n'), { style: 'Liquid' });
});

test('drops numbers that are not positive', () => {
  assert.deepEqual(parseHeader('// @bpm fast\n// @bars -4\n// @order 2'), { order: 2 });
});

test('returns nothing for code without a header', () => {
  assert.deepEqual(parseHeader('s("bd sd")'), {});
  assert.deepEqual(parseHeader(''), {});
});

test('duration follows from bars and tempo', () => {
  assert.equal(durationSeconds({ bpm: 174, bars: 120 }), (120 * 240) / 174);
  assert.equal(durationSeconds({ bpm: 174 }), null);
  assert.equal(durationSeconds(), null);
});

test('formats durations as minutes and seconds', () => {
  assert.equal(formatDuration(165.5), '2:46');
  assert.equal(formatDuration(59.4), '0:59');
  assert.equal(formatDuration(null), '');
  assert.equal(formatDuration(Infinity), '');
});

test('makes titles from file names', () => {
  assert.equal(titleFromFileName('deep-roller_v2.js'), 'Deep roller v2');
  assert.equal(titleFromFileName('.js'), 'Untitled');
});
