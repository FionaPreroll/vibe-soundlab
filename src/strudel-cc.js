// What strudel.cc offers on top of @strudel/web, so songs written there play here too:
// the short drum machine names, sliders, piano(), o() for orbit(), and the editor's
// pianorolls and scopes.

/** Short names for the drum machines (tr909 for RolandTR909, …), the same as strudel.cc's. */
export const BANK_ALIASES = {
  AJKPercusyn: 'Percysyn',
  AkaiLinn: 'Linn',
  AkaiMPC60: 'MPC60',
  AkaiXR10: 'XR10',
  AlesisHR16: 'HR16',
  AlesisSR16: 'SR16',
  BossDR110: 'DR110',
  BossDR220: 'DR220',
  BossDR55: 'DR55',
  BossDR550: 'DR550',
  CasioRZ1: 'RZ1',
  CasioSK1: 'SK1',
  CasioVL1: 'VL1',
  DoepferMS404: 'MS404',
  EmuDrumulator: 'Drumulator',
  EmuSP12: 'SP12',
  KorgDDM110: 'DDM110',
  KorgKPR77: 'KPR77',
  KorgKR55: 'KR55',
  KorgKRZ: 'KRZ',
  KorgM1: 'M1',
  KorgMinipops: 'Minipops',
  KorgPoly800: 'Poly800',
  KorgT3: 'T3',
  Linn9000: '9000',
  LinnLM1: 'LM1',
  LinnLM2: 'LM2',
  MoogConcertMateMG1: 'ConcertMateMG1',
  OberheimDMX: 'DMX',
  RhodesPolaris: 'Polaris',
  RhythmAce: 'Ace',
  RolandCompurhythm1000: 'Compurhythm1000',
  RolandCompurhythm78: 'Compurhythm78',
  RolandCompurhythm8000: 'Compurhythm8000',
  RolandD110: 'D110',
  RolandD70: 'D70',
  RolandDDR30: 'DDR30',
  RolandJD990: 'JD990',
  RolandMC202: 'MC202',
  RolandMC303: 'MC303',
  RolandMT32: 'MT32',
  RolandR8: 'R8',
  RolandS50: 'S50',
  RolandSH09: 'SH09',
  RolandSystem100: 'System100',
  RolandTR505: 'TR505',
  RolandTR606: 'TR606',
  RolandTR626: 'TR626',
  RolandTR707: 'TR707',
  RolandTR727: 'TR727',
  RolandTR808: 'TR808',
  RolandTR909: 'TR909',
  SakataDPM48: 'DPM48',
  SequentialCircuitsDrumtracks: 'CircuitsDrumtracks',
  SequentialCircuitsTom: 'CircuitsTom',
  SimmonsSDS400: 'SDS400',
  SimmonsSDS5: 'SDS5',
  SoundmastersR88: 'R88',
  UnivoxMicroRhythmer12: 'MicroRhythmer12',
  ViscoSpaceDrum: 'SpaceDrum',
  XdrumLM8953: 'LM8953',
  YamahaRM50: 'RM50',
  YamahaRX21: 'RX21',
  YamahaRX5: 'RX5',
  YamahaRY30: 'RY30',
  YamahaTG33: 'TG33',
};

// The editor's drawings. `_pianoroll()` and the other inline ones need the strudel.cc
// editor; `pianoroll()` and the rest draw on a canvas over the whole page and keep
// drawing after the song stops. In the player they all leave the pattern as it is.
export const DRAWINGS = ['pianoroll', 'punchcard', 'wordfall', 'spiral', 'pitchwheel', 'scope', 'tscope', 'fscope', 'spectrum'];

/**
 * Adds the strudel.cc extras to a loaded @strudel/web module. `scope` is where the
 * code Strudel evaluates looks up its functions (the page's globals).
 */
export function addStrudelCcExtras(strudel, scope = globalThis) {
  const proto = strudel.Pattern.prototype;
  for (const name of DRAWINGS) {
    proto[name] = keepPattern;
    proto[`_${name}`] = keepPattern;
  }
  // On strudel.cc, slider(value, min, max) puts a slider into the code (Strudel's
  // transpiler turns it into sliderWithID). Here it keeps the value it starts with.
  scope.sliderWithID = (id, value = 0) => strudel.pure(value);
  scope.slider = (value = 0) => strudel.pure(value);
  proto.piano ??= pianoFor(strudel);
  // Strudel 1.3, which strudel.cc runs, also calls orbit() o(); several songs use that.
  proto.o ??= function o(...args) {
    return this.orbit(...args);
  };
  scope.o ??= strudel.orbit;
}

// strudel.cc's piano(): the piano samples held for the whole note, with a short release,
// panned from left (low notes) to right (high notes) across the middle half.
function pianoFor({ noteToMidi, valueToMidi }) {
  const top = noteToMidi('C8');
  return function piano() {
    return this.clip(1)
      .s('piano')
      .release(0.1)
      .fmap((value) => {
        const place = Math.min(Math.round(valueToMidi(value)) / top, 1);
        return { ...value, pan: (value.pan || 1) * (place * 0.5 + 0.25) };
      });
  };
}

function keepPattern() {
  return this;
}

/**
 * Remembers Strudel as it is now: its Pattern methods and the globals it put in `scope`
 * (`names`). Songs change both, e.g. register('as', …) replaces a built-in for every
 * song played after it, and `n = 3` replaces a global. The returned function puts
 * everything back, so each song starts from the same Strudel.
 */
export function rememberStrudel(strudel, names, scope = globalThis) {
  const proto = strudel.Pattern.prototype;
  const methods = Object.getOwnPropertyDescriptors(proto);
  const globals = new Map(names.map((name) => [name, scope[name]]));
  return function restore() {
    for (const key of Reflect.ownKeys(proto)) if (!Object.hasOwn(methods, key)) delete proto[key];
    for (const key of Reflect.ownKeys(methods)) {
      try {
        Object.defineProperty(proto, key, methods[key]);
      } catch {
        // A built-in no song could change either.
      }
    }
    for (const [name, value] of globals) if (scope[name] !== value) scope[name] = value;
  };
}
