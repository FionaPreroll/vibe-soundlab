// Browser entry point.
import { createApp } from './app.js';
import { createEngine } from './engine.js';
import { createVisuals } from './visuals.js';

function safeStorage() {
  try {
    const probe = '__vibe-player__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

// Tracks call initHydra() and H() as on strudel.cc, so both are globals.
let engine = null;
let app = null;
const visuals = createVisuals({
  canvas: document.querySelector('[data-role=visuals]'),
  now: () => engine.position(),
  onError: (err) => app?.visualsError(err),
});
window.initHydra = visuals.initHydra;
window.H = visuals.H;
engine = createEngine({ visuals, onPlaybackError: (err, info) => app?.playbackError(err, info) });

app = await createApp({
  root: document.querySelector('[data-role=app]'),
  engine,
  visuals,
  fetchFn: (url) => fetch(url),
  storage: safeStorage(),
  location: window.location,
});
setInterval(() => app.updateProgress(), 100);
const frame = (now) => {
  app.drawFrame(now);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
window.vibePlayer = app;
