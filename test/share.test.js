import assert from 'node:assert/strict';
import { test } from 'node:test';
import { code2hash } from '@strudel/core';
import { strudelUrl, toBase64 } from '../src/share.js';

test('links encode code the same way strudel.cc does', () => {
  const code = 'note("c e g") // Größe → äöü 🎛';
  assert.equal(strudelUrl(code), `https://strudel.cc/#${code2hash(code)}`);
});

test('base64 handles multi-byte characters', () => {
  assert.equal(Buffer.from(toBase64('Fläche'), 'base64').toString('utf8'), 'Fläche');
});

test('the base URL can be changed', () => {
  assert.ok(strudelUrl('s("bd")', 'http://localhost:4321/').startsWith('http://localhost:4321/#'));
});
