// @title Nachtschicht
// @style Dark techstep
// @bpm 174
// @key F minor
// @bars 120
// @order 1
// @about Driving reese in the style of Dom & Roland, over a breathing pad on an F pedal.
// ============================================================
//  NACHTSCHICHT v2 — Dark Techstep Drum & Bass · 174 BPM · F-Moll
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  Was sich gegenüber v1 geändert hat:
//  - Der Bass liegt fast immer auf F. Gbmaj7 hatte genau einen Halbton
//    über diesem F (gb), das reibt als kleine None. Jetzt enthält jeder
//    Akkord das F: Fm9 → Dbmaj9/F → Bbm9/F → F9sus4.
//  - Der Stab war ein verminderter Akkord mit H (b3), das in keinem der
//    Akkorde vorkommt. Jetzt spielt er Dreiklänge aus den Pad-Tönen.
//  - Pad in offener Lage über zwei Oktaven, mit zweiter, heller Schicht,
//    langsamer Filterbewegung, Sidechain von der Kick und dunklem Hall.
//  - Jede Schicht mit eigenem Hall/Delay hat ihren eigenen Orbit, damit
//    sich Stab und Arp nicht gegenseitig die Delay-Einstellung überschreiben.
//
//  Orbits: 1 Drums · 2 Bass · 3 Pad · 4 Snare · 5 Stab · 6 Arp · 7 FX
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 174
const bar = 240 / bpm   // Sekunden pro Takt
setcpm(bpm / 4)         // ein Zyklus = ein Takt

// ---------- HARMONIE ----------
// Fm9 → Dbmaj9 → Bbm9 → F9sus4 (= Eb/F), je 2 Takte, alle über dem F im Bass.
// Offene Lage: Grundton unten, dann Septime/None, die Terz oben. Die Stimmen
// bewegen sich kaum (das C oben bleibt liegen), das klingt ruhig und breit.
const chords = "<[f3,ab3,eb4,g4,c5] [db3,ab3,eb4,f4,c5] [bb2,ab3,db4,f4,c5] [bb2,g3,eb4,f4,c5]>/2"
// Luft-Schicht eine Oktave darüber. Die Oberstimme singt c – c – ab – bb
// und löst sich wieder ins c auf.
const air = "<[g5,c6] [f5,c6] [f5,ab5] [g5,bb5]>/2"

// ---------- BASSLINIEN ----------
// 16tel-Raster, 8 Takte = ein Durchlauf der Akkorde.
// A = lange, drohende Noten · B = rollende 3-3-4-2-4-Synkope
// glide = Halbtöne, aus denen die Note hineinrutscht (Portamento)
const lineA  = `<[f1@10 f1@3 gb1@3] [f1@6 ~ f1@3 eb1@6] [f1@10 ab1@3 gb1@3] [f1@3 f1@3 db1@4 eb1@3 c1@3]
                 [f1@10 f1@3 gb1@3] [f1@6 ~ f1@3 eb1@6] [f1@10 g1@3 ab1@3] [f1@3 f1@3 db1@4 eb1@3 c1@3]>`
const glideA = `<[0@10 0@3 1@3] [0@6 ~ 0@3 -2@6] [0@10 3@3 -2@3] [0@3 0@3 -4@4 2@3 -3@3]
                 [0@10 0@3 1@3] [0@6 ~ 0@3 -2@6] [0@10 2@3 1@3] [0@3 0@3 -4@4 2@3 -3@3]>`
const lineB  = `<[f1@3 f1@3 f1@4 ab1@2 gb1@4] [f1@3 f1@3 f1@4 eb1@2 f1@4] [f1@3 f1@3 f1@4 ab1@2 bb1@4] [db1@3 db1@3 f1@4 eb1@3 db1@3]
                 [f1@3 f1@3 f1@4 ab1@2 gb1@4] [f1@3 f1@3 f1@4 eb1@2 f1@4] [f1@3 f1@3 f1@4 ab1@2 bb1@4] [eb1@3 eb1@3 f1@4 eb1@3 c1@3]>`
