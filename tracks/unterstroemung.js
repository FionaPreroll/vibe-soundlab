// @title Unterströmung
// @style Steppy roller
// @bpm 175
// @key G# minor
// @bars 120
// @order 10
// @about An 808 boom on every kick, a subby Reese rolling in the gaps, warm keys and chopped amens.
// ============================================================
//  UNTERSTRÖMUNG — Steppy Roller · 175 BPM · Gis-Moll
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  Boom und Reese teilen sich den Takt wie zwei Gesprächspartner:
//  - Auf jeder Kick (Schlag 1 und 16tel 10) sitzt ein kurzer 808-Boom, der
//    sieben Halbtöne von oben in den Grundton fällt.
//  - In den Lücken dazwischen rollt eine Sub-Reese: zwei verstimmte Saws,
//    tief gefiltert. Sie springt aus dem Boom eine Oktave hoch ("Yoi"),
//    fällt zurück und führt mit dem letzten Ton zum nächsten Akkord.
//  So spielt nie mehr als ein Sub-Ton gleichzeitig: fett, aber nicht matschig.
//
//  Orbits: 1 Drums · 2 Bass · 3 Pad · 4 Snare · 5 Keys · 6 Blasen · 7 FX
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 175
const bar = 240 / bpm
setcpm(bpm / 4)

// ---------- HARMONIE ----------
// G#m11 (ohne None) → E6/9 → F#6/9 → D#7sus4, je 2 Takte. Keine Töne im
// Halbtonabstand. Die Grundtöne liegen tief: 39 bis 52 Hz.
const chords = "<[gs2,ds3,b3,cs4,fs4] [e3,b3,fs4,gs4,cs5] [fs3,cs4,gs4,as4,ds5] [ds3,as3,cs4,gs4,ds5]>/2"
const air = "<[b5,fs6] [b5,e6] [as5,ds6] [as5,ds6]>/2"

// ---------- BOOMS & REESE ----------
// Booms auf den Kicks. Der zweite Boom im zweiten Takt führt zum nächsten Akkord.
const boomLine = `<[gs1@4 ~@6 gs1@3 ~@3] [gs1@4 ~@6 ds1@3 ~@3]
                   [e1@4 ~@6 e1@3 ~@3] [e1@4 ~@6 b1@3 ~@3]
                   [fs1@4 ~@6 fs1@3 ~@3] [fs1@4 ~@6 cs2@3 ~@3]
                   [ds1@4 ~@6 ds1@3 ~@3] [ds1@4 ~@6 as1@3 ~@3]>`
// Reese in den Lücken: Oktave hoch, zurück, Übergangston.
// glide = Halbtöne, aus denen die Note hineinrutscht (+ von unten, − von oben)
const line  = `<[~@4 gs2@3 gs1@3 ~@3 b1@3] [~@4 gs2@3 gs1@3 ~@3 fs1@3]
                [~@4 e2@3 e1@3 ~@3 gs1@3] [~@4 e2@3 e1@3 ~@3 ds1@3]
                [~@4 fs2@3 fs1@3 ~@3 as1@3] [~@4 fs2@3 fs1@3 ~@3 e1@3]
                [~@4 ds2@3 ds1@3 ~@3 fs1@3] [~@4 ds2@3 ds1@3 ~@3 as1@3]>`
const glide = `<[~@4 12@3 -12@3 ~@3 3@3] [~@4 12@3 -12@3 ~@3 -2@3]
                [~@4 12@3 -12@3 ~@3 4@3] [~@4 12@3 -12@3 ~@3 -1@3]
                [~@4 12@3 -12@3 ~@3 4@3] [~@4 12@3 -12@3 ~@3 -2@3]
                [~@4 12@3 -12@3 ~@3 3@3] [~@4 12@3 -12@3 ~@3 7@3]>`

// ---------- BASS ----------
// 808-Boom: kurz und hart, fällt in 60 ms in den Ton, leicht angezerrt
const boom = (drive = .45) => note(boomLine)
  .penv(7).pdecay(.06)
  .s("sine").attack(.003).decay(.4).sustain(.35).release(.08)
  .lpf(900).shape(drive)
  .gain(.5).postgain(.9).orbit(2)

