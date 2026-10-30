import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { transpiler } from '@strudel/transpiler';
import { renderCode, tokenize } from '../src/highlight.js';
import { TRACK_DIR, trackFiles } from './support/tracks.js';

const show = (code) =>
  tokenize(code)
    .filter((t) => t.type !== 'space')
    .map((t) => `${t.type}:${code.slice(t.start, t.end)}`);

test('JavaScript parts get their kind', () => {
  assert.deepEqual(show('const pad = note(chords).s("supersaw").lpf(.4) // warm'), [
    'keyword:const',
    'def:pad',
    'operator:=',
    'call:note',
    'operator:(',
    'name:chords',
    'operator:)',
    'operator:.',
    'method:s',
    'operator:(',
    'mini-quote:"',
    'mini-word:supersaw',
    'mini-quote:"',
    'operator:)',
    'operator:.',
    'method:lpf',
    'operator:(',
    'number:.4',
    'operator:)',
    'comment:// warm',
  ]);
  assert.deepEqual(show("samples('github:x') /* a\nb */ x.value true await f => 1e3 0x1F"), [
    'call:samples',
    'operator:(',
    "string:'github:x'",
    'operator:)',
    'comment:/* a\nb */',
    'name:x',
    'operator:.',
    'property:value',
    'literal:true',
    'keyword:await',
    'name:f',
    'operator:=>',
    'number:1e3',
    'number:0x1F',
  ]);
  assert.deepEqual(show('x.new() function go() {}').slice(0, 5), ['name:x', 'operator:.', 'method:new', 'operator:(', 'operator:)']);
  assert.deepEqual(show('function go() {}').slice(0, 2), ['keyword:function', 'def:go']);
});

test('mini-notation strings are split into atoms and operators', () => {
  assert.deepEqual(show('"<[f1@10 sd:12] ~ -2!2 0.5*2>"'), [
    'mini-quote:"',
    'mini-op:<',
    'mini-op:[',
    'mini-word:f1',
    'mini-op:@',
    'mini-number:10',
    'mini-word:sd',
    'mini-op::',
    'mini-number:12',
    'mini-op:]',
    'mini-op:~',
    'mini-number:-2',
    'mini-op:!',
    'mini-number:2',
    'mini-number:0.5',
    'mini-op:*',
    'mini-number:2',
    'mini-op:>',
    'mini-quote:"',
  ]);
  assert.deepEqual(show('`bd\n  sd`'), ['mini-quote:`', 'mini-word:bd', 'mini-word:sd', 'mini-quote:`']);
  assert.deepEqual(show('`a ${b}`'), ['string:`a ${b}`'], 'templates with values are plain strings');
  assert.deepEqual(show('"a \\" b"'), ['mini-quote:"', 'mini-word:a', 'mini-word:\\"', 'mini-word:b', 'mini-quote:"']);
});

test('broken code still covers every character', () => {
  for (const code of ['"open string\nnext()', "'x", '/* never closed', '`tick', '"', 'a.b(', '#!']) {
    const tokens = tokenize(code);
    assert.equal(tokens.map((t) => code.slice(t.start, t.end)).join(''), code, code);
    for (let i = 1; i < tokens.length; i++) assert.equal(tokens[i].start, tokens[i - 1].end);
  }
});

test('every atom Strudel can mark in the tracks is a token of its own', () => {
  // Strudel's transpiler lists where each mini-notation atom sits in the code; the
  // highlighter has to have a token starting and ending exactly there.
  for (const file of trackFiles()) {
    const code = readFileSync(new URL(file, TRACK_DIR), 'utf8');
    const atoms = new Set(
      tokenize(code)
        .filter((t) => t.type.startsWith('mini-'))
        .map((t) => `${t.start}:${t.end}`),
    );
    const { miniLocations } = transpiler(code, { emitMiniLocations: true });
    const missing = miniLocations
      .filter(([start, end]) => code.slice(start, end).trim() !== '~') // rests play nothing
      .filter(([start, end]) => !atoms.has(`${start}:${end}`))
      .map(([start, end]) => code.slice(start, end));
    assert.deepEqual(missing, [], file);
  }
});

test('marks the atoms of the notes that are playing', () => {
  const { window } = new JSDOM('<pre><code></code></pre>');
  const container = window.document.querySelector('code');
  const code = 'note("c3 [e3 g3]").s(`bd`)';
  const marker = renderCode(container, code);
  assert.equal(container.textContent, code);
  assert.equal(container.querySelector('.tok-call').textContent, 'note');
  assert.equal(marker.atoms, 4);
  const at = (text) => ({ start: code.indexOf(text), end: code.indexOf(text) + text.length });
  assert.equal(marker.mark([at('e3'), at('bd')]), 2);
  assert.deepEqual(
    [...container.querySelectorAll('.playing')].map((n) => n.textContent),
    ['e3', 'bd'],
  );
  marker.mark([at('[e3 g3]')]);
  assert.deepEqual(
    [...container.querySelectorAll('.playing')].map((n) => n.textContent),
    ['e3', 'g3'],
    'a range covering several atoms marks each',
  );
  marker.mark([{ start: 0, end: 4 }]);
  assert.equal(container.querySelectorAll('.playing').length, 0, 'only atoms can be marked');
  marker.mark();
  assert.equal(renderCode(container, '').mark([{ start: 0, end: 9 }]), 0);
});
