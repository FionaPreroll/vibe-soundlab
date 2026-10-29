// @title Druckwelle
// @style Dancefloor roller
// @bpm 174
// @key G minor
// @bars 128
// @order 5
// @about A loud, overdriven foghorn bass rolls under a supersaw hook made for the dancefloor.
// ============================================================
//  DRUCKWELLE — Dancefloor Roller · 174 BPM · G-Moll
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  Laut, aber kontrolliert. Die Energie kommt aus drei Dingen:
//  - Das Horn: zwei leicht verstimmte Saws → Tiefpass → "o"-Formant (das
//    Nebelhorn) → starke, weiche Sättigung. Die Sättigung drückt jeden Ton auf
//    gleichmäßige Lautstärke: das Horn wird laut und bleibt glatt.
//  - Die Basslinie rollt im 3-3-2-Raster und rutscht von Ton zu Ton,
//    im zweiten Teil springt sie in Oktaven ("Yoi").
//  - Ein Supersaw-Hook aus Akkordtönen, den man mitsingen kann.
//
//  Orbits: 1 Drums · 2 Bass · 3 Pad · 4 Snare · 5 Stab · 6 Hook · 7 FX
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 174
const bar = 240 / bpm
setcpm(bpm / 4)

// ---------- HARMONIE ----------
// Gm11 → Eb6/9 → Cm11 → D7sus4, je 2 Takte. In keinem der Akkorde liegen
// zwei Töne einen Halbton auseinander. Deshalb darf jede Stimme jeden
// Akkordton spielen, ohne dass etwas reibt. G und C klingen in allen vier.
const chords = "<[g2,f3,bb3,d4,c5] [eb3,bb3,f4,g4,c5] [c3,bb3,f4,g4,eb5] [d3,c4,g4,a4,d5]>/2"
const air = "<[g5,d6] [g5,c6] [g5,c6] [a5,d6]>/2"

// ---------- BASSLINIEN ----------
// 16tel-Raster, 8 Takte = ein Durchlauf der Akkorde. Auf jeder Eins der Grundton.
// glide = Halbtöne, aus denen die Note hineinrutscht (+ von unten, − von oben)
// A: lange Hornstöße im 3-3-2-Raster
const lineA  = `<[g1@6 g1@4 g1@2 bb1@4] [g1@3 g1@3 ~@2 d2@4 f1@4]
                 [eb1@6 eb1@4 eb1@2 g1@4] [eb1@3 eb1@3 ~@2 bb1@4 c2@4]
                 [c2@6 c2@4 c2@2 eb2@4] [c2@3 c2@3 ~@2 g1@4 bb1@4]
                 [d2@6 d2@4 d2@2 c2@4] [d2@3 d2@3 ~@2 c2@4 a1@4]>`
const glideA = `<[2@6 0@4 0@2 3@4] [-3@3 0@3 ~@2 7@4 -9@4]
                 [-2@6 0@4 0@2 4@4] [-4@3 0@3 ~@2 7@4 2@4]
                 [2@6 0@4 0@2 3@4] [-3@3 0@3 ~@2 -5@4 3@4]
                 [4@6 0@4 0@2 -2@4] [2@3 0@3 ~@2 -2@4 -3@4]>`
// B: rollt schneller, jeder Takt springt einmal in die Oktave und zurück
const lineB  = `<[g1@3 g1@3 g2@2 g1@3 g1@3 bb1@2] [g1@3 g1@3 d2@2 g1@3 f1@3 ~@2]
                 [eb1@3 eb1@3 eb2@2 eb1@3 eb1@3 g1@2] [eb1@3 eb1@3 bb1@2 eb1@3 bb1@3 ~@2]
                 [c2@3 c2@3 c3@2 c2@3 c2@3 eb2@2] [c2@3 c2@3 g1@2 c2@3 bb1@3 ~@2]
                 [d2@3 d2@3 d3@2 d2@3 d2@3 c2@2] [d2@3 d2@3 a1@2 d2@3 c2@3 a1@2]>`
