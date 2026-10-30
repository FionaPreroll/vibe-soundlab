# Vibe Soundlab

> This is the `soundlab` branch: the sound design lessons, maintained on their own.
> The `main` branch holds the Strudel track player, which is what GitHub Pages serves.

Interactive, guided sound design lessons for modern drum & bass, in the browser.
The first lesson builds a foghorn bass step by step: wavetable oscillator and unison,
pitch drop, controlled overdrive, filter movement and a clean sub. A live spectrum
compares your sound with the lesson's target patch.

The controls follow the vocabulary of Vital and Serum, so what you learn here carries
straight over to those synths.

## Run it

No build step and no dependencies. Serve the folder and open it in a browser:

```sh
pnpm start        # python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` straight from disk does not work, because browsers block ES modules on `file://`.

## Tests

The project uses [pnpm](https://pnpm.io/installation); `package.json` pins its version
(`packageManager`).

```sh
pnpm test         # node --test, needs Node 18+
pnpm run coverage # the same with a coverage report of js/ in lcov.info, needs Node 22
```

CI uploads `lcov.info` to [Codecov](https://app.codecov.io/gh/FionaPreroll/vibe-soundlab/tree/soundlab).
Codecov only reports and never fails a pull request (`codecov.yml`).

## Layout

| Path | What it holds |
| --- | --- |
| `js/engine.js` | Web Audio engine: foghorn synth, synthesized 174 BPM drum loop, sidechain, limiter, meters |
| `js/lesson.js` | The foghorn lesson: controls, start and target patches, steps and their checks |
| `js/dsp.js` | Pure helpers: wavetables, distortion curves, FFT, band analysis |
| `js/spectrum.js` | Spectrum and oscilloscope drawing |
| `js/ui.js` | Knob and selector widgets |
| `js/main.js` | Wires everything together |

## Notes

- The loudness meter is an approximation of short-term LUFS (K-weighting with two biquads per channel).
- The band check removes the overall volume difference and compares tonal balance only.
- Settings are kept in the browser's local storage.
