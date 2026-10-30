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
- Guitar chords to play along with: while a track plays, the player shows the chord you hear now and the next ones, each with its fingering for standard tuning (E A D G B E). The chords are worked out from the notes that play, so they show for the tracks, your uploads and the songs from GitHub, wherever chords play. "Simple chords" turns Fm9 into Fm and G7 into G, which is easier to play.
- The code can be changed while it plays: type in the code panel, then press Update or Ctrl+Enter (⌘+Enter on a Mac) and the change takes over without starting the track again. Ctrl+. stops. Your changes are kept for your next visit, marked as "edited", play when you press Play and open in strudel.cc as changed; "Undo my changes" brings back the track as it was.

### Changed

- Mistakes in the code no longer stop the music or freeze the page. A change with a syntax error is not played: the old version plays on, the line with the error is marked, and clicking the message puts the cursor there. Errors in mini-notation (a bracket left open in "c3 [e3") are found too.
- Loops that never end are stopped after a second and a half, patterns with far more notes than can be played (`s("bd*100000")`, `fast(5000)`) are refused before they play or silenced as soon as they start, and code that is still running after 30 seconds is given up on. A change that fails like this while playing goes back to the version before it.
- Mistakes in a track's visuals stop the visuals and say why; the music plays on.

### Fixed

- Notes on orbits the mixer has no channel for (like 0.5 or 12) are no longer dropped; they play on the first channel.
- A song that replaces one of Strudel's own functions no longer breaks the songs you play after it.
- Songs that use `all()` work again after a track with visuals has played.
- Songs that load samples from another site (like tzwaan's liquid and insomnia) no longer fail to play when that site doesn't answer or doesn't let other web pages use its files. They play with the standard sounds instead, and the player says which site failed and why. A site that takes longer than 10 seconds to answer is skipped too.
- Starkstrom: the drum break in the second half no longer stumbles. It was a loop longer than one bar squeezed into one bar; it is now a clean one-bar break.
- Druckwelle: the foghorn bass no longer sounds raspy. It now uses two saws and a stronger, smoother saturation instead of a filter bite on every note.
