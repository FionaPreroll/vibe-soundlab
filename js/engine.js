// Audio engine: a mono foghorn synth, a synthesized D&B drum loop and a master chain.
// The synth works in any BaseAudioContext, so the same code renders the target sound offline.

import { wavetableHarmonics, shaperCurve, dbToGain, midiToHz, HARMONICS } from './dsp.js';

export const BPM = 174;
export const STEPS = 32; // two bars of 16ths
export const STEP_SEC = 60 / BPM / 4;

// Bass riff in F minor. step = 16th index, len in 16ths, note = MIDI number (29 = F1).
export const RIFF = [
  { step: 0, len: 4, note: 29 },
  { step: 6, len: 3, note: 29 },
  { step: 10, len: 5, note: 29 },
  { step: 16, len: 4, note: 29 },
  { step: 22, len: 2, note: 32 },
  { step: 26, len: 5, note: 27 },
];

const KICKS = [0, 10, 16, 26];
const SNARES = [4, 12, 20, 28];

export const LFO_DIVISIONS = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/8T'];

export function lfoHz(division) {
  const beat = 60 / BPM;
  const beats = { '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/8T': 1 / 3 }[division] ?? 1;
  return 1 / (beat * beats);
}

export class FoghornSynth {
  constructor(ctx, params) {
    this.ctx = ctx;
    this.params = { ...params };
    this.lastHz = midiToHz(29);

    // Shared pitch sources: every oscillator follows these, so one automation moves the whole stack.
    this.pitch = ctx.createConstantSource();
    this.pitch.offset.value = this.lastHz;
    this.subPitch = ctx.createConstantSource();
    this.subPitch.offset.value = this.lastHz;

    this.oscSum = ctx.createGain();

    // Mid path: low cut, then parallel dry/driven, then filter.
    this.lowCut = ctx.createBiquadFilter();
    this.lowCut.type = 'highpass';
    this.lowCut.Q.value = 0.7;
    this.dry = ctx.createGain();
    this.drive = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '4x';
    this.wet = ctx.createGain();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.midLevel = ctx.createGain();

    this.lfo = ctx.createOscillator();
    this.lfoDepth = ctx.createGain();
    this.lfo.connect(this.lfoDepth).connect(this.filter.frequency);

    // Sub path: clean sine, always mono.
    this.sub = ctx.createOscillator();
    this.sub.type = 'sine';
    this.sub.frequency.value = 0;
    this.subPitch.connect(this.sub.frequency);
    this.subLevel = ctx.createGain();

    this.env = ctx.createGain();
    this.env.gain.value = 0;
    this.output = ctx.createGain();

    this.oscSum.connect(this.lowCut);
    this.lowCut.connect(this.dry).connect(this.filter);
    this.lowCut.connect(this.drive).connect(this.shaper).connect(this.wet).connect(this.filter);
    this.filter.connect(this.midLevel).connect(this.env);
    this.sub.connect(this.subLevel).connect(this.env);
    this.env.connect(this.output);

    this.voices = [];
    this.buildVoices();
    this.applyAll(this.params);

    this.pitch.start();
    this.subPitch.start();
    this.lfo.start();
    this.sub.start();
  }

  buildVoices() {
    for (const v of this.voices) {
      v.osc.stop();
      v.osc.disconnect();
      v.pan.disconnect();
    }
    this.voices = [];
    const n = Math.max(1, Math.round(this.params.voices));
    for (let i = 0; i < n; i++) {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = 0;
      this.pitch.connect(osc.frequency);
      const pan = this.ctx.createStereoPanner();
      const gain = this.ctx.createGain();
      gain.gain.value = 1 / Math.sqrt(n);
      osc.connect(gain).connect(pan).connect(this.oscSum);
      osc.start();
      this.voices.push({ osc, pan, gain });
    }
    this.setWave(this.params.wtPos);
    this.spreadVoices();
  }

  setWave(position) {
    const imag = wavetableHarmonics(position, HARMONICS);
    const real = new Float32Array(imag.length);
    const wave = this.ctx.createPeriodicWave(real, imag);
    for (const v of this.voices) v.osc.setPeriodicWave(wave);
  }

  spreadVoices() {
    const n = this.voices.length;
    this.voices.forEach((v, i) => {
      const pos = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      v.osc.detune.value = pos * this.params.detune;
      v.pan.pan.value = pos * this.params.spread;
    });
  }

