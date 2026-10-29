import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/catalog.js';

const response = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => JSON.parse(body),
  text: async () => body,
});

// Serves files from the repo, the way GitHub Pages will.
const repoFetch = async (url) => {
  try {
    return response(readFileSync(new URL(`../${url}`, import.meta.url), 'utf8'));
  } catch {
    return response('', false, 404);
  }
};

test('loads every track listed in tracks/index.json', async () => {
  const tracks = await loadCatalog(repoFetch);
  const index = JSON.parse(readFileSync(new URL('../tracks/index.json', import.meta.url), 'utf8'));
  assert.deepEqual(tracks.map((t) => t.file), index.tracks.map((t) => t.file));
  assert.ok(tracks.every((t) => t.code.includes('setcpm(')));
});

test('reports a missing index', async () => {
  await assert.rejects(loadCatalog(repoFetch, 'nowhere/'), /Could not load the track list \(404\)/);
});

test('reports a missing track file', async () => {
  const fetchFn = async (url) => (url.endsWith('index.json') ? response('{"tracks":[{"file":"gone.js"}]}') : response('', false, 404));
  await assert.rejects(loadCatalog(fetchFn), /Could not load gone.js \(404\)/);
});
