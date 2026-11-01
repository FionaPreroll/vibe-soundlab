// @title Kernschmelze
// @style Neurofunk
// @bpm 174
// @key F# minor
// @bars 120
// @order 6
// @about A talking, wavefolded bass on an F sharp pedal, tight drums, metal stabs and lasers.
// ============================================================
//  KERNSCHMELZE — Neurofunk · 174 BPM · Fis-Moll
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  Neuro lebt vom Bass, der "spricht":
//  - Jede 16tel bekommt ihren eigenen Vokal-Formanten (a, e, i, o, u),
//    dazu einen Ladder-Tiefpass mit kurzer Hüllkurve. So klingt jeder
//    Schlag anders, wie eine Silbe.
//  - FM mit halber Frequenz macht den Saw knurrig, Wavefolding ("fold")
//    faltet die Spitzen zurück: das gibt das metallische, hohle Neuro-Kreischen.
//  - Einzelne Töne fallen aus der Oktave herab oder springen hinein ("Dyoo",
//    "Yoi"), der Sub macht diese Sprünge mit.
//  - Der Bass bleibt auf Fis, nur das Pad darüber wandert. Alle vier
//    Akkorde enthalten Fis, deshalb passt er immer.
//
//  Orbits: 1 Drums · 2 Bass · 3 Pad · 4 Snare · 5 Stab · 6 Laser/Arp · 7 FX
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 174
const bar = 240 / bpm
setcpm(bpm / 4)

// ---------- HARMONIE ----------
// F#m11 → D6/9 → E6/9 → C#7sus4, je 2 Takte, alle über dem Fis im Bass.
// Keiner der Akkorde hat zwei Töne im Halbtonabstand: kalt, aber ohne Reibung.
const chords = "<[fs3,e4,a4,b4,cs5] [d3,a3,e4,fs4,b4] [e3,b3,fs4,gs4,cs5] [cs3,gs3,b3,fs4,cs5]>/2"
const air = "<[a5,e6] [a5,e6] [gs5,e6] [gs5,cs6]>/2"

// ---------- NEURO-BASS ----------
// Zwei Takte pro Linie, 16tel-Raster. Auf 16tel 4 und 12 (Snare) bleibt meist Platz.
// vow = Vokal pro Note · bend = Halbtöne, aus denen die Note fällt (+) oder springt (−)
const lineA = `<[fs1@3 fs1 ~@2 fs1@2 fs1 fs1 fs1@2 ~@2 fs2@2]
                [fs1@2 fs1 fs1 ~@2 fs1@3 fs1 fs1@2 ~@2 cs2 e2]>`
const vowA  = `<[a@3 e ~@2 o@2 i e o@2 ~@2 a@2]
                [o@2 a e ~@2 u@3 i a@2 ~@2 e o]>`
const bendA = `<[12@3 0 ~@2 0@2 0 0 -12@2 ~@2 0@2]
                [0@2 0 0 ~@2 12@3 0 -12@2 ~@2 0 0]>`

const lineB = `<[fs1 fs1 fs1@2 ~@2 fs1@3 fs2 fs1@2 ~@2 a1 cs2]
                [fs1@3 ~ fs1 fs1 ~@2 fs1@2 e2@2 fs1@2 ~ fs1]>`
const vowB  = `<[a e o@2 ~@2 u@3 i a@2 ~@2 o e]
                [o@3 ~ a i ~@2 e@2 o@2 a@2 ~ u]>`
const bendB = `<[0 0 12@2 ~@2 -12@3 0 0@2 ~@2 0 0]
                [12@3 ~ 0 0 ~@2 0@2 -12@2 0@2 ~ 0]>`

// Saw mit FM eine Oktave tiefer → resonanter Ladder-Tiefpass, der bei jeder
// Note aufgeht → Vokal → Sättigung (shape, hebt den leisen Formanten auf
// vollen Pegel) → Wavefolder. Unter 120 Hz bleibt Platz für den Sub.
// fold = "Stärke:Ausgangspegel" des Wavefolders
const neuro = (line, vow, bend, fold = "1.6:.35") => note(line)
  .penv(bend).pdecay(.1)
  .s("sawtooth").fmh(.5).fmi(1.5).fmdecay(.2).fmsustain(.3)
  .attack(.004).decay(.12).sustain(.75).release(.04)
  .lpf(800).lpenv(2.5).lpdecay(.14).lpsustain(.3).lpq(12).ftype("ladder")
  .hpf(120)
  .vowel(vow)
  .shape(.95)
  .distort(fold).distorttype("fold")
  .postgain(.38).orbit(2)

