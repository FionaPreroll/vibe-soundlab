// @title Tiefgarage
// @style 808 roller
// @bpm 172
// @key Bb minor
// @bars 128
// @order 8
// @about A sliding 808 and a fat, subby Reese roll as one bass through a dark, dripping car park.
// ============================================================
//  TIEFGARAGE — 808 Roller · 172 BPM · B-Moll
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  Der Bass sind zwei Instrumente, die dieselbe Linie spielen:
//  - Die 808: ein Sinus, der von Ton zu Ton rutscht (Glide) und nach jedem
//    Anschlag ein Stück ausklingt. Leicht angezerrt, damit man sie auch auf
//    kleinen Boxen hört. Sie trägt alles unter 60 Hz.
//  - Die Reese: zwei leicht gegeneinander verstimmte Saws, tief gefiltert.
//    Die Verstimmung lässt den Ton langsam schweben ("atmen"). Sie sitzt
//    knapp über der 808 und macht den Bass breit und fett.
//  Im zweiten Drop kommt eine dritte, helle Reese mit Phaser dazu.
//
//  Orbits: 1 Drums · 2 Bass · 3 Pad · 4 Snare · 5 Dub-Stab · 6 Tropfen · 7 Atmo
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 172
const bar = 240 / bpm
setcpm(bpm / 4)

// ---------- HARMONIE ----------
// Bbm11 (4 Takte) → Gb6/9 → F7sus4. Lange auf einem Akkord: das macht den
// Roller hypnotisch. Keiner der Akkorde hat zwei Töne im Halbtonabstand.
const chords = "<[bb2,ab3,db4,f4,eb5] [bb2,ab3,db4,f4,eb5] [gb3,db4,ab4,bb4,eb5] [f3,c4,eb4,bb4,f5]>/2"
const air = "<[f5,db6] [f5,db6] [bb5,eb6] [bb5,eb6]>/2"

// ---------- BASSLINIEN ----------
// glide = Halbtöne, aus denen die Note hineinrutscht (+ von unten, − von oben).
// Das A am Ende zieht als Leitton zurück ins B.
// A: rollt im 6-4-6-Raster, lange Noten zum Ausklingen
const lineA  = `<[bb1@6 bb1@4 db2@6] [bb1@6 ab1@4 bb1@6]
                 [bb1@6 bb1@4 f1@6] [ab1@6 bb1@4 db2@6]
                 [gb1@6 gb1@4 bb1@6] [gb1@6 ab1@4 db2@6]
                 [f1@6 f1@4 ab1@6] [f1@6 eb1@4 f1@3 a1@3]>`
const glideA = `<[1@6 0@4 3@6] [-3@6 -2@4 2@6]
                 [0@6 0@4 -5@6] [3@6 2@4 3@6]
                 [-7@6 0@4 4@6] [-4@6 2@4 5@6]
                 [-8@6 0@4 3@6] [-3@6 -2@4 2@3 4@3]>`
// B: schneller, 3-3-2 mit kleinen Läufen nach oben
const lineB  = `<[bb1@3 bb1@3 db2@2 bb1@3 bb1@3 ab1@2] [bb1@3 bb1@3 f2@2 eb2@3 db2@3 ab1@2]
                 [bb1@3 bb1@3 db2@2 bb1@3 bb1@3 f1@2] [ab1@3 ab1@3 bb1@2 db2@3 eb2@3 db2@2]
                 [gb1@3 gb1@3 bb1@2 gb1@3 gb1@3 ab1@2] [gb1@3 gb1@3 db2@2 eb2@3 db2@3 ab1@2]
                 [f1@3 f1@3 ab1@2 f1@3 f1@3 eb1@2] [f1@3 f1@3 c2@2 bb1@3 ab1@3 a1@2]>`
const glideB = `<[1@3 0@3 3@2 -3@3 0@3 -2@2] [2@3 0@3 7@2 -2@3 -2@3 -5@2]
                 [2@3 0@3 3@2 -3@3 0@3 -5@2] [3@3 0@3 2@2 3@3 2@3 -2@2]
                 [-7@3 0@3 4@2 -4@3 0@3 2@2] [-2@3 0@3 7@2 2@3 -2@3 -5@2]
                 [-3@3 0@3 3@2 -3@3 0@3 -2@2] [2@3 0@3 7@2 -2@3 -2@3 1@2]>`

// ---------- BASS ----------
// 808: Sinus mit Glide, klingt nach dem Anschlag auf knapp die Hälfte ab
const b808 = (line, glide) => note(line)
  .penv(glide).pattack(.08)
  .s("sine").attack(.004).decay(.9).sustain(.45).release(.08)
  .lpf(700).shape(.4)
  .gain(.4).postgain(.85).orbit(2)

