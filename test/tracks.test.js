// Musical and technical checks for every track in tracks/.
// The tracks are run through the real Strudel pattern engine; nothing is played.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
// superdough is the audio engine inside @strudel/web, installed in the same pinned version
import { distortionAlgorithms } from 'superdough/helpers.mjs';
import { vowelFormant } from 'superdough/vowel.mjs';
import { buildIndex, serialize } from '../scripts/index-tracks.js';
import { parseHeader } from '../src/header.js';
import {
  ORBIT,
  bassClashes,
  busConflicts,
  dissonances,
  duckTargets,
  earlyDucks,
  overLayerClashes,
  padVoicings,
} from './support/harmony.js';
import { parseSections, sectionAt } from '../src/sections.js';
import { toMidi } from './support/strudel.js';
import {
  CHANNEL,
  arpChordAt,
  arpChords,
  channelOverlaps,
  channelsUsed,
  echoEffects,
  heldNoteClashes,
  outOfKey,
  thinArps,
  uncutSamples,
} from './support/tracker.js';
import { analyseTrack, trackFiles, TRACK_DIR } from './support/tracks.js';

const banks = JSON.parse(readFileSync(new URL('./fixtures/sample-banks.json', import.meta.url), 'utf8'));
const SYNTHS = new Set(['sine', 'triangle', 'square', 'sawtooth', 'supersaw', 'pulse', 'white', 'pink', 'brown', 'crackle']);
// Breaks that fit() may stretch onto one bar. breaks165 is one bar long (1.42 s at
// 165 BPM); breaks157 is 1.19 bars and stumbles when squeezed into one.
const ONE_BAR_BREAKS = new Set(['breaks165']);
const DISTORT_TYPES = new Set(Object.keys(distortionAlgorithms));
const VOWELS = new Set(Object.keys(vowelFormant));
const files = trackFiles();

test('the distortion and vowel lists come from the audio engine', () => {
  for (const name of ['scurve', 'diode', 'fold']) assert.ok(DISTORT_TYPES.has(name), name);
  for (const name of ['a', 'e', 'i', 'o', 'u']) assert.ok(VOWELS.has(name), name);
});

test('tracks/index.json matches the track headers (run `pnpm run tracks` to update)', () => {
  assert.equal(readFileSync(new URL('index.json', TRACK_DIR), 'utf8'), serialize(buildIndex()));
});

// Chiptunes say how many tracker channels they use (@channels) and follow the
// tracker rules below; every other track is drum & bass and follows the pad rules.
const isChiptune = (file) => parseHeader(readFileSync(new URL(file, TRACK_DIR), 'utf8')).channels !== undefined;

test('there are drum & bass tracks and chiptunes', () => {
  assert.ok(files.filter(isChiptune).length >= 3);
  assert.ok(files.filter((file) => !isChiptune(file)).length >= 10);
});

