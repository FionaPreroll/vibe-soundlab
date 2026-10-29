// The checks in tracks.test.js must catch what was audibly wrong in the first
// version of Nachtschicht: the pad and stab clashed, and the pad sounded flat.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bassClashes, busConflicts, dissonances, padVoicings } from './support/harmony.js';
import { analyse } from './support/tracks.js';

const v1 = () => analyse(new URL('./fixtures/nachtschicht-v1.js', import.meta.url));

test('v1: F in the bass under Gbmaj7 is caught', async () => {
  const problems = bassClashes((await v1()).haps);
  assert.ok(problems.some((p) => p.includes('bass f1 has gb a semitone above it')), problems.join('\n'));
});

test('v1: the diminished stab rubbing against the pad is caught', async () => {
  const problems = dissonances((await v1()).haps);
  assert.ok(problems.some((p) => p.includes('b under c')), problems.join('\n'));
  assert.ok(problems.some((p) => p.includes('bb under b')), problems.join('\n'));
});

test('v1: the narrow pad voicing is caught', async () => {
  const narrow = padVoicings((await v1()).haps).filter((v) => v.at(-1) - v[0] < 17);
  assert.ok(narrow.length >= 4);
});

test('v1: stab and arp fighting over one delay is caught', async () => {
  assert.deepEqual(busConflicts((await v1()).haps), ['orbit 3 delayfeedback: 0.5 vs 0.45']);
});

test('v2 keeps the v1 drums and bass sound design', async () => {
  const { readFileSync } = await import('node:fs');
  const v2 = readFileSync(new URL('../tracks/nachtschicht.js', import.meta.url), 'utf8');
  for (const line of ['.s("supersaw").unison(3).detune(.42).spread(.35)', '.ftype("ladder")', 'const kick = s("<[bd@10 bd@6]!3 [bd@10 bd@3 bd@3]>")']) {
    assert.ok(v2.includes(line), line);
  }
});
