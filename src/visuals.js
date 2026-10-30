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

// Hydra's browser build sets window.Hydra when it loads.
const loadHydra = async (win) => {
  await import(HYDRA_URL);
  return win.Hydra;
};

/**
 * `canvas` is drawn on full screen, at `scale` of the window size (Hydra's
 * shaders are soft, so half resolution saves a lot of work). `now()` returns the
 * music's position in bars, or null when nothing plays.
 */
export function createVisuals({ canvas, now = () => null, load = loadHydra, scale = 0.5 }) {
  const win = canvas.ownerDocument.defaultView;
  let hydra = null;
  let starting = null;
  let used = false; // the current track called initHydra()
  let running = false; // the current track is playing
  let enabled = true;
  let frame = null;
  let last = 0;

  function size() {
    const width = Math.max(1, Math.round(win.innerWidth * scale));
    const height = Math.max(1, Math.round(win.innerHeight * scale));
    return { width, height };
  }

  async function start() {
    try {
      const Hydra = await load(win);
      hydra = new Hydra({ canvas, ...size(), detectAudio: false, makeGlobal: true, autoLoop: false, precision: 'mediump' });
    } catch (err) {
      console.warn('No visuals, Hydra did not start:', err?.message ?? err);
      const stub = inertHydra();
      for (const name of HYDRA_GLOBALS) win[name] = stub;
    }
  }

  /** What track code calls as initHydra(): loads Hydra once and makes its functions global. */
  async function initHydra() {
    used = true;
    starting ??= start();
    await starting;
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
    hydra.tick(dt);
  }

  // Shows the canvas and runs Hydra only while a track with visuals plays.
  function update() {
    const visible = enabled && running && used && hydra !== null;
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
    /** Before a track's code runs: forget the last track's visuals. */
    beforeRun() {
      used = false;
      hydra?.hush();
    },
    /** After a track's code ran and it plays. */
    afterRun() {
      running = true;
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
