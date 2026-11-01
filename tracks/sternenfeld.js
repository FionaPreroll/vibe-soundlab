// @title Sternenfeld
// @style Amiga demoscene chiptune
// @bpm 125
// @key D major
// @bars 80
// @order 13
// @channels 4
// @mixer Drums + echo, Bass, Arpeggio, , , Lead
// @about A cheerful Amiga intro tune on four channels panned left-right-right-left, the drum channel turns into an echo in the break.
// ============================================================
//  STERNENFELD — Amiga-Chiptune · 125 BPM · D-Dur · 4 Kanäle
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  Musik wie aus einem Amiga-Intro mit Sternenfeld und Laufschrift,
//  geschrieben im ProTracker:
//  - Der Amiga-Soundchip (Paula) hat vier Kanäle, fest verteilt:
//    Kanal 1 und 4 links, Kanal 2 und 3 rechts. Hier etwas weniger hart
//    (.3 / .7), wie es die meisten Amiga-Player anbieten.
//  - 125 BPM ist das Standardtempo im ProTracker.
//  - Kick, Snare und Hi-Hat teilen sich einen Kanal: jeder Schlag
//    schneidet den vorigen ab. coarse(2) halbiert die Abtastrate,
//    das klingt nach den 8-Bit-Samples von damals.
//  - Im Breakdown pausieren die Drums, und ihr Kanal spielt das Echo
//    der Melodie. Ein Kanal ist zu wertvoll, um ihn ruhen zu lassen.
//
//  Kanäle = Orbits: 1 Drums (links) · 2 Bass (rechts) · 3 Arp (rechts) · 6 Lead (links)
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 125
setcpm(bpm / 4)

const LEFT = .3
const RIGHT = .7

// ---------- HARMONIE ----------
// D → A → Hm → G: die fröhlichste Folge, die es gibt (I V vi IV)
const chordsA = `<[a4,d5,f#5] [a4,c#5,e5] [b4,d5,f#5] [b4,d5,g5]
                  [a4,d5,f#5] [a4,c#5,e5] [b4,d5,g5] [a4,c#5,e5]>`
const chordsB = `<[b4,d5,f#5] [b4,d5,g5] [a4,d5,f#5] [a4,c#5,e5]
                  [b4,d5,f#5] [b4,d5,g5] [b4,e5,g5] [a4,c#5,e5]>`
const chordsEnd = `<[a4,d5,f#5] [a4,c#5,e5] [b4,d5,f#5] [b4,d5,g5]
                    [a4,d5,f#5] [a4,c#5,e5] [b4,d5,g5] [a4,d5,f#5]>`

// ---------- KANAL 3: ARP ----------
// Dreieck statt Rechteck: weicher, fast wie Glocken. 48 Töne pro Takt.
const arp = (chords, speed = 16) => note(chords).arp("0 1 2".fast(speed))
  .s("triangle").attack(.001).release(.01)
  .gain("[.7 .5 .58 .5]*4").pan(RIGHT).orbit(3)

// ---------- KANAL 2: BASS ----------
// kurze Töne: Grundton, Oktave, Quinte, Oktave
const bassA = `<[d2 ~ d3 ~ a2 ~ d3 ~]*2 [a1 ~ a2 ~ e2 ~ a2 ~]*2
                [b1 ~ b2 ~ f#2 ~ b2 ~]*2 [g1 ~ g2 ~ d2 ~ g2 ~]*2
                [d2 ~ d3 ~ a2 ~ d3 ~]*2 [a1 ~ a2 ~ e2 ~ a2 ~]*2
                [g1 ~ g2 ~ d2 ~ g2 ~]*2 [a1 ~ a2 ~ e2 ~ a2 ~ a1 ~ c#2 ~ e2 ~ g2 ~]>`
const bassB = `<[b1 ~ b2 ~ f#2 ~ b2 ~]*2 [g1 ~ g2 ~ d2 ~ g2 ~]*2
                [d2 ~ d3 ~ a2 ~ d3 ~]*2 [a1 ~ a2 ~ e2 ~ a2 ~]*2
                [b1 ~ b2 ~ f#2 ~ b2 ~]*2 [g1 ~ g2 ~ d2 ~ g2 ~]*2
                [e1 ~ e2 ~ b1 ~ e2 ~]*2 [a1 ~ a2 ~ e2 ~ a2 ~ a1 ~ c#2 ~ e2 ~ g2 ~]>`
const bassBreak = "<d2 a1 b1 g1 d2 a1 g1 a1>"
const bassEnd = `<[d2 ~ d3 ~ a2 ~ d3 ~]*2 [a1 ~ a2 ~ e2 ~ a2 ~]*2
                  [b1 ~ b2 ~ f#2 ~ b2 ~]*2 [g1 ~ g2 ~ d2 ~ g2 ~]*2
                  [d2 ~ d3 ~ a2 ~ d3 ~]*2 [a1 ~ a2 ~ e2 ~ a2 ~]*2
                  [g1 ~ g2 ~ d2 ~ g2 ~]*2 d2>`

const bass = (line) => note(line).s("square")
  .attack(.002).decay(.1).sustain(.35).release(.03)
  .lpf(1300).coarse(2)
  .gain(.8).pan(RIGHT).orbit(2)

// ---------- KANAL 4: LEAD ----------
// Jeder Takt springt erst hinunter und klettert dann zu einem hohen Ton.
const themeA = `<[d6@3 a5@3 f#5@2 a5@2 d6@2 f#6@4] [e6@3 c#6@3 a5@2 c#6@2 e6@2 a6@4]
                 [f#6@3 d6@3 b5@2 d6@2 f#6@2 b6@4] [a6@2 g6@2 d6@2 b5@2 g5@4 b5@2 d6@2]
                 [d6@3 a5@3 f#5@2 a5@2 d6@2 f#6@4] [e6@3 c#6@3 a5@2 c#6@2 e6@2 a6@4]
                 [g6@3 d6@3 b5@2 d6@2 g6@2 b6@4] [a6@4 e6@2 c#6@2 a5@8]>`
