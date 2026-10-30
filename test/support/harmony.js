// Checks a track's events against the orbit layout the tracks share:
//   orbit 2 bass · orbit 3 pad · orbits 5 and 6 stabs, keys, arps and leads.
import { toMidi } from './strudel.js';

export const ORBIT = { bass: 2, pad: 3, over: [5, 6] };

const pc = (midi) => ((Math.round(midi) % 12) + 12) % 12;
const orbitOf = (hap) => hap.value.orbit ?? 1;
const pitched = (hap) => hap.value.note !== undefined;
const at = (hap) => hap.whole.begin.valueOf();

/** Queries every event of the first `cycles` bars. */
export function collect(pattern, cycles) {
  return pattern.queryArc(0, cycles).filter((h) => h.whole);
}

/** Pitch classes of the pad sounding at time t (empty set if none). */
export function padChordAt(haps, t) {
  const chord = new Set();
  for (const h of haps) {
    if (orbitOf(h) !== ORBIT.pad || !pitched(h)) continue;
    if (h.part.begin.valueOf() <= t && t < h.part.end.valueOf()) chord.add(pc(toMidi(h.value.note)));
  }
  return chord;
}

const NAMES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];
const name = (p) => NAMES[p];
const describe = (set) => [...set].sort((a, b) => a - b).map(name).join(' ');

/** Stab, key, arp and lead notes must be tones of the pad chord under them. */
export function overLayerClashes(haps) {
  const problems = [];
  for (const h of haps) {
    if (!ORBIT.over.includes(orbitOf(h)) || !pitched(h) || !h.hasOnset()) continue;
    const t = at(h);
    const chord = padChordAt(haps, t);
    const note = pc(toMidi(h.value.note));
    if (chord.size === 0) problems.push(`bar ${(t + 1).toFixed(2)}: ${h.value.note} plays with no pad under it`);
    else if (!chord.has(note)) problems.push(`bar ${(t + 1).toFixed(2)}: ${h.value.note} is not in the pad chord (${describe(chord)})`);
  }
  return problems;
}

/**
 * On every bar's downbeat the bass note must be a chord tone, and no chord tone
 * may sit a semitone above it (a minor ninth against the bass, the harshest clash).
 * The chord is the pad's unless `chordAt` says otherwise (chiptunes use the arpeggio).
 */
export function bassClashes(haps, chordAt = (t) => padChordAt(haps, t)) {
  const problems = [];
  for (const h of haps) {
    if (orbitOf(h) !== ORBIT.bass || !pitched(h) || !h.hasOnset()) continue;
    const t = at(h);
    if (!Number.isInteger(t)) continue;
    const chord = chordAt(t);
    if (chord.size === 0) continue;
    const note = pc(toMidi(h.value.note));
    if (!chord.has(note)) problems.push(`bar ${t + 1}: bass ${h.value.note} is not in the chord (${describe(chord)})`);
    else if (chord.has((note + 1) % 12)) problems.push(`bar ${t + 1}: bass ${h.value.note} has ${name((note + 1) % 12)} a semitone above it`);
  }
  return [...new Set(problems)];
}

/** Every distinct pad chord, as sorted MIDI notes that start together. */
export function padVoicings(haps) {
  const byOnset = new Map();
  for (const h of haps) {
    if (orbitOf(h) !== ORBIT.pad || !pitched(h) || !h.hasOnset()) continue;
    const key = `${at(h)}|${h.value.s}`;
    if (!byOnset.has(key)) byOnset.set(key, new Set());
    byOnset.get(key).add(toMidi(h.value.note));
  }
  const unique = new Map();
  for (const notes of byOnset.values()) {
    const sorted = [...notes].sort((a, b) => a - b);
    if (sorted.length > 1) unique.set(sorted.join(','), sorted);
  }
  return [...unique.values()];
}

/** The orbits a duckorbit value names: 3, "2:3" or [2, 3]. */
export const duckTargets = (value) =>
  [value].flat().flatMap((v) => String(v ?? '').split(':')).filter((v) => v !== '').map(Number);

/**
 * Ducking an orbit that has not played anything yet makes Strudel report
 * "duck target orbit N does not exist". Every event that ducks an orbit must
 * come after the first event on that orbit.
 */
export function earlyDucks(haps) {
  const first = new Map();
  for (const h of haps) {
    if (!h.hasOnset()) continue;
    const orbit = orbitOf(h);
    if (!first.has(orbit) || at(h) < first.get(orbit)) first.set(orbit, at(h));
  }
  const problems = new Set();
  for (const h of haps) {
    if (h.value.duckorbit === undefined || !h.hasOnset()) continue;
    for (const target of duckTargets(h.value.duckorbit)) {
      if (!(first.get(target) < at(h))) problems.add(`bar ${Math.floor(at(h)) + 1}: ducks orbit ${target} before anything plays on it`);
    }
  }
  return [...problems];
}

// Reverb size and delay settings belong to the orbit, not to the event:
// two layers that set different values on one orbit keep overwriting each other.
const BUS_PARAMS = ['roomsize', 'roomfade', 'roomlp', 'roomdim', 'delaytime', 'delayfeedback'];

/** Orbits where layers disagree about the shared reverb or delay settings. */
export function busConflicts(haps) {
  const seen = new Map();
  for (const h of haps) {
    const v = h.value;
    for (const p of BUS_PARAMS) {
      if (v[p] === undefined) continue;
      if (p.startsWith('delay') && !(v.delay > 0)) continue;
      if (p.startsWith('room') && !(v.room > 0)) continue;
      const key = `orbit ${orbitOf(h)} ${p}`;
      if (!seen.has(key)) seen.set(key, new Set());
      seen.get(key).add(+Number(v[p]).toFixed(4));
    }
  }
  return [...seen].filter(([, vals]) => vals.size > 1).map(([k, vals]) => `${k}: ${[...vals].join(' vs ')}`);
}

/**
 * Minor seconds and minor ninths between harmony notes (pad, stabs, keys, arps)
 * that sound at the same moment. A major seventh (c over db) is fine;
 * the same two notes the other way round (db over c) grind.
 */
export function dissonances(haps) {
  const harmonic = haps.filter((h) => pitched(h) && [ORBIT.pad, ...ORBIT.over].includes(orbitOf(h)));
  const problems = new Set();
  for (const h of harmonic) {
    if (!h.hasOnset()) continue;
    const t = at(h);
    const sounding = harmonic.filter((o) => o.part.begin.valueOf() <= t && t < o.part.end.valueOf());
    const notes = [...new Set(sounding.map((o) => toMidi(o.value.note)))].sort((a, b) => a - b);
    for (let i = 0; i < notes.length; i++)
      for (let j = i + 1; j < notes.length; j++)
        if ((notes[j] - notes[i]) % 12 === 1) problems.add(`bar ${Math.floor(t) + 1}: ${name(pc(notes[i]))} under ${name(pc(notes[j]))} (${notes[j] - notes[i]} semitones)`);
  }
  return [...problems];
}
