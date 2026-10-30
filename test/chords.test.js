// Chord names found from the notes that play (src/chords.js), on made-up events and on the tracks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NOTE_NAMES, QUALITIES, chordName, createChordTracker, detectChord, noteToMidi, pitchOf, profileOf, simplify, spellingFor } from '../src/chords.js';
import { parseHeader } from '../src/header.js';
import { voicing } from '../src/guitar.js';
import { loadTrack } from './support/strudel.js';
import { TRACK_DIR, trackFiles } from './support/tracks.js';

/** An event like Strudel's: value, whole and part as { begin, end } (numbers work as Fractions do here). */
const hap = (value, begin, end, part = { begin, end }) => ({ value, whole: { begin, end }, part });
const notes = (names, begin = 0, end = 0.5) => names.map((note) => hap({ note }, begin, end));
const named = (chord, spelling) => chordName(chord, spelling);
const chordOf = (haps, previous = null) => detectChord(profileOf(haps, 0, 0.5), previous);

test('note names become MIDI numbers the way Strudel reads them', () => {
  assert.equal(noteToMidi('c4'), 60);
  assert.equal(noteToMidi('A4'), 69);
  assert.equal(noteToMidi('ab3'), 56);
  assert.equal(noteToMidi('c#'), 49, 'octave 3 when none is given');
  assert.equal(noteToMidi('es2'), noteToMidi('e#2'), 's for sharp');
  assert.equal(noteToMidi('bf1'), noteToMidi('bb1'), 'f for flat');
  assert.equal(noteToMidi('c-1'), 0);
  assert.equal(noteToMidi('h3'), null);
  assert.equal(noteToMidi(''), null);
});

test('only pitched notes count: no drums, noise or plain numbers', () => {
  assert.equal(pitchOf({ note: 'a4' }), 69);
  assert.equal(pitchOf({ note: 60.4, s: 'sawtooth' }), 60.4);
  assert.equal(Math.round(pitchOf({ freq: 440 })), 69);
  assert.equal(pitchOf({ freq: 0 }), null);
  assert.equal(pitchOf({ note: Infinity }), null);
  assert.equal(pitchOf({ s: 'piano:2', note: 'c3' }), 48);
  for (const value of [{ s: 'white', note: 'c3' }, { s: 'bd', note: 'c3' }, { s: 'sd:3', note: 40 }, { s: 'hh', bank: 'RolandTR909', note: 'c3' }, { s: 'breaks165', note: 'c3' }, { n: 3, s: 'sawtooth' }, { s: 'piano' }]) {
    assert.equal(pitchOf(value), null, JSON.stringify(value));
  }
  assert.equal(pitchOf(0.5), null, 'what H() and signals give is not a note');
  assert.equal(pitchOf(null), null);
});

test('long notes weigh more than short ones, doubled layers once, silent notes not at all', () => {
  const profile = profileOf(
    [
      hap({ note: 'c3' }, 0, 2, { begin: 0, end: 0.5 }), // a pad held for two bars
      hap({ note: 'c3', s: 'sine' }, 0, 2, { begin: 0, end: 0.5 }), // the same note on another layer
      hap({ note: 'e4' }, 0, 1 / 16),
      hap({ note: 'g4', gain: 0 }, 0, 0.5),
      hap({ note: 'b4', velocity: 0 }, 0, 0.5),
      { value: { note: 'd4' }, part: { begin: 0, end: 0.5 } }, // no whole: a signal, not an event
      hap({ s: 'bd' }, 0, 0.25),
    ],
    0,
    0.5,
  );
  assert.ok(profile.weights[0] > 0.95, 'the held c');
  assert.ok(profile.weights[4] > 0 && profile.weights[4] < 0.05, 'a sixteenth e');
  assert.equal(profile.weights[7], 0);
  assert.equal(profile.weights[11], 0);
  assert.equal(profile.weights[2], 0);
  assert.equal(profile.bass, 0);
  assert.deepEqual(profileOf([], 0, 0.5), { weights: new Array(12).fill(0), bass: null, spelled: { sharp: 0, flat: 0 } });
});

test('the bass is the lowest note that lasts, else the lowest one', () => {
  const held = profileOf([...notes(['e3', 'g3']), hap({ note: 'c1' }, 0, 1 / 32)], 0, 0.5);
  assert.equal(held.bass, 4, 'a short low note is not the bass');
  const short = profileOf([hap({ note: 'c1' }, 0, 1 / 32), hap({ note: 'g2' }, 0.25, 0.25 + 1 / 32)], 0, 0.5);
  assert.equal(short.bass, 0);
});

