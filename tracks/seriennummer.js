// @title Seriennummer
// @style Keygen chiptune
// @bpm 140
// @key A minor
// @bars 88
// @order 11
// @channels 6
// @mixer Kick + snare, Bass, Arpeggio, Hats, Echo, Lead
// @about A keygen anthem in FastTracker style: six channels, shimmering arpeggios, a heroic lead and its echo.
// ============================================================
//  SERIENNUMMER — Keygen-Chiptune · 140 BPM · A-Moll · 6 Kanäle
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  So klang die Musik in Keygens und Cracktros: ein Tracker wie
//  FastTracker 2 mit wenigen Kanälen, und jeder Kanal spielt genau einen
//  Ton zur Zeit. Ein neuer Ton schneidet den alten ab.
//  - Akkorde gibt es nicht. Der Arp-Kanal springt so schnell zwischen
//    Grundton, Terz und Quinte (alle 36 ms), dass das Ohr einen Akkord hört.
//  - Der Lead: Pulse-Welle mit 25 % Pulsbreite (nasal), Vibrato und ein
//    kleiner Slide von unten in jeden Ton.
//  - Echo kostet einen Kanal: Kanal 5 spielt den Lead drei Zeilen später,
//    leiser und auf der anderen Seite. Einen Delay-Effekt gibt es nicht.
//  - Eine Zeile (Row) ist eine 16tel, ein Takt hat 16 Zeilen.
//
//  Kanäle = Orbits: 1 Kick/Snare · 2 Bass · 3 Arp · 4 Hats · 5 Echo · 6 Lead
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 140
setcpm(bpm / 4)

// ---------- HARMONIE ----------
// Am → F → C → G, die "epische" Moll-Folge. Am Ende E-Dur mit Gis: der
// Leitton zieht zurück nach Am. Jeder Akkord als Dreiklang für den Arp.
const chordsA = `<[a4,c5,e5] [a4,c5,f5] [g4,c5,e5] [g4,b4,d5]
                  [a4,c5,e5] [a4,c5,f5] [g4,b4,d5] [g#4,b4,e5]>`
const chordsB = `<[a4,c5,f5] [g4,b4,d5] [g4,b4,e5] [a4,c5,e5]
                  [a4,c5,f5] [g4,b4,d5] [g#4,b4,e5] [g#4,b4,e5]>`
const chordsEnd = `<[a4,c5,e5] [a4,c5,f5] [g4,c5,e5] [g4,b4,d5]
                    [a4,c5,e5] [a4,c5,f5] [g#4,b4,e5] [a4,c5,e5]>`

// ---------- KANAL 3: ARP ----------
// 48 Töne pro Takt. Die Lautstärke-Spalte betont jeden Schlag ein wenig.
const arp = (chords, speed = 16) => note(chords).arp("0 1 2".fast(speed))
  .s("square").attack(.001).release(.01)
  .gain("[.42 .28 .34 .28]*4")
  .pan(.62).orbit(3)

// ---------- KANAL 2: BASS ----------
// Oktav-Bass in Achteln: Grundton unten, Grundton oben.
const bassA = `<[a1 a2]*4 [f1 f2]*4 [c2 c3]*4 [g1 g2]*4
                [a1 a2]*4 [f1 f2]*4 [g1 g2]*4 [e1 e2]*4>`
// B-Teil: synkopiert, mit Durchgangstönen am Phrasenende
const bassB = `<[f1 ~ f2 f1 ~ f1 f2 ~ f1 ~ f2 f1 ~ f1 f2 f1] [g1 ~ g2 g1 ~ g1 g2 ~ g1 ~ g2 g1 ~ g1 g2 g1]
                [e1 ~ e2 e1 ~ e1 e2 ~ e1 ~ e2 e1 ~ e1 e2 e1] [a1 ~ a2 a1 ~ a1 a2 ~ a1 ~ a2 a1 ~ a1 a2 a1]
                [f1 ~ f2 f1 ~ f1 f2 ~ f1 ~ f2 f1 ~ f1 f2 f1] [g1 ~ g2 g1 ~ g1 g2 ~ g1 ~ g2 g1 ~ g1 g2 g1]
                [e1 ~ e2 e1 ~ e1 e2 ~ e1 ~ e2 e1 ~ e1 e2 e1] [e1 e2 e1 e2 e1 e2 g#1 g#2 b1 b2 d2 d3 e2 e3 g#2 b2]>`
