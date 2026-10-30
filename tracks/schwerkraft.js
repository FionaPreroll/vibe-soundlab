// @title Schwerkraft
// @style Reese roller
// @bpm 174
// @key C# minor
// @bars 120
// @order 9
// @about A huge, slowly beating Reese rolls between heavy 808 booms that land every two bars.
// ============================================================
//  SCHWERKRAFT — Reese Roller · 174 BPM · Cis-Moll
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  Hier ist die Reese der Star, die 808 setzt die Ausrufezeichen:
//  - Alle zwei Takte fällt auf der Eins ein 808-Boom: ein Sinus, der eine
//    Oktave von oben in den Ton stürzt und lange ausklingt.
//  - Während der Boom klingt, schweigt die Reese. Erst danach rollt sie los
//    und füllt den Rest der zwei Takte: Frage (Boom) und Antwort (Reese).
//  - Die Reese hat zwei Schichten: unten zwei verstimmte Saws, tief gefiltert
//    und fast mono (der Sub, der schwebt), darüber vier breite Saws mit
//    Phaser, deren Filter sich über acht Takte öffnet.
//
//  Orbits: 1 Drums · 2 Bass · 3 Pad · 4 Snare · 5 Stab · 6 Pfeife · 7 Atmo
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 174
const bar = 240 / bpm
setcpm(bpm / 4)

// ---------- HARMONIE ----------
// C#m11 → A6/9 → B6/9 → G#7sus4, je 2 Takte. Keine Töne im Halbtonabstand,
// das G#7sus4 ohne His (bleibt dunkel) zieht zurück ins Cis.
const chords = "<[cs3,gs3,e4,fs4,b4] [a2,e3,b3,cs4,fs4] [b2,fs3,cs4,ds4,gs4] [gs2,ds3,fs3,cs4,gs4]>/2"
const air = "<[gs5,e6] [fs5,cs6] [fs5,ds6] [gs5,cs6]>/2"

// ---------- BOOMS & REESE-LINIEN ----------
// Booms auf der Eins jedes zweiten Takts, auf dem Grundton des Akkords
const booms = "<[cs2@6 ~@10] ~ [a1@6 ~@10] ~ [b1@6 ~@10] ~ [gs1@6 ~@10] ~>"

// Die Reese setzt nach dem Boom ein (16tel 6) und rollt bis zum nächsten.
// glide = Halbtöne, aus denen die Note hineinrutscht (+ von unten, − von oben)
const lineA  = `<[~@6 cs2@4 cs2@3 e2@3] [cs2@6 cs2@4 b1@3 gs1@3]
                 [~@6 a1@4 a1@3 cs2@3] [a1@6 a1@4 b1@3 cs2@3]
                 [~@6 b1@4 b1@3 ds2@3] [b1@6 b1@4 cs2@3 ds2@3]
                 [~@6 gs1@4 gs1@3 b1@3] [gs1@6 gs1@4 fs1@3 gs1@3]>`
const glideA = `<[~@6 2@4 0@3 3@3] [-3@6 0@4 -2@3 -3@3]
                 [~@6 2@4 0@3 4@3] [-4@6 0@4 2@3 2@3]
                 [~@6 2@4 0@3 4@3] [-4@6 0@4 2@3 2@3]
                 [~@6 2@4 0@3 3@3] [-3@6 0@4 -2@3 2@3]>`
// B: rollt dichter und springt im zweiten Takt in die Oktave
const lineB  = `<[~@6 cs2@2 cs2@2 e2@3 cs2@3] [cs2@3 cs2@3 cs3@2 b1@3 gs1@3 b1@2]
                 [~@6 a1@2 a1@2 cs2@3 a1@3] [a1@3 a1@3 a2@2 b1@3 cs2@3 b1@2]
                 [~@6 b1@2 b1@2 ds2@3 b1@3] [b1@3 b1@3 b2@2 cs2@3 ds2@3 cs2@2]
                 [~@6 gs1@2 gs1@2 b1@3 gs1@3] [gs1@3 gs1@3 gs2@2 fs1@3 gs1@3 b1@2]>`
const glideB = `<[~@6 2@2 0@2 3@3 -3@3] [0@3 0@3 12@2 -14@3 -3@3 3@2]
                 [~@6 2@2 0@2 4@3 -4@3] [0@3 0@3 12@2 -10@3 2@3 -2@2]
                 [~@6 2@2 0@2 4@3 -4@3] [0@3 0@3 12@2 -10@3 2@3 -2@2]
                 [~@6 2@2 0@2 3@3 -3@3] [0@3 0@3 12@2 -14@3 2@3 3@2]>`