// Sub-Reese: zwei Saws, um ein Viertel Halbton verstimmt, fast mono
const reese = (cutoff = 480) => note(line)
  .penv(glide).pattack(.05)
  .s("supersaw").unison(2).detune(.25).spread(.1)
  .attack(.01).decay(.2).sustain(.8).release(.06)
  .lpf(cutoff).lpq(3).hpf(30)
  .distort("1.4:.7")
  .postgain(.5).orbit(2)

// zweiter Drop: breite Reese mit Phaser nur in den Mitten
const reeseMid = note(line)
  .penv(glide).pattack(.05)
  .s("supersaw").unison(3).detune(.45).spread(.4)
  .attack(.01).sustain(.9).release(.06)
  .lpf(sine.range(900, 1700).slow(8)).lpq(4).hpf(180)
  .distort("3:.3")
  .phaser(.3).phaserdepth(.5)
  .postgain(.18).orbit(2)

const bass = (drive) => stack(boom(drive), reese())

// ---------- PAD ----------
const padBody = note(chords)
  .s("supersaw").unison(5).detune(.25).spread(.6)
  .attack(1.2).decay(.8).sustain(.7).release(2.5)
  .lpf(sine.range(700, 2200).slow(16)).lpq(3).hpf(200)
  .room(.5).roomsize(6).roomlp(5000).orbit(3)

const padAir = note(air)
  .s("supersaw").unison(3).detune(.1).spread(1)
  .attack(2).sustain(1).release(4)
  .lpf(7000).hpf(1600)
  .room(.85).roomsize(6).roomlp(5000).orbit(3)

// im Drop reichen weniger Stimmen, das Pad liegt dort nur leise unter dem Bass
const pad = (level = 1, voices = 5) => stack(
  padBody.unison(voices).gain(.12 * level),
  padAir.unison(Math.min(voices, 3)).gain(.05 * level))

// ---------- KEYS & BLASEN ----------
// warme FM-Keys neben den Schlägen. Im zweiten Takt jedes Akkords nur einmal
// früh, damit das Echo nicht in den nächsten Akkord hineinklingt.
const keyChords = "<[b4,ds5,fs5] [b4,e5,gs5] [as4,cs5,fs5] [as4,cs5,gs5]>/2"
const keys = note(keyChords).struct("<[~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~] [~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~]>")
  .s("sine").fmh(1).fmi(1.4).fmdecay(.3).fmsustain(.15)
  .attack(.004).decay(.5).sustain(.15).release(.3)
  .gain(.24).pan(.42)
  .delay(.3).delaytime(bar * 3/16).delayfeedback(.35)
  .room(.4).roomsize(4).orbit(5)

// Blasen: Achtel aus Akkordtönen, jede springt kurz von unten in den Ton
const bubbleLine = `<[gs5 b5 ds6 fs6 ds6 b5 gs5 b5]!2
                     [gs5 b5 e6 fs6 e6 b5 gs5 b5]!2
                     [as5 cs6 ds6 fs6 ds6 cs6 as5 cs6]!2
                     [gs5 as5 cs6 ds6 cs6 as5 gs5 as5]!2>`
const bubbles = note(bubbleLine)
  .penv(-5).pdecay(.03)
  .s("sine").attack(.002).decay(.12).sustain(0).release(.05)
  .gain(.11).pan(sine.range(.25, .75).slow(2))
  .delay(.35).delaytime(bar * 3/16).delayfeedback(.4)
  .room(.5).roomsize(6).orbit(6)

// ---------- DRUMS ----------
// Kick auf der 1 und auf 16tel 10, genau wie die Booms
const kick = s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~").bank("RolandTR909").n(0)
  .lpf(3000).shape(.4).postgain(.32)
  .duckorbit(3).duckdepth(.4).duckattack(.2)

const snare = stack(
  s("sd").beat("4,12", 16).bank("RolandTR909").n(14),
  s("cp").beat("4,12", 16).bank("RolandTR909").n(3).gain(.4).hpf(700),
).shape(.45).postgain(.27).room(.2).roomsize(2.5).orbit(4)

// Amen-Scheiben, ohne die tiefen Kicks (Hochpass), damit die Booms Platz haben
const amenA = n("<[0 ~ 2 ~ 4 5 ~ 7 8 ~ 10 11 ~ 13 14 ~] [0 1 ~ 3 4 ~ 6 7 ~ 9 10 ~ 12 ~ 14 15]>")
const amenB = n("<[0 ~ 2 3 4 ~ 6 [7 7] 8 ~ 10 11 [12 13] ~ 14 15] [0 1 [2 2] 3 ~ 5 6 7 8 9 ~ 11 [24 25] 13 14 [15 31]]>")
const amen = (pat) => pat.s("amencutup").cut(1).hpf(350).gain(.32)

