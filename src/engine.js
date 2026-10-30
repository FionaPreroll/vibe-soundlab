// Plays Strudel code in the browser through @strudel/web.
// The Strudel version here must match the one the tests run against (package.json).

export const STRUDEL_VERSION = '1.2.6';
export const STRUDEL_URL = `https://cdn.jsdelivr.net/npm/@strudel/web@${STRUDEL_VERSION}/dist/index.mjs`;

// The sample sets strudel.cc loads by default, so tracks written there play here too.
const DOUGH = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';
export const SAMPLE_MAPS = [
  `${DOUGH}/tidal-drum-machines.json`,
  `${DOUGH}/piano.json`,
  `${DOUGH}/vcsl.json`,
  `${DOUGH}/mridangam.json`,
  'github:tidalcycles/dirt-samples',
];

// Orbits the tracks use (see the README). Seeking creates them up front.
export const ORBITS = 8;

export function createEngine({ load = () => import(STRUDEL_URL) } = {}) {
  let strudel = null;
  let repl = null;
  let ready = null;
  let evalError = null;
  let playing = false;
  // After a jump, the bar it went to, until the scheduler has caught up with it.
  let seekFloor = null;

  function init() {
    ready ??= (async () => {
      strudel = await load();
      repl = await strudel.initStrudel({
        prebake: () => Promise.all(SAMPLE_MAPS.map((map) => strudel.samples(map))),
        onEvalError: (err) => {
          evalError = err;
        },
      });
    })().catch((err) => {
      ready = null;
      throw err;
    });
    return ready;
  }

  // Plays run one after another: a second click while a track is still
  // loading must not interleave its hush and evaluate with the first.
  let queue = Promise.resolve();

  /**
   * Evaluates and starts the code, from bar `from` (0-based) if given.
   * Throws if Strudel reports an error in it.
   */
  function play(code, { from = 0 } = {}) {
    const run = queue.then(() => playNow(code, from));
    queue = run.catch(() => {});
    return run;
  }

  async function playNow(code, from) {
    await init();
    await strudel.getAudioContext?.().resume?.();
    evalError = null;
    // Stopping first resets the clock, so every track starts at bar 1
    // instead of wherever the previous one was.
    if (playing) strudel.hush();
    const pattern = await strudel.evaluate(code);
    if (evalError || !pattern) {
      playing = false;
      throw evalError ?? new Error('The code did not produce a pattern.');
    }
    playing = true;
    seekFloor = null;
    if (from > 0) seek(from);
  }

  function stop() {
    if (strudel) strudel.hush();
    playing = false;
    seekFloor = null;
  }

  // Every orbit a track may duck has to exist before the first kick asks for it,
  // or Strudel reports "duck target orbit does not exist". A silent note creates each one.
  // Strudel drops notes scheduled in the past without creating their orbit, and on a busy
  // machine the clock moves on while these are set up, so they start well ahead.
  function createOrbits() {
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
    // Notes already started hang off Strudel's current output. Resetting it
    // drops them (and their reverb tails) at once.
    strudel.resetGlobalEffects();
    createOrbits();
    // The scheduler starts its next query at lastEnd. With the tick count at zero,
    // that tick also becomes the new reference for timing, as after a tempo change.
    scheduler.lastEnd = target;
    scheduler.num_ticks_since_cps_change = 0;
    seekFloor = target;
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

  return { init, play, stop, seek, position, isPlaying: () => playing };
}