// Sub-Reese: 2 Saws, um ein Viertel Halbton verstimmt, fast mono (spread .1),
// Tiefpass knapp über dem Grundton. Unter 60 Hz überlässt sie der 808 das Feld.
const reese = (line, glide, cutoff = 420) => note(line)
  .penv(glide).pattack(.08)
  .s("supersaw").unison(2).detune(.22).spread(.1)
  .attack(.01).decay(.3).sustain(.85).release(.08)
  .lpf(cutoff).lpq(3)
  .hpf(60)
  .distort("1.3:.7")
  .postgain(.45).orbit(2)

// helle Reese für den zweiten Drop: mehr Stimmen, Phaser, nur Mitten
const reeseMid = (line, glide) => note(line)
  .penv(glide).pattack(.08)
  .s("supersaw").unison(3).detune(.45).spread(.4)
  .attack(.01).sustain(.9).release(.08)
  .lpf(sine.range(900, 1800).slow(8)).lpq(4).hpf(200)
  .distort("2:.4")
  .phaser(.25).phaserdepth(.5)
  .postgain(.16).orbit(2)

const bass = (line, glide) => stack(b808(line, glide), reese(line, glide))

// ---------- PAD ----------
// dunkel und weit weg: tiefer Filter, dunkler, großer Hall
const padBody = note(chords)
  .s("supersaw").unison(5).detune(.2).spread(.6)
  .attack(1.5).decay(1).sustain(.7).release(3)
  .lpf(sine.range(500, 1500).slow(16)).lpq(4).hpf(200)
  .room(.6).roomsize(8).roomlp(3000).orbit(3)

const padAir = note(air)
  .s("supersaw").unison(3).detune(.08).spread(1)
  .attack(3).sustain(1).release(5)
  .lpf(5000).hpf(1600)
  .room(.9).roomsize(8).roomlp(3000).orbit(3)

// im Drop reichen weniger Stimmen, das Pad liegt dort nur leise unter dem Bass
const pad = (level = 1, voices = 5) => stack(
  padBody.unison(voices).gain(.12 * level),
  padAir.unison(Math.min(voices, 3)).gain(.05 * level))

// ---------- DUB-STAB & TROPFEN ----------
// Dub-Stab: ein Akkord alle zwei Takte, das Delay wiederholt ihn lange.
// Er fällt immer in den ersten Takt eines Akkords, damit die Echos nicht in
// den nächsten Akkord hineinreichen.
const dubChords = "<[db4,f4,ab4] [db4,f4,ab4] [db4,gb4,bb4] [c4,f4,bb4]>/2"
const dub = note(dubChords).struct("<[~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~] ~>")
  .s("sawtooth").lpf(900).lpenv(2).lpdecay(.15).lpsustain(0).lpq(6)
  .attack(.003).decay(.2).sustain(0).release(.1)
  .gain(.22).pan(.4)
  .delay(.55).delaytime(bar * 3/16).delayfeedback(.6)
  .room(.4).roomsize(6).roomlp(4000).orbit(5)

// Tropfen: kurze, hohe Sinus-Blips, die von unten in den Ton springen, mit
// langem Echo, wie Wasser in einer leeren Garage. Nur Akkordtöne.
const dripLine = `<[~@3 f6 ~@5 db6 ~@6] [~@9 ab5 ~@6]
                   [~@3 eb6 ~@5 f6 ~@6] [~@11 db6 ~@4]
                   [~@3 bb5 ~@5 gb6 ~@6] [~@9 eb6 ~@6]
                   [~@3 c6 ~@5 f6 ~@6] [~@11 bb5 ~@4]>`
const drips = note(dripLine)
  .penv(-7).pdecay(.03)
  .s("sine").attack(.001).decay(.15).sustain(0).release(.05)
  .gain(.13).pan(rand.range(.2, .8))
  .delay(.5).delaytime(bar * 3/8).delayfeedback(.5)
  .room(.7).roomsize(8).orbit(6)

// ---------- DRUMS ----------
const kick = s("<[bd@10 bd@6]!3 [bd@10 bd@2 bd@4]>").bank("RolandTR909").n(1)
  .lpf(2500).shape(.35).postgain(.34)
  .duckorbit(3).duckdepth(.4).duckattack(.2)

// Snare und Rimshot in einem großen, dunklen Raum: die Garage
const snare = stack(
  s("sd").beat("4,12", 16).bank("RolandTR909").n(3),
  s("rim").beat("4,12", 16).bank("RolandTR909").n(1).gain(.35),
).shape(.4).postgain(.27).room(.35).roomsize(5).roomlp(5000).orbit(4)

// stark geshuffelte Hats und leise Rimshots dazwischen
const hats = s("hh*16").bank("RolandTR909").n(2)
  .gain("[.1 .2 .26 .2]*4").hpf(7000).late("[0 .014]*8")

