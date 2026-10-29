import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SAMPLE_MAPS, STRUDEL_URL, STRUDEL_VERSION, createEngine } from '../src/engine.js';

// A stand-in for the @strudel/web module.
function fakeStrudel({ failEval = null, noPattern = false, failInit = 0 } = {}) {
  const calls = { samples: [], evaluate: [], hush: 0, resume: 0, init: 0 };
  let options;
  const mod = {
    calls,
    async initStrudel(opts) {
      calls.init++;
      if (calls.init <= failInit) throw new Error('offline');
      options = opts;
      await opts.prebake();
      return { scheduler: { now: () => 12.5 } };
    },
    samples: async (map) => calls.samples.push(map),
    getAudioContext: () => ({ resume: async () => calls.resume++ }),
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
