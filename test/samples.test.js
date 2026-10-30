// Sample sets from other sites: a song plays on without the ones that don't load.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { SAMPLES_TIMEOUT_MS, describeSkipped, diagnose, forgivingSamples, sampleSite } from '../src/samples.js';

const answer = (status) => async () => ({ ok: status >= 200 && status < 300, status });
const unreachable = async () => {
  throw new TypeError('Failed to fetch');
};
const never = () => new Promise(() => {});

// Strudel's samples(): it throws this when it can't fetch or read a sample list.
const failingSamples = (url) => async () => {
  throw new Error(`error loading "${url}"`);
};

test("Strudel's error still names the address it could not load", () => {
  // superdough is the part of @strudel/web that loads samples, in the same pinned version
  const sampler = readFileSync(createRequire(import.meta.url).resolve('superdough/sampler.mjs'), 'utf8');
  assert.match(sampler, /throw new Error\(`error loading "\$\{url\}"`\)/);
});

test('sample sets are named by the site they come from', () => {
  assert.equal(sampleSite('https://tij.men/strudel/strudel.json'), 'tij.men');
  assert.equal(sampleSite('http://localhost:5432/x.json'), 'localhost:5432');
  assert.equal(sampleSite('github:tidalcycles/dirt-samples'), 'github.com/tidalcycles/dirt-samples');
  assert.equal(sampleSite('github:tidalcycles/Dirt-Samples/master/'), 'github.com/tidalcycles/Dirt-Samples');
  assert.equal(sampleSite('github:someone'), 'github.com/someone/samples', "Strudel's default repository name");
  assert.equal(sampleSite('bubo:waveforms'), 'github.com/Bubobubobubobubo/dough-waveforms');
  assert.equal(sampleSite('shabda:noise,chimp:2'), 'shabda.ndre.gr');
  assert.equal(sampleSite('shabda/speech/fr-FR/f:chocolat'), 'shabda.ndre.gr');
  assert.equal(sampleSite('local:'), 'local:');
  assert.equal(sampleSite('my samples'), 'my samples');
});

test('asking again tells a site that does not answer from an error page or a wrong file', async () => {
  const url = 'https://tij.men/strudel/strudel.json';
  assert.deepEqual(await diagnose(url, { fetchFn: unreachable }), { reason: 'unreachable' });
  assert.deepEqual(await diagnose(url, { fetchFn: answer(404) }), { reason: 'status', status: 404 });
  assert.deepEqual(await diagnose(url, { fetchFn: answer(200) }), { reason: 'format' });
  assert.deepEqual(await diagnose(url, { fetchFn: never, timeout: 5 }), { reason: 'late', seconds: 0.005 });
  const thrown = () => {
    throw new TypeError('bad url');
  };
  assert.deepEqual(await diagnose(url, { fetchFn: thrown }), { reason: 'unreachable' });
});

test('only web addresses are asked again', async () => {
  let asked = 0;
  const fetchFn = async () => (asked++, { ok: true });
  assert.equal(await diagnose('local:', { fetchFn }), null);
  assert.equal(await diagnose(undefined, { fetchFn }), null);
  assert.equal(asked, 0);
});

test('a sample list that loads is loaded as Strudel loads it', async () => {
  const calls = [];
  const samples = async (...args) => (calls.push(args), 'loaded');
  const skipped = [];
  const forgiving = forgivingSamples(samples, { onSkip: (s) => skipped.push(s), fetchFn: unreachable });
  assert.equal(await forgiving('https://tij.men/strudel/strudel.json', 'https://base/', { tag: 'x' }), 'loaded');
  assert.deepEqual(calls, [['https://tij.men/strudel/strudel.json', 'https://base/', { tag: 'x' }]]);
  assert.deepEqual(skipped, []);
});

test('a sample list that does not load is left out and reported, with why', async () => {
  const url = 'https://tij.men/strudel/strudel.json';
  const skipped = [];
  const forgiving = forgivingSamples(failingSamples(url), { onSkip: (s) => skipped.push(s), fetchFn: unreachable });
  assert.equal(await forgiving(url), undefined);
  assert.deepEqual(skipped, [{ site: 'tij.men', url, reason: 'unreachable' }]);
});

test('the address asked again is the one Strudel resolved', async () => {
  const resolved = 'https://raw.githubusercontent.com/someone/drums/main/strudel.json';
  const asked = [];
  const skipped = [];
  const fetchFn = async (url) => (asked.push(url), { ok: false, status: 404 });
  const forgiving = forgivingSamples(failingSamples(resolved), { onSkip: (s) => skipped.push(s), fetchFn });
  await forgiving('github:someone/drums');
  assert.deepEqual(asked, [resolved]);
  assert.deepEqual(skipped, [{ site: 'github.com/someone/drums', url: resolved, reason: 'status', status: 404 }]);
});

test('a failure without an address to ask again is reported without a reason', async () => {
  const skipped = [];
  const samples = async () => {
    throw new Error('no fetch here');
  };
  const forgiving = forgivingSamples(samples, { onSkip: (s) => skipped.push(s), fetchFn: unreachable });
  await forgiving('local:');
  assert.deepEqual(skipped, [{ site: 'local:', url: 'local:', reason: 'failed' }]);
});

test('a sample list that takes too long is left out', async () => {
  const skipped = [];
  const forgiving = forgivingSamples(never, { onSkip: (s) => skipped.push(s), timeout: 5 });
  assert.equal(await forgiving('https://slow.example/strudel.json'), undefined);
  assert.deepEqual(skipped, [{ site: 'slow.example', url: 'https://slow.example/strudel.json', reason: 'late', seconds: 0.005 }]);
});

test('sample maps written in the song are its own: their mistakes still stop it', async () => {
  const map = { bd: 'bd.wav' };
  const loaded = [];
  const forgiving = forgivingSamples(async (m, base) => loaded.push([m, base]), { onSkip: () => assert.fail('not a site') });
  await forgiving(map, 'https://base/');
  assert.deepEqual(loaded, [[map, 'https://base/']]);
  const wrong = forgivingSamples(
    async () => {
      throw new Error('wrong sample map format for bd');
    },
    { onSkip: () => assert.fail('not a site') },
  );
  await assert.rejects(wrong({ bd: 3 }), /wrong sample map format/);
});

test('the player says which sites failed, once each, and why', () => {
  assert.equal(describeSkipped([]), '');
  assert.equal(describeSkipped(undefined), '');
  assert.equal(
    describeSkipped([{ site: 'tij.men', reason: 'unreachable' }]),
    'Its samples from tij.men did not load (the site did not answer, or it does not let other web pages load its files). It plays on with the standard sounds, so some parts may sound different or be missing.',
  );
  const text = describeSkipped([
    { site: 'tij.men', reason: 'status', status: 404 },
    { site: 'tij.men', reason: 'unreachable' },
    { site: 'shabda.ndre.gr', reason: 'late', seconds: SAMPLES_TIMEOUT_MS / 1000 },
    { site: 'a.example', reason: 'format' },
    { site: 'local:', reason: 'failed' },
  ]);
  assert.match(text, /^Its samples from tij\.men did not load \(the site answered with error 404\)\. /);
  assert.equal(text.match(/tij\.men/g).length, 1);
  assert.match(text, / Its samples from shabda\.ndre\.gr did not load \(the site took longer than 10 seconds to answer\)\. /);
  assert.match(text, / Its samples from a\.example did not load \(what the site sent is not a list of samples\)\. /);
  assert.match(text, / Its samples from local: did not load\. It plays on/);
});
