import { Engine, renderRiff } from './engine.js';
import { averageSpectrum, bandLevels, compareBands, BANDS } from './dsp.js';
import { MODULES, CONTROLS, START, TARGET, STEPS, stepTips, unlockedControls } from './lesson.js';
import { createKnob, createSelect, toNorm, fromNorm } from './ui.js';
import { SpectrumView, Scope } from './spectrum.js';

const STORE_KEY = 'vibe-soundlab.foghorn.v1';
const MATCH_DB = 4;

const $ = (id) => document.getElementById(id);

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (s && s.params) return { params: { ...START, ...s.params }, step: Math.min(STEPS.length - 1, s.step | 0) };
  } catch (e) { /* storage unavailable */ }
  return { params: { ...START }, step: 0 };
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ params: state.params, step: state.step }));
  } catch (e) { /* storage unavailable */ }
}

const state = {
  ...load(),
  engine: null,
  playing: false,
  targetMode: false,
  source: 'bass',
  targetDb: null,
  targetBands: null,
  avgPower: null,
  avgFrames: 0,
  diff: null,
};

const widgets = {};

// ---------- Rack ----------

function onParam(id, v) {
  state.params[id] = v;
  if (state.engine && !state.targetMode) state.engine.synth.set(id, v);
  save();
  renderFeedback();
}

function buildRack() {
  const flow = $('flow');
  const flowNodes = [
    ['osc', 'OSC'], ['pitch', 'PITCH'], ['dist', 'LOW CUT → DRIVE'], ['filter', 'FILTER'], ['out', '+ SUB → OUT'],
  ];
  flow.innerHTML = flowNodes
    .map(([m, l], i) => `${i ? '<span class="arrow">→</span>' : ''}<span class="node" data-module="${m}">${l}</span>`)
    .join('');

  const root = $('modules');
  for (const m of MODULES) {
    const mod = document.createElement('div');
    mod.className = 'module';
    mod.dataset.module = m.id;
    mod.innerHTML = `<div class="module-head"><span class="module-name">${m.label}</span><span class="module-hint">${m.hint}</span></div>
      <div class="controls"></div><div class="lock-note"></div>`;
    const box = mod.querySelector('.controls');
    for (const c of CONTROLS.filter((c) => c.module === m.id)) {
      const w = c.type === 'select'
        ? createSelect(c, state.params[c.id], (v) => onParam(c.id, v))
        : createKnob(c, state.params[c.id], START[c.id], (v) => onParam(c.id, v));
      widgets[c.id] = w;
      box.appendChild(w.el);
    }
    root.appendChild(mod);
  }
}

function applyLocks() {
  const unlocked = unlockedControls(state.step);
  const step = STEPS[state.step];
  const focus = new Set(step.final ? [] : step.controls);
  for (const c of CONTROLS) {
    const w = widgets[c.id];
    w.el.classList.toggle('locked', !unlocked.has(c.id));
    w.el.classList.toggle('focus', focus.has(c.id));
  }
  for (const mod of document.querySelectorAll('.module')) {
    const id = mod.dataset.module;
    const ctrls = CONTROLS.filter((c) => c.module === id);
    const open = ctrls.some((c) => unlocked.has(c.id));
    mod.classList.toggle('locked', !open);
    mod.classList.toggle('focus', ctrls.some((c) => focus.has(c.id)));
    const first = STEPS.findIndex((s) => s.controls.some((cid) => ctrls.some((c) => c.id === cid)));
    mod.querySelector('.lock-note').textContent = `Unlocks in step ${first + 1}`;
  }
  for (const node of document.querySelectorAll('.flow .node')) {
    const ctrls = CONTROLS.filter((c) => c.module === node.dataset.module);
    node.classList.toggle('active', ctrls.some((c) => unlocked.has(c.id)));
  }
}

// ---------- Lesson ----------

