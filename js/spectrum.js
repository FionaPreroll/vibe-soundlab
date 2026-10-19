// Log-frequency spectrum display with an optional target curve, plus a small oscilloscope.

import { BANDS } from './dsp.js';

const F_MIN = 20;
const F_MAX = 20000;
const DB_MIN = -100;
const DB_MAX = -10;
const POINTS = 220;

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Smooths a dB-per-bin spectrum to 1/6 octave at POINTS log-spaced frequencies.
export function smoothSpectrum(dbBins, sampleRate) {
  const binHz = sampleRate / (dbBins.length * 2);
  const out = new Float32Array(POINTS);
  for (let i = 0; i < POINTS; i++) {
    const f = F_MIN * Math.pow(F_MAX / F_MIN, i / (POINTS - 1));
    const lo = Math.max(1, Math.floor((f * Math.pow(2, -1 / 12)) / binHz));
    const hi = Math.min(dbBins.length - 1, Math.max(lo, Math.ceil((f * Math.pow(2, 1 / 12)) / binHz)));
    let sum = 0;
    for (let k = lo; k <= hi; k++) sum += Math.pow(10, dbBins[k] / 10);
    out[i] = 10 * Math.log10(sum / (hi - lo + 1) + 1e-20);
  }
  return out;
}

export class SpectrumView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.colors = {};
    this.refreshColors();
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    this.resize();
  }

  refreshColors() {
    this.colors = {
      grid: css('--grid'),
      text: css('--text-dim'),
      live: css('--accent'),
      liveFill: css('--accent-fill'),
      target: css('--target'),
      band: css('--band'),
    };
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(10, r.width);
    this.h = Math.max(10, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  x(f) {
    return (Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN)) * this.w;
  }

  y(db) {
    const n = (db - DB_MIN) / (DB_MAX - DB_MIN);
    return this.h - Math.min(1, Math.max(0, n)) * (this.h - 14) - 2;
  }

  draw(live, target, sampleRate, offset = 0) {
    const c = this.ctx;
    const { w, h } = this;
    c.clearRect(0, 0, w, h);

    // Check bands as soft columns.
    c.fillStyle = this.colors.band;
    for (const b of BANDS) c.fillRect(this.x(b.lo), 0, this.x(b.hi) - this.x(b.lo), h);

    c.strokeStyle = this.colors.grid;
    c.fillStyle = this.colors.text;
    c.lineWidth = 1;
    c.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
      const x = Math.round(this.x(f)) + 0.5;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
      c.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x + 3, h - 4);
    }
    for (let db = -90; db <= -20; db += 10) {
      const y = Math.round(this.y(db)) + 0.5;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }

    const path = (pts, shift) => {
      c.beginPath();
      for (let i = 0; i < POINTS; i++) {
        const f = F_MIN * Math.pow(F_MAX / F_MIN, i / (POINTS - 1));
        const px = this.x(f);
        const py = this.y(pts[i] + shift);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
    };

    if (live) {
      const pts = smoothSpectrum(live, sampleRate);
      path(pts, 0);
      c.lineTo(w, h);
      c.lineTo(0, h);
      c.closePath();
      c.fillStyle = this.colors.liveFill;
      c.fill();
      path(pts, 0);
      c.strokeStyle = this.colors.live;
      c.lineWidth = 1.5;
      c.stroke();
    }

    if (target) {
      // offset lines the target up with the live level so only the shape is compared.
      path(smoothSpectrum(target, sampleRate), offset);
      c.strokeStyle = this.colors.target;
      c.lineWidth = 1.5;
      c.setLineDash([5, 4]);
      c.stroke();
      c.setLineDash([]);
    }
  }
}

export class Scope {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.buf = new Float32Array(2048);
  }

  draw(analyser, color) {
    const c = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    if (this.canvas.width !== Math.round(r.width * dpr)) {
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
    }
    const w = this.canvas.width;
    const h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    if (!analyser) return;
    analyser.getFloatTimeDomainData(this.buf);
    // Find a rising zero crossing so the wave stands still.
    let start = 0;
    for (let i = 1; i < 1024; i++) {
      if (this.buf[i - 1] < 0 && this.buf[i] >= 0) {
        start = i;
        break;
      }
    }
    c.strokeStyle = color;
    c.lineWidth = 1.5 * dpr;
    c.beginPath();
    const n = 1024;
    for (let i = 0; i < n; i++) {
      const v = this.buf[start + i] || 0;
      const x = (i / (n - 1)) * w;
      const y = h / 2 - v * (h / 2) * 0.9;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
}
