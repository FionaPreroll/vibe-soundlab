import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMixerGraph } from '../src/mixer-graph.js';
import { EQ_BANDS } from '../src/mixer.js';
import { FakeAudioContext } from './support/fake-audio.js';

const targetsOf = (node) => node.connections.map((c) => c.target);

test('splits Strudel’s 16 channels into a strip per orbit and sums them into the master', () => {
  const ctx = new FakeAudioContext();
  const graph = createMixerGraph(ctx);
  assert.equal(graph.input.maxChannelCount, 16, 'Strudel sizes its output by this');
  assert.equal(graph.input.channelCount, 16);
  assert.equal(graph.input.channelInterpretation, 'discrete');
  const splitter = targetsOf(graph.input)[0];
  assert.equal(splitter.outputs, 16);
  const mergers = ctx.nodes.filter((n) => n.kind === 'merger');
  assert.equal(mergers.length, 8);
  // orbit 3 → channels 4 and 5 → left and right of the third strip
  assert.deepEqual(
    splitter.connections.filter((c) => c.target === mergers[2]).map((c) => [c.output, c.input]),
    [
      [4, 0],
      [5, 1],
    ],
  );
  assert.equal(ctx.nodes.filter((n) => n.kind === 'biquad').length, 9 * EQ_BANDS.length, 'an EQ on every strip and the master');
  assert.equal(ctx.nodes.filter((n) => n.kind === 'analyser').length, 9);
  const reachesSpeakers = (node, seen = new Set()) => {
    if (node === ctx.speakers) return true;
    if (seen.has(node)) return false;
    seen.add(node);
    return node.connections.some((c) => reachesSpeakers(c.target, seen));
  };
  assert.ok(mergers.every((m) => reachesSpeakers(m)));
  const eq = ctx.nodes.filter((n) => n.kind === 'biquad').slice(0, 8);
  assert.deepEqual(
    eq.map((f) => [f.type, f.frequency.value]),
    EQ_BANDS.map((b) => [b.type, b.freq]),
  );
});

test('faders and EQ bands glide to their new settings', () => {
  const ctx = new FakeAudioContext();
  const graph = createMixerGraph(ctx);
  graph.set(2, { gain: 0.5, eq: [0, 3, 0, 0, 0, 0, 0, -6] });
  graph.set('master', { gain: 0.8 });
  graph.set(99, { gain: 0 });
  const gains = ctx.nodes.filter((n) => n.kind === 'gain');
  const bassFader = gains.find((g) => g.gain.value === 0.5);
  assert.deepEqual(bassFader.gain.events, [['target', 0.5, 10, 0.015]]);
  assert.ok(gains.some((g) => g.gain.value === 0.8));
  const bassEq = ctx.nodes.filter((n) => n.kind === 'biquad').slice(8, 16);
  assert.equal(bassEq[1].gain.value, 3);
  assert.equal(bassEq[7].gain.value, -6);
  assert.equal(graph.sampleRate, 48000);
});

test('every strip has an analyser, and the master can fade around a jump', () => {
  const ctx = new FakeAudioContext();
  const speakers = { connections: [] };
  const graph = createMixerGraph(ctx, speakers);
  assert.equal(graph.analyser(1).kind, 'analyser');
  assert.notEqual(graph.analyser(1), graph.analyser('master'));
  assert.equal(graph.analyser(42), null);
  const fade = ctx.nodes.find((n) => targetsOf(n).includes(speakers));
  graph.fadeOut();
  assert.equal(fade.gain.value, 0);
  assert.deepEqual(fade.gain.events[0], ['cancel', 10]);
  graph.fadeIn(0.15);
  assert.equal(fade.gain.value, 1);
  assert.deepEqual(fade.gain.events.at(-1), ['target', 1, 10.15, 0.01]);
  graph.fadeIn();
  assert.deepEqual(fade.gain.events.at(-1), ['target', 1, 10, 0.01]);
});
