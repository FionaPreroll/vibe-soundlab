# Vibe Soundlab Tracks

[![codecov](https://codecov.io/gh/FionaPreroll/vibe-soundlab/branch/main/graph/badge.svg)](https://codecov.io/gh/FionaPreroll/vibe-soundlab)

Drum & bass written in [Strudel](https://strudel.cc/), and a browser player for it: four atmospheric
tracks and three bangers.
Pick one of the tracks in this repo, or upload your own Strudel file and play it next to them.
Play runs through the list: when a track reaches its last bar (`@bars`), the next one starts.
The repeat button switches between off (stop after the last track), all (start over) and one
(repeat the current track). Uploads without a `@bars` header loop until you pick another track.

The live player: https://fionapreroll.github.io/vibe-soundlab/

> The sound design lessons (the foghorn lesson app) live on the
> [`soundlab`](https://github.com/FionaPreroll/vibe-soundlab/tree/soundlab) branch and are maintained
> separately. Only this branch, `main`, is published to GitHub Pages.

## Tracks

| Track | Style | Key | BPM |
| --- | --- | --- | --- |
| [Nachtschicht](tracks/nachtschicht.js) | Dark techstep, Dom & Roland style reese | F minor | 174 |
| [Nebelhorn](tracks/nebelhorn.js) | Deep roller with a distorted foghorn bass | E minor | 174 |
| [Glasregen](tracks/glasregen.js) | Liquid two-step, FM keys, bells, glass rain | C minor | 172 |
| [Polarlicht](tracks/polarlicht.js) | Ambient jungle, chopped amen, 808 sub, halftime breakdown | D minor | 170 |
| [Druckwelle](tracks/druckwelle.js) | Dancefloor roller, overdriven foghorn bass, supersaw hook | G minor | 174 |
| [Kernschmelze](tracks/kernschmelze.js) | Neurofunk, talking wavefolded bass, metal stabs, lasers | F# minor | 174 |
| [Starkstrom](tracks/starkstrom.js) | Jump-up, bouncing wub bass with pitch bends, hoover, air horns | A minor | 175 |

Every track is a plain Strudel file: paste it into strudel.cc, or use the player's
"Open in strudel.cc" link, and it runs there too.

### Conventions the tests rely on

Each track starts with a header the player reads:

```js
// @title Nachtschicht
// @style Dark techstep
// @bpm 174
// @key F minor
// @bars 120
// @order 1
// @about One line for the player.
```

Layers use fixed orbits. Reverb size and delay settings belong to an orbit, so two layers
with different settings on one orbit keep overwriting each other.

| Orbit | Layer |
| --- | --- |
| 1 | drums (default) |
| 2 | bass |
| 3 | pad (the kick ducks this orbit) |
| 4 | snare room |
| 5 | stabs, keys |
| 6 | arps, plucks, leads |
| 7 | FX and atmosphere |

After adding or renaming a track, run `pnpm run tracks` to update `tracks/index.json`.

## Run it

The project uses [pnpm](https://pnpm.io/installation). `package.json` pins its version
(`packageManager`), and pnpm or `corepack enable` switch to that version on their own.

```sh
pnpm install
pnpm start        # serves the folder at http://localhost:8000
```

Strudel itself loads from the jsDelivr CDN (`@strudel/web`, pinned in `src/engine.js`).
Uploaded tracks are kept in the browser's local storage.

## Tests

```sh
pnpm test         # all unit and track tests
pnpm run coverage # the same, failing below 95 % line coverage of src/; writes lcov.info
pnpm run e2e      # plays every track in headless Chromium (needs Playwright)
```

CI uploads `lcov.info` to [Codecov](https://codecov.io/gh/FionaPreroll/vibe-soundlab) on every
push and pull request (repository secret `CODECOV_TOKEN`). The 95 % minimum is checked by
`pnpm run coverage` itself; Codecov only reports (`codecov.yml`).

The track tests run each file through the real Strudel pattern engine in Node and check
every event of the whole arrangement:

- stab, key and arp notes are tones of the pad chord sounding under them;
- on every downbeat the bass is a chord tone with no chord tone a semitone above it;
- no minor seconds or minor ninths between harmony notes that sound together;
- pad chords are in open position (at least 17 semitones wide, nothing below G2);
- the kick ducks the pad, and layers on one orbit agree on its reverb and delay;
- every orbit the kick ducks already plays before the first duck (otherwise Strudel reports
  "duck target orbit does not exist");
- distortion types and vowels are ones Strudel knows;
- every sound and sample number exists, every bar plays something, levels stay sane.

`test/reference.test.js` runs the same checks on the first version of Nachtschicht
(`test/fixtures/nachtschicht-v1.js`) and confirms they catch what was wrong with it.

## Layout

| Path | What it holds |
| --- | --- |
| `tracks/` | the Strudel tracks and `index.json` |
| `index.html`, `css/` | the player page |
| `src/` | player code: engine (Strudel), library (repo tracks and uploads), playlist and repeat rules, upload checks, header parsing, strudel.cc links |
| `scripts/` | `index-tracks.js` (track index), `snapshot-samples.js` (sample names for the tests) |
| `test/` | tests; `test/support/` runs Strudel in Node and holds the harmony checks |