for (const file of files) {
  const chiptune = isChiptune(file);
  describe(file, () => {
    test('has a complete header', async () => {
      const { meta } = await analyseTrack(file);
      for (const field of ['title', 'style', 'bpm', 'key', 'bars', 'about']) assert.ok(meta[field], `missing @${field}`);
      if (chiptune) {
        const channels = Number(meta.channels);
        assert.ok(Number.isInteger(channels) && channels >= 1 && channels <= 8, `@channels ${meta.channels}`);
        assert.ok(meta.bpm >= 110 && meta.bpm <= 180, `tracker tempo, got ${meta.bpm}`);
      } else {
        assert.ok(meta.bpm >= 160 && meta.bpm <= 180, `drum & bass tempo, got ${meta.bpm}`);
      }
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

    test('uses only distortion types and vowels the audio engine knows', async () => {
      const { haps } = await analyseTrack(file);
      const problems = new Set();
      for (const { value: v } of haps) {
        if (v.distorttype !== undefined && !DISTORT_TYPES.has(v.distorttype)) problems.add(`distorttype ${v.distorttype}`);
        if (v.vowel !== undefined && !VOWELS.has(v.vowel)) problems.add(`vowel ${v.vowel}`);
      }
      assert.deepEqual([...problems], []);
    });

    test('stretches only one-bar breaks onto a bar', async () => {
      const { haps } = await analyseTrack(file);
      const stretched = haps.filter((h) => h.value.unit === 'c' && String(h.value.s).startsWith('breaks'));
      assert.deepEqual([...new Set(stretched.map((h) => h.value.s))].filter((name) => !ONE_BAR_BREAKS.has(name)), []);
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

    test('only ducks orbits that already play', async () => {
      const { haps } = await analyseTrack(file);
      assert.deepEqual(earlyDucks(haps), []);
    });

    test('has Hydra visuals that peak in the drops or choruses', async () => {
      const { code, meta, visuals } = await analyseTrack(file);
      assert.equal(visuals.inits, 1, 'calls initHydra() once');
      assert.ok(visuals.outputs.length > 0, 'sends a picture to an output with .out()');
      assert.ok(visuals.patterns.length > 0, 'reads the music with H()');
      const sections = parseSections(code);
      const valueAt = (pattern, t) => Number(pattern.queryArc(t, t)[0]?.value ?? 0);
      const times = Array.from({ length: meta.bars * 4 }, (_, i) => i / 4 + 1 / 8);
      for (const pattern of visuals.patterns) {
        for (const t of times) {
          const value = valueAt(pattern, t);
          assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `H() gives ${value} at bar ${t}`);
        }
      }
      // the loudest parts: drops in drum & bass, choruses in the chiptunes
      const atPeak = (t) => /^(drop|chorus)/.test(sectionAt(sections, t)?.name ?? '');
      assert.ok(times.some(atPeak), 'the arrangement has drops or choruses');
      assert.ok(
        visuals.patterns.some((p) => times.every((t) => (valueAt(p, t) === 1) === atPeak(t))),
        'one H() pattern is 1 in the drops or choruses and lower everywhere else',
      );
    });

    test('layers that share an orbit agree on its reverb and delay', async () => {
      const { haps } = await analyseTrack(file);
      assert.deepEqual(busConflicts(haps), []);
    });

    if (!chiptune) {
      // drum & bass: the pad carries the chords
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
        const ducking = haps.filter((h) => duckTargets(h.value.duckorbit).includes(ORBIT.pad));
        assert.ok(ducking.length > 0);
        assert.ok(ducking.every((h) => (h.value.orbit ?? 1) !== ORBIT.pad), 'the pad must not duck itself');
      });
    } else {
      // chiptunes: one sound per channel, the arpeggio carries the chords
      test('stays within its @channels tracker channels', async () => {
        const { meta, haps } = await analyseTrack(file);
        const used = channelsUsed(haps);
        assert.ok(used.length <= Number(meta.channels), `uses orbits ${used.join(', ')}`);
      });

      test('every channel plays one sound at a time', async () => {
        const { haps } = await analyseTrack(file);
        assert.deepEqual(channelOverlaps(haps).slice(0, 10), []);
      });

      test('the next sound on a channel cuts a sample off (cut group = orbit)', async () => {
        const { haps } = await analyseTrack(file);
        assert.deepEqual(uncutSamples(haps, (s) => SYNTHS.has(s)), []);
      });

      test('echoes play on a channel of their own instead of a delay effect', async () => {
        const { haps } = await analyseTrack(file);
        assert.deepEqual(echoEffects(haps), []);
      });

      test('every channel is a single oscillator, no supersaw', async () => {
        const { haps } = await analyseTrack(file);
        assert.deepEqual([...new Set(haps.filter((h) => h.value.s === 'supersaw').map((h) => h.value.orbit))], []);
      });

      test('the arpeggio channel spells the chords', async () => {
        const { haps } = await analyseTrack(file);
        const chords = arpChords(haps);
        assert.ok(chords.size > 0, `no arpeggio on orbit ${CHANNEL.arp}`);
        assert.deepEqual(thinArps(chords), []);
      });

      test('the bass fits the arpeggio chord on every downbeat', async () => {
        const { haps } = await analyseTrack(file);
        const chords = arpChords(haps);
        assert.deepEqual(bassClashes(haps, (t) => arpChordAt(chords, t)), []);
      });

      test('held melody notes are chord tones and never rub a semitone against the arpeggio', async () => {
        const { haps } = await analyseTrack(file);
        assert.deepEqual(heldNoteClashes(haps).slice(0, 10), []);
      });

      test('bass, arpeggio and melody stay in the key from the header', async () => {
        const { meta, haps } = await analyseTrack(file);
        assert.deepEqual(outOfKey(haps, meta.key).slice(0, 10), []);
      });
    }
  });
}