function buildStepList() {
  const list = $('step-list');
  STEPS.forEach((s, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${i + 1}`;
    b.title = s.title;
    b.addEventListener('click', () => goTo(i));
    li.appendChild(b);
    list.appendChild(li);
  });
}

function goTo(i) {
  state.step = Math.max(0, Math.min(STEPS.length - 1, i));
  save();
  renderStep();
}

function renderStep() {
  const s = STEPS[state.step];
  $('step-kicker').textContent = `Step ${state.step + 1} of ${STEPS.length}`;
  $('step-title').textContent = s.title;
  $('step-why').textContent = s.why;
  $('step-todo').innerHTML = '';
  for (const t of s.todo) {
    const li = document.createElement('li');
    li.textContent = t;
    $('step-todo').appendChild(li);
  }
  $('step-listen').textContent = s.listen;
  $('back').disabled = state.step === 0;
  $('next').disabled = state.step === STEPS.length - 1;
  [...$('step-list').querySelectorAll('button')].forEach((b, i) => {
    b.classList.toggle('current', i === state.step);
    b.classList.toggle('done', i < state.step);
  });
  applyLocks();
  renderFeedback();
}

function renderFeedback() {
  const s = STEPS[state.step];
  const box = $('step-feedback');
  box.innerHTML = '';
  const add = (cls, text) => {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    box.appendChild(d);
  };
  if (s.final) {
    if (!state.diff) add('tip', 'Play the loop for a few seconds so the band check can measure your sound.');
    else {
      const off = BANDS.filter((b) => Math.abs(state.diff[b.id]) > MATCH_DB);
      if (!off.length) add('good', 'All five bands match the target. That is the foghorn.');
      for (const b of off) {
        const d = state.diff[b.id];
        add('tip', `${b.label}: ${d > 0 ? '+' : ''}${d.toFixed(1)} dB against the target. ${bandAdvice(b.id, d)}`);
      }
    }
    return;
  }
  const tips = stepTips(s, state.params);
  if (tips.length) tips.forEach((t) => add('tip', t));
  else add('good', 'Looks good. Move on when it sounds right to you.');
  $('next').classList.toggle('primary', tips.length === 0);
}

function bandAdvice(id, d) {
  const more = d < 0;
  switch (id) {
    case 'sub': return more ? 'Raise the Sub level.' : 'Lower the Sub level.';
    case 'lowmid': return more ? 'Lower Low Cut a little or add Drive.' : 'Raise Low Cut so less low-mid energy reaches the distortion.';
    case 'mid': return more ? 'Open the Cutoff or raise Mids.' : 'Lower the Cutoff a little.';
    case 'presence': return more ? 'Open the Cutoff, add Reso or more Drive.' : 'Lower the Cutoff or reduce Drive.';
    case 'air': return more ? 'Open the Cutoff.' : 'Lower the Cutoff to tame the fizz.';
    default: return '';
  }
}

// Moves the current step's controls to the target values, slowly enough to watch.
function showMe() {
  const s = STEPS[state.step];
  const ids = s.final ? CONTROLS.map((c) => c.id) : s.controls;
  const tweens = [];
  for (const id of ids) {
    const c = CONTROLS.find((x) => x.id === id);
    if (c.type === 'select') {
      widgets[id].render(TARGET[id]);
      onParam(id, TARGET[id]);
    } else {
      tweens.push({ c, from: toNorm(c, state.params[id]), to: toNorm(c, TARGET[id]) });
    }
  }
  const t0 = performance.now();
  const dur = 1400;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    for (const t of tweens) {
      const v = k === 1 ? TARGET[t.c.id] : fromNorm(t.c, t.from + (t.to - t.from) * e);
      widgets[t.c.id].render(v);
      onParam(t.c.id, v);
    }
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- Audio ----------

async function startAudio() {
  if (!state.engine) {
    state.engine = new Engine(state.params);
    state.engine.setVolume(Number($('volume').value));
    computeTarget();
  }
  await state.engine.start();
  state.playing = true;
  $('play').textContent = 'Stop';
  $('play').disabled = false;
}

function stopAudio() {
  state.engine?.stop();
  state.playing = false;
  $('play').textContent = 'Play';
}

async function computeTarget() {
  const { mono, sampleRate } = await renderRiff(TARGET, state.engine.ctx.sampleRate);
  state.targetDb = averageSpectrum(mono, 8192);
  state.targetBands = bandLevels(state.targetDb, sampleRate);
}

function setTargetMode(on) {
  state.targetMode = on;
  const b = $('target');
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on);
  if (state.engine) state.engine.synth.applyAll(on ? TARGET : state.params);
}

// ---------- Meters and spectrum ----------

const freqBuf = new Float32Array(4096);
const timeBuf = new Float32Array(2048);
const loudBlocks = [];
let peakHold = -Infinity;
let lastBandUpdate = 0;

function meanSquare(analyser) {
  analyser.getFloatTimeDomainData(timeBuf);
  let s = 0;
  for (let i = 0; i < timeBuf.length; i++) s += timeBuf[i] * timeBuf[i];
  return s / timeBuf.length;
}

function updateMeters(now) {
  const e = state.engine;
  const ms = meanSquare(e.loudTaps[0]) + meanSquare(e.loudTaps[1]);
  loudBlocks.push({ t: now, ms });
  while (loudBlocks.length && now - loudBlocks[0].t > 3000) loudBlocks.shift();
  const mean = loudBlocks.reduce((s, b) => s + b.ms, 0) / loudBlocks.length;
  const lufs = -0.691 + 10 * Math.log10(mean + 1e-12);
  $('lufs').textContent = lufs < -70 ? '– LUFS' : `${lufs.toFixed(1)} LUFS`;

  e.peakTap.getFloatTimeDomainData(timeBuf);
  let pk = 0;
  for (let i = 0; i < timeBuf.length; i++) pk = Math.max(pk, Math.abs(timeBuf[i]));
  const pkDb = 20 * Math.log10(pk + 1e-12);
  peakHold = Math.max(pkDb, peakHold - 0.15);
  $('peak').textContent = peakHold < -70 ? '– dB' : `${peakHold.toFixed(1)} dB`;
  $('peak').classList.toggle('hot', peakHold > -0.3);
}

// Average of the bass spectrum over the last few seconds (about one loop), as a sliding window
// so old settings drop out completely instead of fading slowly.
const WINDOW_MS = 3000;
const history = [];

function accumulate(now) {
  const e = state.engine;
  e.bassAnalyser.getFloatFrequencyData(freqBuf);
  if (!state.avgPower) state.avgPower = new Float64Array(freqBuf.length);
  const p = new Float32Array(freqBuf.length);
  for (let k = 0; k < freqBuf.length; k++) {
    p[k] = Number.isFinite(freqBuf[k]) ? Math.pow(10, freqBuf[k] / 10) : 0;
    state.avgPower[k] += p[k];
  }
  history.push({ t: now, p });
  while (history.length && now - history[0].t > WINDOW_MS) {
    const old = history.shift();
    for (let k = 0; k < old.p.length; k++) state.avgPower[k] -= old.p[k];
  }
  state.avgFrames = history.length;
}

function avgDb() {
  const n = Math.max(1, history.length);
  const out = new Float32Array(state.avgPower.length);
  for (let k = 0; k < out.length; k++) out[k] = 10 * Math.log10(Math.max(0, state.avgPower[k]) / n + 1e-20);
  return out;
}

function renderBands() {
  const root = $('bands');
  root.innerHTML = '';
  for (const b of BANDS) {
    const d = state.diff ? state.diff[b.id] : null;
    const cell = document.createElement('div');
    cell.className = 'band' + (d == null ? '' : Math.abs(d) <= MATCH_DB ? ' ok' : ' off');
    const range = `${b.lo >= 1000 ? b.lo / 1000 + 'k' : b.lo}–${b.hi >= 1000 ? b.hi / 1000 + 'k' : b.hi} Hz`;
    cell.innerHTML = `<span class="band-label">${b.label}</span><span class="band-value">${
      d == null ? '–' : `${d > 0 ? '+' : ''}${d.toFixed(1)} dB`}</span><span class="band-range">${range}</span>`;
    root.appendChild(cell);
  }
  const note = $('band-note');
  if (!state.diff) note.textContent = 'Play the loop to start the band check.';
  else {
    const ok = BANDS.filter((b) => Math.abs(state.diff[b.id]) <= MATCH_DB).length;
    note.textContent = `${ok} of ${BANDS.length} bands within ±${MATCH_DB} dB of the target. Values are your level minus the target's, after matching overall volume.`;
  }
}

function frame(now) {
  const e = state.engine;
  let live = null;
  let offset = 0;
  if (e && state.playing) {
    updateMeters(now);
    if (!state.targetMode) accumulate(now);
    const an = state.source === 'bass' ? e.bassAnalyser : e.mixAnalyser;
    an.getFloatFrequencyData(freqBuf);
    live = freqBuf;
    if (state.targetBands && state.avgFrames > 30 && now - lastBandUpdate > 300) {
      lastBandUpdate = now;
      const mine = bandLevels(avgDb(), e.ctx.sampleRate);
      state.diff = compareBands(mine, state.targetBands);
      renderBands();
      if (STEPS[state.step].final) renderFeedback();
    }
    if (state.targetBands && state.avgFrames > 30) {
      const total = (lv) => 10 * Math.log10(BANDS.reduce((s, b) => s + Math.pow(10, lv[b.id] / 10), 0));
      offset = total(bandLevels(avgDb(), e.ctx.sampleRate)) - total(state.targetBands);
    }
    scope.draw(an, getComputedStyle(document.documentElement).getPropertyValue(state.targetMode ? '--target' : '--accent'));
  }
  const showTarget = state.source === 'bass' && state.targetDb && state.avgFrames > 30;
  spectrum.draw(live, showTarget ? state.targetDb : null, e ? e.ctx.sampleRate : 48000, offset);
  requestAnimationFrame(frame);
}

// ---------- Wiring ----------

let spectrum;
let scope;

function init() {
  buildRack();
  buildStepList();
  renderStep();
  renderBands();
  spectrum = new SpectrumView($('spectrum'));
  scope = new Scope($('scope'));

  $('start').addEventListener('click', async () => {
    $('overlay').classList.add('hidden');
    await startAudio();
  });
  $('play').addEventListener('click', () => (state.playing ? stopAudio() : startAudio()));
  $('drums').addEventListener('click', (ev) => {
    const on = !ev.currentTarget.classList.contains('on');
    ev.currentTarget.classList.toggle('on', on);
    ev.currentTarget.setAttribute('aria-pressed', on);
    state.engine?.setDrums(on);
  });
  $('target').addEventListener('click', () => setTargetMode(!state.targetMode));
  $('volume').addEventListener('input', (ev) => state.engine?.setVolume(Number(ev.target.value)));
  $('back').addEventListener('click', () => goTo(state.step - 1));
  $('next').addEventListener('click', () => goTo(state.step + 1));
  $('show').addEventListener('click', showMe);
  $('reset').addEventListener('click', () => {
    for (const c of CONTROLS) {
      widgets[c.id].render(START[c.id]);
      onParam(c.id, START[c.id]);
    }
  });
  for (const b of document.querySelectorAll('.analysis-head .seg button')) {
    b.addEventListener('click', () => {
      state.source = b.dataset.src;
      for (const o of document.querySelectorAll('.analysis-head .seg button')) {
        o.classList.toggle('on', o === b);
        o.setAttribute('aria-checked', o === b);
      }
    });
  }
  document.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space' && !(ev.target instanceof HTMLInputElement) && state.engine) {
      ev.preventDefault();
      state.playing ? stopAudio() : startAudio();
    }
  });
  requestAnimationFrame(frame);
}

init();