// Sub: Sinus mit denselben Pitch-Sprüngen, gibt dem "Dyoo" den Druck
const sub = (line, bend) => note(line)
  .penv(bend).pdecay(.1)
  .s("sine").attack(.004).decay(.15).sustain(.85).release(.04)
  .gain(.62).orbit(2)

const bass = (line, vow, bend, fold) => stack(neuro(line, vow, bend, fold), sub(line, bend))

// Reese für Intro und Breakdown: ein langer, rollender Fis-Ton mit Phaser
const reese = note("fs1")
  .s("supersaw").unison(3).detune(.45).spread(.3)
  .attack(.05).sustain(1).release(.2)
  .lpf(sine.range(250, 700).slow(8)).lpq(4)
  .distort("1.8:.5")
  .phaser(.25).phaserdepth(.6)
  .postgain(.3).orbit(2)

// ---------- PAD ----------
// dunkel und kalt: Filter tief, dunkler Hall, darüber zwei hohe Töne
const padBody = note(chords)
  .s("supersaw").unison(5).detune(.22).spread(.6)
  .attack(1).decay(1).sustain(.65).release(2)
  .lpf(sine.range(500, 1600).slow(16)).lpq(5).hpf(180)
  .room(.55).roomsize(7).roomlp(3500).orbit(3)

const padAir = note(air)
  .s("supersaw").unison(3).detune(.08).spread(1)
  .attack(2).sustain(1).release(4)
  .lpf(6000).hpf(1800)
  .room(.9).roomsize(7).roomlp(3500).orbit(3)

// im Drop reichen weniger Stimmen, das Pad liegt dort nur leise unter dem Bass
const pad = (level = 1, voices = 5) => stack(
  padBody.unison(voices).gain(.13 * level),
  padAir.unison(Math.min(voices, 3)).gain(.05 * level))

// ---------- STAB, LASER, ARP ----------
// Metall-Stab: Square mit FM, die nach dem Anschlag sofort abklingt → "Klank"
const stabChords = "<[cs5,e5,a5] [a4,d5,fs5] [b4,e5,gs5] [b4,fs5,cs6]>/2"
const stabRhythm = "<[~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ x] [~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~]>"
const stab = note(stabChords).struct(stabRhythm)
  .s("square").fmh(3).fmi(2.5).fmdecay(.08).fmsustain(.1)
  .attack(.002).decay(.16).sustain(0).release(.06)
  .lpf(3500).distort("1.2:.5")
  .gain(.16).pan(.42)
  .delay(.3).delaytime(bar * 3/16).delayfeedback(.4)
  .room(.25).roomsize(3).orbit(5)

// Laser: fällt in 70 ms zwei Oktaven herab auf einen Akkordton
const laserLine = `<[~@12 cs6 ~ a5 ~] [~@14 e6 ~] [~@12 fs6 ~ d6 ~] [~@14 a5 ~]
                    [~@12 e6 ~ b5 ~] [~@14 gs5 ~] [~@12 fs6 ~ cs6 ~] [~@12 gs5 cs6 fs6 ~]>`
const laserFx = (p) => p
  .delay(.4).delaytime(bar * 3/16).delayfeedback(.45)
  .room(.3).roomsize(5).orbit(6)
const laser = laserFx(note(laserLine)
  .penv(24).pdecay(.07)
  .s("square").attack(.001).decay(.12).sustain(0).release(.05)
  .lpf(4000).gain(.1).pan("<.3 .7>"))

