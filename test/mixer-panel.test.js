// Drives the mixer and EQ panels of the real page (index.html) in jsdom.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { STORAGE_KEY } from '../src/mixer.js';
import { CHANNEL_COLORS, createMixerPanel } from '../src/mixer-panel.js';
import { FakeAudioContext, fakeCanvasContext } from './support/fake-audio.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

class MemoryStorage {
  data = {};
  getItem(k) {
    return k in this.data ? this.data[k] : null;
  }
  setItem(k, v) {
    this.data[k] = String(v);
  }
}

function fakeGraph() {
  const ctx = new FakeAudioContext();
  const analysers = new Map();
  return {
    ctx,
    sets: [],
    sampleRate: 48000,
    set(target, settings) {
      this.sets.push([target, settings]);
    },
    analyser(target) {
      if (!analysers.has(target)) analysers.set(target, ctx.createAnalyser());
      return analysers.get(target);
    },
  };
}

let dom;
let doc;
let contexts;
beforeEach(() => {
  dom = new JSDOM(html, { url: 'https://example.test/' });
  doc = dom.window.document;
  contexts = new Map();
  dom.window.HTMLCanvasElement.prototype.getContext = function () {
    if (!contexts.has(this)) contexts.set(this, fakeCanvasContext());
    return contexts.get(this);
  };
});

const $ = (sel) => doc.querySelector(sel);
const $$ = (sel) => [...doc.querySelectorAll(sel)];
const click = (node) => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const fire = (node, type) => node.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
const strip = (target) => $(`.strip[data-target="${target}"]`);
const lastSet = (graph, target) => graph.sets.filter((s) => s[0] === target).at(-1)?.[1];

function start({ storage = new MemoryStorage(), graph = null, playing = true } = {}) {
  const engine = { graph, playing, mixer: () => engine.graph, isPlaying: () => engine.playing };
  const panel = createMixerPanel({ mixerRoot: $('[data-role=mixer]'), eqRoot: $('[data-role=eq]'), engine, storage });
  return { panel, engine, storage };
}

test('a strip for every orbit and the master, eight EQ bands', () => {
  start();
  assert.deepEqual(
    $$('.strip .name').map((n) => n.textContent),
    ['Drums', 'Bass', 'Pad', 'Snare', 'Stabs', 'Leads', 'FX', 'Orbit 8', 'Master'],
  );
  assert.equal(strip(2).style.getPropertyValue('--strip'), CHANNEL_COLORS[2]);
  assert.equal($$('.strip .mute').length, 8, 'the master has no mute or solo');
  assert.deepEqual(
    $$('[data-role=eq-target] option').map((o) => o.textContent),
    ['Master', 'Drums', 'Bass', 'Pad', 'Snare', 'Stabs', 'Leads', 'FX', 'Orbit 8'],
  );
  assert.deepEqual(
    $$('.eq-band .freq').map((n) => n.textContent),
    ['40', '100', '250', '600', '1.5k', '3.5k', '8k', '14k'],
  );
  assert.equal($('[data-role=mix-reset]').disabled, true, 'nothing to reset yet');
  assert.equal($('[data-role=eq-flat]').disabled, true);
  assert.equal(strip('master').querySelector('.name').getAttribute('aria-pressed'), 'true', 'the EQ starts on the master');
});

test('faders set the channel level and are remembered', () => {
  const { storage } = start({ graph: fakeGraph() });
  const fader = strip(2).querySelector('.fader');
  assert.equal(fader.getAttribute('aria-label'), 'Bass volume');
  fader.value = '-6';
  fire(fader, 'input');
  assert.equal(strip(2).querySelector('output').textContent, '−6.0');
  assert.equal(JSON.parse(storage.data[STORAGE_KEY]).channels[2].gain, -6);
  assert.equal($('[data-role=mix-reset]').disabled, false);
  fire(fader, 'dblclick');
  assert.equal(fader.value, '0');
  fader.value = '-40';
  fire(fader, 'input');
  assert.equal(strip(2).querySelector('output').textContent, 'off');
  click($('[data-role=mix-reset]'));
  assert.equal(fader.value, '0');
  assert.equal($('[data-role=mix-reset]').disabled, true);
});

