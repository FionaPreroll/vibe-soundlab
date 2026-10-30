// Keeps a song's mistakes from taking the page down: loops that never end, patterns
// with more notes than any computer can play, errors while a pattern plays, and
// syntax errors, which get the line they are on.

import { tokenize } from './highlight.js';

export const LIMITS = {
  // a loop may keep the page busy this long before it is stopped
  blockedMs: 1500,
  // more notes than this per second can't be played; a few hundred at once are fine
  eventsPerSecond: 2000,
  burst: 200,
  // working out one stretch of the music may take this long
  queryMs: 300,
  // time spent looking for too many notes before a pattern plays
  probeMs: 100,
};

/** The global function the loop checks call. */
export const LOOP_GUARD = '__vibeLoop';

/**
 * Adds a check to the condition of every `for (…; …; …)`, `while (…)` and
 * `do … while (…)` loop, so a loop that never ends throws instead of freezing the page.
 * Returns the new code and `toOriginal(position)`, which maps a position in it back
 * to the code as written (Strudel marks notes by their position in the code).
 */
export function protectLoops(code) {
  const tokens = tokenize(code).filter((t) => t.type !== 'space' && t.type !== 'comment');
  const text = (t) => code.slice(t.start, t.end);
  const inserts = [];
  tokens.forEach((token, i) => {
    const word = text(token);
    if (token.type !== 'keyword' || (word !== 'for' && word !== 'while') || text(tokens[i + 1] ?? token) !== '(') return;
    let depth = 0;
    let close = null;
    const semicolons = [];
    for (const t of tokens.slice(i + 1)) {
      if (t.type !== 'operator') continue;
      const c = text(t);
      if (c === '(') depth++;
      else if (c === ')' && --depth === 0) {
        close = t;
        break;
      } else if (c === ';' && depth === 1) semicolons.push(t);
    }
    if (close === null) return;
    // the condition: all of while (…), the middle part of for (…; …; …); for…of/in end on their own
    const [from, to] = word === 'while' ? [tokens[i + 1].end, close.start] : semicolons.length === 2 ? [semicolons[0].end, semicolons[1].start] : [];
    if (from === undefined) return;
    if (code.slice(from, to).trim() === '') inserts.push({ at: from, text: ` ${LOOP_GUARD}()` });
    else inserts.push({ at: from, text: `${LOOP_GUARD}() && (` }, { at: to, text: ')' });
  });
  let out = '';
  let last = 0;
  for (const { at, text: added } of inserts) {
    out += code.slice(last, at) + added;
    last = at;
  }
  out += code.slice(last);
  return {
    code: out,
    changed: inserts.length > 0,
    toOriginal(position) {
      let shift = 0;
      for (const { at, text: added } of inserts) {
        const start = at + shift;
        if (position < start) break;
        if (position < start + added.length) return at;
        shift += added.length;
      }
      return position - shift;
    },
  };
}

/**
 * Puts the loop check (see protectLoops) on `scope`. It throws once the page has been
 * busy for `blockedMs` without a break: a heartbeat every 100 ms shows the page is
 * free, and `touch()` marks the start of work that may loop (running a song's code,
 * asking the pattern for notes).
 */
export function installLoopGuard({ scope = globalThis, now = () => performance.now(), every = setInterval, blockedMs = LIMITS.blockedMs } = {}) {
  let free = now();
  let count = 0;
  const touch = () => {
    free = now();
  };
  // in Node (the tests) the heartbeat must not keep the process alive
  every(touch, 100)?.unref?.();
  scope[LOOP_GUARD] = () => {
    count++;
    if (count % 1024 === 0 && now() - free > blockedMs) {
      touch();
      throw new RangeError(`A loop ran for more than ${blockedMs / 1000} seconds without ending, so it was stopped.`);
    }
    return true;
  };
  return { touch };
}

const onsets = (haps) => haps.reduce((n, hap) => n + (hap.hasOnset?.() ? 1 : 0), 0);

const tooMany = (count, seconds) =>
  `The pattern plays ${count} notes in ${seconds < 0.1 ? `${Math.round(seconds * 1000)} milliseconds` : `${seconds.toFixed(1)} seconds`}, far more than can be played. Is a number in *, !, fast() or ply() too big?`;