// ---------- BASS ----------
// 808-Boom: fällt in 100 ms eine Oktave herab, klingt lange aus,
// angezerrt für Obertöne, die man auch auf kleinen Boxen hört
const boom = (drive = .45) => note(booms)
  .penv(12).pdecay(.1)
  .s("sine").attack(.003).decay(1).sustain(.15).release(.15)
  .lpf(900).shape(drive)
  .gain(.5).postgain(.9).orbit(2)

// Sub-Reese: zwei Saws, um ein Fünftel Halbton verstimmt, fast mono.
// Die Schwebung lässt den Sub langsam atmen.
const subReese = (line, glide) => note(line)
  .penv(glide).pattack(.07)
  .s("supersaw").unison(2).detune(.2).spread(.1)
  .attack(.02).sustain(1).release(.08)
  .lpf(340).lpq(2).hpf(30)
  .distort("1.2:.75")
  .postgain(.55).orbit(2)

// breite Reese darüber: vier Saws, Phaser, der Filter öffnet sich über 8 Takte
const midReese = (line, glide, drive = "3:.3") => note(line)
  .penv(glide).pattack(.07)
  .s("supersaw").unison(4).detune(.5).spread(.5)
  .attack(.02).sustain(1).release(.08)
  .lpf(saw.range(700, 1900).slow(8)).lpq(4).hpf(160)
  .distort(drive)
  .phaser(.2).phaserdepth(.5)
  .postgain(.22).orbit(2)

const bass = (line, glide, drive) => stack(boom(), subReese(line, glide), midReese(line, glide, drive))

// ---------- PAD ----------
const padBody = note(chords)
  .s("supersaw").unison(5).detune(.25).spread(.7)
  .attack(1).decay(1).sustain(.7).release(2.5)
  .lpf(sine.range(600, 1800).slow(16)).lpq(3).hpf(220)
  .room(.5).roomsize(7).roomlp(4000).orbit(3)

const padAir = note(air)
  .s("supersaw").unison(3).detune(.1).spread(1)
  .attack(2.5).sustain(1).release(5)
  .lpf(6500).hpf(1700)
  .room(.9).roomsize(7).roomlp(4000).orbit(3)

// im Drop reichen weniger Stimmen, das Pad liegt dort nur leise unter dem Bass
const pad = (level = 1, voices = 5) => stack(
  padBody.unison(voices).gain(.12 * level),
  padAir.unison(Math.min(voices, 3)).gain(.05 * level))

// ---------- PFEIFE & STAB ----------
// Pfeife: einsame Melodie aus Akkordtönen, mit Vibrato und langem Echo.
// Jeder lange Ton ist auch im nächsten Akkord enthalten, darum reiben die Echos nicht.
const leadLine = `<[gs5@8 e5@8] [fs5@12 ~@4] [e5@8 cs5@8] [b4@12 ~@4]
                   [ds5@8 fs5@8] [gs5@12 ~@4] [fs5@8 ds5@8] [cs5@12 ~@4]>`
const lead = note(leadLine)
  .penv(3).pattack(.15)
  .s("triangle").vib(5).vibmod(.15)
  .attack(.05).decay(.4).sustain(.6).release(.6)
  .lpf(2500).gain(.16).pan(.6)
  .delay(.45).delaytime(bar * 3/8).delayfeedback(.5)
  .room(.6).roomsize(7).orbit(6)

// dunkler Stab am Ende jedes ersten Akkordtakts, Dreiklänge aus den Pad-Tönen
const stab = note(`<[~@14 [e4,gs4,b4]@2] ~ [~@14 [cs4,e4,a4]@2] ~
                    [~@14 [ds4,fs4,b4]@2] ~ [~@14 [ds4,gs4,cs5]@2] ~>`)
  .s("sawtooth").lpf(1400).lpenv(2).lpdecay(.15).lpsustain(0).lpq(5)
  .attack(.003).decay(.25).sustain(0).release(.1)
  .gain(.3).pan(.38)
  .delay(.3).delaytime(bar * 3/16).delayfeedback(.4)
  .room(.35).roomsize(4).orbit(5)

// ---------- DRUMS ----------
const kick = s("<[bd@10 bd@6]!3 [bd@10 bd@3 bd@3]>").bank("RolandTR909").n(2)
  .lpf(2800).shape(.4).postgain(.33)
  .duckorbit(3).duckdepth(.4).duckattack(.2)

const snare = stack(
  s("sd").beat("4,12", 16).bank("RolandTR909").n(11),
  s("sd").beat("4,12", 16).bank("EmuSP12").n(8).gain(.5).hpf(300),
).shape(.5).postgain(.27).room(.2).roomsize(2.2).orbit(4)

const hats = s("hh*16").bank("RolandTR909").n(3)
  .gain("[.12 .22 .3 .22]*4").hpf(7000).late("[0 .01]*8")