const rims = s("rim").beat("3,7,11,14", 16).bank("RolandTR909").n(2)
  .gain("[.06 .1 .07 .09]").hpf(1500).pan(sine.range(.3, .7).slow(3))

const brk = s("breaks165").fit().hpf(1000).gain(.2)

const crash = s("<cr ~!7>").bank("RolandTR909").n(1).hpf(300).gain(.22)

// ---------- ATMO & FX ----------
// Brummen der Lüftung: tiefes braunes Rauschen, schwillt langsam an und ab
const hum = s("brown").slow(8)
  .lpf(sine.range(120, 260).slow(16)).attack(4).release(4)
  .gain(.2).room(.6).roomsize(6).orbit(7)

const roll = s("<sd*4 sd*4 sd*8 sd*8 sd*16 sd*16 sd*16 [[sd*16]@3 ~]>")
  .bank("RolandTR909").n(3)
  .gain(saw.range(.08, .4).slow(8)).hpf(saw.range(150, 1200).slow(8))

const riser = s("white").slow(8)
  .hpf(200).hpenv(5).hpattack(bar * 8)
  .attack(bar * 7.3).release(.05).gain(.18)

const revcrash = s("<~!7 cr>").bank("RolandTR909").n(1)
  .speed(-bpm / 240).unit("c").hpf(400).gain(.26)

const impact = s("<white ~!31>")
  .lpf(150).lpenv(-6).lpattack(.9)
  .decay(1.8).sustain(0).gain(.7).room(.6).roomsize(6).orbit(7)

const preload = stack(
  s("bd:1 sd:3 rim:1 rim:2 hh:2 cr:1").bank("RolandTR909"), s("breaks165"),
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
  [16, isaw.range(0, .6).slow(16)],  // outro: blendet aus
))
const pulse = H(isaw.fast(2).early(.25))
// Tiefgarage: Betonrahmen, die in die Tiefe ziehen, Neonlicht im Takt
const light = () => .25 + pulse() * energy() * .75
shape(4, .95, .005).diff(shape(4, .92, .005))
  .color(() => light() * .9, () => light() * .8, () => light() * .35)
  .add(src(o0).scale(.97), .85)
  .out()

// ---------- ARRANGEMENT ----------
const intro = stack(
  preload.mask("<1 0!15>"),
  pad().lpf(saw.range(300, 1200).slow(16)), hum,
  drips.mask("<0!4 1!12>"), hats.mask("<0!4 1!12>"), rims.mask("<0!8 1!8>"),
  kick.mask("<0!8 1!8>"),
  reese(lineA, glideA, 220).mask("<0!12 1!4>"),
  b808(lineA, glideA).gain(.3).mask("<0!12 1!4>"),
)

// letzter Schlag vor dem Drop bleibt leer
const build = stack(
  pad().lpf(saw.range(600, 2000).slow(8)), drips, dub, hum,
  roll, riser, revcrash, hats.mask("<1!6 0!2>"),
  reese(lineA, glideA).lpf(saw.range(200, 500).slow(8)),
  b808(lineA, glideA).gain(.25),
).mask("<1!7 [1@3 0]>")

const drop1 = stack(
  kick, snare, hats, rims, crash, impact,
  arrange([16, bass(lineA, glideA)], [16, bass(lineB, glideB)]),
  dub.mask("<0!16 1!16>"), drips.gain(.08),
  pad(.5, 2),
)

// Breakdown: Pad, Dub-Stab und Tropfen im Raum, darunter nur die Reese
const breakdown = stack(
  pad(1.1), dub, drips, hum, crash.mask("<1 0!15>"),
  reese(lineA, glideA, 260).mask("<0!8 1!8>"),
  hats.gain(.5).mask("<0!12 1!4>"),
)

const build2 = stack(
  pad().lpf(saw.range(600, 2000).slow(8)), drips, dub, hum,
  roll, riser, revcrash, brk.mask("<0!4 1!2 0!2>"),
  reese(lineB, glideB).lpf(saw.range(200, 500).slow(8)),
  b808(lineB, glideB).gain(.25),
).mask("<1!7 [1@3 0]>")

// zweiter Drop: helle Reese obendrauf, Break-Tops, Dub-Stab durchgehend
const drop2 = stack(
  kick, snare, hats, rims, brk, crash, impact,
  arrange(
    [16, stack(bass(lineB, glideB), reeseMid(lineB, glideB))],
    [16, stack(bass(lineA, glideA), reeseMid(lineA, glideA))],
  ),
  dub, drips.gain(.08), pad(.5, 2),
)

const outro = stack(
  kick.mask("<1!12 0!4>"), snare.mask("<1!12 0!4>"), hats, rims.mask("<1!8 0!8>"), crash,
  bass(lineA, glideA).mask("<1!8 0!8>"),
  pad(), drips, hum,
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
