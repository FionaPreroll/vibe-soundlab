// Runs Strudel track files in Node with the real pattern engine (no audio),
// so tests can inspect every event a track would play.
import * as core from '@strudel/core';
import * as mini from '@strudel/mini';
import * as tonal from '@strudel/tonal';
import { evaluate } from '@strudel/transpiler';

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
});

/** Evaluates track code and returns its pattern plus what it set up. */
export async function loadTrack(code) {
  await ready;
  current = { cpm: null, samples: [] };
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
