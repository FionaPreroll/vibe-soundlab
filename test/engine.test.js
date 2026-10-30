import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SAMPLE_MAPS, SOUNDFONTS_URL, STRUDEL_URL, STRUDEL_VERSION, createEngine, hasStrip } from '../src/engine.js';
import { LOOP_GUARD, protectLoops } from '../src/guard.js';
import { BANK_ALIASES } from '../src/strudel-cc.js';
import { FakeAudioContext } from './support/fake-audio.js';

// A stand-in for @strudel/soundfonts.
const fonts = { registered: 0, registerSoundfonts: () => fonts.registered++ };
const loadSoundfonts = async () => fonts;

// A stand-in for the @strudel/web module.
function fakeStrudel({ failEval = null, noPattern = false, failInit = 0 } = {}) {
  const calls = { samples: [], evaluate: [], hush: 0, resume: 0, init: 0, resets: 0, voices: [], multiChannel: [], output: [], aliases: [], zzfx: 0 };
  class Pattern {}
  let options;
  const ctx = new FakeAudioContext();
  ctx.currentTime = 3;
  ctx.resume = async () => calls.resume++;
  // Only the parts of Strudel's Cyclist that seeking touches.
  const scheduler = { time: 12.5, lastEnd: 13, num_ticks_since_cps_change: 40, now: () => scheduler.time };
  const mod = {
    calls,
    scheduler,
    ctx,
    options: () => options,
    async initStrudel(opts) {
      calls.init++;
      if (calls.init <= failInit) throw new Error('offline');
      options = opts;
      await opts.prebake();
      return { scheduler };
    },
    samples: async (map) => calls.samples.push(map),
    registerZZFXSounds: async () => calls.zzfx++,
    // aliases only work for sounds that are loaded
    aliasBank: (map) => calls.aliases.push({ map, samplesLoaded: calls.samples.length }),
    Pattern,
    pure: (value) => ({ pure: value }),
    noteToMidi: () => 108,
    valueToMidi: () => 60,
    getAudioContext: () => ctx,
    setMultiChannelOrbits: (on) => calls.multiChannel.push(on),
    webaudioOutput: (...args) => calls.output.push(args),
    resetGlobalEffects: () => calls.resets++,
    superdough: async (value, t) => {
      calls.voices.push({ ...value, t });
      if (value.orbit === 2) throw new Error('voice failed');
    },
    async evaluate(code) {
      calls.evaluate.push(code);
      if (failEval) {
        options.onEvalError(failEval);
        return undefined;
      }
      return noPattern ? undefined : { pattern: true };
    },
    hush: () => calls.hush++,
  };
  return mod;
}

test('the browser loads the same Strudel version the tests use', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const name of ['@strudel/core', '@strudel/mini', '@strudel/tonal', '@strudel/transpiler', '@strudel/soundfonts', 'superdough']) assert.equal(pkg.devDependencies[name], STRUDEL_VERSION, name);
  assert.ok(STRUDEL_URL.includes(`@strudel/web@${STRUDEL_VERSION}/`));
  assert.ok(SOUNDFONTS_URL.includes(`@strudel/soundfonts@${STRUDEL_VERSION}/`));
});

test('the soundfonts get the same Strudel through the import map', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(map.imports, { '@strudel/core': './src/strudel-bridge.js', '@strudel/webaudio': './src/strudel-bridge.js', sfumato: './src/sfumato-stub.js' });
  assert.ok(html.indexOf('type="importmap"') < html.indexOf('type="module"'), 'the map comes before the first module');
  const bridge = readFileSync(new URL('../src/strudel-bridge.js', import.meta.url), 'utf8');
  assert.match(bridge, new RegExp(`^export \\* from '${STRUDEL_URL.replaceAll('.', '\\.')}';$`, 'm'));
});

test('init loads Strudel once and registers the default sample sets', async () => {
  const strudel = fakeStrudel();
  let loads = 0;
  const engine = createEngine({ loadSoundfonts, load: async () => (loads++, strudel) });
  await Promise.all([engine.init(), engine.init()]);
  assert.equal(loads, 1);
  assert.deepEqual(strudel.calls.samples, SAMPLE_MAPS);
  assert.equal(strudel.calls.zzfx, 1, 'the ZZFX synths');
  assert.equal(fonts.registered > 0, true, 'the General MIDI instruments');
  assert.deepEqual(strudel.calls.aliases, [{ map: BANK_ALIASES, samplesLoaded: SAMPLE_MAPS.length }], 'short bank names once the samples are in');
  assert.equal(typeof strudel.Pattern.prototype._pianoroll, 'function', 'and the strudel.cc extras');
});

