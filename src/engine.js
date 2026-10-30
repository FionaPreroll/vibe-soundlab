// Plays Strudel code in the browser through @strudel/web.
// The Strudel version here must match the one the tests run against (package.json).
import { checkDensity, guardPattern, installLoopGuard, locateError, protectLoops } from './guard.js';
import { createMixerGraph } from './mixer-graph.js';
import { SAMPLES_TIMEOUT_MS, forgivingSamples } from './samples.js';
import { BANK_ALIASES, addStrudelCcExtras, rememberStrudel } from './strudel-cc.js';

export const STRUDEL_VERSION = '1.2.6';
export const STRUDEL_URL = `https://cdn.jsdelivr.net/npm/@strudel/web@${STRUDEL_VERSION}/dist/index.mjs`;
// The General MIDI instruments (gm_piano, gm_flute, …) strudel.cc has. This module imports
// Strudel by its package names; the import map in index.html points them at STRUDEL_URL.
export const SOUNDFONTS_URL = `https://cdn.jsdelivr.net/npm/@strudel/soundfonts@${STRUDEL_VERSION}/dist/index.mjs`;

// The sample sets strudel.cc loads by default, so tracks written there play here too.
const DOUGH = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';
export const SAMPLE_MAPS = [
  `${DOUGH}/tidal-drum-machines.json`,
  `${DOUGH}/piano.json`,
  `${DOUGH}/vcsl.json`,
  `${DOUGH}/mridangam.json`,
  `${DOUGH}/EmuSP12.json`,
  'github:tidalcycles/dirt-samples',
];

// Orbits the tracks use (see the README). Seeking creates them up front.
export const ORBITS = 8;

// A song whose code is still running after this long (waiting for something that
// never comes) is given up on, so the player doesn't wait for it forever.
export const EVAL_TIMEOUT_MS = 30000;

class EvalTimeout extends Error {}

/** Whether the mixer has a strip for this orbit (no orbit means orbit 1). */
export const hasStrip = (orbit) => orbit == null || (Number.isInteger(orbit) && orbit >= 1 && orbit <= ORBITS);

/**
 * `createGraph` builds the mixer between Strudel and the speakers (null plays
 * without one); `later` runs a callback after a delay in ms; `visuals` (see
 * visuals.js) is told when a track's code runs, plays and stops; `loadSoundfonts`
 * loads the General MIDI instruments. `onPlaybackError(error, { stopped, reverted })`
 * hears about errors once a track plays (see guard.js): the pattern went silent and
 * playback stopped, or a change made while it played failed and the version before
 * it plays again. `installGuard` sets up the check that stops loops that never end.
 * `fetchSamples` asks again for a sample list a song could not load, to say why, and
 * `samplesTimeout` is how long a song waits for one (see samples.js).
 */
