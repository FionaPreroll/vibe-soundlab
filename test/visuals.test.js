// The Hydra visuals behind the player, with a stand-in for Hydra and a jsdom window.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { HYDRA_GLOBALS, HYDRA_URL, HYDRA_VERSION, createVisuals, inertHydra } from '../src/visuals.js';

// Records what the visuals ask of Hydra.
class FakeHydra {
  static made = [];
  constructor(options) {
    this.options = options;
    this.ticks = [];
    this.hushes = 0;
    this.sizes = [];
    FakeHydra.made.push(this);
  }
  tick(dt) {
    this.ticks.push(dt);
  }
  hush() {
    this.hushes++;
  }
  setResolution(width, height) {
    this.sizes.push([width, height]);
  }
}

let dom;
let win;
let canvas;
let frames; // animation frame callbacks waiting to run
let loads;

beforeEach(() => {
  dom = new JSDOM('<canvas></canvas>');
  win = dom.window;
  Object.assign(win, { innerWidth: 1280, innerHeight: 800 });
  canvas = win.document.querySelector('canvas');
  frames = new Map();
  let id = 0;
  win.requestAnimationFrame = (callback) => (frames.set(++id, callback), id);
  win.cancelAnimationFrame = (frame) => frames.delete(frame);
  FakeHydra.made = [];
  loads = 0;
});

const load = async () => (loads++, FakeHydra);
const runFrame = (time) => {
  const [[frame, callback]] = frames;
  frames.delete(frame);
  callback(time);
};

/** A track that starts visuals and plays. */
async function playTrackWithVisuals(visuals) {
  visuals.beforeRun();
  await visuals.initHydra();
  visuals.afterRun();
}

test('the pinned Hydra version is the one the tests check tracks against', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.devDependencies['hydra-synth'], HYDRA_VERSION);
  assert.ok(HYDRA_URL.includes(`hydra-synth@${HYDRA_VERSION}/`));
});

test('initHydra loads Hydra once, at half the window size, without its own loop or audio', async () => {
  const visuals = createVisuals({ canvas, load });
  await Promise.all([visuals.initHydra(), visuals.initHydra()]);
  assert.equal(loads, 1);
  assert.equal(FakeHydra.made.length, 1);
  const { options } = FakeHydra.made[0];
  assert.equal(options.canvas, canvas);
  assert.equal(options.width, 640);
  assert.equal(options.height, 400);
  assert.equal(options.makeGlobal, true, 'tracks call osc(), noise() … as globals, as on strudel.cc');
  assert.equal(options.autoLoop, false, 'the visuals run their own frame loop');
  assert.equal(options.detectAudio, false, 'no microphone prompt');
});

test('the visuals show only while a track that uses them plays', async () => {
  const visuals = createVisuals({ canvas, load });
  assert.equal(visuals.isShowing(), false);
  await playTrackWithVisuals(visuals);
  assert.equal(visuals.isShowing(), true);
  assert.equal(canvas.classList.contains('on'), true);
  assert.equal(frames.size, 1);
  visuals.stop();
  assert.equal(visuals.isShowing(), false);
  assert.equal(canvas.classList.contains('on'), false);
  assert.equal(frames.size, 0, 'no frames are drawn while stopped');
});

test('a track without visuals clears the ones before it', async () => {
  const visuals = createVisuals({ canvas, load });
  await playTrackWithVisuals(visuals);
  const [hydra] = FakeHydra.made;
  visuals.beforeRun();
  assert.equal(hydra.hushes, 1);
  visuals.afterRun();
  assert.equal(visuals.isShowing(), false);
  await playTrackWithVisuals(visuals);
  assert.equal(visuals.isShowing(), true);
  assert.equal(FakeHydra.made.length, 1, 'Hydra is reused');
});

test('the switch turns the visuals off and on', async () => {
  const visuals = createVisuals({ canvas, load });
  await playTrackWithVisuals(visuals);
  visuals.setEnabled(false);
  assert.equal(visuals.isEnabled(), false);
  assert.equal(visuals.isShowing(), false);
  assert.equal(canvas.classList.contains('on'), false);
  visuals.setEnabled(true);
  assert.equal(visuals.isEnabled(), true);
  assert.equal(visuals.isShowing(), true);
});

