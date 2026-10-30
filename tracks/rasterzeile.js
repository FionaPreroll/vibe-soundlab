// @title Rasterzeile
// @style C64 SID chiptune
// @bpm 150
// @key B minor
// @bars 88
// @order 12
// @channels 3
// @about Three voices like the C64's SID chip: a PWM lead, a fast arpeggio, and one voice for bass and drums together.
// ============================================================
//  RASTERZEILE — C64-Chiptune · 150 BPM · H-Moll · 3 Stimmen
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  Der SID-Chip im Commodore 64 hat genau drei Stimmen. Alles, was man
//  hört, müssen sich diese drei teilen:
//  - Stimme 1, der Lead: Pulse-Welle, deren Pulsbreite langsam wandert
//    (PWM, der typische SID-Klang). Jeder Ton springt aus der Oktave
//    darüber herein, im B-Teil rutscht er von unten hinein.
//  - Stimme 2, der Arp: Akkorde gibt es nur als sehr schnelles Arpeggio.
//  - Stimme 3 spielt Bass UND Schlagzeug: die Kick ist eine Bassnote, die
//    drei Oktaven höher startet und in 30 ms herunterfällt; die Snare ist
//    ein kurzes Rauschen in einer Lücke der Basslinie.
//  - Im Mittelteil öffnet und schließt der resonante Filter den Bass.
//  - Der C64 ist mono, deshalb kommt alles aus der Mitte. Kein Hall.
//
//  Kanäle = Orbits: 2 Bass + Drums · 3 Arp · 6 Lead
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 150
setcpm(bpm / 4)

// ---------- HARMONIE ----------
// A-Teil: Hm → A → G → A, am Ende Fis-Dur (mit Ais, dem Leitton nach H)
// B-Teil: Em → G → D → A, dann zweimal Fis-Dur
const chordsA = `<[b4,d5,f#5] [a4,c#5,e5] [g4,b4,d5] [a4,c#5,e5]
                  [b4,d5,f#5] [a4,c#5,e5] [g4,b4,d5] [f#4,a#4,c#5]>`
const chordsB = `<[g4,b4,e5] [g4,b4,d5] [a4,d5,f#5] [a4,c#5,e5]
                  [g4,b4,e5] [g4,b4,d5] [f#4,a#4,c#5] [f#4,a#4,c#5]>`
const chordsEnd = `<[b4,d5,f#5] [a4,c#5,e5] [g4,b4,d5] [a4,c#5,e5]
                    [b4,d5,f#5] [g4,b4,d5] [f#4,a#4,c#5] [b4,d5,f#5]>`

// ---------- STIMME 2: ARP ----------
// 60 Töne pro Takt (alle 27 ms), fast so schnell wie ein Frame am C64 (20 ms)
const arp = (chords, speed = 20) => note(chords).arp("0 1 2".fast(speed))
  .s("square").attack(.001).release(.01)
  .gain("[.38 .26 .3 .26]*4").orbit(3)

// ---------- STIMME 3: BASS + DRUMS ----------
// Jeder Takt: Grundton, Oktave, Grundton … Auf Zeile 4 und 12 bleibt die
// Basslinie stumm, dort spielt dieselbe Stimme die Snare.
const bassA = `<[b1 ~ b2 b1 ~ b1 b2 b1]*2 [a1 ~ a2 a1 ~ a1 a2 a1]*2
                [g1 ~ g2 g1 ~ g1 g2 g1]*2 [a1 ~ a2 a1 ~ a1 a2 a1 a1 ~ a2 a1 ~ a1 c#2 e2]
                [b1 ~ b2 b1 ~ b1 b2 b1]*2 [a1 ~ a2 a1 ~ a1 a2 a1]*2
                [g1 ~ g2 g1 ~ g1 g2 g1]*2 [f#1 ~ f#2 f#1 ~ f#1 f#2 f#1 f#1 ~ f#2 f#1 ~ ~ ~ ~]>`
const bassB = `<[e1 ~ e2 e1 ~ e1 e2 e1]*2 [g1 ~ g2 g1 ~ g1 g2 g1]*2
                [d2 ~ d3 d2 ~ d2 d3 d2]*2 [a1 ~ a2 a1 ~ a1 a2 a1]*2
                [e1 ~ e2 e1 ~ e1 e2 e1]*2 [g1 ~ g2 g1 ~ g1 g2 g1]*2
                [f#1 ~ f#2 f#1 ~ f#1 f#2 f#1]*2 [f#1 ~ f#2 f#1 ~ f#1 f#2 f#1 f#1 ~ f#2 f#1 ~ ~ ~ ~]>`
const bassEnd = `<[b1 ~ b2 b1 ~ b1 b2 b1]*2 [a1 ~ a2 a1 ~ a1 a2 a1]*2
                  [g1 ~ g2 g1 ~ g1 g2 g1]*2 [a1 ~ a2 a1 ~ a1 a2 a1]*2
                  [b1 ~ b2 b1 ~ b1 b2 b1]*2 [g1 ~ g2 g1 ~ g1 g2 g1]*2
                  [f#1 ~ f#2 f#1 ~ f#1 f#2 f#1]*2 [b1@12 ~@4]>`