const bassBreak = "<a1 f1 c2 g1 a1 f1 g1 e1>"
const bassEnd = `<[a1 a2]*4 [f1 f2]*4 [c2 c3]*4 [g1 g2]*4
                  [a1 a2]*4 [f1 f2]*4 [e1 e2]*4 a1>`

const bass = (line) => note(line).s("sawtooth")
  .attack(.002).decay(.14).sustain(.45).release(.03)
  .lpf(700).lpenv(2.5).lpdecay(.1).lpsustain(.2).lpq(4)
  .gain(.62).orbit(2)

// ---------- KANAL 6: LEAD ----------
// Das Thema: 3+3+2 Zeilen, der Rhythmus, der in Keygens und Trance überall steckt.
const themeA = `<[a5@3 e5@3 a5@2 c6@3 b5@3 a5@2] [c6@3 a5@3 f5@2 a5@4 c6@4]
                 [g5@3 e5@3 g5@2 c6@3 d6@3 e6@2] [d6@6 b5@2 g5@4 a5@2 b5@2]
                 [a5@3 e5@3 a5@2 c6@3 b5@3 a5@2] [c6@3 a5@3 f5@2 c6@2 d6@2 e6@2 f6@2]
                 [g6@6 d6@2 b5@4 d6@2 b5@2] [g#5@4 b5@2 e6@2 g#6@2 e6@2 b5 ~@3]
                 [a5@3 e5@3 a5@2 c6@3 b5 c6 b5 a5@2] [c6@3 a5@3 f5@2 a5@4 c6@2 f6@2]
                 [e6@3 c6@3 g5@2 e6@3 f6 e6@2 d6@2] [d6@6 b5@2 g5@2 a5@2 b5@2 d6@2]
                 [e6@3 c6@3 a5@2 e6@3 d6 e6 d6 c6@2] [f6@6 e6@2 c6@4 a5@2 c6@2]
                 [d6@3 e6@3 d6@2 b5@3 g5@3 d6@2] [e6@8 g#5@2 b5@2 e6@4]>`
// B-Teil: höher, mit 16tel-Trillern und einem Dur-Arpeggio nach oben
const themeB = `<[c6@2 d6@2 c6@2 a5@2 f5@4 a5@2 c6@2] [d6@2 e6@2 d6@2 b5@2 g5@4 b5@2 d6@2]
                 [e6@4 d6@2 b5@2 g5@4 b5@2 e6@2] [c6@6 b5@2 a5@8]
                 [c6 d6 c6 d6 c6@2 a5@2 f6@4 e6@2 c6@2] [d6 e6 d6 e6 d6@2 b5@2 g6@4 d6@2 b5@2]
                 [g#5@2 b5@2 e6@2 g#6@2 b6@4 g#6@2 e6@2] [e6@8 ~@8]>`
// Breakdown: das Thema in langen Tönen, jeder Ton rutscht eine Oktave hoch hinein
const themeBreak = `<[a5@8 c6@4 e6@4] [f6@8 c6@8] [e6@8 g5@8] [d6@12 b5@4]
                     [c6@8 e6@4 a6@4] [a6@8 f6@8] [g6@8 d6@4 b5@4] [b5@4 g#5@4 e5@8]>`
const themeEnd = `<[a5@3 e5@3 a5@2 c6@3 b5@3 a5@2] [c6@3 a5@3 f5@2 a5@4 c6@4]
                   [g5@3 e5@3 g5@2 c6@3 d6@3 e6@2] [d6@6 b5@2 g5@8]
                   [a5@3 e5@3 a5@2 c6@3 b5@3 a5@2] [c6@8 a5@5 ~@3] [b5@8 g#5@8] a5>`

const lead = (line) => note(line)
  .s("pulse").pw(.25).pwrate(.3).pwsweep(.08)
  .penv(2).pattack(.03)
  .vib(6).vibmod(.25)
  .attack(.004).decay(.12).sustain(.75).release(.04)
  .gain(.7).pan(.38).orbit(6)

