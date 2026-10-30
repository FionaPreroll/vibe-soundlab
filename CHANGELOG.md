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
- Every track now has its own visuals behind the player, made with Hydra: night-blue streaks for Nachtschicht, fog and a lighthouse for Nebelhorn, glass and rain for Glasregen, northern lights for Polarlicht, shock waves for Druckwelle, melting cells for Kernschmelze, electric arcs for Starkstrom, a car-park tunnel for Tiefgarage, a black hole for Schwerkraft, a river bed for Unterströmung, a pixel plasma for Seriennummer, C64 raster bars for Rasterzeile and a starfield for Sternenfeld. They grow with the build-ups, peak in the drops and choruses and pulse with the beat. The same code runs on strudel.cc. The "Visuals" button turns them off.
- Songs from GitHub: more than a hundred Strudel songs that eefano, tzwaan and MariaAreadne share in their GitHub repositories, from Cardiacs covers to Mario and Megalovania. They stay hidden until you switch them on, because playing one runs its code in the page. Each repository has its own foldable list with its folders, and you can search them by title, artist or folder. A song's code loads from GitHub when you pick it, always the version that was listed.
- Songs written on strudel.cc now play here much as they do there: the General MIDI instruments (gm_piano, gm_flute, …), the ZZFX synths, the short drum machine names (tr909, linn, …), `piano()` and `o()`. Sliders keep the value they start with, and pianorolls and scopes are left out.
- Uploads without a header take their title from a first comment like `// "Night Bus"`, as songs written for strudel.cc often have.

### Fixed

- Notes on orbits the mixer has no channel for (like 0.5 or 12) are no longer dropped; they play on the first channel.
- A song that replaces one of Strudel's own functions no longer breaks the songs you play after it.
- Songs that use `all()` work again after a track with visuals has played.
- Starkstrom: the drum break in the second half no longer stumbles. It was a loop longer than one bar squeezed into one bar; it is now a clean one-bar break.
- Druckwelle: the foghorn bass no longer sounds raspy. It now uses two saws and a stronger, smoother saturation instead of a filter bite on every note.
