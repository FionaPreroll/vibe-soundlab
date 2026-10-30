// The audio side of the mixer. Strudel sends every orbit to its own pair of
// channels (multi-channel orbits); this graph splits them back into one strip
// per orbit, each with an 8-band EQ, a fader and an analyser for the meters,
// and sums them into the master strip on the way to the speakers.
//
//   Strudel → input (2 channels per orbit) → splitter ─┬→ strip 1: EQ → fader → analyser ─┐
//                                                      ├→ strip 2 …                       ├→ master EQ → fader → fade → speakers
//                                                      └→ strip 8 …                       ┘                         └→ analyser
import { CHANNELS, EQ_BANDS, EQ_Q } from './mixer.js';

const SMOOTHING = 0.015; // seconds: fader and EQ moves glide instead of clicking

function createEq(ctx) {
  const filters = EQ_BANDS.map(({ freq, type }) => {
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = EQ_Q;
    filter.gain.value = 0;
    return filter;
  });
  filters.reduce((prev, next) => (prev.connect(next), next));
  return { input: filters[0], output: filters.at(-1), filters };
}

function createAnalyser(ctx) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.7;
  analyser.minDecibels = -100;
  analyser.maxDecibels = -10;
  return analyser;
}

/**
 * Builds the mixer between Strudel and `output` (the speakers). Returns the node
 * Strudel should use as its destination and the controls for the strips.
 */
export function createMixerGraph(ctx, output = ctx.destination) {
  const channelCount = CHANNELS.length * 2;
  const input = ctx.createGain();
  input.channelCount = channelCount;
  input.channelCountMode = 'explicit';
  input.channelInterpretation = 'discrete';
  // Strudel sizes its output by the destination's channel count.
  Object.defineProperty(input, 'maxChannelCount', { value: channelCount });
  const splitter = ctx.createChannelSplitter(channelCount);
  input.connect(splitter);

  const sum = ctx.createGain();
  const strips = new Map();
  CHANNELS.forEach(({ orbit }, i) => {
    const merger = ctx.createChannelMerger(2);
    splitter.connect(merger, 2 * i, 0);
    splitter.connect(merger, 2 * i + 1, 1);
    const eq = createEq(ctx);
    merger.connect(eq.input);
    const fader = ctx.createGain();
    eq.output.connect(fader);
    const analyser = createAnalyser(ctx);
    fader.connect(analyser);
    fader.connect(sum);
    strips.set(orbit, { eq, fader, analyser });
  });

  const masterEq = createEq(ctx);
  sum.connect(masterEq.input);
  const masterFader = ctx.createGain();
  masterEq.output.connect(masterFader);
  // A separate gain for the short dips around a jump, so they never fight the fader.
  const fade = ctx.createGain();
  masterFader.connect(fade);
  const masterAnalyser = createAnalyser(ctx);
  fade.connect(masterAnalyser);
  fade.connect(output);
  strips.set('master', { eq: masterEq, fader: masterFader, analyser: masterAnalyser });

  const glide = (param, value) => param.setTargetAtTime(value, ctx.currentTime, SMOOTHING);

  return {
    input,
    sampleRate: ctx.sampleRate,
    /** Sets a strip's fader (linear gain) and EQ (dB per band). `target` is an orbit or 'master'. */
    set(target, { gain, eq }) {
      const strip = strips.get(target);
      if (!strip) return;
      if (gain !== undefined) glide(strip.fader.gain, gain);
      eq?.forEach((db, i) => glide(strip.eq.filters[i].gain, db));
    },
    analyser: (target) => strips.get(target)?.analyser ?? null,
    /** Fades everything out quickly (before a jump) … */
    fadeOut() {
      fade.gain.cancelScheduledValues(ctx.currentTime);
      fade.gain.setTargetAtTime(0, ctx.currentTime, 0.005);
    },
    /** … and back in once the new part has started. */
    fadeIn(delay = 0) {
      fade.gain.setTargetAtTime(1, ctx.currentTime + delay, 0.01);
    },
  };
}