test('triads, sevenths, ninths, power chords and suspended chords are named', () => {
  assert.equal(named(chordOf(notes(['c3', 'e3', 'g3']))), 'C');
  assert.equal(named(chordOf(notes(['a2', 'c3', 'e3']))), 'Am');
  assert.equal(named(chordOf(notes(['e2', 'b2']))), 'E5');
  assert.equal(named(chordOf(notes(['g2', 'b2', 'd3', 'f3']))), 'G7');
  assert.equal(named(chordOf(notes(['g2', 'b2', 'f3']))), 'G7', 'without its fifth');
  assert.equal(named(chordOf(notes(['f3', 'ab3', 'eb4', 'g4', 'c5'])), 'flat'), 'Fm9');
  assert.equal(named(chordOf(notes(['d3', 'g3', 'a3']))), 'Dsus4');
  assert.equal(named(chordOf(notes(['b2', 'd3', 'f3']))), 'Bdim');
});

test('the bass decides between chords with the same notes', () => {
  assert.equal(named(chordOf(notes(['a2', 'c3', 'e3', 'g3']))), 'Am7');
  assert.equal(named(chordOf(notes(['c2', 'a2', 'c3', 'e3', 'g3']))), 'C6');
});

test('a single note, only drums or a chromatic smear make no chord', () => {
  assert.equal(chordOf(notes(['c3', 'c4'])), null);
  assert.equal(chordOf([hap({ s: 'bd' }, 0, 0.25)]), null);
  assert.equal(chordOf(notes(['c3', 'c#3', 'd3', 'd#3', 'e3', 'f3', 'f#3', 'g3', 'g#3', 'a3', 'a#3', 'b3'])), null);
});

test('a chord that still covers the notes is kept, so names do not flicker', () => {
  const am7 = chordOf(notes(['a2', 'c3', 'e3', 'g3']));
  assert.equal(named(chordOf(notes(['c3', 'e3', 'g3', 'a3']), am7)), 'Am7', 'the same notes over C stay Am7');
  assert.equal(named(chordOf(notes(['f2', 'a2', 'c3']), am7)), 'F', 'new notes, new chord');
});

test('roots are spelled from the key, else from the notes, else as chord charts do', () => {
  assert.equal(spellingFor({ key: 'F minor' }), 'flat');
  assert.equal(spellingFor({ key: 'Bb minor' }), 'flat');
  assert.equal(spellingFor({ key: 'Eb' }), 'flat');
  assert.equal(spellingFor({ key: 'F# minor' }), 'sharp');
  assert.equal(spellingFor({ key: 'G♯m' }), 'sharp');
  assert.equal(spellingFor({ key: 'D major' }), 'sharp');
  assert.equal(spellingFor({ key: 'D♭ major' }), 'flat');
  assert.equal(spellingFor({ key: 'A minor' }), 'common');
  assert.equal(spellingFor({ key: 'Db minor' }), 'common', 'a key nobody writes');
  assert.equal(spellingFor({ spelled: { sharp: 1, flat: 4 } }), 'flat');
  assert.equal(spellingFor({ spelled: { sharp: 3, flat: 0 } }), 'sharp');
  assert.equal(spellingFor(), 'common');
  assert.equal(chordName({ root: 1, quality: 'm7' }, 'sharp'), 'C#m7');
  assert.equal(chordName({ root: 1, quality: 'm7' }, 'flat'), 'Dbm7');
  assert.equal(chordName({ root: 10, quality: '' }), 'Bb');
  assert.equal(chordName(null), '');
  assert.equal(NOTE_NAMES.common[6], 'F#');
});

test('simple chords keep the triad', () => {
  assert.deepEqual(simplify({ root: 5, quality: 'm9' }), { root: 5, quality: 'm' });
  assert.deepEqual(simplify({ root: 7, quality: '7' }), { root: 7, quality: '' });
  assert.deepEqual(simplify({ root: 7, quality: 'm7b5' }), { root: 7, quality: 'dim' });
  assert.deepEqual(simplify({ root: 4, quality: '5' }), { root: 4, quality: '5' });
  assert.equal(simplify(null), null);
  for (const quality of Object.keys(QUALITIES)) assert.ok(simplify({ root: 0, quality }).quality in QUALITIES, quality);
});

// Four bars, two chords each half bar long: Am | Am F | C | G G7 …
function progression() {
  const bars = [
    ['a2 c3 e3', 'a2 c3 e3'],
    ['a2 c3 e3', 'f2 a2 c3'],
    ['c3 e3 g3', 'c3 e3 g3'],
    ['g2 b2 d3', 'g2 b2 d3 f3'],
  ];
  const haps = [];
  bars.forEach((halves, bar) => halves.forEach((names, half) => haps.push(...notes(names.split(' '), bar + half / 2, bar + half / 2 + 0.5))));
  const asked = [];
  const query = (begin, end) => {
    asked.push([begin, end]);
    return haps.filter((h) => h.whole.begin < end && h.whole.end > begin);
  };
  return { query, asked };
}