// Snare-Spur: Schläge auf 2 und 4, am Phrasenende ein Wirbel in die Lücke
const snaresA = "<[~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~]!7 [~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x x x x]>"
const snaresHalf = "<[~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~]!7 [~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ x x x x]>"
const snaresEnd = "<[~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~]!7 ~>"

// Pulse-Bass durch den resonanten Tiefpass. kick: Zeile 0 und 8 fallen
// aus drei Oktaven darüber herunter, das ist die Bassdrum.
const bass = (line, kick = true) => note(line)
  .s("pulse").pw(.35)
  .penv(kick ? "[36 0!7]*2" : 0).pdecay(.03)
  .velocity("[1 .66 .66 .66 .66 .66 .66 .66]*2")
  .attack(.002).decay(.12).sustain(.6).release(.02)
  .lpf(1100).lpq(6).lpenv(1.5).lpdecay(.08).lpsustain(.3)
  .gain(1.1).orbit(2)

const snare = (hits) => s("white").struct(hits)
  .attack(.001).decay(.11).sustain(0).release(.01)
  .hpf(900).lpf(7000).coarse(3)
  .gain(1).orbit(2)

const voice3 = (line, hits = snaresA, kick = true) => stack(bass(line, kick), snare(hits))

// ---------- STIMME 1: LEAD ----------
// A-Teil: eine absteigende Sequenz, dreimal dieselbe Figur einen Ton tiefer
const themeA = `<[f#5@3 b5@3 d6@2 c#6 d6 c#6 b5 f#5@4] [e5@3 a5@3 c#6@2 b5 c#6 b5 a5 e5@4]
                 [d5@3 g5@3 b5@2 a5 b5 a5 g5 d5@4] [e5@2 a5@2 c#6@2 e6@2 c#6@4 a5@4]
                 [f#5@3 b5@3 d6@2 c#6 d6 e6 d6 f#6@4] [e6@6 c#6@2 a5@4 e6@2 c#6@2]
                 [d6@3 b5@3 g5@2 b5@2 d6@2 g6@4] [f#6@4 e6@2 c#6@2 a#5@4 c#6@2 e6@2]>`
// B-Teil: lange, singende Töne
const themeB = `<[e6@8 d6@2 b5@2 g5@4] [b5@6 d6@2 g6@4 f#6@2 d6@2]
                 [f#6@8 e6@2 d6@2 a5@4] [e6@8 c#6@4 a5@4]
                 [e6@4 g6@4 b6@4 a6@2 g6@2] [g6@6 f#6@2 d6@4 b5@4]
                 [c#6@4 a#5@4 f#5@4 c#6@2 e6@2] [f#6@12 ~@4]>`
// Filter-Teil: erst Pause, dann ein paar lange Töne
const themeBreak = "<~ ~ ~ ~ f#5 e5 d5 [c#5 a#4]>"
const themeEnd = `<[f#5@3 b5@3 d6@2 c#6 d6 c#6 b5 f#5@4] [e5@3 a5@3 c#6@2 b5 c#6 b5 a5 e5@4]
                   [d5@3 g5@3 b5@2 a5 b5 a5 g5 d5@4] [e5@2 a5@2 c#6@2 e6@2 c#6@4 a5@4]
                   d6 b5 [a#5 c#6] b5>`

const pwm = (line) => note(line)
  .s("pulse").pw(.5).pwrate(.6).pwsweep(.3)
  .vib(5.5).vibmod(.3)
  .attack(.003).decay(.2).sustain(.7).release(.05)
  .gain(1).orbit(6)
// Ton springt aus der Oktave darüber herein
const leadDrop = (line) => pwm(line).penv(12).pdecay(.035)
// Ton rutscht aus zwei Halbtönen darunter hinein
const leadSlide = (line) => pwm(line).penv(2).pattack(.06)

// ---------- ARRANGEMENT ----------
// 4 Takte nur Stimme 3 (Bass, Kick, Snare), dann kommt der Arp dazu
const intro = stack(
  voice3(bassA).mask("<0!2 1!6>"),
  bass(bassA).mask("<1!2 0!6>"),
  arp(chordsA).mask("<0!4 1!4>"),
)

const verse = stack(voice3(bassA), arp(chordsA), leadDrop(themeA))

const chorus = stack(voice3(bassB), arp(chordsB), leadSlide(themeB))

// Filter-Teil: keine Kick, Snare nur auf der 4, der Filter fährt auf und zu
const filterBreak = stack(
  voice3(bassA, snaresHalf, false).lpf(sine.range(250, 2800).slow(8)).lpq(14),
  arp(chordsA, 8),
  pwm(themeBreak).release(.3),
)

const outro = stack(voice3(bassEnd, snaresEnd), arp(chordsEnd), leadDrop(themeEnd))

arrange(
  [8,  intro],
  [16, verse],
  [16, chorus],
  [8,  filterBreak],
  [16, verse],
  [16, chorus],
  [8,  outro],
)
