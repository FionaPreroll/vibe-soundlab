// The mixer and EQ panels: builds their controls, keeps the settings (and
// remembers them), passes them to the audio graph once it exists, and draws the
// channel visualizers and the EQ view.
import { EQ_BANDS, EQ_RANGE_DB, FADER_MAX_DB, FADER_MIN_DB, CHANNELS, STORAGE_KEY, channelGain, dbToGain, defaultMix, formatDb, isAudible, isDefaultMix, parseMix } from './mixer.js';
import { createMeter, drawChannel, drawEq, peakDb, spectrumBands } from './meters.js';

// One colour per orbit; they read on both the dark and the light theme.
export const CHANNEL_COLORS = {
  1: '#f97316',
  2: '#8b5cf6',
  3: '#06b6d4',
  4: '#eab308',
  5: '#22c55e',
  6: '#ec4899',
  7: '#3b82f6',
  8: '#84cc16',
  master: '#7cc4ff',
};

const FRAME_MS = 1000 / 30;

export function createMixerPanel({ mixerRoot, eqRoot, engine, storage = null }) {
  const doc = mixerRoot.ownerDocument;
  let mix = defaultMix();
  try {
    mix = parseMix(storage?.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    // Blocked storage: start flat.
  }
  let eqTarget = 'master';
  let graph = null;

  const make = (tag, props = {}, children = []) => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
  };

  const settingsOf = (target) => (target === 'master' ? mix.master : mix.channels[target]);
  const nameOf = (target) => (target === 'master' ? 'Master' : CHANNELS.find((c) => c.orbit === target).name);

  // ---------- strips ----------
  const stripsEl = mixerRoot.querySelector('[data-role=strips]');
  const resetButton = mixerRoot.querySelector('[data-role=mix-reset]');
  const strips = new Map();

  function buildStrip(target) {
    const name = nameOf(target);
    const canvas = make('canvas', { class: 'viz', width: '56', height: '72', 'aria-hidden': 'true' });
    const fader = make('input', {
      type: 'range',
      class: 'fader',
      min: String(FADER_MIN_DB),
      max: String(FADER_MAX_DB),
      step: '0.5',
      'aria-label': `${name} volume`,
    });
    const readout = make('output', { class: 'db' });
    const label = make('button', { type: 'button', class: 'name', text: name, title: `Show ${name} in the EQ` });
    const strip = make('div', { class: 'strip', 'data-target': String(target) }, [canvas, fader, readout]);
    strip.style.setProperty('--strip', CHANNEL_COLORS[target]);
    const entry = { strip, canvas, fader, readout, label, meter: createMeter() };
    if (target !== 'master') {
      const mute = make('button', { type: 'button', class: 'mute', text: 'M', title: `Mute ${name}` });
      const solo = make('button', { type: 'button', class: 'solo', text: 'S', title: `Solo ${name}` });
      mute.addEventListener('click', () => update(() => (mix.channels[target].mute = !mix.channels[target].mute)));
      solo.addEventListener('click', () => update(() => (mix.channels[target].solo = !mix.channels[target].solo)));
      strip.append(make('div', { class: 'ms' }, [mute, solo]));
      Object.assign(entry, { mute, solo });
    } else {
      strip.classList.add('master');
    }
    strip.append(label);
    fader.addEventListener('input', () => update(() => (settingsOf(target).gain = Number(fader.value))));
    fader.addEventListener('dblclick', () => update(() => (settingsOf(target).gain = 0)));
    label.addEventListener('click', () => setEqTarget(target));
    strips.set(target, entry);
    return strip;
  }

  stripsEl.replaceChildren(...CHANNELS.map(({ orbit }) => buildStrip(orbit)), buildStrip('master'));

  // ---------- EQ ----------
  const targetSelect = eqRoot.querySelector('[data-role=eq-target]');
  const flatButton = eqRoot.querySelector('[data-role=eq-flat]');
  const eqCanvas = eqRoot.querySelector('[data-role=eq-view]');
  const bandsEl = eqRoot.querySelector('[data-role=eq-bands]');
  targetSelect.replaceChildren(
    make('option', { value: 'master', text: 'Master' }),
    ...CHANNELS.map(({ orbit, name }) => make('option', { value: String(orbit), text: name })),
  );
  const bandInputs = EQ_BANDS.map((band, i) => {
    const input = make('input', {
      type: 'range',
      class: 'band',
      min: String(-EQ_RANGE_DB),
      max: String(EQ_RANGE_DB),
      step: '0.5',
      'aria-label': `${band.label} Hz`,
    });
    const readout = make('output', { class: 'db' });
    input.addEventListener('input', () => update(() => (settingsOf(eqTarget).eq[i] = Number(input.value))));
    input.addEventListener('dblclick', () => update(() => (settingsOf(eqTarget).eq[i] = 0)));
    bandsEl.append(make('div', { class: 'eq-band' }, [readout, input, make('span', { class: 'freq', text: band.label })]));
    return { input, readout };
  });
  targetSelect.addEventListener('change', () => setEqTarget(targetSelect.value === 'master' ? 'master' : Number(targetSelect.value)));
  flatButton.addEventListener('click', () => update(() => (settingsOf(eqTarget).eq = EQ_BANDS.map(() => 0))));
  resetButton.addEventListener('click', () => update(() => (mix = defaultMix())));

  function setEqTarget(target) {
    eqTarget = target;
    render();
  }

  // ---------- state ----------
  // The graph appears with the first track played; settings made before then wait for it.
  function apply() {
    graph = engine.mixer();
    if (!graph) return;
    for (const { orbit } of CHANNELS) graph.set(orbit, { gain: channelGain(mix, orbit), eq: mix.channels[orbit].eq });
    graph.set('master', { gain: dbToGain(mix.master.gain), eq: mix.master.eq });
  }

  function save() {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(mix));
    } catch {
      // Not remembered, but still applied.
    }
  }

  function update(change) {
    change();
    apply();
    save();
    render();
  }

  function render() {
    for (const [target, entry] of strips) {
      const settings = settingsOf(target);
      entry.fader.value = String(settings.gain);
      entry.readout.textContent = formatDb(settings.gain);
      entry.label.setAttribute('aria-pressed', String(target === eqTarget));
      if (target !== 'master') {
        entry.mute.setAttribute('aria-pressed', String(settings.mute));
        entry.solo.setAttribute('aria-pressed', String(settings.solo));
        entry.strip.classList.toggle('silent', !isAudible(mix, target));
      }
    }
    targetSelect.value = String(eqTarget);
    const gains = settingsOf(eqTarget).eq;
    bandInputs.forEach(({ input, readout }, i) => {
      input.value = String(gains[i]);
      readout.textContent = gains[i] === 0 ? '0' : `${gains[i] > 0 ? '+' : '−'}${Math.abs(gains[i])}`;
    });
    eqRoot.style.setProperty('--strip', CHANNEL_COLORS[eqTarget]);
    resetButton.disabled = isDefaultMix(mix);
    flatButton.disabled = gains.every((g) => g === 0);
  }

  // ---------- drawing ----------
  const buffers = new Map();
  function read(analyser, kind) {
    const key = `${kind}:${analyser.fftSize}`;
    let byKind = buffers.get(analyser);
    if (!byKind) buffers.set(analyser, (byKind = {}));
    if (!byKind[key]) byKind[key] = new Float32Array(kind === 'freq' ? analyser.frequencyBinCount : analyser.fftSize);
    if (kind === 'freq') analyser.getFloatFrequencyData(byKind[key]);
    else analyser.getFloatTimeDomainData(byKind[key]);
    return byKind[key];
  }

  // Matches the canvas's pixel size to its size on screen.
  function fit(canvas) {
    const ratio = doc.defaultView?.devicePixelRatio ?? 1;
    const width = Math.round((canvas.clientWidth || Number(canvas.getAttribute('width'))) * ratio);
    const height = Math.round((canvas.clientHeight || Number(canvas.getAttribute('height'))) * ratio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return { width, height };
  }

  let lastFrame = -Infinity;
  /** Draws the visualizers; call it every animation frame with the frame time in ms. */
  function draw(now) {
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;
    if (engine.mixer() !== graph) apply();
    const live = graph !== null && engine.isPlaying();
    for (const [target, entry] of strips) {
      const g = entry.canvas.getContext('2d');
      if (!g) continue;
      const size = fit(entry.canvas);
      const analyser = live ? graph.analyser(target) : null;
      const bands = analyser ? spectrumBands(read(analyser, 'freq'), graph.sampleRate, 14) : new Array(14).fill(0);
      const { level, peak } = entry.meter.update(analyser ? peakDb(read(analyser, 'time')) : -Infinity, now);
      drawChannel(g, { ...size, bands, level, peak, color: CHANNEL_COLORS[target], muted: target !== 'master' && !isAudible(mix, target) });
    }
    const g = eqCanvas.getContext('2d');
    if (g) {
      const style = doc.defaultView.getComputedStyle(eqRoot);
      const analyser = live ? graph.analyser(eqTarget) : null;
      drawEq(g, {
        ...fit(eqCanvas),
        data: analyser ? read(analyser, 'freq') : null,
        sampleRate: graph?.sampleRate ?? 48000,
        gains: settingsOf(eqTarget).eq,
        colors: {
          grid: style.getPropertyValue('--line').trim() || '#263041',
          spectrum: `${CHANNEL_COLORS[eqTarget]}55`,
          curve: CHANNEL_COLORS[eqTarget],
        },
      });
    }
  }

  render();
  return { draw, settings: () => mix, setEqTarget, eqTarget: () => eqTarget };
}
