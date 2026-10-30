// Runs Strudel track files in Node with the real pattern engine (no audio),
// so tests can inspect every event a track would play.
import * as core from '@strudel/core';
import * as mini from '@strudel/mini';
import * as tonal from '@strudel/tonal';
import { evaluate } from '@strudel/transpiler';
import { hydraGlobals } from './hydra.js';

let current = null;

const ready = core.evalScope(core, mini, tonal, {
  samples: async (source) => {
    current?.samples.push(source);
  },
  setcpm: (cpm) => {
    if (current) current.cpm = cpm;
  },
  setcps: (cps) => {
    if (current) current.cpm = cps * 60;
  },
  // Hydra visuals, as the player and strudel.cc provide them
  initHydra: async () => {
    current.visuals.inits++;
    Object.assign(globalThis, hydraGlobals(current.visuals));
  },
  H: (pattern) => {
    current.visuals.patterns.push(pattern);
    return () => 0;
  },
});

/** Evaluates track code and returns its pattern plus what it set up. */
export async function loadTrack(code) {
  await ready;
  current = { cpm: null, samples: [], visuals: { inits: 0, sources: [], methods: [], outputs: [], renders: [], patterns: [] } };
  try {
    const { pattern } = await evaluate(code);
    return { pattern, ...current };
  } finally {
    current = null;
  }
}

/** Converts a note value (number or name like "ab3") to a MIDI number. */
export function toMidi(note) {
  if (typeof note === 'number') return note;
  return core.noteToMidi(note);
}
