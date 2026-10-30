// Stand-ins for the Web Audio and canvas APIs, recording what the player does with them.

class FakeParam {
  constructor(value = 1) {
    this.value = value;
    this.events = [];
  }
  setTargetAtTime(value, at, constant) {
    this.events.push(['target', value, at, constant]);
    this.value = value;
  }
  cancelScheduledValues(at) {
    this.events.push(['cancel', at]);
  }
}

class FakeNode {
  constructor(kind, extra = {}) {
    this.kind = kind;
    this.connections = [];
    Object.assign(this, extra);
  }
  connect(target, output = 0, input = 0) {
    this.connections.push({ target, output, input });
    return target;
  }
}

export class FakeAudioContext {
  constructor({ sampleRate = 48000 } = {}) {
    this.sampleRate = sampleRate;
    this.currentTime = 10;
    this.nodes = [];
    this.speakers = new FakeNode('destination', { maxChannelCount: 2, channelCount: 2 });
    // what an analyser reports: level of every FFT bin in dB, and the waveform
    this.spectrum = -40;
    this.wave = 0.5;
  }
  get destination() {
    return this.speakers;
  }
  #add(node) {
    this.nodes.push(node);
    return node;
  }
  createGain() {
    return this.#add(new FakeNode('gain', { gain: new FakeParam(1) }));
  }
  createChannelSplitter(outputs) {
    return this.#add(new FakeNode('splitter', { outputs }));
  }
  createChannelMerger(inputs) {
    return this.#add(new FakeNode('merger', { inputs }));
  }
  createBiquadFilter() {
    return this.#add(new FakeNode('biquad', { type: 'lowpass', frequency: new FakeParam(350), Q: new FakeParam(1), gain: new FakeParam(0) }));
  }
  createAnalyser() {
    const ctx = this;
    const analyser = new FakeNode('analyser', {
      fftSize: 2048,
      get frequencyBinCount() {
        return this.fftSize / 2;
      },
      getFloatFrequencyData: (array) => array.fill(ctx.spectrum),
      getFloatTimeDomainData: (array) => array.fill(ctx.wave),
    });
    return this.#add(analyser);
  }
}

/** A 2D canvas context that records the calls that draw something. */
export function fakeCanvasContext() {
  const calls = [];
  const record = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    count: (name) => calls.filter((c) => c[0] === name).length,
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    stroke: record('stroke'),
    fill: record('fill'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
  };
}
