// @title Polarlicht
// @style Ambient jungle
// @bpm 170
// @key D minor
// @bars 128
// @order 4
// @about Chopped amen and a deep 808 sub under a choir pad, with a halftime breakdown.
// ============================================================
//  POLARLICHT — Ambient Jungle · 170 BPM · D-Moll (dorisch gefärbt)
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  Orbits: 1 Drums · 2 Bass · 3 Pad · 4 Snare · 6 Pluck · 7 Atmo
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 170
const bar = 240 / bpm
setcpm(bpm / 4)

// ---------- HARMONIE ----------
// Dm9 → Bbmaj9 → Gm9 → A7sus4, je 2 Takte. Das A7sus4 am Ende hat kein Cis:
// es zieht zurück zum Dm, ohne die Stimmung aufzuhellen.
const chords = "<[d3,c4,f4,a4,e5] [bb2,a3,d4,f4,c5] [g2,f3,bb3,d4,a4] [a2,g3,d4,e4,a4]>/2"
const air = "<[a5,d6] [f5,c6] [a5,d6] [a5,e6]>/2"

// ---------- BASS ----------
// tiefer 808-Sub: kurzer Pitch-Drop am Anfang jeder Note gibt den Kick-artigen Punch
const line = `<[d1@12 d2@2 d1@2] [d1@6 ~@4 a1@6]
               [bb1@12 bb1@4] [bb1@6 ~@2 f1@8]
               [g1@12 g1@4] [g1@6 ~@4 d1@6]
               [a1@12 a1@2 g1@2] [a1@6 ~@2 e1@4 c2@4]>`

const sub808 = note(line).s("sine")
  .penv(7).pattack(0).pdecay(.07)
  .attack(.005).decay(.5).sustain(.8).release(.15)
  .distort("0.6:.8").gain(.7).orbit(2)

// eine Oktave höher, leise und angezerrt: damit man den Bass auch auf kleinen Boxen hört
const bassMid = note(line).add(note(12)).s("triangle")
  .attack(.005).sustain(.7).release(.1)
  .lpf(900).distort("2:.4").postgain(.14).orbit(2)

const bass = (level = 1) => stack(sub808.gain(.7 * level), bassMid.postgain(.14 * level))

// ---------- PAD ----------
const padBody = note(chords)
  .s("supersaw").unison(6).detune(.28).spread(.6)
  .attack(1.5).decay(1).sustain(.75).release(4)
  .lpf(sine.range(600, 2000).slow(16)).lpq(3).hpf(120)
  .room(.55).roomsize(8).roomlp(4500).orbit(3)

// Chor: dieselben Töne als Saw durch den "o"-Formant, klingt nach Stimmen
const padChoir = note(chords)
  .s("sawtooth").vowel("<o o a o>/2")
  .attack(2).sustain(1).release(4)
  .lpf(2400).hpf(200)
  .room(.7).roomsize(8).roomlp(4500).orbit(3)

const padAir = note(air)
  .s("supersaw").unison(4).detune(.1).spread(1)
  .attack(3).sustain(1).release(6)
  .lpf(sine.range(3500, 7000).slow(24)).hpf(1500)
  .room(.95).roomsize(8).roomlp(4500).orbit(3)

const pad = (level = 1) => stack(
  padBody.gain(.12 * level), padChoir.gain(.09 * level), padAir.gain(.06 * level))

// ---------- PLUCK ----------
// Achtel-Arp aus Akkordtönen, die über dem Pad liegen (bei Gm9 kein Bb über dem A)
const pluckNotes = `<[d5 e5 a5 e5 c6 a5 e5 a5]!2
                     [d5 f5 a5 f5 c6 a5 f5 a5]!2
                     [d5 f5 a5 f5 d6 a5 g5 a5]!2
                     [d5 e5 a5 e5 g5 a5 e5 a5]!2>`
const pluck = note(pluckNotes)
  .s("square").lpf(2200).lpenv(3).lpdecay(.12).lpsustain(0)
  .attack(.002).decay(.16).sustain(0).release(.1)
  .gain(.14).pan(sine.range(.3, .7).slow(4))
  .delay(.4).delaytime(bar * 3/16).delayfeedback(.55)
  .room(.5).roomsize(6).orbit(6)