// kalter Achtel-Arp für den Breakdown, nur Akkordtöne
const arpLine = `<[fs5 cs6 e5 a5 b5 cs6 a5 e5]!2
                  [fs5 d6 a5 e5 b5 fs5 d6 a5]!2
                  [gs5 e6 b5 fs5 cs6 gs5 e6 b5]!2
                  [gs5 cs6 fs5 b5 cs6 gs5 fs5 b5]!2>`
const arp = laserFx(note(arpLine)
  .s("triangle").fmh(2).fmi(.8)
  .attack(.002).decay(.2).sustain(0).release(.1)
  .lpf(3000).gain(.2).pan(sine.range(.3, .7).slow(4)))

// ---------- DRUMS ----------
// Zwei-Schritt: Kick auf der 1 und auf 16tel 10, Snare auf 2 und 4
const kick = s("<[bd@10 bd@6]!3 [bd@10 bd@3 bd@3]>")
  .bank("RolandJD990").n(5).shape(.45).postgain(.3)
  .duckorbit(3).duckdepth(.45).duckattack(.15)

// drei Snares übereinander, hart angezerrt, sehr kleiner Raum: knallt trocken
const snare = stack(
  s("sd").beat("4,12", 16).bank("RolandTR909").n(9),
  s("sd").beat("4,12", 16).bank("EmuSP12").n(2).gain(.6).hpf(250),
  s("cp").beat("4,12", 16).bank("RolandTR909").n(2).gain(.35).hpf(900),
).shape(.6).postgain(.26).room(.15).roomsize(1.8).orbit(4)

const ghosts = s("sd").beat("7,9,14", 16).bank("RolandTR909").n(9)
  .gain("[.08 .1 .12]").hpf(1200)

const hats = s("hh*16").bank("RolandTR909").n(1)
  .gain("[.12 .2 .28 .2]*4").hpf(8000)

// Metall-Schläge auf zufälligen Samples, leise, links und rechts
const metal = s("~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ metal ~ ~ ~ metal").n(irand(10))
  .hpf(2500).gain(.12).pan(rand).speed(rand.range(.9, 1.3))

const ride = s("rd*8").bank("RolandTR909").n(1).gain("[.06 .13]*4").hpf(4000)

// Amen-Slices als Tops im zweiten Drop
const amen = n("0 ~ 2 3 ~ 5 6 ~ 8 ~ 10 11 ~ 13 14 15").s("amencutup")
  .cut(7).hpf(500).gain(.3)

// Amen-Fill auf jedem 8. Takt
const fill = n("<~!7 [~ ~ [13 9 13 13] [20 31 [2 2] 25]]>").s("amencutup")
  .cut(8).hpf(200).gain(.45)

const crash = s("<cr ~!7>").bank("RolandTR909").n(4).hpf(300).gain(.24)

// Halftime für den Breakdown: Kick auf der 1, Snare auf der 3
const htKick = s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~").bank("RolandJD990").n(5)
  .shape(.45).postgain(.3).duckorbit(3).duckdepth(.45).duckattack(.3)
const htSnare = s("~ sd").bank("RolandTR909").n(9)
  .shape(.6).postgain(.24).room(.15).roomsize(1.8).orbit(4)

// ---------- FX ----------
// Alarm: Fis und Cis im Wechsel, die Töne rutschen ineinander wie eine Werkssirene
const alarm = note("[fs5 cs6]").penv("[-7 7]").pattack(.18)
  .s("square").attack(.05).sustain(1).release(.1)
  .lpf(1800).vib(5).vibmod(.1)
  .gain(.035).pan(sine.range(.2, .8).slow(2))
  .room(.6).roomsize(6).orbit(7)

const roll = s("<sd*4 sd*4 sd*8 sd*8 sd*16 sd*16 sd*32 [[sd*24]@3 ~]>")
  .bank("RolandTR909").n(9)
  .gain(saw.range(.1, .5).slow(8)).hpf(saw.range(200, 2000).slow(8))
  .speed(saw.range(1, 1.4).slow(8))

const riser = s("white").slow(8)
  .hpf(300).hpenv(5).hpattack(bar * 8)
  .attack(bar * 7.3).release(.05).gain(.2)

const revcrash = s("<~!7 cr>").bank("RolandTR909").n(4)
  .speed(-bpm / 240).unit("c").hpf(400).gain(.28)

