// What keeps a song's mistakes from taking the page down (src/guard.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as core from '@strudel/core';
import * as mini from '@strudel/mini';
import { transpiler } from '@strudel/transpiler';
import { LIMITS, LOOP_GUARD, checkDensity, guardPattern, installLoopGuard, lineAndColumn, locateError, plainMessage, protectLoops } from '../src/guard.js';

const { Pattern, sequence } = core;
const pat = (text) => mini.mini(text);

test('every loop gets a check in its condition', () => {
  const guard = `${LOOP_GUARD}()`;
  assert.equal(protectLoops('while (x < 3) x++').code, `while (${guard} && (x < 3)) x++`);
  assert.equal(protectLoops('for (let i = 0; i < f(2); i++) {}').code, `for (let i = 0;${guard} && ( i < f(2)); i++) {}`);
  assert.equal(protectLoops('for (;;) {}').code, `for (; ${guard};) {}`);
  assert.equal(protectLoops('do { x++ } while (go(x))').code, `do { x++ } while (${guard} && (go(x)))`);
  const untouched = ['for (const x of xs) {}', 'for (const k in o) {}', 'for await (const x of xs) {}', '// while (true) {}', 's("while (true)")', "s('for (;;)')", 'x.while(1)', 'while'];
  for (const code of untouched) {
    const result = protectLoops(code);
    assert.equal(result.code, code, code);
    assert.equal(result.changed, false, code);
  }
});

test('positions in the checked code map back to the code as written', () => {
  const code = 'while (a) b()\nnote("c3 e3")';
  const { code: checked, toOriginal, changed } = protectLoops(code);
  assert.equal(changed, true);
  const at = checked.indexOf('c3');
  assert.equal(toOriginal(at), code.indexOf('c3'));
  assert.equal(toOriginal(0), 0);
  assert.equal(toOriginal(checked.indexOf(LOOP_GUARD)), code.indexOf('a'), 'inside the check: where it was put');
  assert.equal(toOriginal(checked.indexOf('a)')), code.indexOf('a'));
});

test('checked code still parses and runs as before', () => {
  const scope = {};
  installLoopGuard({ scope, every: () => null });
  const code = 'let n = 0; for (let i = 0; i < 5; i++) { n += i } let j = 0; while (j < 3) j++; do { j++ } while (j < 10);';
  const { code: checked } = protectLoops(code);
  transpiler(`${checked}\nn + j`, {});
  assert.equal(new Function(LOOP_GUARD, `${checked}\nreturn n + j`)(scope[LOOP_GUARD]), 20);
});

test('a loop that keeps the page busy too long is stopped', () => {
  let time = 0;
  let beat = null;
  const scope = {};
  const guard = installLoopGuard({ scope, now: () => time, every: (fn) => (beat = fn), blockedMs: 1000 });
  const spin = () => {
    for (let i = 0; i < 5000; i++) {
      time += 1;
      scope[LOOP_GUARD]();
    }
  };
  assert.throws(spin, /A loop ran for more than 1 seconds without ending, so it was stopped/);
  time = 10000;
  beat();
  for (let i = 0; i < 1023; i++) scope[LOOP_GUARD]();
  assert.equal(scope[LOOP_GUARD](), true, 'a heartbeat a moment ago: fine');
  time = 20000;
  guard.touch();
  for (let i = 0; i < 2048; i++) scope[LOOP_GUARD]();
});

test('the heartbeat does not keep Node running', () => {
  let unref = 0;
  installLoopGuard({ scope: {}, every: () => ({ unref: () => unref++ }) });
  assert.equal(unref, 1);
  installLoopGuard({ scope: {}, every: () => 7 });
});

test('far too many notes are found before they play, even with huge numbers', () => {
  checkDensity(pat('bd*16 [sd hh]*8'), { cps: 0.725 });
  checkDensity(sequence(...Array.from({ length: 64 }, () => pat('[c,e,g,b]'))), { cps: 0.5 });
  const started = performance.now();
  assert.throws(() => checkDensity(pat('bd*100000'), { cps: 0.725 }), /The pattern plays \d+ notes in \d+ milliseconds, far more than can be played/);
  assert.throws(() => checkDensity(pat('bd*1000000000'), { cps: 0.5 }), /far more than can be played/);
  assert.throws(() => checkDensity(pat('hh*16').fast(5000), { from: 12, cps: 0.5 }), /far more than can be played/);
  assert.ok(performance.now() - started < 2000, 'found quickly');
});

test('a pattern too slow to work out is refused, and checking stops after its time', () => {
  let time = 0;
  const slow = { queryArc: () => ((time += 500), []) };
  assert.throws(() => checkDensity(slow, { now: () => time }), /takes 500 ms to work out a moment of music/);
  let asked = 0;
  const busy = { queryArc: () => ((asked++, (time += 40)), []) };
  checkDensity(busy, { now: () => time });
  assert.equal(asked, 3, 'checks for about probeMs');
  assert.equal(LIMITS.probeMs, 100);
});