const glideB = `<[2@3 0@3 12@2 -12@3 0@3 3@2] [-3@3 0@3 7@2 -7@3 -2@3 ~@2]
                 [-2@3 0@3 12@2 -12@3 0@3 4@2] [-4@3 0@3 7@2 -7@3 7@3 ~@2]
                 [2@3 0@3 12@2 -12@3 0@3 3@2] [-3@3 0@3 -5@2 5@3 -2@3 ~@2]
                 [4@3 0@3 12@2 -12@3 0@3 -2@2] [2@3 0@3 -5@2 5@3 -2@3 -3@2]>`

// ---------- BASS ----------
// Das Horn. Unter 140 Hz ist es weggefiltert, dort spielt nur der Sub.
// drive = "Stärke:Ausgangspegel" der Verzerrung
// Die erste Fassung hatte einen Filter-Biss auf jedem Ton und eine leichtere
// Diode-Verzerrung. Gemessen pulsierte sie mehr als doppelt so stark wie das
// Nebelhorn-Horn und klang krächzend. Stärkere Sättigung glättet das: sie
// presst jede Schwingung auf dieselbe Höhe.
const horn = (line, glide, drive = "4:.3") => note(line)
  .penv(glide).pattack(.07)
  .s("supersaw").unison(2).detune(.12).spread(.25)
  .attack(.03).sustain(1).release(.08)
  .lpf(sine.range(500, 1500).slow(8)).lpq(5)
  .hpf(140)
  .vowel("o")
  .distort(drive)
  .postgain(.34).orbit(2)

// zweite Stimme eine Oktave höher, leise: hörbar auch auf dem Handy
const hornTop = (line, glide) => horn(line, glide, "4.5:.28")
  .add(note(12)).hpf(300).postgain(.12)

// Sub: reiner Sinus, rutscht mit dem Horn mit und trägt den Druck
const sub = (line, glide) => note(line)
  .penv(glide).pattack(.07)
  .s("sine").attack(.01).decay(.2).sustain(.9).release(.06)
  .gain(.56).orbit(2)

const bass = (line, glide, drive) => stack(horn(line, glide, drive), sub(line, glide))

// ---------- PAD ----------
const padBody = note(chords)
  .s("supersaw").unison(6).detune(.3).spread(.7)
  .attack(.6).decay(.8).sustain(.7).release(2.5)
  .lpf(sine.range(900, 2800).slow(16)).lpq(3).hpf(200)
  .room(.45).roomsize(6).roomlp(6000).orbit(3)

const padAir = note(air)
  .s("supersaw").unison(4).detune(.1).spread(1)
  .attack(1.5).sustain(1).release(4)
  .lpf(7500).hpf(1500)
  .room(.85).roomsize(6).roomlp(6000).orbit(3)

// level skaliert beide Schichten. Unter dem Bass im Drop hört man das Pad kaum,
// dort reichen drei Stimmen statt sechs (spart viel Rechenzeit im Browser).
const pad = (level = 1, voices = 6) => stack(
  padBody.unison(voices).gain(.13 * level),
  padAir.unison(Math.min(voices, 4)).gain(.06 * level))

// ---------- HOOK & STAB ----------
// Der Hook: 3-3-2-Rhythmus wie der Bass, nur Akkordtöne. Die Oberstimme
// steigt mit jedem Akkord und landet am Ende auf dem hohen D.
const hookLine = `<[d5@3 c5@3 bb4@2 c5@3 d5@3 f5@2] [g5@6 f5@4 d5@6]
                   [eb5@3 c5@3 bb4@2 c5@3 eb5@3 g5@2] [f5@6 eb5@4 c5@6]
                   [g5@3 f5@3 eb5@2 f5@3 g5@3 bb5@2] [c6@6 bb5@4 g5@6]
                   [a5@3 g5@3 d5@2 g5@3 a5@3 c6@2] [d6@10 ~@6]>`