test('without the soundfonts, everything else still loads', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const strudel = fakeStrudel();
  const engine = createEngine({ loadSoundfonts: async () => Promise.reject(new Error('blocked')), load: async () => strudel });
  await engine.play('s("bd")');
  assert.equal(engine.isPlaying(), true);
  assert.equal(strudel.calls.aliases.length, 1);
  assert.match(warn.mock.calls[0].arguments.join(' '), /without the General MIDI instruments: blocked/);
});

test('every song starts from Strudel as it was loaded', async () => {
  const strudel = fakeStrudel();
  const engine = createEngine({ loadSoundfonts, load: async () => strudel });
  await engine.init();
  const piano = strudel.Pattern.prototype.piano;
  // what a song may do: replace a built-in, add a method, replace a global
  strudel.Pattern.prototype.piano = () => 'replaced';
  strudel.Pattern.prototype.mine = () => 'mine';
  globalThis.samples = 'replaced';
  try {
    await engine.play('register("piano", …)');
    assert.equal(strudel.Pattern.prototype.piano, piano);
    assert.equal('mine' in strudel.Pattern.prototype, false);
    assert.equal(globalThis.samples, undefined, 'as it was once Strudel had loaded');
  } finally {
    delete globalThis.samples;
  }
});

test('play evaluates the code, stop hushes it', async () => {
  const strudel = fakeStrudel();
  const engine = createEngine({ loadSoundfonts, load: async () => strudel });
  assert.equal(engine.position(), null);
  engine.stop();
  await engine.play('s("bd")');
  assert.deepEqual(strudel.calls.evaluate, ['s("bd")']);
  assert.equal(strudel.calls.resume, 1);
  assert.equal(engine.isPlaying(), true);
  assert.equal(engine.position(), 12.5);
  await engine.play('s("sd")');
  assert.equal(strudel.calls.hush, 1, 'switching tracks restarts the clock');
  engine.stop();
  assert.equal(strudel.calls.hush, 2);
  assert.equal(engine.isPlaying(), false);
  assert.equal(engine.position(), null);
});

test('tells the visuals when a track runs, plays and stops', async () => {
  const events = [];
  const visuals = { beforeRun: () => events.push('run'), afterRun: () => events.push('play'), stop: () => events.push('stop') };
  const engine = createEngine({ loadSoundfonts, load: async () => fakeStrudel(), visuals });
  await engine.play('s("bd")');
  assert.deepEqual(events, ['run', 'play']);
  engine.stop();
  assert.deepEqual(events, ['run', 'play', 'stop']);
  const failing = createEngine({ loadSoundfonts, load: async () => fakeStrudel({ failEval: new Error('typo') }), visuals });
  await assert.rejects(failing.play('s("bd"'), /typo/);
  assert.deepEqual(events.slice(3), ['run', 'stop'], 'code that fails shows no visuals');
});

test('errors Strudel reports during evaluation are thrown', async () => {
  const engine = createEngine({ loadSoundfonts, load: async () => fakeStrudel({ failEval: new Error('note is not defined') }) });
  await assert.rejects(engine.play('nope()'), /note is not defined/);
  assert.equal(engine.isPlaying(), false);
});

test('code that yields no pattern is an error', async () => {
  const engine = createEngine({ loadSoundfonts, load: async () => fakeStrudel({ noPattern: true }) });
  await assert.rejects(engine.play('// nothing'), /did not produce a pattern/);
});

test('a failed load can be retried', async () => {
  const strudel = fakeStrudel({ failInit: 1 });
  const engine = createEngine({ loadSoundfonts, load: async () => strudel });
  await assert.rejects(engine.init(), /offline/);
  await engine.init();
  assert.equal(strudel.calls.init, 2);
});

