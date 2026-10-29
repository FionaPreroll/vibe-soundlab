// @title Starkstrom
// @style Jump-up
// @bpm 175
// @key A minor
// @bars 120
// @order 7
// @about A bouncing wub bass full of pitch bends, a hoover riff and air horns on the drop.
// ============================================================
//  STARKSTROM — Jump-up · 175 BPM · A-Moll
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  Jump-up ist verspielt und hüpft:
//  - Der Wub-Bass: Square durch einen resonanten Ladder-Tiefpass, der bei
//    jeder Note auf- und wieder zugeht ("wau"). Fast jede Note rutscht:
//    "Yoi" springt aus der Oktave darunter hoch, "Dyoo" fällt von oben herein.
//  - Frage und Antwort: Takt 1 stellt die Figur vor, Takt 2 antwortet.
//  - Der Hoover: breiter, verstimmter Supersaw mit Vibrato, der von unten in
//    jeden Ton gleitet, darunter ein Pulse mit wandernder Pulsbreite (PWM).
//  - Air Horns auf der Eins des Drops, wie im Rave.
//
//  Orbits: 1 Drums · 2 Bass · 3 Pad · 4 Snare · 5 Horn/Stab · 6 Hoover · 7 FX
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 175
const bar = 240 / bpm
setcpm(bpm / 4)

// ---------- HARMONIE ----------
// Am11 → F6/9 → G6/9 → E7sus4, je 2 Takte: die klassische Moll-Kadenz,
// nur ohne Töne im Halbtonabstand. Das E7sus4 hat kein Gis und bleibt dunkel.
const chords = "<[a2,g3,c4,e4,d5] [f3,c4,g4,a4,d5] [g3,d4,a4,b4,e5] [e3,b3,d4,a4,e5]>/2"
const air = "<[a5,e6] [a5,d6] [b5,e6] [b5,e6]>/2"

// ---------- WUB-LINIEN ----------
// 16tel-Raster, 8 Takte. Auf jeder Eins der Grundton des Akkords.
// bend = Halbtöne: − springt von unten hinein ("Yoi"), + fällt von oben ("Dyoo")
const lineA = `<[a1@2 a1@2 ~@2 a1@2 c2@2 a1@2 ~ e2@3] [a1@4 g1@2 a1@2 ~@2 a2@2 e2@2 d2@2]
                [f1@2 f1@2 ~@2 f1@2 a1@2 f1@2 ~ c2@3] [f1@4 g1@2 a1@2 ~@2 f2@2 c2@2 d2@2]
                [g1@2 g1@2 ~@2 g1@2 b1@2 g1@2 ~ d2@3] [g1@4 a1@2 b1@2 ~@2 g2@2 d2@2 e2@2]
                [e1@2 e1@2 ~@2 e1@2 a1@2 e1@2 ~ b1@3] [e1@4 g1@2 b1@2 ~@2 e2@2 d2@2 b1@2]>`
const bendA = `<[0@2 -12@2 ~@2 0@2 -3@2 3@2 ~ 12@3] [-12@4 2@2 -2@2 ~@2 -12@2 5@2 2@2]
                [0@2 -12@2 ~@2 0@2 -4@2 4@2 ~ 12@3] [-12@4 -2@2 -2@2 ~@2 -12@2 5@2 -2@2]
                [0@2 -12@2 ~@2 0@2 -4@2 4@2 ~ 12@3] [-12@4 -2@2 -2@2 ~@2 -12@2 5@2 -2@2]
                [0@2 -12@2 ~@2 0@2 -5@2 5@2 ~ 12@3] [-12@4 -3@2 -4@2 ~@2 -12@2 2@2 3@2]>`

