// ============================================================
//  NACHTSCHICHT — Dark Techstep Drum & Bass · 174 BPM · F-Moll
//  Treibende Reese im Stil von Dom & Roland, gebaut für Strudel
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 174
const bar = 240 / bpm   // Sekunden pro Takt
setcpm(bpm / 4)         // ein Zyklus = ein Takt

// ---------- HARMONIE & BASSLINIEN ----------
// Fm9 → Dbmaj9 → Bbm9 → Gbmaj7, je 2 Takte
const chords = "<[f3,ab3,c4,eb4,g4] [db3,f3,ab3,c4,eb4] [bb2,db3,f3,ab3,c4] [gb2,bb2,db3,f3,ab3]>/2"

// 16tel-Raster: Kick auf 1 und 3+, Snare auf 2 und 4
// A = lange, drohende Noten · B = rollende 3-3-4-2-4-Synkope
// glide = Halbtöne, aus denen die Note hineinrutscht (Portamento)
const lineA  = "<[f1@10 f1@3 gb1@3] [f1@6 ~ f1@3 eb1@6] [f1@10 ab1@3 gb1@3] [f1@3 f1@3 db1@4 eb1@3 c1@3]>"
const glideA = "<[0@10 0@3 1@3] [0@6 ~ 0@3 -2@6] [0@10 3@3 -2@3] [0@3 0@3 -4@4 2@3 -3@3]>"
const lineB  = "<[f1@3 f1@3 f1@4 ab1@2 gb1@4] [f1@3 f1@3 f1@4 eb1@2 f1@4] [f1@3 f1@3 f1@4 ab1@2 bb1@4] [gb1@3 gb1@3 f1@4 eb1@3 db1@3]>"
const glideB = "<[0@3 0@3 0@4 3@2 -2@4] [0@3 0@3 0@4 -2@2 2@4] [0@3 0@3 0@4 3@2 2@4] [1@3 0@3 -1@4 -2@3 -2@3]>"

// ---------- BASS ----------
// Reese: 3 verstimmte Saws → Ladder-Filter mit Hüllkurve → Verzerrung → Phaser
const reese = (line, glide, drive = "2.5:.6") => note(line)
  .penv(glide).pattack(.06)
  .s("supersaw").unison(3).detune(.42).spread(.35)
  .attack(.02).decay(.25).sustain(.85).release(.06)
  .lpf(sine.range(900, 1700).slow(8)).lpenv(2.5)
  .lpattack(.04).lpdecay(.35).lpsustain(.45).lpq(8)
  .ftype("ladder")
  .distort(drive)
  .hpf(130)
  .phaser(.4).phaserdepth(.35)
  .postgain(.47).orbit(2)

// Growl: dieselbe Reese durch einen "a"-Formant → knurrt in den Mitten
const growl = (line, glide, drive) => reese(line, glide, drive).vowel("a").postgain(.4)

// Sub: reiner Sinus auf dem Grundton, trägt den Druck
// (die Reese ist unter 130 Hz gefiltert, damit sich beide nicht beißen)
const sub = (line, glide) => note(line)
  .penv(glide).pattack(.06)
  .s("sine").attack(.03).sustain(1).release(.05)
  .gain(.58).orbit(2)

const bass = (line, glide, drive) => stack(
  reese(line, glide, drive), growl(line, glide, drive), sub(line, glide))

// ---------- FLÄCHEN & STABS ----------
const pad = note(chords)
  .s("supersaw").unison(5).detune(.18).spread(.9)
  .attack(.6).decay(.4).sustain(.8).release(2)
  .lpf(1100).gain(.16)
  .room(.55).roomsize(5).orbit(3)

const arp = note(chords).arp("0 2 4 2 1 3 4 3").add(note(12))
  .s("triangle").fmh(2).fmi(.6)
  .decay(.18).sustain(0).release(.1)
  .gain(.3).delay(.35).delaytime(bar * 3/16).delayfeedback(.45)
  .room(.4).roomsize(5).orbit(3)

// verminderter Stab am Ende jeder 4-Takt-Phrase, mit punktierten Echos
const stab = note("<~ ~ ~ [~@14 [f3,ab3,b3]@2]>")
  .s("sawtooth").lpf(1800).lpenv(2).lpdecay(.15).lpsustain(0)
  .decay(.2).sustain(0).release(.1)
  .gain(.55).delay(.4).delaytime(bar * 3/16).delayfeedback(.5)
  .room(.3).roomsize(5).orbit(3)

// ---------- DRUMS ----------
const kick = s("<[bd@10 bd@6]!3 [bd@10 bd@3 bd@3]>")
  .bank("RolandJD990").n(5).shape(.4).postgain(.31)

// 909 + SP-12 übereinander, angezerrt, kleiner Raum
const snare = stack(
  s("sd").beat("4,12", 16).bank("RolandTR909").n(13),
  s("sd").beat("4,12", 16).bank("EmuSP12").n(2).gain(.6).hpf(250),
).shape(.7).postgain(.27).room(.12).roomsize(1.5).orbit(4)

const ghosts = n("~ ~ ~ ~ ~ ~ ~ 15 ~ ~ ~ ~ ~ ~ 17 ~").s("amencutup")
  .hpf(300).gain(.7)

const hats = s("hh*16").bank("RolandTR909")
  .gain("[.3 .16 .5 .16]*4").hpf(5000).postgain(.65)

// Break als "Tops"-Layer, auf genau einen Takt gestreckt
const brk = s("breaks165").fit().hpf(300).gain(.5)

