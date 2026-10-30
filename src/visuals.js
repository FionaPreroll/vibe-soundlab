// Hydra visuals behind the player. A track starts them the way it would on strudel.cc:
//
//   await initHydra()
//   osc(30, .05, H("<.8 1.4>")).kaleid(4).out()
//
// H() turns a Strudel pattern into a number that Hydra reads every frame, at the
// position the music is at, so the visuals follow the bars, beats and parts.

export const HYDRA_VERSION = '1.4.0';
export const HYDRA_URL = `https://cdn.jsdelivr.net/npm/hydra-synth@${HYDRA_VERSION}/dist/hydra-synth.js`;

// The names Hydra puts on window: its sources, outputs and helpers.
export const HYDRA_GLOBALS = [
  'osc', 'noise', 'voronoi', 'shape', 'gradient', 'src', 'solid', 'prev',
  'o0', 'o1', 'o2', 'o3', 's0', 's1', 's2', 's3', 'render', 'hush', 'setResolution', 'update', 'speed', 'bpm',
];

/**
 * A stand-in for Hydra that accepts any chain (osc(10).kaleid(4).out(o0)) and draws
 * nothing. When Hydra can't run, tracks still play with it.
 */
export function inertHydra() {
  const chain = new Proxy(function hydraChain() {}, {
    get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : chain),
    apply: () => chain,
  });
  return chain;
}

// Hydra gives every array .fast(), .smooth() … for its own arguments, as properties
// for…in sees. Strudel runs the functions songs pass to all() with for…in, so after the
// first visuals it called Hydra's helpers too and every song with all() failed.
function hideArrayHelpers() {
  for (const name of Object.keys(Array.prototype)) Object.defineProperty(Array.prototype, name, { enumerable: false });
}

// Hydra's browser build sets window.Hydra when it loads.
const loadHydra = async (win) => {
  await import(HYDRA_URL);
  return win.Hydra;
};

/**
 * `canvas` is drawn on full screen, at `scale` of the window size (Hydra's
 * shaders are soft, so half resolution saves a lot of work). `now()` returns the
 * music's position in bars, or null when nothing plays. `onError(error)` hears when
 * the track's visuals throw while drawing; they stop until the code runs again.
 */
export function createVisuals({ canvas, now = () => null, load = loadHydra, scale = 0.5, onError = () => {} }) {
  const win = canvas.ownerDocument.defaultView;
  let hydra = null;
  let starting = null;
  let used = false; // the current track called initHydra()
  let usedBefore = false; // and the code that ran before it, in case the new code fails
  let broken = false; // the visuals threw while drawing
  let brokenBefore = false;
  let running = false; // the current track is playing
  let enabled = true;
  let frame = null;
  let last = 0;
  // What Hydra put on window. Before each track the player puts Strudel's own noise(),
  // shape(), speed() … back, so every track that starts Hydra gets these again.
  let globals = {};

  function size() {
    const width = Math.max(1, Math.round(win.innerWidth * scale));
    const height = Math.max(1, Math.round(win.innerHeight * scale));
    return { width, height };
  }

  async function start() {
    try {
      const Hydra = await load(win);
      hydra = new Hydra({ canvas, ...size(), detectAudio: false, makeGlobal: true, autoLoop: false, precision: 'mediump' });
      globals = Object.fromEntries(Object.keys(hydra.synth ?? {}).map((name) => [name, win[name]]));
      hideArrayHelpers();
    } catch (err) {
      console.warn('No visuals, Hydra did not start:', err?.message ?? err);
      const stub = inertHydra();
      globals = Object.fromEntries(HYDRA_GLOBALS.map((name) => [name, stub]));
    }
  }

  /** What track code calls as initHydra(): loads Hydra once and makes its functions global. */
  async function initHydra() {
    used = true;
    starting ??= start();
    await starting;
    Object.assign(win, globals);
  }

  /** What track code calls as H(pattern): a function returning the pattern's value right now. */
  function H(pattern) {
    if (typeof pattern === 'number') return () => pattern;
    return () => {
      const t = now();
      if (t == null || typeof pattern?.queryArc !== 'function') return 0;
      const value = Number(pattern.queryArc(t, t)[0]?.value);
      return Number.isFinite(value) ? value : 0;
    };
  }

  function tick(time) {
    frame = win.requestAnimationFrame(tick);
    const dt = last ? Math.min(100, time - last) : 16;
    last = time;
    try {
      hydra.tick(dt);
    } catch (err) {
      // A mistake in the visuals (a misspelled name in a function Hydra calls every
      // frame) would throw sixty times a second. They stop instead; the music plays on.
      broken = true;
      update();
      onError(err);
    }
  }

  // Shows the canvas and runs Hydra only while a track with visuals plays.
  function update() {
    const visible = enabled && running && used && !broken && hydra !== null;
    canvas.classList.toggle('on', visible);
    if (visible && frame === null) {
      last = 0;
      frame = win.requestAnimationFrame(tick);
    } else if (!visible && frame !== null) {
      win.cancelAnimationFrame(frame);
      frame = null;
    }
  }

  win.addEventListener('resize', () => {
    if (!hydra) return;
    const { width, height } = size();
    hydra.setResolution(width, height);
  });

  return {
    initHydra,
    H,
    /**
     * Before a track's code runs: forget the last track's visuals. For code changed
     * while it plays (`fresh: false`) they keep running until the new code replaces them.
     */
    beforeRun({ fresh = true } = {}) {
      usedBefore = used;
      brokenBefore = broken;
      used = false;
      broken = false;
      if (fresh) hydra?.hush();
    },
    /** After a track's code ran and it plays. */
    afterRun() {
      if (!used) hydra?.hush();
      running = true;
      update();
    },
    /** The changed code failed: the visuals that ran before it carry on. */
    failedRun() {
      used = usedBefore;
      broken = brokenBefore;
      update();
    },
    stop() {
      running = false;
      update();
    },
    setEnabled(on) {
      enabled = on;
      update();
    },
    isEnabled: () => enabled,
    isShowing: () => frame !== null,
  };
}