// Breakdown-Lead: Slide aus einer Oktave darunter, langsameres, tieferes Vibrato
const leadSlow = (line) => lead(line).penv(12).pattack(.09).vib(5).vibmod(.35).release(.2)

// ---------- KANAL 5: ECHO ----------
// derselbe Lead, drei Zeilen später, leiser, dunkler und rechts
const echo = (part) => part.late(3/16).gain(.26).lpf(3200).pan(.78).orbit(5)
// im letzten Teil spielt Kanal 5 statt des Echos den Lead eine Oktave tiefer
const octave = (part) => part.add(note(-12)).gain(.37).pan(.66).orbit(5)

// ---------- KANAL 1: KICK & SNARE ----------
// Ein Kanal für beide: sie wechseln sich ab, nie spielen beide zugleich.
// cut(1): der nächste Schlag auf dem Kanal schneidet den letzten ab.
const kick = s(`<[bd ~ ~ ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~ ~ ~]!3
                 [bd ~ ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~ ~ ~ ~]>`).n(0).gain(.42)
const snare = s(`<[~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~]!3
                  [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`).n(6).gain(.26)
const beat = stack(kick, snare).bank("RolandTR909").cut(1).orbit(1)

// Snare-Wirbel vor dem Einsatz: 16tel, dann 32tel, immer lauter
const roll = s("<[sd*16] [sd*32]>").bank("RolandTR909").n(6)
  .velocity(saw.range(.3, 1).slow(2)).gain(.28).cut(1).orbit(1)

// ---------- KANAL 4: HATS ----------
// Open Hat auf jedem Offbeat, der nächste Closed Hat schneidet ihn ab. Crash am Phrasenanfang.
const hats = s(`<[cr ~ ~ ~ hh hh oh hh hh hh oh hh hh hh oh hh] [[hh hh oh hh]*4]!7>`)
  .bank("RolandTR909").gain("[.25 .12 .17 .12]*4").hpf(4000).pan(.6).cut(4).orbit(4)

// ---------- ARRANGEMENT ----------
// lädt die Samples vor dem ersten Einsatz (unhörbar)
const preload = s("bd:0 sd:6 hh oh cr").bank("RolandTR909").gain(0).orbit(1)

// 4 Takte nur Arp, der lauter wird; dann Bass und Hats, am Ende der Snare-Wirbel
const intro = stack(
  preload.mask("<1 0!7>"),
  arp(chordsA).velocity(saw.range(.3, 1).slow(4)).mask("<1!4 0!4>"),
  arp(chordsA).mask("<0!4 1!4>"),
  bass(bassA).mask("<0!4 1!4>"),
  hats.mask("<0!4 1!4>"),
  roll.mask("<0!6 1!2>"),
)

const verse = stack(
  beat, hats, bass(bassA), arp(chordsA),
  lead(themeA), echo(lead(themeA)),
)

const chorus = stack(
  beat, hats, bass(bassB), arp(chordsB),
  lead(themeB), echo(lead(themeB)),
)

// Breakdown: keine Drums, langsamerer Arp, Bass hält, am Ende der Wirbel
const breakdown = stack(
  arp(chordsA, 8), bass(bassBreak).decay(1.2).sustain(.3).release(.3),
  leadSlow(themeBreak), echo(leadSlow(themeBreak)),
  roll.mask("<0!6 1!2>"),
)

// zweites A: erst mit Echo, dann mit der tiefen Oktave
const verse2 = stack(
  beat, hats, bass(bassA), arp(chordsA),
  lead(themeA),
  echo(lead(themeA)).mask("<1!8 0!8>"),
  octave(lead(themeA)).mask("<0!8 1!8>"),
)

const outro = stack(
  beat.mask("<1!4 0!4>"), hats.mask("<1!6 0!2>"),
  bass(bassEnd), arp(chordsEnd).velocity(saw.range(1, .45).slow(8)),
  lead(themeEnd), echo(lead(themeEnd)),
)

arrange(
  [8,  intro],
  [16, verse],
  [16, chorus],
  [8,  breakdown],
  [16, verse2],
  [16, chorus],
  [8,  outro],
)