const glideB = `<[0@3 0@3 0@4 3@2 -2@4] [0@3 0@3 0@4 -2@2 2@4] [0@3 0@3 0@4 3@2 2@4] [0@3 0@3 4@4 -2@3 -2@3]
                 [0@3 0@3 0@4 3@2 -2@4] [0@3 0@3 0@4 -2@2 2@4] [0@3 0@3 0@4 3@2 2@4] [0@3 0@3 2@4 -2@3 -3@3]>`

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

// ---------- PAD ----------
// Körper: 7 Stimmen, breit, das Filter atmet über 16 Takte.
// Hochpass bei 170 Hz, damit unten Platz für Sub und Reese bleibt.
const padBody = note(chords)
  .s("supersaw").unison(7).detune(.3).spread(.7)
  .attack(.9).decay(.6).sustain(.75).release(3)
  .lpf(sine.range(650, 2200).slow(16)).lpq(4)
  .hpf(170)
  .room(.45).roomsize(6).roomlp(5000).orbit(3)

// Luft: zwei hohe, ganz breite Töne mit viel dunklem Hall. Sie liegen weit
// hinten im Raum und geben dem Pad die Tiefe, die vorher gefehlt hat.
const padAir = note(air)
  .s("supersaw").unison(4).detune(.12).spread(1)
  .attack(2).sustain(1).release(4)
  .lpf(sine.range(3000, 6500).slow(12)).hpf(900)
  .room(.85).roomsize(6).roomlp(5000).orbit(3)

// level skaliert beide Schichten zusammen, damit ihr Verhältnis bleibt
const pad = (level = 1) => stack(padBody.gain(.15 * level), padAir.gain(.07 * level))

// ---------- STAB & ARP ----------
// Stab am Ende jeder 4-Takt-Phrase: Fm-Dreiklang über Db, Eb-Dreiklang über F9sus4.
// Beides sind nur Töne, die das Pad gerade spielt, deshalb reibt nichts mehr.
const stabNotes = "<~ ~ ~ [~@14 [f4,ab4,c5]@2] ~ ~ ~ [~@14 [eb4,g4,bb4]@2]>"
// zweiter Drop: zusätzlich Cm über Fm9 und Bb-sus2 über Bbm9
const stabNotes2 = "<[~@14 [c5,eb5,g5]@2] [~@14 [c5,eb5,g5]@2] ~ [~@14 [f4,ab4,c5]@2] ~ [~@14 [f4,bb4,c5]@2] ~ [~@14 [eb4,g4,bb4]@2]>"
const stab = (notes = stabNotes) => note(notes)
  .s("sawtooth").lpf(1800).lpenv(2).lpdecay(.15).lpsustain(0)
  .decay(.2).sustain(0).release(.1)
  .gain(.5).delay(.4).delaytime(bar * 3/16).delayfeedback(.5)
  .room(.3).roomsize(4).orbit(5)

// Arp: nur Akkordtöne, die über dem Pad liegen und keinen Halbton
// über einem Pad-Ton bilden (bei Fm9 kein Ab über dem G).
const arpNotes = "<[c5 eb5 g5 f5 c5 g5 eb5 f5] [c5 eb5 g5 f5 c5 g5 eb5 f5] [c5 eb5 f5 ab5 c5 ab5 f5 eb5] [c5 eb5 f5 ab5 c5 ab5 f5 eb5] [c5 f5 ab5 bb5 c5 bb5 ab5 f5] [c5 f5 ab5 bb5 c5 bb5 ab5 f5] [c5 eb5 g5 bb5 c5 bb5 g5 f5] [c5 eb5 g5 bb5 c5 bb5 g5 f5]>"
const arp = note(arpNotes)
  .s("triangle").fmh(2).fmi(.6)
  .decay(.18).sustain(0).release(.1)
  .gain(.28).delay(.35).delaytime(bar * 3/16).delayfeedback(.45)
  .room(.4).roomsize(6).orbit(6)

// ---------- DRUMS ----------
// Die Kick drückt das Pad (Orbit 3) kurz weg: der Sidechain-Pump lässt es atmen.
const kick = s("<[bd@10 bd@6]!3 [bd@10 bd@3 bd@3]>")
  .bank("RolandJD990").n(5).shape(.4).postgain(.31)
  .duckorbit(3).duckdepth(.35).duckattack(.22)

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