const themeB = `<[b5@2 d6@2 f#6@2 d6@2 b5@4 a5@2 b5@2] [g5@2 b5@2 d6@2 b5@2 g5@4 a5@2 b5@2]
                 [a5@2 d6@2 f#6@2 d6@2 a5@4 c#6@2 d6@2] [e6@8 c#6@4 a5@4]
                 [b5@2 d6@2 f#6@2 a6@2 b6@4 a6@2 f#6@2] [g6@4 d6@2 b5@2 g5@4 b5@2 d6@2]
                 [e6@4 b5@2 g5@2 e5@4 g5@2 b5@2] [c#6@2 e6@2 a6@4 g6@2 e6@2 c#6@4]>`
// Breakdown: zwei lange Töne pro Takt, vor dem Taktende eine kurze Pause fürs Echo
const themeBreak = `<[f#6@8 d6@5 ~@3] [e6@8 c#6@5 ~@3] [d6@8 b5@5 ~@3] [b5@8 g5@5 ~@3]
                     [a5@8 d6@5 ~@3] [c#6@8 e6@5 ~@3] [d6@8 g6@5 ~@3] [e6@8 a6@5 ~@3]>`
const themeEnd = `<[d6@3 a5@3 f#5@2 a5@2 d6@2 f#6@4] [e6@3 c#6@3 a5@2 c#6@2 e6@2 a6@4]
                   [f#6@3 d6@3 b5@2 d6@2 f#6@2 b6@4] [a6@2 g6@2 d6@2 b5@2 g5@4 b5@2 d6@2]
                   f#6 e6 [d6 b5] d6>`

const lead = (line) => note(line).s("square")
  .penv(1).pattack(.025)
  .vib(6.5).vibmod(.22)
  .attack(.003).decay(.15).sustain(.8).release(.05)
  .coarse(2)
  .gain(.62).pan(LEFT).orbit(6)

// ---------- KANAL 1: DRUMS ----------
// Kick, Snare und Hi-Hat auf einem Kanal: sie wechseln sich ab, nie spielen
// zwei zugleich. Am Phrasenende ein Snare-Fill.
const kick = s("bd ~ ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~ ~ ~ ~").gain(.34)
const snare = s(`<[~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~]!7
                  [~ ~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`).gain(.3)
const hats = s(`<[~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh hh]!7
                 [~ ~ hh ~ ~ ~ hh ~ ~ ~ ~ ~ ~ ~ ~ ~]>`).gain(.17)
const beat = stack(kick, snare, hats).bank("RolandTR707").coarse(2)
  .pan(LEFT).cut(1).orbit(1)

// im Breakdown spielt Kanal 1 das Echo der Melodie: drei Zeilen später, leiser
const echo = (part) => part.late(3/16).gain(.26).lpf(2500).pan(LEFT).orbit(1)

// ---------- VISUALS (Hydra) ----------
// Laufen im Player hinter dem Code und genauso auf strudel.cc.
// H() macht aus einem Pattern eine Zahl, die Hydra in jedem Bild liest:
// `energy` folgt den Teilen des Arrangements unten, `pulse` dem Beat.
await initHydra()
const energy = H(arrange(
  [8,  saw.range(0, .4).slow(8)],    // intro: wird langsam heller
  [16, ".6"],                        // verse
  [16, "1"],                         // chorus
  [8,  ".3"],                        // breakdown
  [16, ".6"],                        // verse
  [8,  "1"],                         // chorus
  [8,  isaw.range(0, .5).slow(8)],   // outro: blendet aus
))
const pulse = H(isaw.fast(4))
// Sternenfeld: ein Flug durch die Sterne wie in einem Amiga-Intro
const twinkle = () => .5 + pulse() * energy() * .5
noise(150, .02).thresh(.82, 0)
  .color(() => twinkle() * .8, () => twinkle() * .9, twinkle)
  .add(src(o0).scale(1.04), () => .6 + energy() * .25)
  .out()

// ---------- ARRANGEMENT ----------
const preload = s("bd sd hh").bank("RolandTR707").gain(0).orbit(1)

// Arp blendet ein, dann Bass, dann Hats, dann der ganze Beat
const intro = stack(
  preload.mask("<1 0!7>"),
  arp(chordsA).velocity(saw.range(.25, 1).slow(4)).mask("<1!4 0!4>"),
  arp(chordsA).mask("<0!4 1!4>"),
  bass(bassA).mask("<0!4 1!4>"),
  s("[~ hh]*8").bank("RolandTR707").gain(.17).coarse(2).pan(LEFT).cut(1).orbit(1).mask("<0!4 1!2 0!2>"),
  beat.mask("<0!6 1!2>"),
)

const verse = stack(beat, bass(bassA), arp(chordsA), lead(themeA))

const chorus = stack(beat, bass(bassB), arp(chordsB), lead(themeB))

const breakdown = stack(
  bass(bassBreak).decay(1.4).sustain(.2).release(.3),
  arp(chordsA, 8),
  lead(themeBreak).vib(5).vibmod(.3).release(.2),
  echo(lead(themeBreak).release(.2)),
)

const outro = stack(
  beat.mask("<1!6 0!2>"), bass(bassEnd), arp(chordsEnd).velocity(saw.range(1, .4).slow(8)),
  lead(themeEnd),
)

arrange(
  [8,  intro],
  [16, verse],
  [16, chorus],
  [8,  breakdown],
  [16, verse],
  [8,  chorus],
  [8,  outro],
)
