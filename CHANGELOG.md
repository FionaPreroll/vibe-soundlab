# Changelog

All notable changes to the player and its tracks. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Three Reese rollers with 808 booms: Tiefgarage, Schwerkraft and Unterströmung.
- A progress bar for the playing track, with its parts (intro, build, drops, breakdown, outro) underneath and the time played. Click or drag the bar, or click a part, to jump there; if the track is stopped, it starts from there.
- A mixer with a channel for each part of the band (drums, bass, pad, snare, stabs, leads, FX), each with a fader, mute and solo, and a live spectrum and level meter. Settings are kept for your next visit.
- An 8-band EQ for the master or any single channel, with its curve drawn over the live spectrum. Click a channel's name in the mixer to EQ it.
- Tracks can name their own mixer channels, so a track that plays an arpeggio where the others have a pad shows "Arpeggio" on that channel.
- The track's code is now shown with syntax colours, and while a track plays, the notes and sounds you hear light up in it, like in the strudel.cc editor. The code panel is open from the start.

### Fixed

- Starkstrom: the drum break in the second half no longer stumbles. It was a loop longer than one bar squeezed into one bar; it is now a clean one-bar break.
- Druckwelle: the foghorn bass no longer sounds raspy. It now uses two saws and a stronger, smoother saturation instead of a filter bite on every note.