test('settings reach the audio graph as soon as it exists', () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({ channels: { 3: { gain: -6 } }, master: { gain: 3, eq: [2] } }));
  const { panel, engine } = start({ storage });
  assert.equal(strip(3).querySelector('.fader').value, '-6', 'restored before any audio');
  const graph = fakeGraph();
  engine.graph = graph;
  panel.draw(1000);
  assert.ok(Math.abs(lastSet(graph, 3).gain - 0.501) < 0.001);
  assert.equal(lastSet(graph, 1).gain, 1);
  assert.deepEqual(lastSet(graph, 'master').eq, [2, 0, 0, 0, 0, 0, 0, 0]);
  const before = graph.sets.length;
  panel.draw(1010);
  panel.draw(1100);
  assert.equal(graph.sets.length, before, 'only once per graph');
});

test('mute and solo', () => {
  const graph = fakeGraph();
  start({ graph });
  const mute = strip(1).querySelector('.mute');
  click(mute);
  assert.equal(mute.getAttribute('aria-pressed'), 'true');
  assert.equal(lastSet(graph, 1).gain, 0);
  assert.ok(strip(1).classList.contains('silent'));
  click(strip(2).querySelector('.solo'));
  assert.equal(lastSet(graph, 2).gain, 1);
  assert.equal(lastSet(graph, 3).gain, 0, 'everything else goes quiet');
  assert.ok(strip(3).classList.contains('silent'));
  click(strip(2).querySelector('.solo'));
  click(mute);
  assert.equal(lastSet(graph, 3).gain, 1);
  assert.ok(!strip(1).classList.contains('silent'));
});

test('the EQ edits the channel picked in the mixer or the menu', () => {
  const graph = fakeGraph();
  const { panel } = start({ graph });
  click(strip(3).querySelector('.name'));
  assert.equal($('[data-role=eq-target]').value, '3');
  assert.equal(panel.eqTarget(), 3);
  assert.equal(strip(3).querySelector('.name').getAttribute('aria-pressed'), 'true');
  const bands = $$('.eq-band .band');
  assert.equal(bands[1].getAttribute('aria-label'), '100 Hz');
  bands[1].value = '-4.5';
  fire(bands[1], 'input');
  assert.deepEqual(lastSet(graph, 3).eq, [0, -4.5, 0, 0, 0, 0, 0, 0]);
  assert.equal($$('.eq-band output')[1].textContent, '−4.5');
  bands[6].value = '3';
  fire(bands[6], 'input');
  assert.equal($$('.eq-band output')[6].textContent, '+3');
  assert.equal($('[data-role=eq-flat]').disabled, false);
  fire(bands[6], 'dblclick');
  assert.equal(panel.settings().channels[3].eq[6], 0);

  const select = $('[data-role=eq-target]');
  select.value = 'master';
  fire(select, 'change');
  assert.equal(bands[1].value, '0', 'the master has its own EQ');
  select.value = '3';
  fire(select, 'change');
  assert.equal(bands[1].value, '-4.5');
  click($('[data-role=eq-flat]'));
  assert.deepEqual(panel.settings().channels[3].eq, [0, 0, 0, 0, 0, 0, 0, 0]);
});

test('meters and the EQ view draw what the analysers hear', () => {
  const graph = fakeGraph();
  const { panel, engine } = start({ graph });
  panel.draw(0);
  const drums = contexts.get(strip(1).querySelector('canvas'));
  const eqView = contexts.get($('[data-role=eq-view]'));
  assert.ok(drums.count('fillRect') > 3, 'bars and a level');
  assert.equal(eqView.count('fill'), 1, 'the spectrum of the master');
  panel.draw(10);
  assert.equal(drums.count('clearRect'), 1, 'at most 30 frames a second');
  engine.playing = false;
  panel.draw(100);
  assert.equal(eqView.count('fill'), 1, 'no spectrum while stopped');
  assert.equal($('[data-role=eq-view]').width, 640, 'sized to the canvas when it has no layout');
});

test('works without storage, a canvas context or audio', () => {
  const storage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  const { panel } = start({ storage });
  const fader = strip(4).querySelector('.fader');
  fader.value = '2';
  fire(fader, 'input');
  assert.equal(panel.settings().channels[4].gain, 2);
  panel.draw(0);
  start({ storage: null });
});