// Impact: Rauschen, das beim Drop von hell nach dunkel fällt (eigener Orbit, wird nicht geduckt)
const impact = s("<white ~!31>")
  .lpf(150).lpenv(-6).lpattack(.9)
  .decay(1.8).sustain(0).gain(.9).room(.4).roomsize(5).orbit(7)

const atmos = s("pink").slow(4)
  .lpf(700).attack(2).release(2).gain(.1)

// lädt alle Drum-Samples schon im ersten Intro-Takt (unhörbar, gain 0),
// damit beim ersten Drop nichts verschluckt wird
const preload = stack(
  s("bd:5").bank("RolandJD990"), s("sd:12 sd:13").bank("RolandTR909"),
  s("sd:2").bank("EmuSP12"), s("cr rd hh").bank("RolandTR909"),
  n(run(32)).s("amencutup"), s("breaks165"),
).gain(0)

// ---------- VISUALS (Hydra) ----------
// Laufen im Player hinter dem Code und genauso auf strudel.cc.
// H() macht aus einem Pattern eine Zahl, die Hydra in jedem Bild liest:
// `energy` folgt den Teilen des Arrangements unten, `pulse` dem Beat.
await initHydra()
const energy = H(arrange(
  [16, saw.range(0, .3).slow(16)],   // intro: wird langsam heller
  [8,  saw.range(.3, .8).slow(8)],   // build
  [32, "1"],                         // drop 1
  [8,  ".25"],                       // breakdown
  [8,  saw.range(.3, .9).slow(8)],   // build 2
  [32, "1"],                         // drop 2
  [16, isaw.range(0, .6).slow(16)],  // outro: blendet aus
))
const pulse = H(isaw.fast(4))            // jede Viertel ein Stoß, der abklingt
// Nachtschicht: kalte blaue Streifen, die im Dunkeln treiben
osc(18, .03, .4).color(.25, .35, .75)
  .modulate(noise(2.5, .05), () => .1 + energy() * .25)
  .rotate(.3, .02)
  .kaleid(2)
  .brightness(() => -.5 + energy() * .12 + pulse() * energy() * .12)
  .out()

// ---------- ARRANGEMENT ----------
const intro = stack(
  preload.mask("<1 0!15>"),
  pad().lpf(saw.range(400, 1600).slow(16)),
  atmos, stab().mask("<0!8 1!8>"),
  reese(lineA, glideA).lpf(220).lpenv(1).postgain(.35).mask("<0!8 1!8>"),
  brk.hpf(saw.range(3000, 400).slow(16)).mask("<0!4 1!12>"),
  hats.mask("<0!8 1!8>"),
  kick.mask("<0!12 1!4>"),
)

// letzter Schlag vor dem Drop bleibt leer – nur das Rückwärts-Crash zieht hoch
const build = stack(
  pad().lpf(saw.range(700, 2800).slow(8)), roll, riser, revcrash,
  reese(lineA, glideA).lpf(saw.range(250, 2000).slow(8)).postgain(saw.range(.25, .5).slow(8)),
  hats.mask("<1!6 0!2>"),
).mask("<1!7 [1@3 0]>")

const drop1 = stack(
  kick, snare, ghosts, hats, brk, crash, fill, impact,
  arrange([16, bass(lineA, glideA)], [16, bass(lineB, glideB)]),
  stab().mask("<0!8 1!8 0!8 1!8>"),
  pad(.7),
)

const breakdown = stack(
  pad(1.1), arp, atmos, impact.gain(.5), crash,
  reese(lineA, glideA).lpf(300).lpenv(1).postgain(.3),
  hats.mask("<0!4 1!4>"),
)

const build2 = stack(
  pad().lpf(saw.range(700, 2800).slow(8)), arp.mask("<1!4 0!4>"),
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
  stab(stabNotes2),
  pad(.6),
  arp.gain(.12).mask("<0!16 1!16>"),
)

const outro = stack(
  kick.mask("<1!12 0!4>"), snare.mask("<1!12 0!4>"),
  hats, brk, crash,
  reese(lineA, glideA).lpf(saw.range(600, 200).slow(8)).mask("<1!8 0!8>"),
  sub(lineA, glideA).mask("<1!8 0!8>"),
  pad(),
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