test('plays requested back to back run one after another', async () => {
  const strudel = fakeStrudel();
  const order = [];
  let release;
  const gate = new Promise((r) => (release = r));
  strudel.evaluate = async (code) => {
    order.push(`start ${code}`);
    if (code === 'a') await gate;
    order.push(`end ${code}`);
    return { pattern: true };
  };
  const engine = createEngine({ loadSoundfonts, load: async () => strudel });
  const a = engine.play('a');
  const b = engine.play('b');
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(order, ['start a']);
  release();
  await Promise.all([a, b]);
  assert.deepEqual(order, ['start a', 'end a', 'start b', 'end b']);
});

test('a failed play does not block the next one', async () => {
  const strudel = fakeStrudel();
  const engine = createEngine({ loadSoundfonts, load: async () => strudel });
  strudel.evaluate = async () => undefined;
  await assert.rejects(engine.play('bad'));
  strudel.evaluate = async () => ({ pattern: true });
  await engine.play('good');
  assert.equal(engine.isPlaying(), true);
});

test('seek jumps to a bar and cuts what was still ringing', async () => {
  const strudel = fakeStrudel();
  const engine = createEngine({ loadSoundfonts, load: async () => strudel, createGraph: null });
  assert.equal(engine.seek(10), false, 'nothing to seek while stopped');
  await engine.play('s("bd")');
  assert.equal(engine.seek(40.7), true);
  assert.equal(strudel.scheduler.lastEnd, 40, 'whole bars only');
  assert.equal(strudel.scheduler.num_ticks_since_cps_change, 0);
  assert.equal(strudel.calls.resets, 1);
  assert.deepEqual(
    strudel.calls.voices.map((v) => v.orbit),
    [1, 2, 3, 4, 5, 6, 7, 8],
    'every orbit exists again before the first kick ducks one',
  );
  assert.ok(strudel.calls.voices.every((v) => v.gain === 0 && v.t > 3));

  // The scheduler has not caught up yet: the position stays on the target bar.
  assert.equal(engine.position(), 40);
  strudel.scheduler.num_ticks_since_cps_change = 1;
  strudel.scheduler.time = 39.95;
  assert.equal(engine.position(), 40, 'latency puts the clock slightly behind at first');
  strudel.scheduler.time = 40.2;
  assert.equal(engine.position(), 40.2);
  strudel.scheduler.time = 40.4;
  assert.equal(engine.position(), 40.4);

  engine.seek(-5);
  assert.equal(strudel.scheduler.lastEnd, 0);
  engine.stop();
  assert.equal(engine.position(), null);
});

test('play can start from a later bar', async () => {
  const strudel = fakeStrudel();
  const engine = createEngine({ loadSoundfonts, load: async () => strudel, createGraph: null });
  await engine.play('s("bd")', { from: 24 });
  assert.equal(strudel.scheduler.lastEnd, 24);
  assert.equal(engine.position(), 24);
  await engine.play('s("sd")');
  assert.equal(strudel.calls.resets, 1, 'from bar 1, nothing to jump');
  assert.equal(engine.position(), 12.5);
});

test('seek needs a scheduler it knows', async () => {
  const strudel = fakeStrudel();
  strudel.initStrudel = async (opts) => {
    await opts.prebake();
    return { scheduler: { now: () => 1 } };
  };
  const engine = createEngine({ loadSoundfonts, load: async () => strudel });
  await engine.play('s("bd")');
  assert.equal(engine.seek(8), false);
});

test('the mixer sits between Strudel and the speakers', async () => {
  const strudel = fakeStrudel();
  const speakers = strudel.ctx.destination;
  const engine = createEngine({ loadSoundfonts, load: async () => strudel });
  assert.equal(engine.mixer(), null, 'no mixer before the first play');
  await engine.play('s("bd")');
  const graph = engine.mixer();
  assert.ok(graph);
  assert.equal(strudel.ctx.destination, graph.input, 'Strudel now sends to the mixer');
  assert.equal(strudel.calls.resets, 1, 'and rebuilds its output to pick that up');
  const fade = strudel.ctx.nodes.find((n) => n.connections.some((c) => c.target === speakers));
  assert.ok(fade, 'the mixer feeds the real speakers');
  await engine.play('s("sd")');
  assert.equal(engine.mixer(), graph, 'built once');

  // Every note first switches Strudel to one channel pair per orbit.
  const hap = { value: { s: 'bd', orbit: 2 } };
  strudel.options().defaultOutput(hap, 0.1, 0.2, 0.5, 4);
  assert.deepEqual(strudel.calls.multiChannel, [true]);
  assert.deepEqual(strudel.calls.output, [[hap, 0.1, 0.2, 0.5, 4]]);
  // An orbit without a strip plays on the first pair, as without the mixer.
  strudel.options().defaultOutput({ value: { s: 'bd', orbit: 0.5 } });
  assert.deepEqual(strudel.calls.multiChannel, [true, false]);
});