const tooSlow = (ms) => `The pattern takes ${Math.round(ms)} ms to work out a moment of music, too long to play.`;

/**
 * Looks at the pattern around bar `from` before it plays and throws when it has far
 * more notes than can be played (s("bd*100000"), fast(5000)) or is too slow to work
 * out. It starts with a tiny stretch, so even a huge number is found quickly.
 */
export function checkDensity(pattern, { from = 0, cps = 0.5, now = () => performance.now(), limits = LIMITS } = {}) {
  const started = now();
  for (let length = 1 / 65536; length <= 1; length *= 4) {
    const before = now();
    const count = onsets(pattern.queryArc(from, from + length));
    const took = now() - before;
    const seconds = length / cps;
    if (count > limits.burst && count > limits.eventsPerSecond * seconds) throw new Error(tooMany(count, seconds));
    if (took > limits.queryMs) throw new Error(tooSlow(took));
    if (now() - started > limits.probeMs) return;
  }
}

/**
 * Wraps a pattern for playing. When asking it for the next notes brings far too many
 * or takes too long, it goes silent and `onTrip(error)` is called; when asking throws,
 * that stretch is silent and `onError(error)` hears about it once per message, instead
 * of the scheduler logging it twenty times a second.
 */
export function guardPattern(pattern, { Pattern, cps = () => 0.5, onTrip = () => {}, onError = () => {}, touch = () => {}, now = () => performance.now(), limits = LIMITS }) {
  let tripped = false;
  const reported = new Set();
  return new Pattern((state) => {
    if (tripped) return [];
    touch();
    const before = now();
    let haps;
    try {
      haps = pattern.query(state);
    } catch (err) {
      const message = err?.message ?? String(err);
      if (!reported.has(message)) {
        reported.add(message);
        onError(err);
      }
      return [];
    }
    const took = now() - before;
    const seconds = (Number(state.span.end) - Number(state.span.begin)) / cps();
    const count = seconds > 0 ? onsets(haps) : 0;
    if (took > limits.queryMs || (count > limits.burst && count > limits.eventsPerSecond * seconds)) {
      tripped = true;
      onTrip(new Error(took > limits.queryMs ? tooSlow(took) : tooMany(count, seconds)));
      return [];
    }
    return haps;
  });
}

/**
 * Error messages as the player shows them. Strudel's parser lists every character it
 * would have accepted; this says what went wrong instead.
 */
export function plainMessage(err) {
  const message = String(err?.message ?? err ?? 'Unknown error');
  const mini = /^\[mini\] parse error[^:]*:[\s\S]* but ([\s\S]+) found\.?$/.exec(message);
  if (mini) {
    return mini[1] === '"\\""' || mini[1] === 'end of input'
      ? 'Mini-notation: the string ends before a bracket or group in it is closed.'
      : `Mini-notation: ${mini[1]} doesn't fit there.`;
  }
  return message.replace(/\s*\(\d+:\d+\)\s*$/, '');
}

/** 1-based line and column of a position in the code. */
export function lineAndColumn(code, position) {
  const at = Math.max(0, Math.min(position, code.length));
  const before = code.slice(0, at);
  return { line: before.split('\n').length, column: at - before.lastIndexOf('\n') };
}

/**
 * Where in the code an error from Strudel is: { position, line, column } or null.
 * JavaScript syntax errors carry their position (`pos`); errors in mini-notation
 * ("c3 [e3") don't, so `parseMini` (Strudel's mini parser) is tried on every
 * double-quoted and backtick string until one fails.
 */
export function locateError(code, err, { parseMini = null, toOriginal = (p) => p } = {}) {
  let position = null;
  if (Number.isInteger(err?.pos)) position = toOriginal(err.pos);
  else if (parseMini && /\[mini\]|mini|parse error/i.test(err?.message ?? '')) {
    const tokens = tokenize(code);
    for (let i = 0; i < tokens.length && position === null; i++) {
      if (tokens[i].type !== 'mini-quote') continue;
      let close = i + 1;
      while (close < tokens.length && tokens[close].type !== 'mini-quote') close++;
      try {
        parseMini(code.slice(tokens[i].end, tokens[close]?.start ?? code.length));
      } catch {
        position = tokens[i].start;
      }
      i = close;
    }
  }
  return position === null ? null : { position, ...lineAndColumn(code, position) };
}