const ride = s("rd*8").bank("RolandTR909").gain("[.1 .2]*4").hpf(2000)

// Amen-Slices neu zusammengesetzt (rollt im zweiten Drop mit)
const amen = n("0 3 5 6 2 14 15 17 16 4 11 19 13 21 22 27").s("amencutup")
  .cut(7).hpf(250).gain(.4)

// Amen-Fill auf jedem 8. Takt
const fill = n("<~!7 [~ ~ [13 9 13 13] [20 31 [2 2] 25]]>").s("amencutup")
  .cut(8).gain(.5)

const crash = s("<cr ~!7>").bank("RolandTR909").hpf(300).gain(.3)

// ---------- FX ----------
// Snare-Roll: Viertel → Achtel → 16tel → 32tel, wird lauter, heller, höher
const roll = s("<sd*4 sd*4 sd*8 sd*8 sd*16 sd*16 sd*32 [[sd*24]@3 ~]>")
  .bank("RolandTR909").n(12)
  .gain(saw.range(.12, .55).slow(8))
  .hpf(saw.range(100, 1500).slow(8))
  .speed(saw.range(1, 1.5).slow(8))

const riser = s("white").slow(8)
  .hpf(200).hpenv(5.5).hpattack(bar * 8)
  .attack(bar * 7.3).release(.05).gain(.24)

// rückwärts abgespieltes Crash: speed in Zyklen (unit c) = exakt 1 Takt lang,
// es kommt genau auf der Eins des Drops an
const revcrash = s("<~!7 cr>").bank("RolandTR909")
  .speed(-bpm / 240).unit("c").hpf(400).gain(.32)

// Impact: Rauschen, das beim Drop von hell nach dunkel fällt
const impact = s("<white ~!31>")
  .lpf(150).lpenv(-6).lpattack(.9)
  .decay(1.8).sustain(0).gain(.9).room(.4).roomsize(5).orbit(3)

const atmos = s("pink").slow(4)
  .lpf(700).attack(2).release(2).gain(.1)

// lädt alle Drum-Samples schon im ersten Intro-Takt (unhörbar, gain 0),
// damit beim ersten Drop nichts verschluckt wird
const preload = stack(
  s("bd:5").bank("RolandJD990"), s("sd:12 sd:13").bank("RolandTR909"),
  s("sd:2").bank("EmuSP12"), s("cr rd hh").bank("RolandTR909"),
  n(run(32)).s("amencutup"), s("breaks165"),
).gain(0)

// ---------- ARRANGEMENT ----------
const intro = stack(
  preload.mask("<1 0!15>"),
  pad.lpf(saw.range(400, 1200).slow(16)),
  atmos, stab.mask("<0!8 1!8>"),
  reese(lineA, glideA).lpf(220).lpenv(1).postgain(.35).mask("<0!8 1!8>"),
  brk.hpf(saw.range(3000, 400).slow(16)).mask("<0!4 1!12>"),
  hats.mask("<0!8 1!8>"),
  kick.mask("<0!12 1!4>"),
)

// letzter Schlag vor dem Drop bleibt leer – nur das Rückwärts-Crash zieht hoch
const build = stack(
  pad.lpf(saw.range(700, 2600).slow(8)), roll, riser, revcrash,
  reese(lineA, glideA).lpf(saw.range(250, 2000).slow(8)).postgain(saw.range(.25, .5).slow(8)),
  hats.mask("<1!6 0!2>"),
).mask("<1!7 [1@3 0]>")

const drop1 = stack(
  kick, snare, ghosts, hats, brk, crash, fill, impact,
  arrange([16, bass(lineA, glideA)], [16, bass(lineB, glideB)]),
  stab.mask("<0!8 1!8 0!8 1!8>"),
  pad.gain(.065),
)

const breakdown = stack(
  pad, arp, atmos, impact.gain(.5), crash,
  reese(lineA, glideA).lpf(300).lpenv(1).postgain(.3),
  hats.mask("<0!4 1!4>"),
)

const build2 = stack(
  pad.lpf(saw.range(700, 2600).slow(8)), arp.mask("<1!4 0!4>"),
  roll, riser, revcrash,
  reese(lineB, glideB).lpf(saw.range(250, 2000).slow(8)).postgain(saw.range(.25, .5).slow(8)),
).mask("<1!7 [1@3 0]>")

// zweiter Drop: mehr Zerre, Amen + Ride, Oktav-Layer, Bass-Stotterer am Phrasenende
const drop2 = stack(
  kick, snare, hats, ride, amen, crash, fill, impact,
  arrange(
    [16, bass(lineB, glideB, "2.8:.5")],
    [16, stack(bass(lineA, glideA, "2.8:.5"),
               reese(lineA, glideA).add(note(12)).hpf(220).postgain(.18))],
  ).lastOf(8, x => x.ply(2)),
  stab,
  arp.gain(.12).mask("<0!16 1!16>"),
)

const outro = stack(
  kick.mask("<1!12 0!4>"), snare.mask("<1!12 0!4>"),
  hats, brk, crash,
  reese(lineA, glideA).lpf(saw.range(600, 200).slow(8)).mask("<1!8 0!8>"),
  sub(lineA, glideA).mask("<1!8 0!8>"),
  pad,
)

// Jammen: die Zeilen unten durch z. B. nur `drop1` oder `drop2` ersetzen,
// um einen Teil in Schleife laufen zu lassen
arrange(
  [16, intro],
  [8,  build],
  [32, drop1],
  [8,  breakdown],
  [8,  build2],
  [32, drop2],
  [16, outro],
)