test('the mixer has strips for orbits 1 to 8', () => {
  for (const orbit of [undefined, null, 1, 5, 8]) assert.equal(hasStrip(orbit), true, String(orbit));
  for (const orbit of [0, 0.5, 9, 12, -1, '2', NaN]) assert.equal(hasStrip(orbit), false, String(orbit));
});

test('without a mixer, Strudel plays straight to the speakers', async () => {
  const strudel = fakeStrudel();
  const engine = createEngine({ loadSoundfonts, load: async () => strudel, createGraph: null });
  await engine.play('s("bd")');
  assert.equal(engine.mixer(), null);
  assert.equal(strudel.options().defaultOutput, undefined);
  assert.equal(strudel.calls.resets, 0);
});

test('a mixer that fails to build leaves playback working', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const strudel = fakeStrudel();
  const engine = createEngine({
    loadSoundfonts,
    load: async () => strudel,
    createGraph: () => {
      throw new Error('no ChannelSplitterNode');
    },
  });
  await engine.play('s("bd")');
  assert.equal(engine.isPlaying(), true);
  assert.equal(engine.mixer(), null);
  assert.match(warn.mock.calls[0].arguments.join(' '), /without the mixer: no ChannelSplitterNode/);
  engine.seek(4);
  assert.equal(strudel.scheduler.lastEnd, 4, 'jumps at once without a fade');
  assert.deepEqual(strudel.calls.multiChannel, []);
});

test('with the mixer, a jump fades out first and back in after', async () => {
  const strudel = fakeStrudel();
  const waiting = [];
  const engine = createEngine({ loadSoundfonts, load: async () => strudel, later: (fn, ms) => waiting.push({ fn, ms }) });
  await engine.play('s("bd")');
  const fade = strudel.ctx.nodes.find((n) => n.connections.some((c) => c.target === strudel.ctx.speakers));
  engine.seek(32);
  assert.equal(fade.gain.value, 0, 'faded out');
  assert.equal(strudel.scheduler.lastEnd, 13, 'the jump waits for the fade');
  assert.equal(engine.position(), 32);
  assert.equal(waiting[0].ms, 25);
  waiting[0].fn();
  assert.equal(strudel.scheduler.lastEnd, 32);
  assert.equal(strudel.calls.resets, 2);
  assert.deepEqual(strudel.calls.multiChannel, [true], 'the orbits it creates get their own channels');
  assert.deepEqual(fade.gain.events.at(-1), ['target', 1, 3.15, 0.01]);

  // A jump still waiting when playback stops is dropped.
  engine.seek(64);
  engine.stop();
  waiting[1].fn();
  assert.equal(strudel.scheduler.lastEnd, 32);
  await engine.play('s("bd")');
  assert.equal(fade.gain.value, 1, 'the next play is not left faded out');
});

test('reports where in the code the sounding notes were written', async () => {
  const strudel = fakeStrudel();
  const hap = (begin, end, locations) => ({ whole: { begin, end }, context: { locations } });
  let broken = false;
  strudel.evaluate = async () => ({
    queryArc: (from, to) => {
      if (broken) throw new Error('bad pattern');
      assert.equal(from, 12.5);
      assert.equal(to, 12.5);
      return [
        hap(12, 13, [{ start: 1, end: 3 }]),
        hap(12.5, 12.75, [{ start: 5, end: 6 }, { start: 8, end: 9 }]),
        hap(11, 12.5, [{ start: 20, end: 21 }]),
        { whole: undefined, context: { locations: [{ start: 30, end: 31 }] } },
        hap(12, 14, undefined),
        { whole: { begin: 12, end: 13 } },
      ];
    },
  });
  const engine = createEngine({ loadSoundfonts, load: async () => strudel, createGraph: null });
  assert.deepEqual(engine.activeLocations(), []);
  await engine.play('note("c e g")');
  assert.deepEqual(engine.activeLocations(), [
    { start: 1, end: 3 },
    { start: 5, end: 6 },
    { start: 8, end: 9 },
  ]);
  broken = true;
  assert.deepEqual(engine.activeLocations(), [], 'a pattern that fails to query marks nothing');
  engine.stop();
  assert.deepEqual(engine.activeLocations(), []);
});