test('each frame advances Hydra by the time since the last one', async () => {
  const visuals = createVisuals({ canvas, load });
  await playTrackWithVisuals(visuals);
  const [hydra] = FakeHydra.made;
  runFrame(1000);
  runFrame(1020);
  runFrame(5000);
  assert.deepEqual(hydra.ticks, [16, 20, 100], 'the first frame and long pauses count as one short step');
  assert.equal(frames.size, 1, 'and asks for the next frame');
});

test('H reads a pattern at the position of the music', () => {
  let now = 1.5;
  const visuals = createVisuals({ canvas, load, now: () => now });
  const queried = [];
  const pattern = {
    queryArc(begin, end) {
      queried.push([begin, end]);
      return [{ value: begin * 2 }];
    },
  };
  const value = visuals.H(pattern);
  assert.equal(value(), 3);
  assert.deepEqual(queried, [[1.5, 1.5]]);
  now = null;
  assert.equal(value(), 0, 'nothing plays');
  now = 2;
  assert.equal(visuals.H({ queryArc: () => [] })(), 0, 'a gap in the pattern');
  assert.equal(visuals.H({ queryArc: () => [{ value: 'c4' }] })(), 0, 'not a number');
  assert.equal(visuals.H('fast')(), 0, 'not a pattern');
  assert.equal(visuals.H(0.7)(), 0.7, 'a plain number');
});

test('resizing the window resizes the visuals', async () => {
  const visuals = createVisuals({ canvas, load, scale: 0.25 });
  win.dispatchEvent(new win.Event('resize'));
  await visuals.initHydra();
  Object.assign(win, { innerWidth: 1000, innerHeight: 2 });
  win.dispatchEvent(new win.Event('resize'));
  assert.deepEqual(FakeHydra.made[0].sizes, [[250, 1]]);
});

test('when Hydra cannot start, tracks still run with stand-ins', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const visuals = createVisuals({
    canvas,
    load: async () => {
      throw new Error('offline');
    },
  });
  await playTrackWithVisuals(visuals);
  assert.match(warn.mock.calls[0].arguments.join(' '), /Hydra did not start: offline/);
  for (const name of HYDRA_GLOBALS) assert.equal(typeof win[name], 'function', name);
  assert.doesNotThrow(() => win.osc(10, 0.1).kaleid(4).modulate(win.noise(3), () => 1).out(win.o0));
  assert.equal(visuals.isShowing(), false);
  visuals.beforeRun();
});

test('every track that starts Hydra gets its functions back, after other songs put their own there', async () => {
  const noise = () => 'Hydra noise';
  class GlobalHydra extends FakeHydra {
    constructor(options) {
      super(options);
      this.synth = { noise, speed: 1 };
      Object.assign(options.canvas.ownerDocument.defaultView, this.synth);
    }
  }
  const visuals = createVisuals({ canvas, load: async () => GlobalHydra });
  await playTrackWithVisuals(visuals);
  Object.assign(win, { noise: 'Strudel noise', speed: 'Strudel speed' });
  await playTrackWithVisuals(visuals);
  assert.equal(win.noise, noise);
  assert.equal(win.speed, 1);
});

test('Hydra’s array helpers stay out of for…in, which Strudel runs all() with', async (t) => {
  class ArrayHydra extends FakeHydra {
    constructor(options) {
      super(options);
      Array.prototype.wobble = function wobble() {
        return this;
      };
    }
  }
  t.after(() => delete Array.prototype.wobble);
  await createVisuals({ canvas, load: async () => ArrayHydra }).initHydra();
  const keys = [];
  for (const key in ['a']) keys.push(key);
  assert.deepEqual(keys, ['0']);
  assert.equal(typeof [].wobble, 'function', 'Hydra still has them');
});

test('the stand-in accepts any chain and counts as zero', () => {
  const hydra = inertHydra();
  const chain = hydra(1).rotate(0.2).color(1, 0, 0).out();
  assert.equal(typeof chain, 'function');
  assert.equal(+hydra.speed, 0);
});