// Supersaw vorne, darunter ein Square eine Oktave tiefer für den Körper.
// Beide auf Orbit 6, deshalb mit denselben Hall- und Delay-Einstellungen.
const hookFx = (p) => p
  .delay(.3).delaytime(bar * 3/16).delayfeedback(.35)
  .room(.35).roomsize(5).orbit(6)
const hookSaw = hookFx(note(hookLine)
  .s("supersaw").unison(4).detune(.25).spread(.6)
  .attack(.008).decay(.3).sustain(.55).release(.25)
  .lpf(2600).lpenv(2).lpdecay(.2).lpsustain(.4).lpq(2))
const hookBody = hookFx(note(hookLine).add(note(-12))
  .s("square").attack(.008).decay(.25).sustain(.4).release(.2)
  .lpf(1400))
const hook = (level = 1) => stack(hookSaw.gain(.22 * level), hookBody.gain(.07 * level))

// Stabs zwischen den Schlägen: Dreiklänge aus den Pad-Tönen
const stabChords = "<[bb4,d5,f5] [bb4,eb5,g5] [c5,eb5,g5] [a4,d5,g5]>/2"
const stab = note(stabChords).struct("~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~")
  .s("sawtooth").lpf(1600).lpenv(2.5).lpdecay(.12).lpsustain(0).lpq(4)
  .attack(.002).decay(.18).sustain(0).release(.08)
  .distort("1.5:.5")
  .gain(.32)
  .delay(.25).delaytime(bar * 3/16).delayfeedback(.3)
  .room(.3).roomsize(4).orbit(5)

// ---------- DRUMS ----------
// Rolling: Kick auf der 1 und auf 16tel 10, jeder 4. Takt mit Extra-Kick.
// Die Kick drückt das Pad (Orbit 3) weg, das pumpt.
const kick = s("<[bd@10 bd@6]!3 [bd@7 bd@3 bd@6]>").bank("RolandTR909").n(3)
  .lpf(3200).shape(.4).postgain(.31)
  .duckorbit(3).duckdepth(.4).duckattack(.18)

// 909-Snare plus Clap, kräftig angezerrt, kleiner Raum
const snare = stack(
  s("sd").beat("4,12", 16).bank("RolandTR909").n(13),
  s("cp").beat("4,12", 16).bank("RolandTR909").n(1).gain(.5).hpf(800),
).shape(.55).postgain(.28).room(.18).roomsize(2).orbit(4)

const ghosts = s("sd").beat("7,14", 16).bank("RolandTR909").n(13)
  .gain("[.1 .14]").hpf(1000)

const hats = s("hh*16").bank("RolandTR909")
  .gain("[.14 .26 .34 .26]*4").hpf(7000).late("[0 .01]*8")

const oh = s("[~ oh]*4").bank("RolandTR909").n(1).gain(.13).hpf(5000).cut(3)

const ride = s("rd*8").bank("RolandTR909").n(2).gain("[.08 .16]*4").hpf(3000)

// Break als Tops-Layer, auf genau einen Takt gestreckt
const brk = s("breaks165").fit().hpf(700).gain(.28)

const crash = s("<cr ~!7>").bank("RolandTR909").n(3).hpf(300).gain(.26)

// ---------- FX ----------
const roll = s("<sd*4 sd*4 sd*8 sd*8 sd*16 sd*16 sd*32 [[sd*16]@3 ~]>")
  .bank("RolandTR909").n(13)
  .gain(saw.range(.1, .5).slow(8)).hpf(saw.range(150, 1500).slow(8))

const riser = s("white").slow(8)
  .hpf(200).hpenv(5.5).hpattack(bar * 8)
  .attack(bar * 7.3).release(.05).gain(.22)

// Ton-Riser: ein Saw, der über 8 Takte zwei Oktaven hoch zum G fährt
const sweep = note("g4").slow(8).s("sawtooth")
  .penv(24).pattack(bar * 8)
  .attack(bar * 6).sustain(1).release(.05)
  .lpf(2500).hpf(300).gain(.07)
  .room(.4).roomsize(6).orbit(7)