// Patterns as the guard sees them: query(state) and queryArc(begin, end).
function fakePattern(make) {
  const pattern = {
    query: (state) => make(Number(state.span.begin), Number(state.span.end)),
    queryArc: (begin, end) => pattern.query({ span: { begin, end } }),
  };
  return pattern;
}

/**
 * A note every `step` bars (every `then` bars from bar `from` on), each marking
 * `locations`. Asked for a moment, it gives the note sounding then.
 */
function notesEvery(step, { from = Infinity, then = step, locations = [] } = {}) {
  return fakePattern((begin, end) => {
    const haps = [];
    for (let t = Math.floor(begin / step) * step; (t < end || t === begin) && haps.length < 1e6; t += t >= from ? then : step) {
      const length = t >= from ? then : step;
      if (t + length <= begin) continue;
      haps.push({ value: { note: 'c3' }, whole: { begin: t, end: t + length }, part: { begin: t, end: t + length }, hasOnset: () => t >= begin, context: { locations } });
    }
    return haps;
  });
}

/**
 * A stand-in for Strudel that, like the real one, checks code with its transpiler and
 * hands every pattern to editPattern before playing it. `programs` maps code to patterns.
 */
function liveStrudel(programs = {}) {
  const strudel = fakeStrudel();
  strudel.calls.transpiled = [];
  strudel.calls.setPattern = [];
  strudel.scheduler.cps = 0.5;
  strudel.scheduler.setPattern = (pattern) => {
    strudel.calls.setPattern.push(pattern);
    strudel.scheduler.pattern = pattern;
  };
  strudel.Pattern = class {
    constructor(query) {
      this.query = query;
    }
    queryArc(begin, end) {
      return this.query({ span: { begin, end } });
    }
  };
  strudel.transpiler = (code) => {
    strudel.calls.transpiled.push(code);
    if (code.includes('OOPS')) {
      const err = new SyntaxError('Unexpected token (2:3)');
      err.pos = code.indexOf('OOPS');
      throw err;
    }
    if (code.includes('[bad')) throw new Error('[mini] parse error at line 1: Expected "]" but "\\"" found.');
  };
  strudel.mini = (text) => {
    if (text.includes('[bad')) throw new Error('mini');
  };
  strudel.evaluate = async (code) => {
    strudel.calls.evaluate.push(code);
    const options = strudel.options();
    try {
      if (code.includes('THROW')) throw new ReferenceError('nope is not defined');
      const pattern = programs[code] ?? notesEvery(1 / 4);
      const played = options.editPattern(pattern);
      strudel.scheduler.pattern = played;
      return played;
    } catch (err) {
      options.onEvalError(err);
      return undefined;
    }
  };
  return strudel;
}

function liveEngine(programs, options = {}) {
  const strudel = liveStrudel(programs);
  const errors = [];
  const visuals = { events: [] };
  for (const name of ['beforeRun', 'afterRun', 'failedRun', 'stop']) visuals[name] = (arg) => visuals.events.push(arg ? `${name} ${JSON.stringify(arg)}` : name);
  const engine = createEngine({
    loadSoundfonts,
    load: async () => strudel,
    createGraph: null,
    later: (fn) => fn(),
    visuals,
    onPlaybackError: (err, info) => errors.push({ message: err.message, ...info }),
    ...options,
  });
  return { strudel, engine, errors, visuals };
}