  set(name, value) {
    const p = this.params;
    const old = p[name];
    p[name] = value;
    const t = this.ctx.currentTime;
    const smooth = (param, v) => param.setTargetAtTime(v, t, 0.015);
    switch (name) {
      case 'voices':
        if (Math.round(old) !== Math.round(value)) this.buildVoices();
        break;
      case 'wtPos':
        this.setWave(value);
        break;
      case 'detune':
      case 'spread':
        this.spreadVoices();
        break;
      case 'drive':
        smooth(this.drive.gain, dbToGain(value) / 8);
        break;
      case 'distType':
        this.shaper.curve = shaperCurve(value);
        break;
      case 'distMix':
        smooth(this.wet.gain, value);
        smooth(this.dry.gain, 1 - value);
        break;
      case 'lowCut':
        smooth(this.lowCut.frequency, value);
        break;
      case 'cutoff':
        smooth(this.filter.frequency, value);
        smooth(this.lfoDepth.gain, p.lfoDepth * value * 0.9);
        break;
      case 'reso':
        smooth(this.filter.Q, value);
        break;
      case 'lfoRate':
        smooth(this.lfo.frequency, lfoHz(value));
        break;
      case 'lfoDepth':
        smooth(this.lfoDepth.gain, value * p.cutoff * 0.9);
        break;
      case 'subLevel':
        smooth(this.subLevel.gain, value <= -48 ? 0 : dbToGain(value));
        break;
      case 'midLevel':
        smooth(this.midLevel.gain, dbToGain(value));
        break;
      default:
        break; // pitchAmt, pitchTime, glide are read at note time
    }
  }

  applyAll(params) {
    const structural = Math.round(params.voices) !== this.voices.length;
    this.params = { ...params };
    if (structural) this.buildVoices();
    for (const [k, v] of Object.entries(params)) if (k !== 'voices') this.set(k, v);
  }

  // Schedules one note. time/dur in seconds (context time).
  note(midi, time, dur) {
    const p = this.params;
    const hz = midiToHz(midi);
    const glide = p.glide;
    const amt = p.pitchAmt;

    const main = this.pitch.offset;
    main.cancelScheduledValues(time);
    if (amt > 0.01) {
      main.setValueAtTime(hz * Math.pow(2, amt / 12), time);
      main.exponentialRampToValueAtTime(hz, time + Math.max(0.005, p.pitchTime));
    } else if (glide > 0.005) {
      main.setValueAtTime(this.lastHz, time);
      main.exponentialRampToValueAtTime(hz, time + glide);
    } else {
      main.setValueAtTime(hz, time);
    }

    const sub = this.subPitch.offset;
    sub.cancelScheduledValues(time);
    if (glide > 0.005) {
      sub.setValueAtTime(this.lastHz, time);
      sub.exponentialRampToValueAtTime(hz, time + glide);
    } else {
      sub.setValueAtTime(hz, time);
    }
    this.lastHz = hz;

    const g = this.env.gain;
    g.cancelScheduledValues(time);
    g.setTargetAtTime(1, time, 0.003);
    g.setTargetAtTime(0, time + dur, 0.03);
  }
}

// Synthesized drums, so the app needs no sample files.
export class Drums {
  constructor(ctx) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = dbToGain(-3);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  kick(t) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.08);
    g.gain.setValueAtTime(1.1, t);
    g.gain.setTargetAtTime(0, t + 0.12, 0.06);
    const click = c.createBufferSource();
    click.buffer = this.noise;
    const cg = c.createGain();
    cg.gain.setValueAtTime(0.35, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    o.connect(g).connect(this.output);
    click.connect(cg).connect(this.output);
    o.start(t);
    o.stop(t + 0.6);
    click.start(t);
    click.stop(t + 0.02);
  }

  snare(t) {
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 0.6;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.9, t);
    ng.gain.setTargetAtTime(0, t + 0.01, 0.06);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.05);
    const og = c.createGain();
    og.gain.setValueAtTime(0.7, t);
    og.gain.setTargetAtTime(0, t + 0.01, 0.04);
    n.connect(bp).connect(ng).connect(this.output);
    o.connect(og).connect(this.output);
    n.start(t, Math.random() * 0.5);
    n.stop(t + 0.4);
    o.start(t);
    o.stop(t + 0.3);
  }

  hat(t, vel, open = false) {
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.28 * vel, t);
    g.gain.setTargetAtTime(0, t + 0.004, open ? 0.08 : 0.018);
    n.connect(hp).connect(g).connect(this.output);
    n.start(t, Math.random() * 0.5);
    n.stop(t + (open ? 0.5 : 0.15));
  }

  step(i, t) {
    if (KICKS.includes(i)) this.kick(t);
    if (SNARES.includes(i)) this.snare(t);
    if (i % 2 === 0) this.hat(t, i % 4 === 2 ? 1 : 0.55, i === 14 || i === 30);
  }
}

