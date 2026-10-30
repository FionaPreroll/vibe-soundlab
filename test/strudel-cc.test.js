// The strudel.cc extras, tried on the real Strudel pattern engine.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as core from '@strudel/core';
import { BANK_ALIASES, DRAWINGS, addStrudelCcExtras, rememberStrudel } from '../src/strudel-cc.js';
import { loadSoundfont, startPresetNote } from '../src/sfumato-stub.js';

const scope = {};
addStrudelCcExtras(core, scope);
const first = (pattern) => pattern.firstCycle()[0].value;

test('the editor drawings leave the pattern as it is', () => {
  const pattern = core.s('bd sd');
  for (const name of DRAWINGS) {
    assert.equal(pattern[name](), pattern, name);
    assert.equal(pattern[`_${name}`]({ fold: 1 }), pattern, `_${name}`);
  }
});

test('a slider keeps the value it starts with', () => {
  assert.equal(first(core.s('bd').lpf(scope.sliderWithID('slider_12', 3000, 0, 3000))).cutoff, 3000);
  assert.equal(first(core.s('bd').gain(scope.slider(0.7))).gain, 0.7);
  assert.equal(scope.slider().firstCycle()[0].value, 0);
  assert.equal(scope.sliderWithID('slider_1').firstCycle()[0].value, 0);
});

test('o() is orbit()', () => {
  assert.equal(first(core.s('bd').o(3)).orbit, 3);
  assert.equal(scope.o, core.orbit);
});

test('piano() plays the piano, held, panned by pitch', () => {
  const [low, high] = core.note(core.sequence('c2', 'c7')).piano().firstCycle().map((hap) => hap.value);
  assert.equal(low.s, 'piano');
  assert.equal(low.clip, 1);
  assert.equal(low.release, 0.1);
  assert.ok(low.pan > 0.25 && low.pan < high.pan && high.pan <= 0.75, `${low.pan} < ${high.pan}`);
  assert.equal(first(core.note('c8').pan(0.5).piano()).pan, 0.375, 'a pan of its own scales the pitch pan');
});

test('the drum machine short names are strudel.cc’s', () => {
  assert.equal(BANK_ALIASES.RolandTR909, 'TR909');
  assert.equal(BANK_ALIASES.AkaiLinn, 'Linn');
  assert.equal(BANK_ALIASES.Linn9000, '9000');
  assert.equal(new Set(Object.values(BANK_ALIASES)).size, Object.keys(BANK_ALIASES).length, 'no short name stands for two machines');
});

test('what a song changes in Strudel is put back', () => {
  class Pattern {
    keep() {
      return 'built in';
    }
  }
  Object.defineProperty(Pattern.prototype, 'fixed', { get: () => 'fixed', configurable: false });
  const globals = { n: 'note numbers', s: 'sounds' };
  const restore = rememberStrudel({ Pattern }, ['n', 's', 'missing'], globals);
  Pattern.prototype.keep = () => 'replaced';
  Pattern.prototype.added = () => 'added';
  globals.n = 3;
  globals.missing = 'set by a song';
  globals.other = 'left alone';
  restore();
  assert.equal(new Pattern().keep(), 'built in');
  assert.equal('added' in Pattern.prototype, false);
  assert.equal(new Pattern().fixed, 'fixed');
  assert.deepEqual(globals, { n: 'note numbers', s: 'sounds', missing: undefined, other: 'left alone' });
});

test('.sf2 soundfonts are not supported', () => {
  assert.throws(() => loadSoundfont('x.sf2'), /not supported/);
  assert.throws(() => startPresetNote(), /not supported/);
});
