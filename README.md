# Vibe Soundlab Tracks

[![codecov](https://codecov.io/gh/FionaPreroll/vibe-soundlab/branch/main/graph/badge.svg)](https://codecov.io/gh/FionaPreroll/vibe-soundlab)

Drum & bass and chiptunes written in [Strudel](https://strudel.cc/), and a browser player for them:
four atmospheric tracks, three bangers, three Reese rollers and three keygen-style chiptunes.
Pick one of the tracks in this repo, or upload your own Strudel file and play it next to them.
Play runs through the list: when a track reaches its last bar (`@bars`), the next one starts.
The repeat button switches between off (stop after the last track), all (start over) and one
(repeat the current track). Uploads without a `@bars` header loop until you pick another track.
The progress bar shows the parts of the track (intro, build, drops, …) as the final `arrange(...)`
lists them; click or drag it, or click a part, to jump there.

The mixer has one channel per orbit (see the table below) and a master, each with a fader, mute,
solo and a live spectrum with a level meter. The 8-band EQ (shelves at 40 Hz and 14 kHz, bells at
100, 250, 600, 1.5k, 3.5k and 8k) works on the master or on any one channel; its curve is drawn
over that channel's live spectrum. Mixer and EQ settings stay in the browser.
To get there, the player tells Strudel to give every orbit its own pair of output channels
(multi-channel orbits) and splits them back up in its own Web Audio graph (`src/mixer-graph.js`).

The code panel shows the track with syntax colours and, while it plays, outlines the
mini-notation atoms (notes, sounds, numbers in `"..."` strings) that are sounding, the way the
strudel.cc editor does. Strudel records where in the code each atom of a pattern was written;
the player asks the playing pattern which notes are sounding and marks those places.

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
| [Tiefgarage](tracks/tiefgarage.js) | 808 roller, sliding 808 and subby Reese as one bass, dub stabs | Bb minor | 172 |
| [Schwerkraft](tracks/schwerkraft.js) | Reese roller, huge beating Reese answering 808 booms | C# minor | 174 |
| [Unterströmung](tracks/unterstroemung.js) | Steppy roller, 808 boom on every kick, Reese in the gaps, amens | G# minor | 175 |
| [Seriennummer](tracks/seriennummer.js) | Keygen chiptune, FastTracker style, 6 channels, lead with an echo channel | A minor | 140 |
| [Rasterzeile](tracks/rasterzeile.js) | C64 SID chiptune, 3 voices, bass and drums share one voice | B minor | 150 |
| [Sternenfeld](tracks/sternenfeld.js) | Amiga demoscene chiptune, 4 channels panned left-right-right-left | D major | 125 |

Every track is a plain Strudel file: paste it into strudel.cc, or use the player's
"Open in strudel.cc" link, and it runs there too.

### Conventions the tests rely on

Each track starts with a header the player reads, and ends with one `arrange(...)` whose parts
(`[16, intro]`, `[32, drop1]`, …) add up to `@bars`; the progress bar shows them by name.
The header looks like this:

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
with different settings on one orbit keep overwriting each other. Each orbit is also one channel
in the player's mixer.

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

### Chiptunes

A track with an `@channels` header (`// @channels 4`) is a chiptune written like tracker music
and follows the tracker rules instead of the pad rules. Every orbit is one tracker channel, and a
channel plays one sound at a time, so the header's number is a real limit:

| Orbit | Channel |
| --- | --- |
| 1 | drums (kick, snare and hats take turns) |
| 2 | bass (in a SID tune also the drums) |
| 3 | arpeggio: the chords, as fast broken chords |
| 4 | second drum channel |
| 5 | echo or counter melody |
| 6 | lead |

There is no pad. The arpeggio channel spells the chords, and an echo is a quieter copy of the lead
on a channel of its own, not a delay effect.

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
every event of the whole arrangement. For every track:

- layers on one orbit agree on its reverb and delay;
- every orbit the kick ducks already plays before the first duck (otherwise Strudel reports
  "duck target orbit does not exist");
- distortion types and vowels are ones Strudel knows;
- only breaks that are exactly one bar long get stretched onto a bar with `fit()`;
- every sound and sample number exists, every bar plays something, levels stay sane.

For the drum & bass tracks:

- stab, key and arp notes are tones of the pad chord sounding under them;
- on every downbeat the bass is a chord tone with no chord tone a semitone above it;
- no minor seconds or minor ninths between harmony notes that sound together;
- pad chords are in open position (at least 17 semitones wide, nothing below G2);
- the kick ducks the pad.

For the chiptunes (`test/support/tracker.js`, tried on small examples in `test/tracker.test.js`):

- no more orbits than `@channels`, and each channel plays one sound at a time;
- every sample has the cut group of its channel (`cut` = orbit), so the next sound cuts it off;
- no delay effect and no supersaw: echoes and voices cost channels;
- the arpeggio plays at least three different tones per half bar;
- on every downbeat the bass is a tone of the arpeggio chord with no chord tone a semitone above it;
- melody notes held for a beat or longer are tones of the arpeggio chord and never a semitone
  (or minor ninth) away from an arpeggio note; short passing notes are free;
- bass, arpeggio and melody stay in the key from the header (minor with its leading tone,
  major with its flat seventh).

`test/reference.test.js` runs the same checks on the first version of Nachtschicht
(`test/fixtures/nachtschicht-v1.js`) and confirms they catch what was wrong with it.

## Layout

| Path | What it holds |
| --- | --- |
| `tracks/` | the Strudel tracks and `index.json` |
| `index.html`, `css/` | the player page |
| `src/` | player code: engine (Strudel, seeking), library (repo tracks and uploads), playlist and repeat rules, track parts for the progress bar, mixer (settings, audio graph, EQ math, meters, panel), code highlighting, upload checks, header parsing, strudel.cc links |
| `scripts/` | `index-tracks.js` (track index), `snapshot-samples.js` (sample names for the tests) |
| `test/` | tests; `test/support/` runs Strudel in Node and holds the harmony and tracker checks |