// K-weighting (ITU-R BS.1770), approximated with two biquads per channel.
function kWeight(ctx, input) {
  const shelf = ctx.createBiquadFilter();
  shelf.type = 'highshelf';
  shelf.frequency.value = 1681.97;
  shelf.gain.value = 4;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 38.13;
  hp.Q.value = 0.5;
  input.connect(shelf).connect(hp);
  return hp;
}

export class Engine {
  constructor(params) {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.synth = new FoghornSynth(ctx, params);
    this.drums = new Drums(ctx);

    // Sidechain: the bass ducks under every kick, as in nearly every modern D&B mix.
    this.duck = ctx.createGain();
    this.synthBus = ctx.createGain();
    this.synth.output.connect(this.duck).connect(this.synthBus);

    this.drumMute = ctx.createGain();
    this.drums.output.connect(this.drumMute);

    this.mix = ctx.createGain();
    this.mix.gain.value = dbToGain(-6); // headroom into the limiter
    this.synthBus.connect(this.mix);
    this.drumMute.connect(this.mix);

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1.5;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.06;
    this.master = ctx.createGain();
    this.master.gain.value = dbToGain(-6);
    this.mix.connect(this.limiter).connect(this.master).connect(ctx.destination);

    // Spectrum taps: bass alone (before the sidechain) and the full mix.
    this.bassAnalyser = ctx.createAnalyser();
    this.bassAnalyser.fftSize = 8192;
    this.bassAnalyser.smoothingTimeConstant = 0.75;
    this.synth.output.connect(this.bassAnalyser);
    this.mixAnalyser = ctx.createAnalyser();
    this.mixAnalyser.fftSize = 8192;
    this.mixAnalyser.smoothingTimeConstant = 0.75;
    this.limiter.connect(this.mixAnalyser);

    // Loudness taps on the limited mix (before the monitor volume).
    const split = ctx.createChannelSplitter(2);
    this.limiter.connect(split);
    this.loudTaps = [0, 1].map((ch) => {
      const g = ctx.createGain();
      split.connect(g, ch);
      const a = ctx.createAnalyser();
      a.fftSize = 2048;
      kWeight(ctx, g).connect(a);
      return a;
    });
    this.peakTap = ctx.createAnalyser();
    this.peakTap.fftSize = 2048;
    this.limiter.connect(this.peakTap);

    this.sidechain = 0.7;
    this.playing = false;
    this.step = 0;
    this.nextTime = 0;
    this.onStep = null;
  }

  async start() {
    await this.ctx.resume();
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.synth.env.gain.cancelScheduledValues(t);
    this.synth.env.gain.setTargetAtTime(0, t, 0.02);
  }

  schedule() {
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const i = this.step;
      const t = this.nextTime;
      this.drums.step(i, t);
      if (KICKS.includes(i) && this.sidechain > 0) {
        const g = this.duck.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(1 - this.sidechain, t);
        g.linearRampToValueAtTime(1, t + 0.14);
      }
      for (const n of RIFF) if (n.step === i) this.synth.note(n.note, t, n.len * STEP_SEC * 0.92);
      if (this.onStep) {
        const delay = Math.max(0, (t - this.ctx.currentTime) * 1000);
        setTimeout(() => this.onStep && this.onStep(i), delay);
      }
      this.nextTime += STEP_SEC;
      this.step = (i + 1) % STEPS;
    }
  }

  setDrums(on) {
    this.drumMute.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
  }

  setVolume(db) {
    this.master.gain.setTargetAtTime(dbToGain(db), this.ctx.currentTime, 0.02);
  }
}

// Renders the riff with the given params offline (no drums, no sidechain) and returns a mono buffer.
export async function renderRiff(params, sampleRate = 44100) {
  const bars = 2;
  const seconds = STEPS * STEP_SEC * bars + 0.3;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const synth = new FoghornSynth(ctx, params);
  synth.output.connect(ctx.destination);
  for (let bar = 0; bar < bars; bar++) {
    for (const n of RIFF) {
      synth.note(n.note, 0.05 + (bar * STEPS + n.step) * STEP_SEC, n.len * STEP_SEC * 0.92);
    }
  }
  const buf = await ctx.startRendering();
  const l = buf.getChannelData(0);
  const r = buf.getChannelData(1);
  const mono = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) mono[i] = (l[i] + r[i]) / 2;
  return { mono, sampleRate };
}