test('changed code takes over while a track plays, without starting it again', async () => {
  const { strudel, engine, visuals } = liveEngine();
  await engine.play('a');
  const version = engine.version();
  assert.equal(engine.playingCode(), 'a');
  await engine.update('b');
  assert.deepEqual(strudel.calls.evaluate, ['a', 'b']);
  assert.equal(strudel.calls.hush, 0, 'no restart: the music keeps its place');
  assert.equal(engine.playingCode(), 'b');
  assert.equal(engine.version(), version + 1);
  assert.deepEqual(visuals.events, ['beforeRun', 'afterRun', 'beforeRun {"fresh":false}', 'afterRun']);
  engine.stop();
  assert.equal(engine.playingCode(), null);
  await engine.update('c');
  assert.equal(engine.playingCode(), 'c', 'with nothing playing, it plays');
});

test('a syntax error in changed code changes nothing and says where it is', async () => {
  const { strudel, engine, visuals } = liveEngine();
  await engine.play('a');
  const err = await engine.update('x\n  OOPS').catch((e) => e);
  assert.match(err.message, /Unexpected token/);
  assert.deepEqual(err.location, { position: 4, line: 2, column: 3 });
  assert.deepEqual(strudel.calls.evaluate, ['a'], 'nothing ran');
  assert.equal(engine.playingCode(), 'a');
  assert.deepEqual(visuals.events, ['beforeRun', 'afterRun'], 'the visuals carry on');
  const mini = await engine.update('s("bd")\ns("[bad")').catch((e) => e);
  assert.deepEqual(mini.location, { position: 10, line: 2, column: 3 }, 'mini-notation errors get their string');
  assert.equal(engine.isPlaying(), true);
});

test('a syntax error when starting a track stops what played', async () => {
  const { engine } = liveEngine();
  await engine.play('a');
  const err = await engine.play('OOPS').catch((e) => e);
  assert.equal(err.location.line, 1);
  assert.equal(engine.isPlaying(), false);
});

test('changed code that fails while it runs leaves the version before it playing', async () => {
  const { engine, visuals } = liveEngine();
  await engine.play('a');
  await assert.rejects(engine.update('THROW'), /nope is not defined/);
  assert.equal(engine.playingCode(), 'a');
  assert.equal(visuals.events.at(-1), 'failedRun');
});

test('loops get a check, and the notes are still marked where they were written', async () => {
  const code = 'while (go()) step()\nnote("c3")';
  const checked = protectLoops(code);
  const at = checked.code.indexOf('c3');
  const { strudel, engine } = liveEngine({ [checked.code]: notesEvery(1, { locations: [{ start: at, end: at + 2 }] }) });
  await engine.play(code);
  assert.equal(strudel.calls.evaluate[0], checked.code);
  assert.deepEqual(engine.activeLocations(), [{ start: code.indexOf('c3'), end: code.indexOf('c3') + 2 }]);
  assert.equal(engine.playingCode(), code, 'the code as written');
});

test('code the loop check would confuse runs as written', async () => {
  const { strudel, engine } = liveEngine();
  const transpile = strudel.transpiler;
  strudel.transpiler = (code) => {
    if (code.includes(LOOP_GUARD)) throw new SyntaxError('confused');
    return transpile(code);
  };
  await engine.play('while (x) y()');
  assert.equal(strudel.calls.evaluate[0], 'while (x) y()');
});

test('far too many notes are refused before they play; what played plays on', async () => {
  const { strudel, engine } = liveEngine({ flood: notesEvery(1 / 100000) });
  await engine.play('a');
  await assert.rejects(engine.update('flood'), /far more than can be played/);
  assert.equal(engine.playingCode(), 'a');
  assert.equal(strudel.scheduler.pattern.queryArc(0, 1).length, 4, 'the guarded pattern before it still plays');
  await assert.rejects(engine.play('flood'), /far more than can be played/);
  assert.equal(engine.isPlaying(), false);
});

test('a change that floods later goes back to the version before it', async () => {
  const { strudel, engine, errors } = liveEngine({ late: notesEvery(1 / 4, { from: 20, then: 1 / 100000 }) });
  await engine.play('a');
  const before = strudel.scheduler.pattern;
  await engine.update('late');
  const version = engine.version();
  assert.equal(strudel.scheduler.pattern.queryArc(0, 1).length, 4);
  assert.deepEqual(strudel.scheduler.pattern.queryArc(20, 20.1), [], 'the flood is never played');
  assert.equal(strudel.calls.setPattern.at(-1), before, 'the version before plays again');
  assert.equal(engine.playingCode(), 'a');
  assert.equal(engine.version(), version + 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].reverted, true);
  assert.equal(errors[0].code, 'a');
  assert.match(errors[0].message, /far more than can be played/);
});

