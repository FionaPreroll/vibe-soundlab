// The chiptune checks in tracks.test.js, tried on small made-up patterns.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bassClashes, collect } from './support/harmony.js';
import { loadTrack } from './support/strudel.js';
import {
  arpChordAt,
  arpChords,
  channelOverlaps,
  channelsUsed,
  echoEffects,
  heldNoteClashes,
  outOfKey,
  scaleOf,
  thinArps,
  uncutSamples,
} from './support/tracker.js';

const haps = async (code, bars = 1) => collect((await loadTrack(code)).pattern, bars);
const isSynth = (s) => ['square', 'pulse', 'triangle', 'white'].includes(s);
const AM = 'note("[a4,c5,e5]").arp("[0 1 2]*4").s("square").orbit(3)';

test('channels are the orbits that play something audible', async () => {
  const events = await haps('stack(s("bd").orbit(1), note("c4").orbit(6), s("hh").orbit(4).gain(0))');
  assert.deepEqual(channelsUsed(events), [1, 6]);
});

test('notes after each other on one channel pass', async () => {
  assert.deepEqual(channelOverlaps(await haps('note("c4 e4 g4 ~").s("square").orbit(6)')), []);
});

test('two notes at once on one channel are caught', async () => {
  const problems = channelOverlaps(await haps('stack(note("c4 e4"), note("~ ~ g4 ~")).s("square").orbit(6)'));
  assert.deepEqual(problems, ['orbit 6, bar 1.50: g4 starts while e4 still plays']);
});

test('a note held over the next one with clip is caught', async () => {
  const problems = channelOverlaps(await haps('note("c4 e4").clip(1.5).s("square").orbit(2)'));
  assert.deepEqual(problems, ['orbit 2, bar 1.50: e4 starts while c4 still plays']);
});

test('the same notes on two channels pass, silent preload events are ignored', async () => {
  const code = 'stack(note("c4 e4").orbit(6), note("c4 e4").orbit(5), s("bd*4").gain(0))';
  assert.deepEqual(channelOverlaps(await haps(code)), []);
});

test('samples need the cut group of their channel', async () => {
  assert.deepEqual(uncutSamples(await haps('s("bd sd").cut(1)'), isSynth), []);
  assert.deepEqual(uncutSamples(await haps('s("bd sd")'), isSynth), ['bd on orbit 1 has cut undefined', 'sd on orbit 1 has cut undefined']);
  assert.deepEqual(uncutSamples(await haps('s("hh").cut(1).orbit(4)'), isSynth), ['hh on orbit 4 has cut 1']);
  assert.deepEqual(uncutSamples(await haps('s("white").orbit(2)'), isSynth), []);
});

test('the delay effect is caught, a quiet copy on another channel is not', async () => {
  assert.deepEqual(echoEffects(await haps('note("c5").s("square").delay(.4).orbit(6)')), ['square on orbit 6 uses delay']);
  assert.deepEqual(echoEffects(await haps('stack(note("c5 e5").orbit(6), note("c5 e5").late(.1).gain(.3).orbit(5))')), []);
});

test('the arpeggio chord is read per half bar', async () => {
  const chords = arpChords(await haps('note("<[a4,c5,e5] [g4,b4,d5]>").arp("[0 1 2]*4").orbit(3)', 2));
  assert.deepEqual([...arpChordAt(chords, 0.3)].sort((a, b) => a - b), [0, 4, 9]);
  assert.deepEqual([...arpChordAt(chords, 1.7)].sort((a, b) => a - b), [2, 7, 11]);
  assert.equal(arpChordAt(chords, 5).size, 0);
  assert.deepEqual(thinArps(chords), []);
});

test('an arpeggio of two tones spells no chord', async () => {
  const chords = arpChords(await haps('note("[a4 e5]*4").orbit(3)'));
  assert.deepEqual(thinArps(chords), ['bar 1.00: only e a', 'bar 1.50: only e a']);
});

test('the bass on the downbeat must fit the arpeggio chord', async () => {
  const check = async (bass) => {
    const events = await haps(`stack(${AM}, note("${bass}").s("sawtooth").orbit(2))`);
    const chords = arpChords(events);
    return bassClashes(events, (t) => arpChordAt(chords, t));
  };
  assert.deepEqual(await check('a1 e2'), []);
  assert.deepEqual(await check('f1 a1'), ['bar 1: bass f1 is not in the chord (c e a)']);
});

test('short melody notes may pass through anything', async () => {
  const events = await haps(`stack(${AM}, note("[a5 bb5 b5 f5]*2").s("pulse").orbit(6))`);
  assert.deepEqual(heldNoteClashes(events), []);
});

test('held melody notes must be chord tones', async () => {
  const events = await haps(`stack(${AM}, note("e5 b5 a5 f5").s("pulse").orbit(6))`);
  assert.deepEqual(heldNoteClashes(events), [
    'bar 1.25: held b5 is not in the arpeggio chord (c e a)',
    'bar 1.75: held f5 is not in the arpeggio chord (c e a)',
    'bar 1.75: held f5 rubs a semitone against e (orbit 6)',
  ]);
});

test('a held note that runs into the next chord must not rub against it', async () => {
  const arp = 'note("<[a4,c5,e5] [g4,b4,d5]>").arp("[0 1 2]*4").s("square").orbit(3)';
  const echo = 'note("<[~ c6] ~>").late(.25).s("pulse").orbit(5)';
  assert.deepEqual(heldNoteClashes(await haps(`stack(${arp}, ${echo})`, 2)), ['bar 1.75: held c6 rubs a semitone against b (orbit 5)']);
});

test('the key from the header gives the scale, with the leading tone in minor', () => {
  assert.deepEqual([...scaleOf('A minor')].sort((a, b) => a - b), [0, 2, 4, 5, 7, 8, 9, 11]);
  assert.deepEqual([...scaleOf('D major')].sort((a, b) => a - b), [0, 1, 2, 4, 6, 7, 9, 11]);
  assert.ok(scaleOf('F# minor').has(6));
  assert.ok(scaleOf('Bb major').has(10));
  assert.throws(() => scaleOf('H-Moll'), /cannot read the key/);
});

test('notes outside the key are caught, drum channels are left alone', async () => {
  const code = 'stack(note("a4 g#4 bb4").orbit(6), note("c#2").orbit(1), note("f2").orbit(2))';
  assert.deepEqual(outOfKey(await haps(code), 'A minor'), ['bar 1.67: bb4 on orbit 6 is not in A minor']);
});
