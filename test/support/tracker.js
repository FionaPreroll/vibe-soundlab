// Checks for chiptune tracks written like tracker music (tracks with an @channels header).
// Every orbit is one tracker channel, and a channel plays one sound at a time:
//   orbit 1 drums · 2 bass · 3 arpeggio (the chords) · 4 second drum channel
//   orbit 5 echo or counter melody · 6 lead
// There is no pad: the arpeggio channel spells the chords.
import { toMidi } from './strudel.js';

export const CHANNEL = { drums: [1, 4], bass: 2, arp: 3, melody: [5, 6] };

/** A melody note this long (a beat) or longer counts as held. */
export const HELD = 1 / 4;

const EPSILON = 1e-9;
const orbitOf = (hap) => hap.value.orbit ?? 1;
const pitched = (hap) => hap.value.note !== undefined;
const audible = (hap) => hap.hasOnset() && hap.value.gain !== 0;
const at = (hap) => hap.whole.begin.valueOf();
const end = (hap) => at(hap) + hap.duration.valueOf();
const pc = (midi) => ((Math.round(midi) % 12) + 12) % 12;
const where = (t) => `bar ${(t + 1).toFixed(2)}`;
const label = (hap) => String(hap.value.note ?? hap.value.s);

const NAMES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];
const describe = (notes) => [...new Set([...notes].map(pc))].sort((a, b) => a - b).map((p) => NAMES[p]).join(' ');

/** The orbits (channels) that play anything audible, in order. */
export function channelsUsed(haps) {
  return [...new Set(haps.filter(audible).map(orbitOf))].sort((a, b) => a - b);
}

/**
 * A tracker channel plays one sound at a time: the next note on a channel may only
 * start once the previous one has ended (its length counts `clip`).
 */
export function channelOverlaps(haps) {
  const byOrbit = new Map();
  for (const h of haps) {
    if (!audible(h)) continue;
    if (!byOrbit.has(orbitOf(h))) byOrbit.set(orbitOf(h), []);
    byOrbit.get(orbitOf(h)).push(h);
  }
  const problems = [];
  for (const [orbit, list] of byOrbit) {
    list.sort((a, b) => at(a) - at(b));
    for (let i = 1; i < list.length; i++) {
      const [prev, next] = [list[i - 1], list[i]];
      if (at(next) < end(prev) - EPSILON) problems.push(`orbit ${orbit}, ${where(at(next))}: ${label(next)} starts while ${label(prev)} still plays`);
    }
  }
  return problems;
}

/**
 * A sample plays to its end unless something cuts it. On a tracker channel the next
 * sound cuts the last one, so every sample needs the cut group of its channel (cut = orbit).
 */
export function uncutSamples(haps, isSynth) {
  const problems = new Set();
  for (const h of haps) {
    if (!audible(h) || isSynth(h.value.s)) continue;
    if (h.value.cut !== orbitOf(h)) problems.add(`${h.value.s} on orbit ${orbitOf(h)} has cut ${h.value.cut}`);
  }
  return [...problems];
}

/** Echoes cost a channel in a tracker, so the delay effect is not used. */
export function echoEffects(haps) {
  const problems = new Set();
  for (const h of haps) if (audible(h) && h.value.delay > 0) problems.add(`${h.value.s} on orbit ${orbitOf(h)} uses delay`);
  return [...problems];
}

/** The notes the arpeggio channel plays in each half bar (key: half-bar number). */
export function arpChords(haps) {
  const chords = new Map();
  for (const h of haps) {
    if (orbitOf(h) !== CHANNEL.arp || !pitched(h) || !audible(h)) continue;
    const half = Math.floor(at(h) * 2);
    if (!chords.has(half)) chords.set(half, new Set());
    chords.get(half).add(toMidi(h.value.note));
  }
  return chords;
}

/** Pitch classes of the arpeggio chord in the half bar around time t (empty set if none). */
export const arpChordAt = (chords, t) => new Set([...(chords.get(Math.floor(t * 2)) ?? [])].map(pc));

/** Half bars where the arpeggio plays fewer than three different tones, so it spells no chord. */
export function thinArps(chords) {
  return [...chords].filter(([, notes]) => new Set([...notes].map(pc)).size < 3).map(([half, notes]) => `${where(half / 2)}: only ${describe(notes)}`);
}

/**
 * Short melody notes may pass through anything. Notes held for a beat or longer
 * must be tones of the arpeggio chord where they start, and must not sit a
 * semitone (or a minor ninth) away from an arpeggio note anywhere they sound.
 */
export function heldNoteClashes(haps, chords = arpChords(haps)) {
  const problems = new Set();
  for (const h of haps) {
    if (!CHANNEL.melody.includes(orbitOf(h)) || !pitched(h) || !audible(h)) continue;
    if (h.duration.valueOf() < HELD - EPSILON) continue;
    const midi = toMidi(h.value.note);
    const first = Math.floor(at(h) * 2);
    const chord = arpChordAt(chords, at(h));
    if (chord.size > 0 && !chord.has(pc(midi))) problems.add(`${where(at(h))}: held ${h.value.note} is not in the arpeggio chord (${describe(chords.get(first))})`);
    for (let half = first; half < end(h) * 2 - EPSILON; half++) {
      for (const tone of chords.get(half) ?? []) {
        if (Math.abs(midi - tone) % 12 === 1) problems.add(`${where(at(h))}: held ${h.value.note} rubs a semitone against ${NAMES[pc(tone)]} (orbit ${orbitOf(h)})`);
      }
    }
  }
  return [...problems];
}

const SCALES = {
  // natural minor plus the raised seventh of harmonic minor (the leading tone)
  minor: [0, 2, 3, 5, 7, 8, 10, 11],
  // major plus the flat seventh of mixolydian
  major: [0, 2, 4, 5, 7, 9, 10, 11],
};

/** "F# minor" → the pitch classes the track may use. */
export function scaleOf(key) {
  const match = String(key).trim().match(/^([a-g][#b]?)\s+(major|minor)$/i);
  if (!match) throw new Error(`cannot read the key "${key}"`);
  const tonic = pc(toMidi(`${match[1].toLowerCase()}4`));
  return new Set(SCALES[match[2].toLowerCase()].map((step) => (tonic + step) % 12));
}

/** Notes on the bass, arpeggio and melody channels that are outside the key. */
export function outOfKey(haps, key) {
  const scale = scaleOf(key);
  const problems = new Set();
  for (const h of haps) {
    if (CHANNEL.drums.includes(orbitOf(h)) || !pitched(h) || !audible(h)) continue;
    if (!scale.has(pc(toMidi(h.value.note)))) problems.add(`${where(at(h))}: ${h.value.note} on orbit ${orbitOf(h)} is not in ${key}`);
  }
  return [...problems];
}
