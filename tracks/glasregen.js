// @title Glasregen
// @style Liquid / atmospheric
// @bpm 172
// @key C minor
// @bars 128
// @order 3
// @about Two-step liquid roller: glassy FM keys, a bell melody and rain made of glass taps.
// ============================================================
//  GLASREGEN — Liquid Drum & Bass · 172 BPM · C-Moll
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  Orbits: 1 Drums · 2 Bass · 3 Pad · 4 Snare · 5 Keys · 6 Glocke · 7 Regen
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 172
const bar = 240 / bpm
setcpm(bpm / 4)

// ---------- HARMONIE ----------
// Cm9 → Abmaj9 → Ebmaj9 → Bb6/9, je 2 Takte. Klassische Liquid-Kadenz:
// alle vier Akkorde teilen sich G und Bb, deshalb fließen sie ineinander.
// Offene Lage, Grundton unten, None oder Sexte oben.
const chords = "<[c3,bb3,eb4,g4,d5] [ab2,g3,c4,eb4,bb4] [eb3,g3,d4,f4,bb4] [bb2,g3,d4,f4,c5]>/2"
// hohe Luft-Schicht: nur Töne, die keinen Halbton über einem Pad-Ton liegen
const air = "<[g5,bb5] [g5,c6] [f5,bb5] [g5,c6]>/2"
// Keys verdoppeln die mittleren Pad-Stimmen: gleiche Töne, andere Farbe
const keyChords = "<[bb3,eb4,g4] [g3,c4,eb4] [g3,d4,f4] [g3,d4,f4]>/2"

// ---------- BASS ----------
// Grundton auf jeder Eins, kurze Durchgänge zum nächsten Akkord.
const line = `<[c2@10 c2@2 eb2@4] [c2@6 ~@2 g1@4 bb1@4]
               [ab1@10 ab1@2 c2@4] [ab1@6 ~@2 eb1@4 g1@4]
               [eb2@10 eb2@2 g2@4] [eb2@6 ~@2 bb1@4 d2@4]
               [bb1@10 bb1@2 d2@4] [bb1@6 ~@2 c2@4 d2@4]>`

const sub = note(line).s("sine")
  .attack(.01).decay(.3).sustain(.9).release(.08)
  .gain(.62).orbit(2)

// weiche Reese: wenig Verstimmung, Filter knapp über dem Grundton, leicht angezerrt
const warm = note(line).s("supersaw").unison(3).detune(.2).spread(.3)
  .attack(.01).sustain(.9).release(.08)
  .lpf(sine.range(400, 900).slow(16)).lpq(2).hpf(110)
  .distort("1.2:.5").postgain(.28).orbit(2)

const bass = (level = 1) => stack(sub.gain(.62 * level), warm.postgain(.28 * level))

// ---------- PAD ----------
const padBody = note(chords)
  .s("supersaw").unison(6).detune(.25).spread(.6)
  .attack(1.2).decay(.8).sustain(.7).release(3)
  .lpf(sine.range(800, 2600).slow(16)).lpq(3).hpf(160)
  .room(.5).roomsize(7).roomlp(6000).orbit(3)

const padAir = note(air)
  .s("supersaw").unison(4).detune(.1).spread(1)
  .attack(2.5).sustain(1).release(5)
  .lpf(7000).hpf(1200)
  .room(.9).roomsize(7).roomlp(6000).orbit(3)

const pad = (level = 1) => stack(padBody.gain(.14 * level), padAir.gain(.06 * level))

// ---------- KEYS & GLOCKE ----------
// FM-Keys, Liquid-typisch neben den Schlägen: auf der 2 und kurz vor der 3
const keys = note(keyChords).struct("~ x ~ ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~")
  .s("sine").fmh(1).fmi(1.6).fmenv("exp").fmdecay(.25).fmsustain(.2)
  .attack(.005).decay(.6).sustain(.1).release(.4)
  .gain(.32).pan(.42)
  .delay(.3).delaytime(bar * 3/8).delayfeedback(.35)
  .room(.4).roomsize(4).orbit(5)

// Glocke: eine Melodie aus Akkordtönen über dem Pad, ein Ton pro Halbtakt
const bellLine = `<[g5@3 bb5@3 c6@2] [bb5@4 g5@4]
                   [c6@3 bb5@3 g5@2] [eb5@8]
                   [d6@3 bb5@3 g5@2] [f5@8]
                   [d6@3 c6@3 bb5@2] [g5@8]>`
const bell = note(bellLine)
  .s("triangle").fmh(3.5).fmi(1.1).fmdecay(.4).fmsustain(0)
  .attack(.003).decay(1.2).sustain(0).release(1)
  .gain(.2).pan(.6)
  .delay(.45).delaytime(bar * 3/16).delayfeedback(.5)
  .room(.7).roomsize(6).orbit(6)

