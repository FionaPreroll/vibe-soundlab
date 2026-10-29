// The ducking checks in tracks.test.js, tried on small made-up patterns.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collect, duckTargets, earlyDucks } from './support/harmony.js';
import { loadTrack } from './support/strudel.js';

const haps = async (code, bars = 2) => collect((await loadTrack(code)).pattern, bars);

test('duck targets can be one orbit, an "a:b" string or a list', async () => {
  assert.deepEqual(duckTargets(3), [3]);
  assert.deepEqual(duckTargets('2:3'), [2, 3]);
  assert.deepEqual(duckTargets([2, 3]), [2, 3]);
  assert.deepEqual(duckTargets(undefined), []);
  const [kick] = await haps('s("bd").duckorbit("2:3")', 1);
  assert.deepEqual(duckTargets(kick.value.duckorbit), [2, 3]);
});

test('a kick that ducks the pad on the very first beat is caught', async () => {
  const problems = earlyDucks(await haps('stack(s("bd*2").duckorbit(3), note("c3").orbit(3))'));
  assert.deepEqual(problems, ['bar 1: ducks orbit 3 before anything plays on it']);
});

test('ducking an orbit that never plays is caught', async () => {
  const problems = earlyDucks(await haps('stack(s("bd ~").duckorbit("2:3"), note("c3").orbit(3))', 1));
  assert.deepEqual(problems, ['bar 1: ducks orbit 2 before anything plays on it', 'bar 1: ducks orbit 3 before anything plays on it']);
});

test('a kick that comes in after the pad passes', async () => {
  assert.deepEqual(earlyDucks(await haps('stack(s("bd*2").duckorbit(3).mask("<0 1>"), note("c3").orbit(3))')), []);
});