export function createEngine({
  load = () => import(STRUDEL_URL),
  loadSoundfonts = () => import(SOUNDFONTS_URL),
  createGraph = createMixerGraph,
  later = setTimeout,
  visuals = null,
  onPlaybackError = () => {},
  installGuard = installLoopGuard,
  evalTimeout = EVAL_TIMEOUT_MS,
  fetchSamples = (url) => fetch(url),
  samplesTimeout = SAMPLES_TIMEOUT_MS,
} = {}) {
  let strudel = null;
  let repl = null;
  let ready = null;
  let evalError = null;
  let playing = false;
  let graph = null;
  // After a jump, the bar it went to, until the scheduler has caught up with it.
  let seekFloor = null;
  // Counts plays and stops, so a jump that was waiting for its fade can tell it is stale.
  let generation = 0;
  // What plays now: { code, pattern (as played, guarded), raw (as the code made it),
  // toOriginal (maps positions in the code that ran back to the code as written) }.
  let current = null;
  // What played before the last change made while playing, to go back to if it fails.
  let previous = null;
  // Counts the patterns played, so the chords know when to start over.
  let version = 0;
  // The code Strudel evaluates now, until its pattern starts playing (see adopt).
  let incoming = null;
  // The bar a new pattern starts playing at, where it is checked for too many notes.
  let probeAt = 0;
  // Undoes what earlier songs changed in Strudel (see rememberStrudel).
  let restoreStrudel = () => {};
  let loops = { touch() {} };
  // Sample sets from other sites the code being evaluated could not load.
  let skipped = [];

  function init() {
    ready ??= (async () => {
      strudel = await load();
      repl = await strudel.initStrudel({
        prebake: async () => {
          // The same sounds strudel.cc starts with: samples, ZZFX synths, General MIDI.
          await Promise.all([...SAMPLE_MAPS.map((map) => strudel.samples(map)), strudel.registerZZFXSounds(), registerSoundfonts()]);
          // Needs the drum machines loaded: it adds the short names to the sounds that exist.
          strudel.aliasBank(BANK_ALIASES);
        },
        onEvalError: (err) => {
          evalError = err;
        },
        // Strudel hands every new pattern here before it plays it. Too many notes throw
        // (an eval error: what played before keeps playing); the rest plays guarded.
        editPattern: (pattern) => {
          checkDensity(pattern, { from: probeAt, cps: repl?.scheduler?.cps ?? 0.5 });
          const guarded = guardPattern(pattern, {
            Pattern: strudel.Pattern,
            cps: () => repl?.scheduler?.cps ?? 0.5,
            touch: loops.touch,
            onTrip: (err) => later(() => failed(guarded, err, true), 0),
            onError: (err) => later(() => failed(guarded, err, false), 0),
          });
          adopt(guarded, pattern);
          return guarded;
        },
        // With the mixer, every orbit gets its own pair of channels. Strudel resets
        // this setting when it starts its audio, so it is set again for each note.
        // Orbits without a strip (songs from elsewhere use 0.5 or 12) play on the first
        // pair, as without the mixer; Strudel reads the setting before its first await.
        ...(createGraph && {
          defaultOutput: (hap, ...rest) => {
            strudel.setMultiChannelOrbits(hasStrip(hap?.value?.orbit));
            return strudel.webaudioOutput(hap, ...rest);
          },
        }),
      });
      addStrudelCcExtras(strudel);
      // A song's sample sets from other sites: one that doesn't load is left out
      // instead of stopping the song. The defaults above still load as Strudel does.
      globalThis.samples = forgivingSamples(strudel.samples, { onSkip: (skip) => skipped.push(skip), fetchFn: fetchSamples, timeout: samplesTimeout });
      loops = installGuard();
      // The globals songs use: Strudel's own, the extras and the Hydra ones (main.js).
      restoreStrudel = rememberStrudel(strudel, [...Object.keys(strudel), 'sliderWithID', 'slider', 'o', 'initHydra', 'H']);
    })().catch((err) => {
      ready = null;
      throw err;
    });
    return ready;
  }

  // Without them, songs that use gm_ sounds miss those parts; everything else still plays.
  async function registerSoundfonts() {
    try {
      (await loadSoundfonts()).registerSoundfonts();
    } catch (err) {
      console.warn('Playing without the General MIDI instruments:', err?.message ?? err);
    }
  }

  // Plays run one after another: a second click while a track is still
  // loading must not interleave its hush and evaluate with the first.
  let queue = Promise.resolve();

  /**
   * Evaluates and starts the code, from bar `from` (0-based) if given.
   * Throws if Strudel reports an error in it. Resolves to `{ skippedSamples }`, the
   * sample sets from other sites it plays without (see samples.js), or to undefined
   * when it was stopped meanwhile.
   */
  function play(code, { from = 0 } = {}) {
    const run = queue.then(() => playNow(code, from));
    queue = run.catch(() => {});
    return run;
  }

  // Puts the mixer between Strudel and the speakers: Strudel sends to whatever
  // its audio context calls the destination, so that name now points at the mixer.
  function attachMixer() {
    if (graph || !createGraph) return;
    try {
      const ctx = strudel.getAudioContext();
      graph = createGraph(ctx, ctx.destination);
      Object.defineProperty(ctx, 'destination', { value: graph.input, configurable: true });
      // Rebuilds Strudel's output, which reads the destination again.
      strudel.resetGlobalEffects();
    } catch (err) {
      graph = null;
      console.warn('Playing without the mixer:', err?.message ?? err);
    }
  }

  /**
   * Checks the code before anything runs: Strudel's transpiler reads all of it, mini-
   * notation included, and throws on a syntax error, with its place in the code. Then
   * every loop gets a check that stops it if it never ends (unless that confuses the
   * transpiler, then the code runs as written).
   */
  function prepare(code) {
    if (!strudel.transpiler) return { code, toOriginal: (p) => p };
    try {
      strudel.transpiler(code, { emitWidgets: false });
    } catch (err) {
      throw located(err, code);
    }
    const guarded = protectLoops(code);
    if (guarded.changed) {
      try {
        strudel.transpiler(guarded.code, { emitWidgets: false });
        return guarded;
      } catch {
        // our check confused the transpiler; run the code as written
      }
    }
    return { code, toOriginal: (p) => p };
  }

  // Adds `location` ({ position, line, column } in the code as written) to an error.
  function located(err, code, toOriginal = (p) => p) {
    const error = err instanceof Error ? err : new Error(String(err));
    const where = locateError(code, error, { parseMini: strudel?.mini ?? null, toOriginal });
    if (where) error.location = where;
    return error;
  }

  // Runs the code in Strudel, giving up after `evalTimeout` ms.
  async function evaluateWithin(code) {
    const result = Promise.resolve(strudel.evaluate(code));
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new EvalTimeout(`The code was still running after ${evalTimeout / 1000} seconds, so the player gave up on it.`)), evalTimeout);
    });
    try {
      return await Promise.race([result, timeout]);
    } catch (err) {
      // If it finishes after all, Strudel starts its pattern: put back what should play.
      if (err instanceof EvalTimeout) result.then(putBack, putBack);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  function putBack() {
    if (playing && current) repl.scheduler?.setPattern?.(current.pattern, false);
    else strudel.hush();
  }

  // A new pattern plays from the moment Strudel hands it to the scheduler, so it
  // becomes `current` right then: an error in its first notes already belongs to it.
  function adopt(pattern, raw) {
    if (!incoming || incoming.generation !== generation) return;
    previous = incoming.update ? current : null;
    current = { code: incoming.code, toOriginal: incoming.toOriginal, pattern, raw };
    incoming = null;
    playing = true;
    version++;
  }

  // Evaluates prepared code; throws on errors. False when stopped meanwhile.
  async function run(code, prepared, update) {
    const mine = generation;
    evalError = null;
    skipped = [];
    incoming = { code, toOriginal: prepared.toOriginal, update, generation: mine };
    restoreStrudel();
    loops.touch();
    let evaluated = null;
    try {
      evaluated = await evaluateWithin(prepared.code);
    } catch (err) {
      evalError ??= err;
    }
    incoming = null;
    if (mine !== generation) {
      // Stopped while the code ran: Strudel started it anyway.
      strudel.hush();
      return false;
    }
    if (evalError || !evaluated) throw located(evalError ?? new Error('The code did not produce a pattern.'), code, prepared.toOriginal);
    // without Strudel's editPattern (the tests' stand-in), it is adopted here
    if (current?.pattern !== evaluated) {
      incoming = { code, toOriginal: prepared.toOriginal, update, generation: mine };
      adopt(evaluated, evaluated);
    }
    return true;
  }

  async function playNow(code, from) {
    await init();
    await strudel.getAudioContext?.().resume?.();
    attachMixer();
    // Stopping first resets the clock, so every track starts at bar 1
    // instead of wherever the previous one was.
    if (playing) strudel.hush();
    generation++;
    graph?.fadeIn(0);
    visuals?.beforeRun();
    probeAt = from;
    let started;
    try {
      started = await run(code, prepare(code), false);
    } catch (err) {
      playing = false;
      current = null;
      previous = null;
      visuals?.stop();
      throw err;
    }
    if (!started) return undefined;
    visuals?.afterRun();
    seekFloor = null;
    if (from > 0) seek(from);
    return { skippedSamples: skipped };
  }

  /**
   * Swaps in changed code while a track plays, without starting it over: the music
   * keeps its place. If the code has an error, the version that played keeps playing
   * and the error is thrown (with `location` when it is known). Starts playing if
   * nothing plays. Resolves as play() does.
   */
  function update(code) {
    const next = queue.then(() => (playing ? updateNow(code) : playNow(code, 0)));
    queue = next.catch(() => {});
    return next;
  }

  async function updateNow(code) {
    const prepared = prepare(code);
    visuals?.beforeRun({ fresh: false });
    probeAt = Math.max(0, repl.scheduler?.now?.() ?? 0);
    try {
      if (!(await run(code, prepared, true))) return undefined;
    } catch (err) {
      visuals?.failedRun?.();
      throw err;
    }
    visuals?.afterRun();
    return { skippedSamples: skipped };
  }

  // A pattern that plays went silent (`tripped`) or threw. A change made while playing
  // goes back to the version before it; otherwise a silent pattern stops.
  function failed(pattern, err, tripped) {
    if (!playing || current?.pattern !== pattern) return;
    if (previous) {
      repl.scheduler?.setPattern?.(previous.pattern, false);
      current = previous;
      previous = null;
      version++;
      onPlaybackError(err, { reverted: true, code: current.code });
    } else if (tripped) {
      stop();
      onPlaybackError(err, { stopped: true });
    } else {
      onPlaybackError(err, {});
    }
  }

  function stop() {
    if (strudel) strudel.hush();
    visuals?.stop();
    playing = false;
    current = null;
    previous = null;
    seekFloor = null;
    generation++;
  }

  // Every orbit a track may duck has to exist before the first kick asks for it,
  // or Strudel reports "duck target orbit does not exist". A silent note creates each one.
  // Strudel drops notes scheduled in the past without creating their orbit, and on a busy
  // machine the clock moves on while these are set up, so they start well ahead.
  function createOrbits() {
    if (graph) strudel.setMultiChannelOrbits(true);
    for (let orbit = 1; orbit <= ORBITS; orbit++) {
      const at = strudel.getAudioContext().currentTime + 0.5;
      Promise.resolve(strudel.superdough({ s: 'sine', gain: 0, orbit }, at, 0.01)).catch(() => {});
    }
  }

  /**
   * Jumps to a bar (0-based) while playing. Sounds still ringing from before the
   * jump are cut. Returns false when nothing is playing.
   */
  function seek(bar) {
    const scheduler = repl?.scheduler;
    if (!playing || !scheduler || !('lastEnd' in scheduler)) return false;
    const target = Math.max(0, Math.floor(bar));
    seekFloor = target;
    const mine = generation;
    const jump = () => {
      if (mine !== generation) return;
      // Notes already started hang off Strudel's current output. Resetting it
      // drops them (and their reverb tails) at once.
      strudel.resetGlobalEffects();
      createOrbits();
      // The scheduler starts its next query at lastEnd. With the tick count at zero,
      // that tick also becomes the new reference for timing, as after a tempo change.
      scheduler.lastEnd = target;
      scheduler.num_ticks_since_cps_change = 0;
      graph?.fadeIn(0.15);
    };
    if (!graph) {
      jump();
      return true;
    }
    // With the mixer, a quick fade first, so cutting the old notes doesn't click.
    graph.fadeOut();
    later(jump, 25);
    return true;
  }

  /** Current position in bars (cycles) since playback started, or null when stopped. */
  function position() {
    if (!playing || !repl?.scheduler) return null;
    const now = repl.scheduler.now();
    if (seekFloor !== null) {
      // Until the scheduler has played from the new bar, report the bar it jumps to.
      if (repl.scheduler.num_ticks_since_cps_change > 0 && now >= seekFloor) seekFloor = null;
      else return seekFloor;
    }
    return now;
  }

  /**
   * Where in the code the notes sounding right now were written, as { start, end }
   * character ranges. Strudel records them for every mini-notation atom.
   */
  function activeLocations() {
    const scheduler = repl?.scheduler;
    if (!playing || !current?.pattern?.queryArc || !scheduler) return [];
    const t = scheduler.now();
    const { toOriginal } = current;
    try {
      return current.pattern
        .queryArc(t, t)
        .filter((hap) => hap.whole && hap.whole.begin <= t && t < hap.whole.end)
        .flatMap((hap) => hap.context?.locations ?? [])
        .map(({ start, end }) => ({ start: toOriginal(start), end: toOriginal(end) }));
    } catch {
      return [];
    }
  }

  /** The events of the playing pattern from bar `begin` to `end` (for the chords). */
  function query(begin, end) {
    if (!playing || !current?.raw?.queryArc) return [];
    loops.touch();
    try {
      return current.raw.queryArc(begin, end);
    } catch {
      return [];
    }
  }

  return {
    init,
    play,
    update,
    stop,
    seek,
    position,
    activeLocations,
    query,
    /** Changes whenever another pattern starts playing. */
    version: () => version,
    /** The code that plays now, or null. */
    playingCode: () => (playing ? (current?.code ?? null) : null),
    isPlaying: () => playing,
    mixer: () => graph,
  };
}
