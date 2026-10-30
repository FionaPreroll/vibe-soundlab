import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SAMPLE_MAPS, STRUDEL_URL, STRUDEL_VERSION, createEngine } from '../src/engine.js';

// A stand-in for the @strudel/web module.
function fakeStrudel({ failEval = null, noPattern = false, failInit = 0 } = {}) {
  const calls = { samples: [], evaluate: [], hush: 0, resume: 0, init: 0, resets: 0, voices: [] };
  let options;
  // Only the parts of Strudel's Cyclist that seeking touches.
  const scheduler = { time: 12.5, lastEnd: 13, num_ticks_since_cps_change: 40, now: () => scheduler.time };
  const mod = {
    calls,
    scheduler,
    async initStrudel(opts) {
      calls.init++;
      if (calls.init <= failInit) throw new Error('offline');
      options = opts;
      await opts.prebake();
      return { scheduler };
    },
    samples: async (map) => calls.samples.push(map),
    getAudioContext: () => ({ currentTime: 3, resume: async () => calls.resume++ }),
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
  for (const name of ['@strudel/core', '@strudel/mini', '@strudel/tonal', '@strudel/transpiler', 'superdough']) assert.equal(pkg.devDependencies[name], STRUDEL_VERSION, name);
  assert.ok(STRUDEL_URL.includes(`@strudel/web@${STRUDEL_VERSION}/`));
});

test('init loads Strudel once and registers the default sample sets', async () => {
  const strudel = fakeStrudel();
  let loads = 0;
  const engine = createEngine({ load: async () => (loads++, strudel) });
  await Promise.all([engine.init(), engine.init()]);
  assert.equal(loads, 1);
  assert.deepEqual(strudel.calls.samples, SAMPLE_MAPS);
});

test('play evaluates the code, stop hushes it', async () => {
  const strudel = fakeStrudel();
  const engine = createEngine({ load: async () => strudel });
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

test('errors Strudel reports during evaluation are thrown', async () => {
  const engine = createEngine({ load: async () => fakeStrudel({ failEval: new Error('note is not defined') }) });
  await assert.rejects(engine.play('nope()'), /note is not defined/);
  assert.equal(engine.isPlaying(), false);
});

test('code that yields no pattern is an error', async () => {
  const engine = createEngine({ load: async () => fakeStrudel({ noPattern: true }) });
  await assert.rejects(engine.play('// nothing'), /did not produce a pattern/);
});

test('a failed load can be retried', async () => {
  const strudel = fakeStrudel({ failInit: 1 });
  const engine = createEngine({ load: async () => strudel });
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
  const engine = createEngine({ load: async () => strudel });
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
  const engine = createEngine({ load: async () => strudel });
  strudel.evaluate = async () => undefined;
  await assert.rejects(engine.play('bad'));
  strudel.evaluate = async () => ({ pattern: true });
  await engine.play('good');
  assert.equal(engine.isPlaying(), true);
});

test('seek jumps to a bar and cuts what was still ringing', async () => {
  const strudel = fakeStrudel();
  const engine = createEngine({ load: async () => strudel });
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
  const engine = createEngine({ load: async () => strudel });
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
  const engine = createEngine({ load: async () => strudel });
  await engine.play('s("bd")');
  assert.equal(engine.seek(8), false);
});