test('the tracker works out the chords ahead, half a bar at a time, and lists the changes', () => {
  const { query, asked } = progression();
  const tracker = createChordTracker({ query, clock: () => 0 });
  assert.deepEqual(tracker.upcoming(0), [], 'nothing known yet');
  assert.equal(tracker.at(0), undefined);
  assert.equal(tracker.fill(0, 3.5), true);
  assert.deepEqual(asked[0], [0, 0.5]);
  assert.equal(asked.length, 8);
  const names = (list) => list.map(({ start, chord }) => `${start}:${named(chord)}`);
  assert.deepEqual(names(tracker.upcoming(0)), ['0:Am', '1.5:F', '2:C', '3:G']);
  assert.deepEqual(names(tracker.upcoming(1.2, 2)), ['0:Am', '1.5:F'], 'the chord now starts where it started');
  assert.deepEqual(names(tracker.upcoming(3.2)), ['3:G', '3.5:G7']);
  assert.deepEqual(names(tracker.upcoming(3.2, 4, { simple: true })), ['3:G'], 'G and G7 are one chord when simple');
  tracker.fill(0, 3.5);
  assert.equal(asked.length, 8, 'known chords are not asked for again');
  tracker.reset();
  assert.equal(tracker.at(0), undefined);
});

test('the tracker stops when its time is up and when the pattern is too heavy', () => {
  let time = 0;
  const clock = () => time;
  const quick = createChordTracker({ query: () => ((time += 3), []), clock });
  assert.equal(quick.fill(0, 8, 4), false, 'two half bars fit into 4 ms');
  assert.equal(quick.at(0), null);
  assert.equal(quick.at(0.5), null);
  assert.equal(quick.at(1), undefined);
  assert.equal(quick.isSlow(), false);
  let cost = 100;
  const heavy = createChordTracker({ query: () => ((time += cost), []), clock });
  assert.equal(heavy.fill(0, 0.5, 1000), true);
  assert.equal(heavy.isSlow(), false, 'two heavy questions may be chance');
  cost = 1;
  heavy.fill(1, 0, 1000);
  cost = 100;
  heavy.fill(1.5, 0.5, 1000);
  assert.equal(heavy.isSlow(), false, 'a quick one in between starts the count again');
  heavy.fill(0, 8, 1000);
  assert.equal(heavy.isSlow(), true, 'three in a row: too heavy');
  assert.equal(heavy.fill(4, 8, 1000), false, 'no more asking');
  heavy.reset();
  assert.equal(heavy.isSlow(), false);
});

test('a pattern that throws or returns nothing has no chords there', () => {
  const tracker = createChordTracker({ query: (begin) => (begin === 0 ? null : (() => { throw new Error('boom'); })()) });
  tracker.fill(0, 1);
  assert.equal(tracker.at(0), null);
  assert.equal(tracker.at(1), null);
  assert.deepEqual(tracker.upcoming(0).map((c) => c.chord), [null]);
});

test('the tracker counts how notes are spelled, for naming the chords', () => {
  const haps = [...notes(['bb2', 'db3', 'f3']), hap({ note: 'c#4' }, 0, 0.5), hap({ note: 61 }, 0, 0.5)];
  const tracker = createChordTracker({ query: () => haps });
  tracker.fill(0, 0);
  assert.deepEqual(tracker.spelled(), { sharp: 1, flat: 2 });
});

// The tracks, through the real pattern engine.
async function chordsOf(file, bars) {
  const code = readFileSync(new URL(file, TRACK_DIR), 'utf8');
  const { pattern } = await loadTrack(code);
  // no clock: on a busy test machine the tracker must not give up
  const tracker = createChordTracker({ query: (begin, end) => pattern.queryArc(begin, end), clock: () => 0 });
  tracker.fill(0, bars, Infinity);
  const spelling = spellingFor({ key: parseHeader(code).key, spelled: tracker.spelled() });
  const changes = [];
  for (let pos = 0; pos < bars; ) {
    const [now, next] = tracker.upcoming(pos, 2, { simple: true });
    changes.push(chordName(now.chord, spelling) || '-');
    pos = next?.start ?? bars;
  }
  return { tracker, changes };
}

test('the chords of the tracks are found: Seriennummer, Sternenfeld, Nachtschicht', async () => {
  assert.deepEqual((await chordsOf('seriennummer.js', 8)).changes, ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E']);
  assert.deepEqual((await chordsOf('sternenfeld.js', 4)).changes, ['D', 'A', 'Bm', 'G']);
  assert.deepEqual((await chordsOf('nachtschicht.js', 6)).changes, ['Fm', 'Db', 'Bbm']);
});

test('every chord in the first bars of every track has a guitar shape', async () => {
  for (const file of trackFiles()) {
    const { tracker } = await chordsOf(file, 16);
    for (let pos = 0; pos < 16; pos += 0.5) {
      const chord = tracker.at(pos);
      if (chord) assert.ok(voicing(chord), `${file}, bar ${pos + 1}: ${chordName(chord)}`);
    }
  }
});
