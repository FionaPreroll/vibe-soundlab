// Chord names to play along with: what the notes sounding in a stretch of a song
// spell, found from the pattern that plays (no chord list needed in the track).
//
// The player asks the pattern for every note in each half bar, weighs them by how
// long and how loud they sound, and picks the chord whose tones cover them best.

/** Note names for the twelve pitch classes, by how a song spells its accidentals. */
export const NOTE_NAMES = {
  sharp: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  flat: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  // what chord charts use when nothing says otherwise
  common: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
};

/**
 * The chords the player names, as intervals above the root. `cost` makes a richer
 * chord win only when its extra tones really sound. Every one has a guitar shape.
 */
export const QUALITIES = {
  '': { intervals: [0, 4, 7], cost: 0 },
  m: { intervals: [0, 3, 7], cost: 0 },
  5: { intervals: [0, 7], cost: 0.02 },
  7: { intervals: [0, 4, 7, 10], cost: 0.02 },
  maj7: { intervals: [0, 4, 7, 11], cost: 0.02 },
  m7: { intervals: [0, 3, 7, 10], cost: 0.02 },
  sus2: { intervals: [0, 2, 7], cost: 0.03 },
  sus4: { intervals: [0, 5, 7], cost: 0.03 },
  dim: { intervals: [0, 3, 6], cost: 0.04 },
  aug: { intervals: [0, 4, 8], cost: 0.06 },
  6: { intervals: [0, 4, 7, 9], cost: 0.04 },
  m6: { intervals: [0, 3, 7, 9], cost: 0.04 },
  '7sus4': { intervals: [0, 5, 7, 10], cost: 0.04 },
  m7b5: { intervals: [0, 3, 6, 10], cost: 0.04 },
  dim7: { intervals: [0, 3, 6, 9], cost: 0.05 },
  add9: { intervals: [0, 2, 4, 7], cost: 0.04 },
  9: { intervals: [0, 2, 4, 7, 10], cost: 0.05 },
  m9: { intervals: [0, 2, 3, 7, 10], cost: 0.05 },
  maj9: { intervals: [0, 2, 4, 7, 11], cost: 0.05 },
};

// "Simple chords": the triad (or power chord) each chord is built on.
const SIMPLE = { 7: '', maj7: '', m7: 'm', 6: '', m6: 'm', '7sus4': 'sus4', m7b5: 'dim', dim7: 'dim', add9: '', 9: '', m9: 'm', maj9: '' };

/** The chord with only its triad: Fm9 → Fm, G7 → G. */
export const simplify = (chord) => (chord && chord.quality in SIMPLE ? { ...chord, quality: SIMPLE[chord.quality] } : chord);

const pitchClass = (midi) => ((Math.round(midi) % 12) + 12) % 12;

