# Changelog

All notable changes to the player and its tracks. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Three Reese rollers with 808 booms: Tiefgarage, Schwerkraft and Unterströmung.
- A progress bar for the playing track, with its parts (intro, build, drops, breakdown, outro) underneath and the time played. Click or drag the bar, or click a part, to jump there; if the track is stopped, it starts from there.
- A mixer with a channel for each part of the band (drums, bass, pad, snare, stabs, leads, FX), each with a fader, mute and solo, and a live spectrum and level meter. Settings are kept for your next visit.
- An 8-band EQ for the master or any single channel, with its curve drawn over the live spectrum. Click a channel's name in the mixer to EQ it.
- Three chiptunes in the style of keygen and demoscene music, each limited to a few channels like the trackers of the time: Seriennummer (FastTracker keygen anthem, 6 channels), Rasterzeile (C64 SID, 3 voices) and Sternenfeld (Amiga intro, 4 channels).
- Tracks can name their own mixer channels, so a track that plays an arpeggio where the others have a pad shows "Arpeggio" on that channel.
- The track's code is now shown with syntax colours, and while a track plays, the notes and sounds you hear light up in it, like in the strudel.cc editor. The code panel is open from the start.
- Every track now has its own visuals behind the player, made with Hydra: night-blue streaks for Nachtschicht, fog and a lighthouse for Nebelhorn, glass and rain for Glasregen, northern lights for Polarlicht, shock waves for Druckwelle, melting cells for Kernschmelze, electric arcs for Starkstrom, a car-park tunnel for Tiefgarage, a black hole for Schwerkraft and a river bed for Unterströmung. They grow with the build-ups, peak in the drops and pulse with the beat. The same code runs on strudel.cc. The "Visuals" button turns them off.

### Fixed

- Starkstrom: the drum break in the second half no longer stumbles. It was a loop longer than one bar squeezed into one bar; it is now a clean one-bar break.
- Druckwelle: the foghorn bass no longer sounds raspy. It now uses two saws and a stronger, smoother saturation instead of a filter bite on every note.
