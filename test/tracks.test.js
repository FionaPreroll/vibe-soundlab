// Musical and technical checks for every track in tracks/.
// The tracks are run through the real Strudel pattern engine; nothing is played.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { buildIndex, serialize } from '../scripts/index-tracks.js';
import { ORBIT, bassClashes, busConflicts, dissonances, overLayerClashes, padVoicings } from './support/harmony.js';
import { toMidi } from './support/strudel.js';
import { analyseTrack, trackFiles, TRACK_DIR } from './support/tracks.js';

const banks = JSON.parse(readFileSync(new URL('./fixtures/sample-banks.json', import.meta.url), 'utf8'));
const SYNTHS = new Set(['sine', 'triangle', 'square', 'sawtooth', 'supersaw', 'pulse', 'white', 'pink', 'brown', 'crackle']);
const files = trackFiles();

test('there are several tracks', () => {
  assert.ok(files.length >= 4, `found ${files.length}`);
});

test('tracks/index.json matches the track headers (run `npm run tracks` to update)', () => {
  assert.equal(readFileSync(new URL('index.json', TRACK_DIR), 'utf8'), serialize(buildIndex()));
});

for (const file of files) {
  describe(file, () => {
    test('has a complete header', async () => {
      const { meta } = await analyseTrack(file);
      for (const field of ['title', 'style', 'bpm', 'key', 'bars', 'about']) assert.ok(meta[field], `missing @${field}`);
      assert.ok(meta.bpm >= 160 && meta.bpm <= 180, `drum & bass tempo, got ${meta.bpm}`);
    });

    test('sets the tempo from its header and loads the dirt samples', async () => {
      const { meta, cpm, samples } = await analyseTrack(file);
      assert.equal(cpm * 4, meta.bpm);
      assert.ok(samples.includes('github:tidalcycles/dirt-samples'));
    });

    test('plays something in every bar', async () => {
      const { meta, haps } = await analyseTrack(file);
      const busy = new Set();
      for (const h of haps) {
        if (h.value.gain === 0) continue;
        for (let b = Math.floor(h.part.begin.valueOf()); b < h.part.end.valueOf(); b++) busy.add(b);
      }
      const silent = [];
      for (let b = 0; b < meta.bars; b++) if (!busy.has(b)) silent.push(b + 1);
      assert.deepEqual(silent, []);
    });

    test('uses only sounds that exist, with sample numbers in range', async () => {
      const { haps } = await analyseTrack(file);
      const problems = new Set();
      for (const { value: v } of haps) {
        assert.ok(v.s, `event without a sound: ${JSON.stringify(v)}`);
        if (SYNTHS.has(v.s)) continue;
        const name = v.bank ? `${v.bank}_${v.s}` : v.s;
        const count = v.bank ? banks.machines[name] : banks.dirt[name];
        if (!count) problems.add(`unknown sound ${name}`);
        else if ((v.n ?? 0) >= count) problems.add(`${name}:${v.n} (only ${count})`);
      }
      assert.deepEqual([...problems], []);
    });

    test('keeps every value finite and every level sane', async () => {
      const { haps } = await analyseTrack(file);
      for (const { value: v } of haps) {
        for (const [key, val] of Object.entries(v)) if (typeof val === 'number') assert.ok(Number.isFinite(val), `${key}=${val}`);
        const level = (v.gain ?? 1) * (v.postgain ?? 1);
        assert.ok(level <= 1.2, `${v.s} at level ${level}`);
        if (v.note !== undefined) {
          const midi = toMidi(v.note);
          assert.ok(midi >= 23 && midi <= 100, `${v.s} note ${v.note}`);
        }
      }
    });

    test('stabs, keys and arps only play tones of the pad chord under them', async () => {
      const { haps } = await analyseTrack(file);
      const checked = haps.filter((h) => ORBIT.over.includes(h.value.orbit) && h.value.note !== undefined);
      assert.ok(checked.length > 0, 'no stab, key or arp events on orbits 5 and 6');
      assert.deepEqual(overLayerClashes(haps), []);
    });

    test('the bass fits the pad on every downbeat', async () => {
      const { haps } = await analyseTrack(file);
      assert.deepEqual(bassClashes(haps), []);
    });

    test('no minor seconds or minor ninths between harmony notes', async () => {
      const { haps } = await analyseTrack(file);
      assert.deepEqual(dissonances(haps), []);
    });

    test('pad chords are spread out in open position', async () => {
      const { haps } = await analyseTrack(file);
      const voicings = padVoicings(haps);
      assert.ok(voicings.length >= 3, 'expected several pad chords');
      for (const v of voicings) {
        assert.ok(v.at(-1) - v[0] >= 17, `pad chord ${v} spans only ${v.at(-1) - v[0]} semitones`);
        assert.ok(v[0] >= 43, `pad chord ${v} goes below G2 and muddies the bass`);
      }
    });

    test('the kick ducks the pad', async () => {
      const { haps } = await analyseTrack(file);
      const ducking = haps.filter((h) => String(h.value.duckorbit ?? '').split(':').map(Number).includes(ORBIT.pad));
      assert.ok(ducking.length > 0);
      assert.ok(ducking.every((h) => (h.value.orbit ?? 1) !== ORBIT.pad), 'the pad must not duck itself');
    });

    test('layers that share an orbit agree on its reverb and delay', async () => {
      const { haps } = await analyseTrack(file);
      assert.deepEqual(busConflicts(haps), []);
    });
  });
}