/** "ab3" → 56, "c#" → 49 (octave 3 when none is given), as Strudel reads note names. */
export function noteToMidi(name) {
  const match = /^([a-g])([#bsf]*)(-?\d*)$/i.exec(String(name).trim());
  if (!match) return null;
  const [, letter, accidentals, octave] = match;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[letter.toLowerCase()];
  const shift = [...accidentals].reduce((sum, ch) => sum + (ch === '#' || ch === 's' ? 1 : -1), 0);
  return (Number(octave === '' ? 3 : octave) + 1) * 12 + base + shift;
}

// Sounds that have no pitch to speak of, even when a note is set on them.
const NOISE = new Set(['white', 'pink', 'brown', 'crackle']);
const DRUM = /^(bd|sd|hh|oh|ch|cp|rim|rm|lt|mt|ht|cr|rd|cb|sh|tb|perc|misc|fx|kick|snare|hat|clap|breaks\d*|amencutup)$/i;

/** The pitch of a note event as a MIDI number, or null for drums, noise and non-notes. */
export function pitchOf(value) {
  if (value === null || typeof value !== 'object') return null;
  const sound = String(value.s ?? '').split(':')[0];
  if (NOISE.has(sound) || DRUM.test(sound) || value.bank) return null;
  if (typeof value.freq === 'number') return value.freq > 0 ? 69 + 12 * Math.log2(value.freq / 440) : null;
  if (typeof value.note === 'number') return Number.isFinite(value.note) ? value.note : null;
  if (typeof value.note === 'string') return noteToMidi(value.note);
  return null;
}

const sounds = (value) => !(Number(value.gain ?? 1) <= 0) && !(Number(value.velocity ?? 1) <= 0);

/**
 * What the notes in [begin, end) add up to: `weights` per pitch class (summing to 1),
 * `bass` (the pitch class of the lowest note that lasts a while), and how many note
 * names were written with sharps and with flats.
 *
 * Long notes count more than short ones (a held chord says more about the harmony than
 * a run of sixteenths), the mix levels don't count, and layers that double a note
 * (a bass made of three sounds) count once.
 */
export function profileOf(haps, begin, end) {
  const weights = new Array(12).fill(0);
  const spelled = { sharp: 0, flat: 0 };
  const seen = new Set();
  const length = end - begin;
  let total = 0;
  let lowest = Infinity;
  let lowestHeld = Infinity;
  for (const hap of haps) {
    if (!hap?.whole || !hap.part || !sounds(hap.value)) continue;
    const midi = pitchOf(hap.value);
    if (midi === null || !Number.isFinite(midi)) continue;
    const from = Math.max(begin, Number(hap.part.begin));
    const to = Math.min(end, Number(hap.part.end));
    const doubled = `${Math.round(midi)}|${from}|${to}`;
    if (!(to > from) || seen.has(doubled)) continue;
    seen.add(doubled);
    const held = Math.min(1, (Number(hap.whole.end) - Number(hap.whole.begin)) / length);
    const weight = (to - from) * held;
    weights[pitchClass(midi)] += weight;
    total += weight;
    lowest = Math.min(lowest, midi);
    if (to - from >= length / 4) lowestHeld = Math.min(lowestHeld, midi);
    if (typeof hap.value.note === 'string') {
      if (/^[a-g](#|s)/i.test(hap.value.note)) spelled.sharp++;
      else if (/^[a-g](b|f)/i.test(hap.value.note)) spelled.flat++;
    }
  }
  const bassNote = Number.isFinite(lowestHeld) ? lowestHeld : lowest;
  return {
    weights: total > 0 ? weights.map((w) => w / total) : weights,
    bass: Number.isFinite(bassNote) ? pitchClass(bassNote) : null,
    spelled,
  };
}

// A pitch class counts as sounding from this share of the weight on.
const HEARD = 0.03;

const tonesOf = ({ root, quality }) => QUALITIES[quality].intervals.map((i) => (root + i) % 12);
const coverage = (weights, tones) => tones.reduce((sum, pc) => sum + weights[pc], 0);

/**
 * The chord a profile (see profileOf) spells, as { root, quality }, or null when the
 * notes don't make one (a single note, only drums, a melody on its own). A chord that
 * still covers the notes is kept from `previous`, so it doesn't flicker between names
 * for the same notes (Am7 and C6).
 */
export function detectChord({ weights, bass }, previous = null) {
  const heard = weights.filter((w) => w >= HEARD).length;
  if (heard < 2) return null;
  if (previous && coverage(weights, tonesOf(previous)) >= 0.92) return previous;
  let best = null;
  for (let root = 0; root < 12; root++) {
    for (const [quality, { intervals, cost }] of Object.entries(QUALITIES)) {
      const tones = intervals.map((i) => (root + i) % 12);
      const covered = coverage(weights, tones);
      let missing = tones.filter((pc) => weights[pc] < HEARD).length;
      // four-note chords often leave out the fifth
      if (intervals.length >= 4 && weights[(root + 7) % 12] < HEARD) missing -= 0.75;
      const score = covered - (1 - covered) - missing * 0.12 - cost + (root === bass ? 0.08 : 0);
      if (best === null || score > best.score) best = { root, quality, score, covered };
    }
  }
  return best.covered >= 0.6 ? { root: best.root, quality: best.quality } : null;
}

const FLAT_KEYS = { major: ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'], minor: ['D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab'] };
const SHARP_KEYS = { major: ['G', 'D', 'A', 'E', 'B', 'F#', 'C#'], minor: ['E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'] };

/**
 * How to spell chord roots: from the track's key ("F minor" → flats) if it has one,
 * else from how its notes are written ("ab3" → flats), else as chord charts do.
 */
export function spellingFor({ key = null, spelled = { sharp: 0, flat: 0 } } = {}) {
  const match = /^\s*([A-G])\s*([#b♯♭]?)\s*(major|minor|maj|min|m)?/i.exec(key ?? '');
  if (match) {
    const tonic = match[1].toUpperCase() + (match[2] === '♯' ? '#' : match[2] === '♭' ? 'b' : match[2]);
    const mode = /^m(in(or)?)?$/i.test(match[3] ?? '') ? 'minor' : 'major';
    if (FLAT_KEYS[mode].includes(tonic)) return 'flat';
    if (SHARP_KEYS[mode].includes(tonic)) return 'sharp';
    return 'common';
  }
  if (spelled.flat > spelled.sharp) return 'flat';
  if (spelled.sharp > spelled.flat) return 'sharp';
  return 'common';
}

/** "Fm7", "Bb", "C#dim". */
export function chordName(chord, spelling = 'common') {
  return chord ? `${NOTE_NAMES[spelling][chord.root]}${chord.quality}` : '';
}

const keyOf = (chord) => (chord ? `${chord.root}:${chord.quality}` : '-');

/**
 * Finds the chords of a playing pattern half a bar at a time, ahead of the music.
 * `query(begin, end)` returns the pattern's events in that span (bars are cycles).
 * fill() works for at most `budgetMs` per call, so it can run every frame.
 */
export function createChordTracker({ query, segment = 0.5, clock = () => performance.now() }) {
  // segment index → chord or null; a missing entry is not worked out yet
  const chords = new Map();
  const spelled = { sharp: 0, flat: 0 };
  // heavy questions in a row; one alone may be the browser tidying up memory
  let heavy = 0;
  let slow = false;

  function compute(index) {
    const begin = index * segment;
    const end = begin + segment;
    let haps = [];
    try {
      haps = query(begin, end) ?? [];
    } catch {
      haps = [];
    }
    const profile = profileOf(haps, begin, end);
    spelled.sharp += profile.spelled.sharp;
    spelled.flat += profile.spelled.flat;
    chords.set(index, detectChord(profile, chords.get(index - 1) ?? null));
  }

  return {
    segment,
    reset() {
      chords.clear();
      spelled.sharp = 0;
      spelled.flat = 0;
      heavy = 0;
      slow = false;
    },
    /** Works out the chords from bar `from` to `from + ahead`; true once they are all known. */
    fill(from, ahead = 8, budgetMs = 4) {
      const started = clock();
      const first = Math.max(0, Math.floor(from / segment));
      const last = Math.floor((from + ahead) / segment);
      for (let index = first; index <= last; index++) {
        if (chords.has(index)) continue;
        const before = clock();
        compute(index);
        // A pattern this heavy to ask would take the music's time away: stop asking.
        heavy = clock() - before > 60 ? heavy + 1 : 0;
        if (heavy >= 3) slow = true;
        if (slow || clock() - started > budgetMs) return false;
      }
      return true;
    },
    /** True when the pattern was too heavy to look ahead in. */
    isSlow: () => slow,
    spelled: () => ({ ...spelled }),
    /** The chord at bar position `pos`: an object, null (no chord) or undefined (not known yet). */
    at: (pos) => chords.get(Math.floor(pos / segment)),
    /**
     * The chord sounding at `pos` and the next ones after it, as { start, chord }
     * (start in bars), as far as they are known. `simple` reduces them to triads.
     */
    upcoming(pos, count = 4, { simple = false } = {}) {
      const shape = (chord) => (simple ? simplify(chord) : chord);
      let index = Math.max(0, Math.floor(pos / segment));
      if (!chords.has(index)) return [];
      const current = shape(chords.get(index));
      let first = index;
      while (chords.has(first - 1) && keyOf(shape(chords.get(first - 1))) === keyOf(current)) first--;
      const changes = [{ start: first * segment, chord: current }];
      while (changes.length < count && chords.has(index + 1)) {
        index++;
        const chord = shape(chords.get(index));
        if (keyOf(chord) !== keyOf(changes.at(-1).chord)) changes.push({ start: index * segment, chord });
      }
      return changes;
    },
  };
}