// B: vier schnelle Wubs, dann Oktav-Sprung hin und zurück
const lineB = `<[a1 a1 a1 a1 ~@2 a2@2 a1@2 c2@2 ~@2 e2@2] [a1@3 a1@3 g1@2 a1@4 e2@2 c2@2]
                [f1 f1 f1 f1 ~@2 f2@2 f1@2 a1@2 ~@2 c2@2] [f1@3 f1@3 g1@2 a1@4 c2@2 d2@2]
                [g1 g1 g1 g1 ~@2 g2@2 g1@2 b1@2 ~@2 d2@2] [g1@3 g1@3 a1@2 b1@4 d2@2 e2@2]
                [e1 e1 e1 e1 ~@2 e2@2 e1@2 a1@2 ~@2 b1@2] [e1@3 e1@3 g1@2 b1@4 d2@2 e2@2]>`
const bendB = `<[0 0 0 0 ~@2 -12@2 12@2 -3@2 ~@2 12@2] [12@3 0@3 2@2 -2@4 -7@2 4@2]
                [0 0 0 0 ~@2 -12@2 12@2 -4@2 ~@2 12@2] [12@3 0@3 -2@2 -2@4 -3@2 -2@2]
                [0 0 0 0 ~@2 -12@2 12@2 -4@2 ~@2 12@2] [12@3 0@3 -2@2 -2@4 -3@2 -2@2]
                [0 0 0 0 ~@2 -12@2 12@2 -5@2 ~@2 12@2] [12@3 0@3 -3@2 -4@4 -3@2 -2@2]>`

// ---------- BASS ----------
// Square → resonanter Ladder-Tiefpass, der in 50 ms aufgeht und wieder zufällt
// → Verzerrung. Unter 110 Hz bleibt Platz für den Sub.
const wub = (line, bend, drive = "2.2:.4") => note(line)
  .penv(bend).pdecay(.13)
  .s("square")
  .attack(.004).decay(.2).sustain(.8).release(.05)
  .lpf(400).lpenv(3.5).lpattack(.05).lpdecay(.16).lpsustain(.25).lpq(14).ftype("ladder")
  .hpf(110)
  .distort(drive)
  .postgain(.58).orbit(2)

// zweiter Drop: zusätzlich ein Supersaw durch den "a"-Formanten, quietscht obenrum
const squeal = (line, bend) => note(line)
  .penv(bend).pdecay(.13)
  .s("supersaw").unison(3).detune(.5).spread(.4)
  .attack(.004).decay(.2).sustain(.7).release(.05)
  .lpf(2000).hpf(250)
  .vowel("a").shape(.8)
  .postgain(.12).orbit(2)

const sub = (line, bend) => note(line)
  .penv(bend).pdecay(.13)
  .s("sine").attack(.004).decay(.2).sustain(.85).release(.05)
  .gain(.64).orbit(2)

const bass = (line, bend, drive) => stack(wub(line, bend, drive), sub(line, bend))

// ---------- PAD ----------
const padBody = note(chords)
  .s("supersaw").unison(5).detune(.28).spread(.7)
  .attack(.5).decay(.8).sustain(.7).release(2)
  .lpf(sine.range(1000, 3000).slow(16)).lpq(2).hpf(220)
  .room(.4).roomsize(5).roomlp(6500).orbit(3)

const padAir = note(air)
  .s("supersaw").unison(3).detune(.12).spread(1)
  .attack(1.5).sustain(1).release(3)
  .lpf(8000).hpf(1600)
  .room(.8).roomsize(5).roomlp(6500).orbit(3)

// im Drop reichen weniger Stimmen, das Pad liegt dort nur leise unter dem Bass
const pad = (level = 1, voices = 5) => stack(
  padBody.unison(voices).gain(.13 * level),
  padAir.unison(Math.min(voices, 3)).gain(.06 * level))

// ---------- HOOVER ----------
const hooverLine = `<[a4@3 c5@3 e5@2 d5@4 c5@4] [e5@12 ~@4]
                     [a4@3 c5@3 f5@2 d5@4 c5@4] [d5@12 ~@4]
                     [b4@3 d5@3 g5@2 e5@4 d5@4] [e5@12 ~@4]
                     [b4@3 d5@3 e5@2 a5@4 e5@4] [b4@12 ~@4]>`
const hooverFx = (p) => p
  .delay(.25).delaytime(bar * 3/16).delayfeedback(.3)
  .room(.3).roomsize(5).orbit(6)
