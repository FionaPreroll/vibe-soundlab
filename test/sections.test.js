import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseSections, sectionAt, sectionLabel } from '../src/sections.js';
import { trackFiles, TRACK_DIR } from './support/tracks.js';
import { parseHeader } from '../src/header.js';

test('section names become labels', () => {
  assert.equal(sectionLabel('drop1'), 'Drop 1');
  assert.equal(sectionLabel('build_2'), 'Build 2');
  assert.equal(sectionLabel('bigDrop'), 'Big drop');
  assert.equal(sectionLabel('breakdown'), 'Breakdown');
  assert.equal(sectionLabel('__'), 'Part');
});

test('reads the arrangement at the end of a track', () => {
  const code = `const intro = s("bd")
const drop = stack(s("bd"), arrange([2, s("hh")], [2, s("sd")]))
arrange(
  [16, intro], // quiet start, don't skip it
  [8,  drop],
  /* a part that is not a name */
  [4, stack(intro, drop.mask("<1 0>"))],
)`;
  assert.deepEqual(parseSections(code), [
    { name: 'intro', label: 'Intro', start: 0, bars: 16 },
    { name: 'drop', label: 'Drop', start: 16, bars: 8 },
    { name: 'part3', label: 'Part 3', start: 24, bars: 4 },
  ]);
});

test('code without a readable arrangement has no sections', () => {
  assert.deepEqual(parseSections('s("bd sd")'), []);
  assert.deepEqual(parseSections('stack(arrange([4, a]))'), [], 'only top-level calls count');
  assert.deepEqual(parseSections('arrange([4, a], [0, b])'), [], 'a part without length');
  assert.deepEqual(parseSections('arrange(a, b)'), [], 'not [bars, part] pairs');
  assert.deepEqual(parseSections('arrange([4, a]'), [], 'unclosed call');
  assert.deepEqual(parseSections('arrange([4, a)]'), [], 'brackets out of order');
  assert.deepEqual(parseSections('arrange([4, s("a)]'), [], 'unclosed string');
  assert.deepEqual(parseSections('arrange([4, a] /* open comment )'), []);
  assert.deepEqual(parseSections('arrange()'), []);
  assert.deepEqual(parseSections('arrange([4, a], [4, [b, c])'), [], 'unbalanced inside');
  assert.deepEqual(parseSections('arrange(\n  [4, a], // last part\n)'), [{ name: 'a', label: 'A', start: 0, bars: 4 }]);
  assert.deepEqual(parseSections('arrange([4, s("x")], [2, b]) // end'), [
    { name: 'part1', label: 'Part 1', start: 0, bars: 4 },
    { name: 'b', label: 'B', start: 4, bars: 2 },
  ]);
});

test('finds the section playing at a bar', () => {
  const sections = parseSections('arrange([16, intro], [8, build])');
  assert.equal(sectionAt(sections, 0).name, 'intro');
  assert.equal(sectionAt(sections, 15.9).name, 'intro');
  assert.equal(sectionAt(sections, 16).name, 'build');
  assert.equal(sectionAt(sections, 24), null);
  assert.equal(sectionAt(sections, null), null);
  assert.equal(sectionAt(sections, NaN), null);
});

test('every repo track has sections that add up to its length', () => {
  for (const file of trackFiles()) {
    const code = readFileSync(new URL(file, TRACK_DIR), 'utf8');
    const sections = parseSections(code);
    const total = sections.reduce((sum, s) => sum + s.bars, 0);
    assert.ok(sections.length >= 3, `${file} has its parts in a final arrange()`);
    assert.equal(total, parseHeader(code).bars, `${file}: @bars matches the arrangement`);
    assert.ok(sections.every((s) => !s.label.startsWith('Part')), `${file}: every part has a name`);
  }
});
