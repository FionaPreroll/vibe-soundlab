// Browser entry point.
import { createApp } from './app.js';
import { createEngine } from './engine.js';

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

const app = await createApp({
  root: document.querySelector('[data-role=app]'),
  engine: createEngine(),
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