// rückwärts abgespieltes Crash, genau einen Takt lang, endet auf der Eins
const revcrash = s("<~!7 cr>").bank("RolandTR909").n(3)
  .speed(-bpm / 240).unit("c").hpf(400).gain(.3)

// Impact: Rauschen, das beim Drop von hell nach dunkel fällt
const impact = s("<white ~!31>")
  .lpf(150).lpenv(-6).lpattack(.9)
  .decay(1.8).sustain(0).gain(.8).room(.4).roomsize(6).orbit(7)

// lädt die Drum-Samples im ersten Takt (unhörbar), damit beim Drop nichts fehlt
const preload = stack(
  s("bd:3 sd:13 cp:1 hh oh:1 rd:2 cr:3").bank("RolandTR909"), s("breaks165"),
).gain(0)

// ---------- ARRANGEMENT ----------
// DJ-Intro: der Beat läuft früh, das Horn kommt gefiltert dazu
const intro = stack(
  preload.mask("<1 0!15>"),
  pad().lpf(saw.range(500, 2000).slow(16)),
  hats.mask("<0!4 1!12>"), oh.mask("<0!8 1!8>"),
  kick.mask("<0!4 1!12>"), snare.mask("<0!8 1!8>"),
  horn(lineA, glideA).lpf(saw.range(200, 700).slow(8)).postgain(.24).mask("<0!8 1!8>"),
  sub(lineA, glideA).gain(.45).mask("<0!8 1!8>"),
  hook(.5).lpf(1200).mask("<0!12 1!4>"),
)

// letzter Schlag vor dem Drop bleibt leer
const build = stack(
  pad().lpf(saw.range(800, 3000).slow(8)), hook(.6),
  roll, riser, sweep, revcrash, hats.mask("<1!6 0!2>"),
  horn(lineA, glideA).lpf(saw.range(300, 1600).slow(8)).postgain(saw.range(.16, .36).slow(8)),
).mask("<1!7 [1@3 0]>")

const drop1 = stack(
  kick, snare, ghosts, hats, oh, brk.mask("<0!8 1!24>"), crash, impact,
  arrange([16, bass(lineA, glideA)], [16, bass(lineB, glideB)]),
  stab.mask("<0!8 1!8 0!8 1!8>"),
  pad(.55, 3),
)

// Breakdown: der Hook frei im Raum, dann kommen Hats und Sub zurück
const breakdown = stack(
  pad(1.1), hook(), crash.mask("<1 0!15>"),
  hats.gain(.5).mask("<0!8 1!8>"),
  sub(lineA, glideA).gain(.4).mask("<0!8 1!8>"),
)

const build2 = stack(
  pad().lpf(saw.range(800, 3000).slow(8)), hook(.7),
  roll, riser, sweep, revcrash, brk.mask("<0!4 1!2 0!2>"),
  horn(lineB, glideB, "4.5:.28").lpf(saw.range(300, 1800).slow(8)).postgain(saw.range(.16, .34).slow(8)),
).mask("<1!7 [1@3 0]>")

// zweiter Drop: mehr Zerre, Hook durchgehend, Ride und Break, Oberstimme am Horn
const drop2 = stack(
  kick, snare, ghosts, hats, ride, brk, crash, impact,
  arrange(
    [16, bass(lineB, glideB, "4.5:.28")],
    [16, stack(bass(lineA, glideA, "4.5:.28"), hornTop(lineA, glideA))],
  ),
  hook(.7), stab, pad(.5, 3),
)

const outro = stack(
  kick.mask("<1!12 0!4>"), snare.mask("<1!12 0!4>"), ghosts.mask("<1!8 0!8>"),
  hats, oh.mask("<1!8 0!8>"), crash,
  bass(lineA, glideA).mask("<1!8 0!8>"),
  pad(),
)

// Jammen: die Zeilen unten durch z. B. nur `drop2` ersetzen,
// um einen Teil in Schleife laufen zu lassen
arrange(
  [16, intro],
  [8,  build],
  [32, drop1],
  [16, breakdown],
  [8,  build2],
  [32, drop2],
  [16, outro],
)