test('a track that floods later stops', async () => {
  const { strudel, engine, errors } = liveEngine({ late: notesEvery(1 / 4, { from: 20, then: 1 / 100000 }) });
  await engine.play('late');
  strudel.scheduler.pattern.queryArc(20, 20.1);
  assert.equal(engine.isPlaying(), false);
  assert.equal(errors[0].stopped, true);
  strudel.scheduler.pattern.queryArc(20, 20.1);
  assert.equal(errors.length, 1, 'once');
});

test('errors while a track plays are reported; a change that throws is undone', async () => {
  const broken = fakePattern((begin) => {
    if (begin >= 20) throw new Error('v.nope is undefined');
    return [];
  });
  const { strudel, engine, errors } = liveEngine({ broken, early: fakePattern(() => { throw new Error('at once'); }) });
  await assert.rejects(engine.play('early'), /at once/, 'an error right where it starts: it does not play');
  await engine.play('broken');
  strudel.scheduler.pattern.queryArc(20, 20.1);
  strudel.scheduler.pattern.queryArc(20.1, 20.2);
  assert.deepEqual(errors, [{ message: 'v.nope is undefined' }]);
  assert.equal(engine.isPlaying(), true, 'the rest of the track plays');
  await engine.play('a');
  await engine.update('broken');
  strudel.scheduler.pattern.queryArc(20, 20.1);
  assert.equal(errors[1].reverted, true);
  assert.equal(engine.playingCode(), 'a');
  // an error from a pattern no longer playing is old news
  const old = strudel.calls.setPattern.length;
  engine.stop();
  assert.equal(strudel.calls.setPattern.length, old);
});

test('stopped while changed code runs, it stays stopped', async () => {
  const { strudel, engine } = liveEngine();
  await engine.play('a');
  const evaluate = strudel.evaluate;
  let release;
  strudel.evaluate = async (code) => {
    await new Promise((r) => (release = r));
    return evaluate(code);
  };
  const update = engine.update('b');
  await new Promise((r) => setTimeout(r, 0));
  engine.stop();
  const hushes = strudel.calls.hush;
  release();
  await update;
  assert.equal(engine.isPlaying(), false);
  assert.equal(strudel.calls.hush, hushes + 1, 'Strudel started it anyway: silenced again');
  assert.equal(engine.playingCode(), null);
});

test('code still running after the time limit is given up on', async () => {
  const { strudel, engine } = liveEngine({}, { evalTimeout: 20 });
  const evaluate = strudel.evaluate;
  let release;
  strudel.evaluate = async (code) => {
    if (code === 'slow') await new Promise((r) => (release = r));
    return evaluate(code);
  };
  await assert.rejects(engine.play('slow'), /still running after 0.02 seconds/);
  assert.equal(engine.isPlaying(), false);
  await engine.play('a');
  const playing = strudel.scheduler.pattern;
  release();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(strudel.calls.setPattern.at(-1), playing, 'when it finishes after all, what plays is put back');
  engine.stop();
  const hushes = strudel.calls.hush;
  await assert.rejects(engine.update('slow'), /still running/);
  release();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(engine.isPlaying(), false);
  assert.ok(strudel.calls.hush > hushes, 'and with nothing playing, it is silenced');
});

test('the chords get the events of what plays', async () => {
  const broken = fakePattern((begin) => {
    if (begin >= 20) throw new Error('x');
    return [];
  });
  const { engine } = liveEngine({ broken });
  assert.deepEqual(engine.query(0, 1), []);
  await engine.play('a');
  assert.equal(engine.query(0, 1).length, 4);
  assert.equal(engine.query(0, 1)[0].value.note, 'c3');
  await engine.play('broken');
  assert.deepEqual(engine.query(20, 21), []);
});

test('the loop check is installed once Strudel has loaded', async () => {
  let installed = 0;
  const { engine } = liveEngine({}, { installGuard: () => (installed++, { touch() {} }) });
  await engine.init();
  assert.equal(installed, 1);
});