const ride = s("rd*8").bank("RolandTR909").n(3).gain("[.07 .14]*4").hpf(3500)

// Break als Tops-Layer: breaks165 ist genau ein Takt lang
const brk = s("breaks165").fit().hpf(400).gain(.3)

const crash = s("<cr ~!7>").bank("RolandTR909").n(2).hpf(300).gain(.24)

// ---------- ATMO & FX ----------
// Grollen: tiefes braunes Rauschen, das langsam an- und abschwillt
const rumble = s("brown").slow(8)
  .lpf(sine.range(150, 400).slow(16)).attack(4).release(4)
  .gain(.16).room(.5).roomsize(6).orbit(7)

const roll = s("<sd*4 sd*4 sd*8 sd*8 sd*16 sd*16 sd*32 [[sd*16]@3 ~]>")
  .bank("RolandTR909").n(11)
  .gain(saw.range(.1, .45).slow(8)).hpf(saw.range(150, 1500).slow(8))

const riser = s("white").slow(8)
  .hpf(200).hpenv(5.5).hpattack(bar * 8)
  .attack(bar * 7.3).release(.05).gain(.2)

const revcrash = s("<~!7 cr>").bank("RolandTR909").n(2)
  .speed(-bpm / 240).unit("c").hpf(400).gain(.28)

const impact = s("<white ~!31>")
  .lpf(150).lpenv(-6).lpattack(.9)
  .decay(1.8).sustain(0).gain(.75).room(.5).roomsize(6).orbit(7)

const preload = stack(
  s("bd:2 sd:11 hh:3 rd:3 cr:2").bank("RolandTR909"), s("sd:8").bank("EmuSP12"), s("breaks165"),
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
const pulse = H(isaw.fast(4))
// Schwerkraft: ein schwarzes Loch, um das sich violettes Licht dreht
osc(6, .05, 0).color(.6, .3, 1)
  .modulateRotate(shape(99, .1, 1), () => 2 + energy() * 3)
  .rotate(0, .1)
  .mult(shape(99, .15, .5).invert())
  .brightness(() => -.35 + pulse() * energy() * .15)
  .out()

// ---------- ARRANGEMENT ----------
const intro = stack(
  preload.mask("<1 0!15>"),
  pad().lpf(saw.range(400, 1600).slow(16)), rumble,
  lead.mask("<0!8 1!8>"), hats.mask("<0!4 1!12>"),
  brk.hpf(saw.range(4000, 600).slow(8)).mask("<0!8 1!8>"),
  boom().gain(.35).mask("<0!8 1!8>"),
  kick.mask("<0!12 1!4>"),
)

// letzter Schlag vor dem Drop bleibt leer
const build = stack(
  pad().lpf(saw.range(700, 2500).slow(8)), lead, stab, rumble,
  roll, riser, revcrash, hats.mask("<1!6 0!2>"),
  boom().gain(.4),
  midReese(lineA, glideA).lpf(saw.range(300, 1600).slow(8)).postgain(saw.range(.1, .22).slow(8)),
).mask("<1!7 [1@3 0]>")

const drop1 = stack(
  kick, snare, hats, brk, crash, impact,
  arrange([16, bass(lineA, glideA)], [16, bass(lineB, glideB)]),
  stab.mask("<0!8 1!8 0!8 1!8>"),
  pad(.5, 2),
)

// Breakdown: nur Pad, Pfeife, Stab und die Booms im Raum
const breakdown = stack(
  pad(1.1), lead, stab, rumble, crash.mask("<1 0!7>"),
  boom(.3).gain(.45),
  hats.gain(.5).mask("<0!4 1!4>"),
)

const build2 = stack(
  pad().lpf(saw.range(700, 2500).slow(8)), lead, stab, rumble,
  roll, riser, revcrash, brk.mask("<0!4 1!2 0!2>"),
  boom().gain(.4),
  midReese(lineB, glideB).lpf(saw.range(300, 1800).slow(8)).postgain(saw.range(.1, .22).slow(8)),
).mask("<1!7 [1@3 0]>")

// zweiter Drop: dichtere Linie zuerst, mehr Sättigung an der Reese, Ride
const drop2 = stack(
  kick, snare, hats, ride, brk, crash, impact,
  arrange([16, bass(lineB, glideB, "3.6:.27")], [16, bass(lineA, glideA, "3.6:.27")]),
  stab, lead.gain(.1), pad(.5, 2),
)

const outro = stack(
  kick.mask("<1!12 0!4>"), snare.mask("<1!12 0!4>"), hats, brk.mask("<1!8 0!8>"), crash,
  bass(lineA, glideA).mask("<1!8 0!8>"),
  pad(), lead.mask("<0!8 1!8>"), rumble,
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