// breiter Supersaw, gleitet aus 5 Halbtönen darunter in den Ton, mit Vibrato
const hooverSaw = hooverFx(note(hooverLine)
  .penv(5).pattack(.12)
  .s("supersaw").unison(5).detune(.6).spread(.9)
  .vib(5.5).vibmod(.18)
  .attack(.02).decay(.5).sustain(.6).release(.3)
  .lpf(3200).lpq(2))
// eine Oktave tiefer: Pulse, dessen Pulsbreite langsam wandert (PWM)
const hooverPwm = hooverFx(note(hooverLine).add(note(-12))
  .penv(5).pattack(.12)
  .s("pulse").pw(.3).pwrate(3).pwsweep(.25)
  .attack(.02).decay(.5).sustain(.6).release(.3)
  .lpf(1800))
const hoover = (level = 1) => stack(hooverSaw.gain(.24 * level), hooverPwm.gain(.05 * level))

// ---------- AIR HORN & STABS ----------
// Air Horn: A-Moll-Dreiklang, "BAP BAP BAAAP", rutscht von unten in den Ton.
// Nur über dem Am11 (erster Takt jeder 8-Takt-Phrase).
const hornFx = (p, send = .2) => p
  .delay(send).delaytime(bar * 3/16).delayfeedback(.3)
  .room(.35).roomsize(4).orbit(5)
const airhorn = hornFx(note("[a4,c5,e5]").struct("x@2 ~@2 x@2 ~@2 x@8")
  .penv(4).pattack(.04)
  .s("sawtooth").attack(.01).decay(.1).sustain(.85).release(.06)
  .lpf(2600).hpf(300)
  .distort("1.5:.6")
  .gain(.14), .08)

// Rave-Stabs auf den Achtel-Offbeats, Dreiklänge aus den Pad-Tönen
const stabChords = "<[a4,c5,e5] [a4,c5,f5] [b4,d5,g5] [b4,d5,e5]>/2"
const stab = hornFx(note(stabChords).struct("[~ x]*4")
  .s("sawtooth").lpf(1800).lpenv(2).lpdecay(.1).lpsustain(0).lpq(3)
  .attack(.002).decay(.14).sustain(0).release(.06)
  .gain(.16))

// ---------- DRUMS ----------
const kick = s("<[bd@10 bd@6]!3 [bd@10 bd@4 bd@2]>").bank("RolandTR909").n(0)
  .lpf(3500).shape(.5).postgain(.32)
  .duckorbit(3).duckdepth(.4).duckattack(.18)

// Snare plus echte Handclaps: der typische Jump-up-Knall
const snare = stack(
  s("sd").beat("4,12", 16).bank("RolandTR909").n(6),
  s("realclaps").beat("4,12", 16).n(1).gain(.5).hpf(500),
).shape(.55).postgain(.3).room(.2).roomsize(2.5).orbit(4)

const ghosts = s("sd").beat("2,7,15", 16).bank("RolandTR909").n(6)
  .gain("[.06 .1 .08]").hpf(1500)

const shaker = s("sh*16").bank("RolandTR808")
  .gain("[.1 .18 .14 .18]*4").hpf(5000).late("[0 .008]*8")

const oh = s("[~ oh]*4").bank("RolandTR909").n(2).gain(.14).hpf(6000).cut(3)

const brk = s("breaks157").fit().hpf(600).gain(.26)

const crash = s("<cr ~!7>").bank("RolandTR909").n(0).hpf(300).gain(.26)

// ---------- FX ----------
const roll = s("<sd*4 sd*4 sd*8 sd*8 sd*16 sd*16 sd*32 [[sd*16]@3 ~]>")
  .bank("RolandTR909").n(6)
  .gain(saw.range(.1, .5).slow(8)).hpf(saw.range(150, 1500).slow(8))

const riser = s("white").slow(8)
  .hpf(200).hpenv(5.5).hpattack(bar * 8)
  .attack(bar * 7.3).release(.05).gain(.22)