const shaker = s("sh*16").bank("RolandTR808").n(1)
  .gain("[.08 .15 .11 .15]*4").hpf(5000).late("[0 .008]*8")

const crash = s("<cr ~!7>").bank("RolandTR909").n(3).hpf(300).gain(.22)

// ---------- FX ----------
const roll = s("<sd*4 sd*4 sd*8 sd*8 sd*16 sd*16 sd*32 [[sd*16]@3 ~]>")
  .bank("RolandTR909").n(14)
  .gain(saw.range(.1, .45).slow(8)).hpf(saw.range(150, 1500).slow(8))

const riser = s("pink").slow(8)
  .hpf(300).hpenv(5).hpattack(bar * 8)
  .attack(bar * 7.3).release(.05).gain(.2)

const revcrash = s("<~!7 cr>").bank("RolandTR909").n(3)
  .speed(-bpm / 240).unit("c").hpf(400).gain(.26)

const impact = s("<white ~!31>")
  .lpf(150).lpenv(-6).lpattack(.9)
  .decay(1.8).sustain(0).gain(.75).room(.5).roomsize(6).orbit(7)

const preload = stack(
  s("bd:0 sd:14 cp:3 cr:3").bank("RolandTR909"), s("sh:1").bank("RolandTR808"),
  n(run(32)).s("amencutup"),
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
// Unterströmung: Licht auf dem Grund eines Flusses, das mit der Strömung zieht
voronoi(10, .3, .3).mult(osc(20, .05, .6).modulate(noise(2, .1), .4))
  .color(.15, .8, .85)
  .scrollX(0, .03)
  .modulate(noise(1.5, .05), () => .1 + energy() * .15)
  .brightness(() => -.2 + energy() * .05 + pulse() * energy() * .12)
  .out()

// ---------- ARRANGEMENT ----------
const intro = stack(
  preload.mask("<1 0!15>"),
  pad().lpf(saw.range(500, 2000).slow(16)),
  keys.mask("<0!4 1!12>"), shaker.mask("<0!4 1!12>"),
  amen(amenA).hpf(saw.range(3000, 350).slow(8)).mask("<0!8 1!8>"),
  kick.mask("<0!12 1!4>"), boom().gain(.35).mask("<0!12 1!4>"),
)

// letzter Schlag vor dem Drop bleibt leer
const build = stack(
  pad().lpf(saw.range(800, 2800).slow(8)), keys, bubbles.mask("<0!4 1!4>"),
  roll, riser, revcrash, shaker.mask("<1!6 0!2>"),
  boom().gain(.4), reese().lpf(saw.range(150, 480).slow(8)),
).mask("<1!7 [1@3 0]>")

const drop1 = stack(
  kick, snare, amen(amenA), shaker, crash, impact,
  bass(), keys.gain(.18), pad(.5, 2),
)

// Breakdown: Keys und Blasen über dem Pad, ab Takt 9 kommen die Booms zurück
const breakdown = stack(
  pad(1.1), keys, bubbles, crash.mask("<1 0!15>"),
  boom(.3).gain(.4).mask("<0!8 1!8>"),
  shaker.gain(.6).mask("<0!8 1!8>"),
)

const build2 = stack(
  pad().lpf(saw.range(800, 2800).slow(8)), keys, bubbles,
  roll, riser, revcrash, amen(amenB).mask("<0!4 1!2 0!2>"),
  boom().gain(.4), reese().lpf(saw.range(150, 480).slow(8)),
).mask("<1!7 [1@3 0]>")

// zweiter Drop: wildere Amens, breite Reese obendrauf, Blasen im Hintergrund
const drop2 = stack(
  kick, snare, amen(amenB), shaker, crash, impact,
  bass(.55), reeseMid, keys.gain(.18), bubbles.gain(.07), pad(.5, 2),
)

const outro = stack(
  kick.mask("<1!4 0!4>"), snare.mask("<1!4 0!4>"), amen(amenA).mask("<1!6 0!2>"), shaker,
  bass().mask("<1!4 0!4>"),
  pad(), keys,
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
