// The foghorn lesson: controls, the starting patch, the target patch and the guided steps.

import { LFO_DIVISIONS } from './engine.js';
import { frameLabel } from './dsp.js';

const hz = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} kHz` : `${Math.round(v)} Hz`);
const ms = (v) => `${Math.round(v * 1000)} ms`;
const pct = (v) => `${Math.round(v * 100)}%`;
const db = (v) => (v <= -48 ? 'off' : `${v.toFixed(1)} dB`);

export const MODULES = [
  { id: 'osc', label: 'OSC', hint: 'Wavetable oscillator' },
  { id: 'pitch', label: 'PITCH', hint: 'Pitch envelope and glide' },
  { id: 'dist', label: 'DRIVE', hint: 'Distortion' },
  { id: 'filter', label: 'FILTER', hint: 'Lowpass filter and LFO' },
  { id: 'out', label: 'SUB / LEVEL', hint: 'Sub layer and balance' },
];

export const CONTROLS = [
  { id: 'wtPos', module: 'osc', label: 'WT Pos', min: 0, max: 1, format: frameLabel },
  { id: 'voices', module: 'osc', label: 'Voices', min: 1, max: 7, step: 1, format: (v) => `${Math.round(v)}` },
  { id: 'detune', module: 'osc', label: 'Detune', min: 0, max: 50, format: (v) => `${v.toFixed(1)} ct` },
  { id: 'spread', module: 'osc', label: 'Stereo', min: 0, max: 1, format: pct },

  { id: 'pitchAmt', module: 'pitch', label: 'Amount', min: 0, max: 36, step: 1, format: (v) => `+${Math.round(v)} st` },
  { id: 'pitchTime', module: 'pitch', label: 'Time', min: 0.01, max: 0.6, scale: 'log', format: ms },
  { id: 'glide', module: 'pitch', label: 'Glide', min: 0, max: 0.3, format: ms },

  { id: 'lowCut', module: 'dist', label: 'Low Cut', min: 20, max: 800, scale: 'log', format: hz },
  { id: 'drive', module: 'dist', label: 'Drive', min: 0, max: 36, format: (v) => `${v.toFixed(1)} dB` },
  { id: 'distMix', module: 'dist', label: 'Mix', min: 0, max: 1, format: pct },
  {
    id: 'distType', module: 'dist', label: 'Type', type: 'select',
    options: [
      { value: 'soft', label: 'Soft' },
      { value: 'hard', label: 'Hard' },
      { value: 'asym', label: 'Tube' },
      { value: 'fold', label: 'Fold' },
    ],
  },

  { id: 'cutoff', module: 'filter', label: 'Cutoff', min: 80, max: 14000, scale: 'log', format: hz },
  { id: 'reso', module: 'filter', label: 'Reso', min: 0.5, max: 14, scale: 'log', format: (v) => v.toFixed(1) },
  { id: 'lfoDepth', module: 'filter', label: 'LFO Depth', min: 0, max: 1, format: pct },
  { id: 'lfoRate', module: 'filter', label: 'LFO Rate', type: 'select', options: LFO_DIVISIONS.map((d) => ({ value: d, label: d })) },

  { id: 'subLevel', module: 'out', label: 'Sub', min: -48, max: 0, format: db },
  { id: 'midLevel', module: 'out', label: 'Mids', min: -24, max: 0, format: db },
];

export const START = {
  wtPos: 0, voices: 1, detune: 0, spread: 0,
  pitchAmt: 0, pitchTime: 0.12, glide: 0,
  lowCut: 20, drive: 0, distType: 'soft', distMix: 0,
  cutoff: 14000, reso: 0.7, lfoRate: '1/4', lfoDepth: 0,
  subLevel: -48, midLevel: -6,
};

export const TARGET = {
  wtPos: 0.6, voices: 5, detune: 18, spread: 0.6,
  pitchAmt: 12, pitchTime: 0.14, glide: 0.04,
  lowCut: 180, drive: 22, distType: 'asym', distMix: 0.85,
  cutoff: 1500, reso: 4, lfoRate: '1/8', lfoDepth: 0.5,
  subLevel: -8, midLevel: -6,
};

const tip = (ok, text) => (ok ? null : text);

export const STEPS = [
  {
    title: 'Pick a harmonic-rich source',
    controls: ['wtPos', 'voices', 'detune', 'spread'],
    why: 'A foghorn is mostly overtones. Distortion later multiplies whatever the oscillator gives it, so a sine leaves it little to work with, while a saw or square gives it a full harmonic series. Unison stacks detuned copies of the wave. Their slow beating is what makes a bass sound wide and "massive" instead of thin.',
    todo: [
      'Turn WT Pos towards Saw and Square (around 60%). Watch the harmonics appear in the spectrum.',
      'Raise Voices to 5 and Detune to about 15 to 20 cents.',
      'Set Stereo to about 60% and listen on headphones.',
    ],
    listen: 'The single clean tone turns into a wide wall that slowly shimmers.',
    check: (p) => [
      tip(p.wtPos >= 0.4, 'WT Pos is still in the sine/triangle area. Move it past Saw to get enough overtones.'),
      tip(p.voices >= 3, 'Use at least 3 voices so the unison can beat against itself.'),
      tip(p.detune >= 8, 'Detune is too low to hear the chorus effect. Try 15 cents or more.'),
      tip(p.detune <= 35, 'Detune above 35 cents starts to sound out of tune rather than wide.'),
    ],
  },
  {
    title: 'The horn drop',
    controls: ['pitchAmt', 'pitchTime', 'glide'],
    why: 'The "blown horn" attack comes from pitch. Each note starts higher and falls to its real pitch in a fraction of a second. The ear hears that fall as a breath pushing through a horn. A little glide between notes makes the riff feel like one continuous voice.',
    todo: [
      'Set Amount to +12 semitones, one octave.',
      'Set Time between 100 and 200 ms. Shorter feels punchier, longer feels more like a siren.',
      'Add 30 to 50 ms of Glide.',
    ],
    listen: 'Every note now "falls into place" with a short bending attack.',
    check: (p) => [
      tip(p.pitchAmt >= 7, 'The drop is too small to read as a horn. Use at least +7 semitones, +12 is classic.'),
      tip(p.pitchAmt <= 24, 'More than two octaves of drop sounds like a laser rather than a horn.'),
      tip(p.pitchTime >= 0.05 && p.pitchTime <= 0.35, 'Keep the drop time between 50 and 350 ms.'),
    ],
  },
  {
    title: 'Controlled overdrive',
    controls: ['lowCut', 'drive', 'distMix', 'distType'],
    why: 'Distorting low frequencies creates intermodulation: new tones that are not in key, which make the low end muddy and unstable. Producers therefore cut the lows before the distortion and add a clean sub later. The Mix knob blends the clean and distorted signal (parallel distortion), so you keep some body while the driven signal adds density.',
    todo: [
      'First push Drive to about 20 dB with Low Cut at 20 Hz. Listen to how the low end turns to mush.',
      'Now raise Low Cut to 150 to 200 Hz. The distortion gets cleaner and more focused.',
      'Try each Type. Tube adds even harmonics and sounds warmer, Fold is the most aggressive.',
      'Set Mix to about 85%.',
    ],
    listen: 'Loud, dense and growling, but the lowest notes stay defined.',
    check: (p) => [
      tip(p.drive >= 12, 'Push Drive past 12 dB. This sound lives on deliberate overdrive.'),
      tip(p.lowCut >= 120, 'Low Cut is below 120 Hz, so the distortion is eating the lows. Raise it.'),
      tip(p.distMix >= 0.5, 'Mix is mostly clean. Bring it up to at least 50% to hear the distortion.'),
    ],
  },
  {
    title: 'Make it talk',
    controls: ['cutoff', 'reso', 'lfoDepth', 'lfoRate'],
    why: 'After heavy distortion the sound is bright and static, and the top end fizzes. A lowpass filter after the drive tames the fizz, and resonance adds a vocal peak. An LFO synced to the tempo then moves the cutoff, so the sound opens and closes in rhythm. That movement is what makes a bass feel alive.',
    todo: [
      'Lower Cutoff to around 1.5 kHz.',
      'Raise Reso to about 4 for a vowel-like peak.',
      'Set LFO Depth to about 50% and try 1/8 and 1/8T for the rate.',
    ],
    listen: 'The horn now "talks" in time with the drums.',
    check: (p) => [
      tip(p.cutoff <= 4000, 'Cutoff is very open, so the fizz from the distortion is still there. Bring it below 4 kHz.'),
      tip(p.cutoff >= 500, 'Cutoff is so low that the horn loses its bite. Stay above 500 Hz.'),
      tip(p.lfoDepth >= 0.2, 'Add LFO Depth so the filter moves.'),
      tip(p.lfoDepth <= 0.85, 'LFO Depth is so high that the sound keeps vanishing. Pull it back a little.'),
    ],
  },
  {
    title: 'Lay the foundation',
    controls: ['subLevel', 'midLevel'],
    why: 'Because the low cut removed everything below the mids, the sound now needs a clean sine sub. It stays mono and undistorted, so it hits hard on a club system and never fights the kick. In the mix the sub and the mids are balanced like two separate instruments.',
    todo: [
      'Raise Sub until the low end feels solid. Around −8 dB is a good start.',
      'Switch between Bass and Full mix in the spectrum. The sub should sit as one clear peak around 40 to 60 Hz.',
    ],
    listen: 'Weight from the sub, character from the mids, and they no longer blur together.',
    check: (p) => [
      tip(p.subLevel > -48, 'The sub is still off. Bring it in.'),
      tip(p.subLevel >= -14, 'The sub is very quiet compared to the mids.'),
      tip(p.subLevel <= -3, 'The sub is louder than it needs to be. It will eat the headroom for the mix.'),
    ],
  },
  {
    title: 'Check against the target',
    controls: [],
    final: true,
    why: 'Ears get used to a sound within minutes, so producers check their balance against a reference. Here the reference is the target patch. The check removes the overall volume difference and only compares how the energy is spread across the bands.',
    todo: [
      'Press "Hear target" to switch between the target and your sound.',
      'Read the band check under the spectrum. Each band within ±4 dB counts as a match.',
      'Adjust any module until all bands match.',
    ],
    listen: 'Switching between yours and the target should sound like two takes of the same sound.',
    check: () => [],
  },
];

export function stepTips(step, params) {
  return step.check(params).filter(Boolean);
}

// All controls unlocked up to and including step i.
export function unlockedControls(i) {
  const set = new Set();
  STEPS.slice(0, i + 1).forEach((s) => s.controls.forEach((c) => set.add(c)));
  if (STEPS[i]?.final) CONTROLS.forEach((c) => set.add(c.id));
  return set;
}
