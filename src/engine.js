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

export function createEngine({ load = () => import(STRUDEL_URL) } = {}) {
  let strudel = null;
  let repl = null;
  let ready = null;
  let evalError = null;
  let playing = false;

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

  /** Evaluates and starts the code. Throws if Strudel reports an error in it. */
  function play(code) {
    const run = queue.then(() => playNow(code));
    queue = run.catch(() => {});
    return run;
  }

  async function playNow(code) {
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
  }

  function stop() {
    if (strudel) strudel.hush();
    playing = false;
  }

  /** Current position in bars (cycles) since playback started, or null when stopped. */
  function position() {
    if (!playing || !repl?.scheduler) return null;
    return repl.scheduler.now();
  }

  return { init, play, stop, position, isPlaying: () => playing };
}