// ---------- DRUMS ----------
// Two-Step: Kick auf der 1 und der 3+, die Snare auf 2 und 4
const kick = s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~").bank("RolandTR909").n(1)
  .lpf(3500).shape(.25).postgain(.42)
  .duckorbit(3).duckdepth(.3).duckattack(.25)

const snare = stack(
  s("sd").beat("4,12", 16).bank("LinnDrum").n(1),
  s("cp").beat("4,12", 16).bank("RolandTR909").gain(.35).hpf(600),
).shape(.3).postgain(.3).room(.2).roomsize(2).orbit(4)

const ghosts = s("sd").beat("3,7,9,14", 16).bank("LinnDrum").n(1)
  .gain("[.12 .08 .1 .07]").hpf(800)

const shaker = s("sh*16").bank("LinnDrum")
  .gain("[.12 .22 .16 .22]*4").hpf(4000).pan(sine.range(.35, .65).slow(2))

const hats = s("[~ hh]*4").bank("RolandTR909").gain(.18).hpf(6000)

const brk = s("breaks165").fit().hpf(500).lpf(9000).gain(.32)

const amen = n("0 ~ 2 3 4 ~ 6 7 8 9 ~ 11 12 ~ 14 15").s("amencutup")
  .cut(7).hpf(400).gain(.28)

const crash = s("<cr ~!7>").bank("RolandTR909").n(2).hpf(400).gain(.22)

// ---------- ATMO ----------
// Regen aus Glas: zufällige, hohe Glas-Klicks in einem großen Raum
const rain = s("glasstap*16").n(irand(3))
  .degradeBy(.55).speed(rand.range(1.4, 2.6))
  .gain(rand.range(.03, .14)).hpf(2500).pan(rand)
  .room(.8).roomsize(8).orbit(7)

const riser = s("pink").slow(8)
  .hpf(300).hpenv(5).hpattack(bar * 8)
  .attack(bar * 7).release(.1).gain(.18)

const sweepDown = s("<white ~!31>")
  .lpf(3000).lpenv(-4).lpattack(.8)
  .decay(2.5).sustain(0).gain(.35).room(.8).roomsize(8).orbit(7)

const preload = stack(
  s("bd:1 cp cr:2 hh").bank("RolandTR909"), s("sd:1 sh").bank("LinnDrum"),
  n(run(16)).s("amencutup"), s("breaks165"), n(run(3)).s("glasstap"),
).gain(0)

// ---------- ARRANGEMENT ----------
const intro = stack(
  preload.mask("<1 0!15>"),
  pad().lpf(saw.range(500, 2200).slow(16)),
  rain, keys.lpf(saw.range(600, 3000).slow(16)).mask("<0!4 1!12>"),
  bell.mask("<0!8 1!8>"),
  shaker.mask("<0!8 1!8>"),
  sub.mask("<0!12 1!4>"),
)

const build = stack(
  pad(), keys, bell, rain, riser,
  shaker, kick.mask("<0!4 1!4>"), snare.mask("<0!6 1!2>"),
  bass(.7).mask("<0!4 1!4>"),
).mask("<1!7 [1@3 0]>")

const drop1 = stack(
  kick, snare, ghosts, shaker, hats, brk.mask("<0!8 1!24>"), crash, sweepDown,
  bass(), pad(.7), keys, rain.gain(.06),
  bell.mask("<0!16 1!16>"),
)

// Breakdown ohne Drums: nur Harmonie, Glocke und Regen
const breakdown = stack(
  pad(1.15), keys.lpf(2200), bell, rain, sweepDown.gain(.25),
  sub.mask("<0!8 1!8>"),
)

const build2 = stack(
  pad().lpf(saw.range(900, 3200).slow(8)), keys, bell, rain, riser,
  s("sd*4 sd*4 sd*8 sd*8 [sd*16]!2 sd*16 [[sd*16]@3 ~]").bank("LinnDrum").n(1).slow(8)
    .gain(saw.range(.06, .35).slow(8)).hpf(600),
  bass(.8).mask("<0!4 1!4>"),
).mask("<1!7 [1@3 0]>")

// zweiter Drop: Amen statt Break, Glocke durchgehend
const drop2 = stack(
  kick, snare, ghosts, shaker, hats, amen, crash, sweepDown,
  bass(), pad(.7), keys, bell, rain.gain(.06),
)

const outro = stack(
  pad(), keys.mask("<1!8 0!8>"), bell.mask("<1!12 0!4>"), rain,
  kick.mask("<1!8 0!8>"), snare.mask("<1!8 0!8>"), shaker.mask("<1!12 0!4>"),
  sub.mask("<1!8 0!8>"),
)

arrange(
  [16, intro],
  [8,  build],
  [32, drop1],
  [16, breakdown],
  [8,  build2],
  [32, drop2],
  [16, outro],
)
