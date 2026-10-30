// A stand-in for Hydra in Node: accepts exactly the functions hydra-synth has,
// records what a track's visuals use, and throws on anything Hydra doesn't know,
// so a typo in a track's visuals fails the tests instead of a browser.
import glslFunctions from 'hydra-synth/src/glsl/glsl-functions.js';

const functions = glslFunctions();
export const HYDRA_SOURCES = new Set(functions.filter((f) => f.type === 'src').map((f) => f.name));
export const HYDRA_METHODS = new Set([...functions.filter((f) => f.type !== 'src').map((f) => f.name), 'out']);

function checkArgument(name, value) {
  const ok =
    typeof value === 'number' ||
    typeof value === 'function' ||
    value?.hydraChain === true ||
    value?.hydraOutput !== undefined ||
    value?.hydraSource !== undefined ||
    (Array.isArray(value) && value.every((v) => typeof v === 'number'));
  if (!ok) throw new Error(`Hydra can't use ${JSON.stringify(value)} in ${name}()`);
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${name}() got ${value}`);
}

/** Returns the globals initHydra() makes, recording into `record`. */
export function hydraGlobals(record) {
  const chain = () =>
    new Proxy(
      { hydraChain: true },
      {
        get(target, key) {
          if (key in target) return target[key];
          if (typeof key !== 'string' || !HYDRA_METHODS.has(key)) throw new Error(`Hydra has no .${String(key)}()`);
          return (...args) => {
            args.forEach((arg) => checkArgument(key, arg));
            record.methods.push(key);
            if (key === 'out') record.outputs.push(args[0]?.hydraOutput ?? 0);
            return target.hydraChain && chain();
          };
        },
      },
    );
  const globals = {};
  for (const name of HYDRA_SOURCES) {
    globals[name] = (...args) => {
      args.forEach((arg) => checkArgument(name, arg));
      record.sources.push(name);
      return chain();
    };
  }
  for (let i = 0; i < 4; i++) {
    globals[`o${i}`] = { hydraOutput: i };
    globals[`s${i}`] = { hydraSource: i, initCam() {}, initImage() {}, init() {} };
  }
  globals.render = (output) => record.renders.push(output?.hydraOutput ?? 'all');
  globals.setResolution = () => {};
  globals.hush = () => {};
  globals.speed = 1;
  globals.bpm = 30;
  return globals;
}