// Ton-Riser: Saw, der über 8 Takte zwei Oktaven hoch zum A fährt
const sweep = note("a4").slow(8).s("sawtooth")
  .penv(24).pattack(bar * 8)
  .attack(bar * 6).sustain(1).release(.05)
  .lpf(2500).hpf(300).gain(.07)
  .room(.4).roomsize(6).orbit(7)

const revcrash = s("<~!7 cr>").bank("RolandTR909").n(0)
  .speed(-bpm / 240).unit("c").hpf(400).gain(.3)

const impact = s("<white ~!31>")
  .lpf(150).lpenv(-6).lpattack(.9)
  .decay(1.8).sustain(0).gain(.8).room(.4).roomsize(6).orbit(7)

const preload = stack(
  s("bd:0 sd:6 oh:2 cr:0").bank("RolandTR909"), s("sh").bank("RolandTR808"),
  s("realclaps:1 breaks157"),
).gain(0)

// ---------- ARRANGEMENT ----------
const intro = stack(
  preload.mask("<1 0!15>"),
  pad().lpf(saw.range(600, 2400).slow(16)),
  shaker.mask("<0!4 1!12>"), oh.mask("<0!8 1!8>"),
  kick.mask("<0!8 1!8>"), snare.mask("<0!12 1!4>"),
  hoover(.6).lpf(saw.range(600, 2500).slow(8)).mask("<0!8 1!8>"),
  wub(lineA, bendA).lpf(200).lpenv(2).postgain(.25).mask("<0!12 1!4>"),
)

// letzter Schlag vor dem Drop bleibt leer
const build = stack(
  pad().lpf(saw.range(900, 3200).slow(8)), hoover(.8),
  airhorn.mask("<1 0!7>"), stab.mask("<0!4 1!4>"),
  roll, riser, sweep, revcrash, shaker.mask("<1!6 0!2>"),
  wub(lineA, bendA).lpf(saw.range(200, 500).slow(8)).postgain(saw.range(.15, .4).slow(8)),
).mask("<1!7 [1@3 0]>")

const drop1 = stack(
  kick, snare, ghosts, shaker, oh, crash, impact,
  airhorn.mask("<1 0!15>"),
  arrange([16, bass(lineA, bendA)], [16, bass(lineB, bendB)]),
  hoover(.7).mask("<0!16 1!16>"),
  pad(.5, 2),
)

// kurzer Breakdown: Hoover und Skank-Stabs über dem Pad, der Sub hüpft weiter
const breakdown = stack(
  pad(1.1), hoover(), stab, crash.mask("<1 0!7>"),
  sub(lineA, bendA).gain(.45).mask("<0!4 1!4>"),
  shaker.gain(.6).mask("<0!4 1!4>"),
)

const build2 = stack(
  pad().lpf(saw.range(900, 3200).slow(8)), hoover(.8), stab,
  airhorn.mask("<1 0!7>"),
  roll, riser, sweep, revcrash, brk.mask("<0!4 1!2 0!2>"),
  wub(lineB, bendB).lpf(saw.range(200, 500).slow(8)).postgain(saw.range(.15, .4).slow(8)),
).mask("<1!7 [1@3 0]>")

// zweiter Drop: Break-Layer, Quietsch-Stimme am Bass, Hoover und Stabs durchgehend
const drop2 = stack(
  kick, snare, ghosts, shaker, brk, crash, impact,
  airhorn.mask("<1 0!15>"),
  arrange(
    [16, stack(bass(lineB, bendB, "2.5:.38"), squeal(lineB, bendB))],
    [16, stack(bass(lineA, bendA, "2.5:.38"), squeal(lineA, bendA))],
  ),
  hoover(.8), stab.gain(.1).mask("<0!16 1!16>"),
  pad(.5, 2),
)

const outro = stack(
  kick.mask("<1!12 0!4>"), snare.mask("<1!12 0!4>"), shaker, oh.mask("<1!8 0!8>"), crash,
  bass(lineA, bendA).mask("<1!8 0!8>"),
  hoover(.5).mask("<0!8 1!8>"),
  pad(),
)

arrange(
  [16, intro],
  [8,  build],
  [32, drop1],
  [8,  breakdown],
  [8,  build2],
  [32, drop2],
  [16, outro],
)
