# Vibe Soundlab Tracks

[![codecov](https://codecov.io/gh/FionaPreroll/vibe-soundlab/branch/main/graph/badge.svg)](https://codecov.io/gh/FionaPreroll/vibe-soundlab)

Drum & bass and chiptunes written in [Strudel](https://strudel.cc/), and a browser player for them:
four atmospheric tracks, three bangers, three Reese rollers and three keygen-style chiptunes.
Pick one of the tracks in this repo, upload your own Strudel file and play it next to them, or switch
on the songs other people share on GitHub (see [Songs from GitHub](#songs-from-github)).
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

The code can be changed while it plays: type in the code panel, then press Update or Ctrl+Enter
(⌘+Enter) and the new code takes over without starting the track again, as on strudel.cc;
Ctrl+. stops. Changes are kept in the browser per track (`vibe-player:drafts`), play when the
track is played and open in strudel.cc as changed. The panel is a transparent `<textarea>` over the
highlighted code, so colours and marks stay where the characters are (`src/editor.js`).

Mistakes in the code can't take the page down (`src/guard.js`):

- Before changed code runs, Strudel's transpiler reads all of it, mini-notation included. A syntax
  error stops there: what played plays on and the line is marked. Mini-notation errors carry no
  position, so the player tries each string with Strudel's mini parser to find the one that fails.
- Every `for` and `while` loop gets a check in its condition (`__vibeLoop()`); it throws once the
  page has been busy for 1.5 seconds without a break. Strudel marks notes by their position in the
  code, so positions are mapped back to the code as written.
- Strudel hands every new pattern to the player before it plays it (`editPattern`). The player asks
  it for a tiny stretch first, then longer ones, and refuses patterns with far more notes than can be
  played (more than 2000 a second); `s("bd*1000000000")` is found in milliseconds. While it plays, a
  pattern that brings too many notes at once or takes too long to work out goes silent, and errors
  are reported once instead of twenty times a second. A change that fails like this goes back to the
  version before it; a track that does stops.
- Code still running after 30 seconds is given up on, so one song can't block the next.
- Hydra errors while drawing stop the visuals instead of repeating every frame.

The guitar chords are worked out from the pattern that plays (`src/chords.js`): every half bar,
a few bars ahead of the music, the player asks the pattern for its notes (drums, noise and silent
notes don't count), weighs them by how long they sound (a held pad says more than a run of
sixteenths, layers doubling a note count once) and picks the chord whose tones cover them best, with
the lowest held note deciding between chords with the same notes (Am7 or C6). A chord that still
covers the notes is kept, so names don't flicker. Roots are spelled from the `@key` header (F minor
→ Db, Bb), else from how the notes are written (`ab3` → flats). `src/guitar.js` has a standard-tuning
shape for every chord type in every key: the open chords first, else a movable shape with its root on
the low E, A or D string, as low on the neck as fits; the tests check that every shape sounds its
chord with the root at the bottom.

Every track also brings its own [Hydra](https://hydra.ojack.xyz/) visuals, drawn full screen
behind the player (the "Visuals" button in the top corner turns them off). Tracks start them the
way they would on strudel.cc, so the same code runs in both places:

```js
await initHydra()
const energy = H(arrange([16, saw.range(0, .3).slow(16)], [32, "1"], ...))
osc(18, .03, .4).brightness(() => -.5 + energy() * .2).out()
```

`H(pattern)` turns a Strudel pattern into a number Hydra reads every frame, at the bar the music
is at. The tracks use one `energy` pattern that follows their own arrangement (low in the intro,
rising in the builds, 1 in the drops or choruses) and one `pulse` on the beat. The player loads
Hydra from jsDelivr (`hydra-synth`, pinned in `src/visuals.js`) the first time a track asks for
it; if it can't, the track plays without visuals.

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

The mixer names its channels after this table (Drums, Bass, Pad, Snare, Stabs, Leads, FX). A track
that uses its orbits differently names them in an optional header line, in orbit order; an empty
entry keeps the default name:

```js
// @mixer Drums, Bass, Arpeggio, Drums 2, Echo, Lead
```

Visuals go in a block before the arrangement: `await initHydra()`, then Hydra code that ends in
`.out()`. The final `arrange(...)` must stay the last expression, because that is what plays.

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

## Songs from GitHub

The player can also list Strudel songs from other people's GitHub repositories:

| Repository | What is in it | Folders listed |
| --- | --- | --- |
| [eefano/strudel-songs-collection](https://github.com/eefano/strudel-songs-collection) | covers and originals | top level, `jamsessions/`, `tinkering/` (not `functions/`, which are helpers) |
| [tzwaan/strudel-scripts](https://github.com/tzwaan/strudel-scripts) | trance, liquid, game soundtracks | `songs/`, `songs/game-ost/` (not `prebake.js`, `strudeldj.js`) |
| [Mariaareadne1/maria-live-codes](https://github.com/Mariaareadne1/maria-live-codes) | live-coded covers | `songs/` |

Playing one of these songs runs its code in the page, so they stay hidden until the listener
switches them on ("Show their songs"); the choice is kept in the browser and can be undone. Before
that, the player asks GitHub for nothing, not even the list.

`src/sources.js` says where each repository keeps its songs (`folders`) and reads what the player
shows from the comments at the top of each file, since none of them uses this repo's header:

- the title from `// @title …` (also in a `/* … */` block), else from a quoted first comment like
  `// "Aztec Challenge" (work in progress)` (the rest of the line becomes a note), else from a comment
  that spells out the file name (`// HAPPY BIRTHDAY` in `happybirthday.js`), else from the file name;
- credits from lines like `// song @by Cardiacs`, `// script @by eefano`, `// @by Koji Kondo`,
  `// transcribed @by tzwaan` or `// @song by Parquet Courts`.

`pnpm run sources` clones each repository, reads its files as text (nothing in them runs) and writes
`sources/index.json` with the songs and the commit it read. It prints the `.js` files it left out,
so a new folder in one of the repositories shows up there. The player lists the songs from that file
and loads a song's code from `raw.githubusercontent.com` at that commit when it is picked, so it runs
exactly the code that was listed, even if the repository changes later. To list a newer version, run
the script again and commit the index.

Songs written on strudel.cc expect a few things `@strudel/web` does not have; `src/strudel-cc.js`
and `src/engine.js` add them:

- the sounds strudel.cc starts with: the General MIDI instruments (`gm_piano`, …) from
  `@strudel/soundfonts` (pinned to the Strudel version; it imports Strudel by package name, so the
  import map in `index.html` points those names at the player's copy, `src/strudel-bridge.js`), the
  ZZFX synths, the `EmuSP12` drum machine and the short drum machine names (`tr909`, `linn`, …);
- `slider(…)`, which keeps the value it starts with, `piano()`, and `o()` for `orbit()` (from
  Strudel 1.3, which strudel.cc runs);
- the editor's pianorolls and scopes (`_pianoroll()`, `.scope()`, …), which leave the pattern as it is.

Orbits the mixer has no strip for (`orbit(0.5)`, `orbit(12)`) play on the first strip. Songs also
change Strudel itself (`register('as', …)` replaces a built-in), so before every song the engine puts
Strudel's methods and globals back as they were after loading. Hydra's own `noise()`, `shape()`,
`speed` … come back with every `initHydra()`, and Hydra's array helpers (`[1, 2].fast(2)`) are
hidden from `for…in`, which Strudel's `all()` uses (`src/visuals.js`).

What still doesn't play: songs that need a Strudel newer than 1.2.6 (`fm1`, `.env()`, `cyclesPer`),
MIDI, functions from a repository's own prebake file, and samples from hosts that are down or block
other sites.

## Run it

The project uses [pnpm](https://pnpm.io/installation). `package.json` pins its version
(`packageManager`), and pnpm or `corepack enable` switch to that version on their own.

```sh
pnpm install
pnpm start        # serves the folder at http://localhost:8000
```

Strudel itself loads from the jsDelivr CDN (`@strudel/web` and `@strudel/soundfonts`, pinned in
`src/engine.js`), and so does Hydra (`hydra-synth`, pinned in `src/visuals.js`).
Uploaded tracks are kept in the browser's local storage.

## Tests

```sh
pnpm test         # all unit and track tests
pnpm run coverage # the same, failing below 95 % line coverage of src/; writes lcov.info
pnpm run e2e      # plays every track and a stand-in song from GitHub in headless Chromium (needs Playwright)
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
- every sound and sample number exists, every bar plays something, levels stay sane;
- the Hydra visuals use only functions Hydra has (`test/support/hydra.js` checks them against
  the pinned `hydra-synth`), and one `H()` pattern is 1 exactly in the drops (choruses in the
  chiptunes).

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
| `sources/` | `index.json`, the songs from other GitHub repositories (written by `pnpm run sources`) |
| `index.html`, `css/` | the player page |
| `src/` | player code: engine (Strudel, seeking, changes while playing), guards against mistakes in the code, library (repo tracks, uploads, songs from GitHub), playlist and repeat rules, track parts for the progress bar, mixer (settings, audio graph, EQ math, meters, panel), code highlighting and editor, guitar chords and shapes, Hydra visuals, upload checks, header parsing, strudel.cc links and extras, the GitHub sources |
| `scripts/` | `index-tracks.js` (track index), `index-sources.js` (songs from GitHub), `snapshot-samples.js` (sample names for the tests) |
| `test/` | tests; `test/support/` runs Strudel in Node and holds the harmony and tracker checks |