const query = (pattern, begin, end) => pattern.queryArc(begin, end);

test('a guarded pattern plays as it is', () => {
  let touched = 0;
  const guarded = guardPattern(pat('c3 e3 g3 b3'), { Pattern, touch: () => touched++ });
  assert.deepEqual(guarded.queryArc(0, 1).map((h) => h.value), ['c3', 'e3', 'g3', 'b3']);
  assert.equal(query(guarded, 0.5, 0.5).length, 1, 'asking for a moment (the code marks) is fine');
  assert.equal(touched, 2);
});

test('a guarded pattern that floods goes silent and says so once', () => {
  const trips = [];
  const guarded = guardPattern(pat('bd*16').fast(pat('<1 1 4000>')), { Pattern, cps: () => 0.5, onTrip: (err) => trips.push(err.message) });
  assert.equal(query(guarded, 0, 0.1).length, 2);
  assert.equal(query(guarded, 2, 2.1).length, 0);
  assert.equal(query(guarded, 0, 0.1).length, 0, 'silent from then on');
  assert.equal(trips.length, 1);
  assert.match(trips[0], /The pattern plays 6400 notes in 0.2 seconds/);
});

test('a guarded pattern that takes too long goes silent', () => {
  let time = 0;
  const trips = [];
  const slow = new Pattern(() => ((time += 400), []));
  const guarded = guardPattern(slow, { Pattern, now: () => time, onTrip: (err) => trips.push(err.message) });
  assert.deepEqual(query(guarded, 0, 0.1), []);
  assert.match(trips[0], /takes 400 ms/);
});

test('errors while playing are reported once per message, and that stretch is silent', () => {
  const errors = [];
  const broken = new Pattern((state) => {
    throw new Error(Number(state.span.begin) < 1 ? 'first' : 'second');
  });
  const guarded = guardPattern(broken, { Pattern, onError: (err) => errors.push(err.message) });
  for (const begin of [0, 0.5, 1, 1.5]) assert.deepEqual(query(guarded, begin, begin + 0.5), []);
  assert.deepEqual(errors, ['first', 'second']);
  const plain = guardPattern(new Pattern(() => { throw 'text'; }), { Pattern, onError: (err) => errors.push(err) });
  query(plain, 0, 1);
  assert.equal(errors.at(-1), 'text');
});

test('syntax errors are found where they are', () => {
  const code = 'const a = 1\nnote("c3 e3")\n  .s("saw"';
  let err;
  try {
    transpiler(code, {});
  } catch (e) {
    err = e;
  }
  const where = locateError(code, err);
  assert.equal(where.line, 3);
  assert.equal(where.column, 11);
  assert.equal(where.position, code.length);
  assert.deepEqual(locateError('ab', { pos: 1 }, { toOriginal: (p) => p - 1 }), { position: 0, line: 1, column: 1 });
});

test('mini-notation errors are found by trying each string', () => {
  const code = 'note("c3 e3")\nconst x = \'not mini\'\ns(`bd [sd`).bank("x")';
  let err;
  try {
    transpiler(code, {});
  } catch (e) {
    err = e;
  }
  assert.match(err.message, /\[mini\] parse error/);
  const where = locateError(code, err, { parseMini: (text) => mini.mini(text) });
  assert.deepEqual(where, { position: code.indexOf('`'), line: 3, column: 3 });
  assert.equal(locateError(code, err), null, 'without the parser, no place');
  assert.equal(locateError('note("c3")', err, { parseMini: () => {} }), null, 'no string fails: no place');
  assert.equal(locateError(code, new Error('x is not defined'), { parseMini: () => assert.fail('not a mini error') }), null);
  assert.equal(locateError(code, null), null);
});

test('error messages say what is wrong', () => {
  assert.equal(plainMessage(new Error('Unexpected token (3:11)')), 'Unexpected token');
  assert.equal(
    plainMessage(new Error('[mini] parse error at line 3: Expected "!", "(", or whitespace but "\\"" found.')),
    'Mini-notation: the string ends before a bracket or group in it is closed.',
  );
  assert.equal(plainMessage(new Error('[mini] parse error at line 1: Expected "a" but end of input found.')), 'Mini-notation: the string ends before a bracket or group in it is closed.');
  assert.equal(plainMessage(new Error('[mini] parse error at line 1: Expected "!" but "]" found.')), 'Mini-notation: "]" doesn\'t fit there.');
  assert.equal(plainMessage('plain'), 'plain');
  assert.equal(plainMessage(null), 'Unknown error');
});

test('line and column of a position', () => {
  assert.deepEqual(lineAndColumn('ab\ncd', 0), { line: 1, column: 1 });
  assert.deepEqual(lineAndColumn('ab\ncd', 4), { line: 2, column: 2 });
  assert.deepEqual(lineAndColumn('ab', 99), { line: 1, column: 3 }, 'past the end: at the end');
});