const impact = s("<white ~!31>")
  .lpf(150).lpenv(-6).lpattack(.9)
  .decay(1.8).sustain(0).gain(.8).room(.6).roomsize(6).orbit(7)

const preload = stack(
  s("bd:5").bank("RolandJD990"), s("sd:9 cp:2 hh:1 rd:1 cr:4").bank("RolandTR909"),
  s("sd:2").bank("EmuSP12"), n(run(32)).s("amencutup"), n(run(10)).s("metal"),
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
  [16, ".25"],                       // breakdown
  [8,  saw.range(.3, .9).slow(8)],   // build 2
  [32, "1"],                         // drop 2
  [8,  isaw.range(0, .6).slow(8)],   // outro: blendet aus
))
const pulse = H(isaw.fast(4))
// Kernschmelze: glühende Zellen, die zerlaufen; im Drop zerfällt das Bild in Blöcke
voronoi(5, .6, .4).diff(osc(12, .1, 0).rotate(.4))
  .color(1, .42, .1).contrast(1.2)
  .modulate(noise(3, .2), () => energy() * .15)
  .pixelate(() => 300 - energy() * 220, () => 300 - energy() * 220)
  .brightness(() => -.3 + pulse() * energy() * .2)
  .out()

// ---------- ARRANGEMENT ----------
const intro = stack(
  preload.mask("<1 0!15>"),
  pad().lpf(saw.range(300, 1400).slow(16)),
  reese.lpf(saw.range(150, 500).slow(16)).mask("<0!4 1!12>"),
  alarm.lpf(saw.range(500, 1800).slow(8)).mask("<0!8 1!8>"),
  hats.mask("<0!8 1!8>"), metal.mask("<0!12 1!4>"),
  kick.mask("<0!12 1!4>"),
)

const build = stack(
  pad().lpf(saw.range(600, 2400).slow(8)), alarm,
  roll, riser, revcrash, laser.mask("<0!4 1!4>"),
  neuro(lineA, vowA, bendA).lpf(saw.range(200, 1200).slow(8)).postgain(saw.range(.1, .38).slow(8)),
).mask("<1!7 [1@3 0]>")

const drop1 = stack(
  kick, snare, ghosts, hats, metal, crash, fill, impact,
  arrange([16, bass(lineA, vowA, bendA)], [16, bass(lineB, vowB, bendB)]),
  stab.mask("<0!8 1!8 0!8 1!8>"),
  pad(.5, 2),
)

// Breakdown: Pad, Arp und Reese, ab Takt 9 ein Halftime-Beat
const breakdown = stack(
  pad(1.1), arp, impact.gain(.4),
  reese.lpf(400).postgain(.22),
  htKick.mask("<0!8 1!8>"), htSnare.mask("<0!8 1!8>"),
  hats.gain(.5).mask("<0!12 1!4>"),
)

const build2 = stack(
  pad().lpf(saw.range(600, 2400).slow(8)), alarm, arp.mask("<1!4 0!4>"),
  roll, riser, revcrash, laser,
  neuro(lineB, vowB, bendB).lpf(saw.range(200, 1400).slow(8)).postgain(saw.range(.1, .38).slow(8)),
).mask("<1!7 [1@3 0]>")

// zweiter Drop: mehr Faltung, Amen-Tops, Laser-Antworten, Stotterer am Phrasenende
const drop2 = stack(
  kick, snare, ghosts, hats, ride, amen, metal, crash, fill, impact,
  arrange(
    [16, bass(lineB, vowB, bendB, "2.2:.32")],
    [16, bass(lineA, vowA, bendA, "2.2:.32")],
  ).lastOf(4, x => x.ply(2)),
  stab, laser, pad(.5, 2),
)

const outro = stack(
  kick.mask("<1!4 0!4>"), snare.mask("<1!4 0!4>"), hats, metal, crash,
  reese.lpf(saw.range(600, 150).slow(8)),
  pad(),
)

arrange(
  [16, intro],
  [8,  build],
  [32, drop1],
  [16, breakdown],
  [8,  build2],
  [32, drop2],
  [8,  outro],
)
