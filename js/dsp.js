// Pure DSP helpers. No Web Audio here, so these run in Node tests too.

export const HARMONICS = 256;

// Wavetable frames, described by the amplitude of each harmonic (1..n).
// Position 0..1 morphs through them in order, like scrolling a Vital/Serum table.
const FRAMES = [
  { name: 'Sine', amp: (n) => (n === 1 ? 1 : 0) },
  { name: 'Triangle', amp: (n) => (n % 2 ? 1 / (n * n) : 0) },
  { name: 'Saw', amp: (n) => 1 / n },
  { name: 'Square', amp: (n) => (n % 2 ? 1 / n : 0) },
  // Narrow pulse: lots of upper harmonics, reads as "nasal" and aggressive.
  { name: 'Pulse', amp: (n) => Math.abs(Math.sin((Math.PI * n) / 8)) / n * 1.6 },
];

export const FRAME_NAMES = FRAMES.map((f) => f.name);

// Returns the sine-term amplitudes (index 0 unused, like PeriodicWave expects).
export function wavetableHarmonics(position, count = HARMONICS) {
  const p = Math.min(1, Math.max(0, position)) * (FRAMES.length - 1);
  const i = Math.min(FRAMES.length - 2, Math.floor(p));
  const t = p - i;
  const a = FRAMES[i];
  const b = FRAMES[i + 1];
  const imag = new Float32Array(count + 1);
  for (let n = 1; n <= count; n++) {
    imag[n] = a.amp(n) * (1 - t) + b.amp(n) * t;
  }
  return imag;
}

export function frameLabel(position) {
  const p = Math.min(1, Math.max(0, position)) * (FRAMES.length - 1);
  const i = Math.round(p);
  return Math.abs(p - i) < 0.08 ? FRAMES[i].name : `${FRAMES[Math.floor(p)].name} → ${FRAMES[Math.min(FRAMES.length - 1, Math.floor(p) + 1)].name}`;
}

// Waveshaper transfer curves. Input is already scaled by the drive gain.
export const SHAPES = {
  soft: (x) => Math.tanh(x),
  hard: (x) => Math.max(-1, Math.min(1, x)),
  fold: (x) => Math.sin(x * Math.PI / 2),
  asym: (x) => (x >= 0 ? Math.tanh(x) : Math.tanh(x * 0.6) * 0.8),
};

// Curve spans input -range..range so the drive gain before the shaper really pushes into it.
export function shaperCurve(type, size = 4096, range = 8) {
  const fn = SHAPES[type] || SHAPES.soft;
  const curve = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const x = ((i / (size - 1)) * 2 - 1) * range;
    curve[i] = fn(x);
  }
  return curve;
}

export function dbToGain(db) {
  return Math.pow(10, db / 20);
}

export function midiToHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// In-place radix-2 FFT. re/im are Float64Arrays of the same power-of-two length.
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// Average power spectrum (dB per bin) of a mono signal, Blackman window like AnalyserNode.
export function averageSpectrum(samples, size = 8192) {
  const win = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    win[i] = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / size) + 0.08 * Math.cos((4 * Math.PI * i) / size);
  }
  const power = new Float64Array(size / 2);
  let frames = 0;
  const hop = size / 2;
  for (let start = 0; start + size <= samples.length; start += hop) {
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i++) re[i] = samples[start + i] * win[i];
    fft(re, im);
    for (let k = 0; k < size / 2; k++) power[k] += (re[k] * re[k] + im[k] * im[k]) / (size * size);
    frames++;
  }
  const db = new Float32Array(size / 2);
  for (let k = 0; k < size / 2; k++) db[k] = 10 * Math.log10(power[k] / Math.max(1, frames) + 1e-20);
  return db;
}

// Bands used by the spectrum check (see the learning path document).
export const BANDS = [
  { id: 'sub', label: 'Sub', lo: 30, hi: 80 },
  { id: 'lowmid', label: 'Low mids', lo: 100, hi: 400 },
  { id: 'mid', label: 'Mids', lo: 400, hi: 1000 },
  { id: 'presence', label: 'Presence', lo: 2000, hi: 6000 },
  { id: 'air', label: 'Highs', lo: 6000, hi: 14000 },
];

// Energy per band in dB, from a dB-per-bin spectrum.
export function bandLevels(dbBins, sampleRate) {
  const binHz = sampleRate / (dbBins.length * 2);
  const out = {};
  for (const b of BANDS) {
    let sum = 0;
    let count = 0;
    for (let k = Math.ceil(b.lo / binHz); k <= Math.floor(b.hi / binHz) && k < dbBins.length; k++) {
      sum += Math.pow(10, dbBins[k] / 10);
      count++;
    }
    out[b.id] = 10 * Math.log10(sum + 1e-20);
  }
  return out;
}

// Compares two band-level sets after removing the overall level difference,
// so the check is about tonal balance, not volume.
export function compareBands(mine, target) {
  const ids = BANDS.map((b) => b.id);
  const total = (lv) => 10 * Math.log10(ids.reduce((s, id) => s + Math.pow(10, lv[id] / 10), 0));
  const offset = total(target) - total(mine);
  const diff = {};
  for (const id of ids) diff[id] = mine[id] + offset - target[id];
  return diff;
}