// ---------- DRUMS ----------
// Amen: die 32 Schnipsel von "amencutup" sind unterschiedlich lang, weil sie an den
// Schlägen geschnitten sind. Jeder bekommt deshalb genau seine Originallänge
// (Gewicht = Länge in 16teln), so ergeben sie lückenlos den echten Break.
// speed passt die Originalgeschwindigkeit (1,61 s pro Takt) an 170 BPM an.
const amenBars = [
  "0@2.68 1@2.80 2@2.91 3@1.40 4@1.27 5@1.14 6@1.37 7@1.56 8@1.01",
  "9@2.88 10@2.67 11@2.79 12@2.67 13@2.78 14@1.36 15@1.27",
  "16@1.29 17@1.16 18@2.88 19@2.57 20@2.86 21@1.43 22@1.12 23@1.42 24@1.15",
  "25@2.83 26@1.38 27@1.43 28@1.09 29@1.19 30@5.49 31@2.14",
]
const amenSpeed = 1.6105 / bar
// Edits nur taktweise: ganze Takte des Breaks werden umgestellt, nichts zerhackt
const amen = (...bars) => n(cat(...bars.map(i => amenBars[i])))
  .s("amencutup").speed(amenSpeed).cut(1).hpf(90).shape(.15).postgain(.55)

const jungle = amen(0, 1, 2, 3)
const jungle2 = amen(0, 1, 0, 3, 2, 1, 2, 3)

// Der Amen ist das Schlagzeug. Darunter nur eine Sub-Kick auf der Eins, wo auch der
// Amen seine Kick hat (sonst flammt es). Sie gibt Druck und duckt das Pad.
const kick = s("bd").bank("RolandTR909").n(2)
  .lpf(900).postgain(.3)
  .duckorbit(3).duckdepth(.3).duckattack(.4)

const ride = s("rd*8").bank("RolandTR909").n(1).gain("[.08 .14]*4").hpf(3000)

const crash = s("<cr ~!7>").bank("RolandTR909").n(1).hpf(300).gain(.25)

// Halftime: Kick auf der 1, Snare auf der 3, die Snare im großen Raum
const htKick = s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~").bank("RolandTR909").n(2)
  .lpf(2000).postgain(.35).duckorbit(3).duckdepth(.3).duckattack(.4)
const htSnare = s("~ sd").bank("RolandTR909").n(6)
  .postgain(.24).room(.25).roomsize(3).orbit(4)

// ---------- ATMO ----------
// Wind: rosa Rauschen durch einen wandernden Bandpass
const wind = s("pink").slow(4)
  .bpf(sine.range(400, 2400).slow(16)).bpq(3)
  .attack(2).release(2).gain(.12).pan(sine.range(.2, .8).slow(8))
  .room(.6).roomsize(8).orbit(7)

const riser = s("white").slow(8)
  .hpf(300).hpenv(5).hpattack(bar * 8)
  .attack(bar * 7.5).release(.05).gain(.2)

const preload = stack(
  n(run(32)).s("amencutup"), s("bd:2 sd:6 rd:1 cr:1").bank("RolandTR909"),
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
// Polarlicht: grüne Vorhänge, die über den Himmel wehen
osc(40, .02, 0)
  .modulate(noise(1.5, .05), .3)
  .mult(shape(2, .45, .5).modulate(noise(.8, .05), .5))
  .color(.3, 1, .6)
  .add(noise(1, .02).color(.5, 0, .8), .15)
  .brightness(() => -.25 + energy() * .1 + pulse() * energy() * .08)
  .out()

// ---------- ARRANGEMENT ----------
const intro = stack(
  preload.mask("<1 0!15>"),
  pad().lpf(saw.range(400, 1800).slow(16)), wind,
  pluck.lpf(saw.range(500, 2200).slow(16)).mask("<0!8 1!8>"),
  sub808.gain(.5).mask("<0!12 1!4>"),
)

const build = stack(
  pad(), wind, pluck, riser,
  jungle.hpf(saw.range(2500, 200).slow(8)).mask("<0!2 1!6>"),
  bass(.7).mask("<0!4 1!4>"),
).mask("<1!7 [1@3 0]>")

const drop1 = stack(
  jungle, kick, crash, wind.gain(.06),
  bass(), pad(.75), pluck.gain(.1).mask("<0!16 1!16>"),
)

// Halftime-Breakdown: nur Kick, eine Snare im Raum und die volle Fläche
const breakdown = stack(
  pad(1.2), wind, pluck.mask("<0!4 1!12>"),
  htKick.mask("<0!8 1!8>"), htSnare.mask("<0!8 1!8>"),
  sub808.gain(.55).mask("<0!8 1!8>"),
)

const build2 = stack(
  pad().lpf(saw.range(700, 2800).slow(8)), wind, pluck, riser,
  jungle2.mask("<0!4 1!4>").hpf(saw.range(1800, 150).slow(8)),
  bass(.8).mask("<0!4 1!4>"),
).mask("<1!7 [1@3 0]>")

const drop2 = stack(
  jungle2, kick, ride, crash,
  bass(), pad(.75), pluck.gain(.1),
).lastOf(8, x => x.mask("[1 1 1 [1 0]]"))

const outro = stack(
  pad(), wind, pluck.mask("<1!12 0!4>"),
  jungle.mask("<1!8 0!8>"), kick.mask("<1!8 0!8>"),
  sub808.mask("<1!8 0!8>"),
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
