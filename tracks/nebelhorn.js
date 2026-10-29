// @title Nebelhorn
// @style Deep roller
// @bpm 174
// @key E minor
// @bars 112
// @order 2
// @about A distorted foghorn bass calls across a rolling beat and a cold, wide pad.
// ============================================================
//  NEBELHORN — Deep Roller · 174 BPM · E-Moll
//  strudel.cc öffnen → Code einfügen → Strg+Enter = Play · Strg+. = Stop
//
//  Orbits: 1 Drums · 2 Bass · 3 Pad · 4 Snare · 6 Ruf · 7 Atmo
// ============================================================

samples('github:tidalcycles/dirt-samples')
const bpm = 174
const bar = 240 / bpm
setcpm(bpm / 4)

// ---------- HARMONIE ----------
// Em9 (4 Takte) → Cmaj9 → B7sus4. Lange auf einem Akkord bleiben macht den
// Roller hypnotisch; das B7sus4 zieht zurück zum E, ohne Dis (bleibt dunkel).
const chords = "<[e3,d4,g4,b4,fs5] [e3,d4,g4,b4,fs5] [c3,b3,e4,g4,d5] [b2,a3,e4,fs4,b4]>/2"
const air = "<[b5,e6] [b5,e6] [g5,d6] [fs5,b5]>/2"

// ---------- NEBELHORN-BASS ----------
// Lange Töne, die von unten in den Ton rutschen (penv = Halbtöne darunter).
// glide = Halbtöne, aus denen die Note hineinrutscht
const line = `<[e1@16] [e1@10 e1@3 g1@3]
               [e1@16] [e1@6 ~@2 d2@4 b1@4]
               [c2@16] [c2@10 c2@3 e2@3]
               [b1@16] [b1@6 ~@2 d2@4 fs1@4]>`
const glide = `<[2@16] [0@10 0@3 3@3]
                [2@16] [0@6 ~@2 2@4 -3@4]
                [2@16] [0@10 0@3 4@3]
                [2@16] [0@6 ~@2 3@4 -8@4]>`

// Das Horn: zwei leicht verstimmte Saws → Formant "o" → harte Verzerrung →
// Tiefpass, der sich pro Takt langsam öffnet. Unter 140 Hz ist Platz für den Sub.
const horn = (drive = "4:.3") => note(line)
  .penv(glide).pattack(.25)
  .s("supersaw").unison(2).detune(.12).spread(.2)
  .attack(.04).sustain(1).release(.12)
  .vowel("o")
  .distort(drive)
  .lpf(sine.range(500, 1600).segment(16)).lpq(5)
  .hpf(140)
  .postgain(.33).orbit(2)

const sub = note(line)
  .penv(glide).pattack(.25)
  .s("sine").attack(.03).sustain(1).release(.08)
  .gain(.6).orbit(2)

const bass = (drive) => stack(horn(drive), sub)

// ---------- PAD ----------
const padBody = note(chords)
  .s("supersaw").unison(6).detune(.35).spread(.7)
  .attack(1.6).decay(1).sustain(.7).release(4)
  .lpf(sine.range(500, 1800).slow(32)).lpq(4).hpf(150)
  .room(.6).roomsize(9).roomlp(3500).orbit(3)

const padAir = note(air)
  .s("supersaw").unison(4).detune(.08).spread(1)
  .attack(3).sustain(1).release(6)
  .lpf(6000).hpf(1600)
  .room(.95).roomsize(9).roomlp(3500).orbit(3)

const pad = (level = 1) => stack(padBody.gain(.13 * level), padAir.gain(.05 * level))

// ---------- RUF ----------
// ferne Hornmelodie aus Akkordtönen, mit Vibrato, viel Delay und Hall
const call = note(`<[b4@6 e5@2] [d5@8] [b4@6 e5@2] [fs5@8]
                   [g5@6 e5@2] [d5@8] [fs5@6 e5@2] [b4@8]>`)
  .s("triangle").vib(4.5).vibmod(.12)
  .attack(.15).decay(.5).sustain(.5).release(1.2)
  .lpf(1800).gain(.22).pan(.62)
  .delay(.5).delaytime(bar * 3/8).delayfeedback(.55)
  .room(.8).roomsize(7).orbit(6)

// ---------- DRUMS ----------
// Rolling: Kick auf 1 und 2+ (16tel 11), Snare auf 2 und 4, dazwischen geshuffelte Hats
const kick = s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~").bank("RolandTR909").n(3)
  .lpf(2800).shape(.3).postgain(.4)
  .duckorbit(3).duckdepth(.35).duckattack(.2)

const snare = stack(
  s("sd").beat("4,12", 16).bank("RolandTR909").n(9),
  s("rim").beat("4,12", 16).bank("RolandTR909").gain(.4),
).shape(.45).postgain(.26).room(.15).roomsize(2).orbit(4)

const hats = s("hh*16").bank("RolandTR909")
  .gain("[.12 .22 .3 .22]*4").hpf(6500).late("[0 .012]*8")

const oh = s("[~ oh]*4").bank("RolandTR909").gain(.12).hpf(5000).cut(3)

const perc = s("~ ~ ~ perc ~ ~ perc ~ ~ ~ ~ ~ ~ perc ~ ~").bank("RolandTR808")
  .gain(.18).hpf(1500).pan(rand).sometimesBy(.25, x => x.speed(1.5))

const brk = s("breaks165").fit().hpf(800).gain(.22)

const crash = s("<cr ~!7>").bank("RolandTR909").n(3).hpf(300).gain(.24)

// ---------- ATMO ----------
// Nebel: tiefes, gefiltertes Rauschen, das langsam an- und abschwillt
const fog = s("brown").slow(8)
  .lpf(sine.range(300, 900).slow(16)).attack(4).release(4)
  .gain(.18).room(.7).roomsize(9).orbit(7)

const riser = s("white").slow(8)
  .hpf(200).hpenv(5.5).hpattack(bar * 8)
  .attack(bar * 7.3).release(.05).gain(.2)

const preload = stack(
  s("bd:3 sd:9 rim hh oh cr:3").bank("RolandTR909"), s("perc").bank("RolandTR808"), s("breaks165"),
).gain(0)

// ---------- ARRANGEMENT ----------
const intro = stack(
  preload.mask("<1 0!15>"),
  pad().lpf(saw.range(350, 1500).slow(16)), fog,
  call.mask("<0!8 1!8>"),
  hats.mask("<0!8 1!8>"), perc.mask("<0!12 1!4>"),
  sub.mask("<0!12 1!4>"),
)

const build = stack(
  pad(), fog, call, riser, hats, perc,
  horn().lpf(saw.range(300, 1600).slow(8)).postgain(saw.range(.15, .33).slow(8)),
  s("sd*4 sd*4 sd*8 sd*8 sd*16 sd*16 sd*16 [[sd*16]@3 ~]").bank("RolandTR909").n(9).slow(8)
    .gain(saw.range(.1, .4).slow(8)).hpf(saw.range(150, 1200).slow(8)),
).mask("<1!7 [1@3 0]>")

const drop1 = stack(
  kick, snare, hats, oh, perc, crash,
  bass(), pad(.6), fog.gain(.08),
  call.gain(.14).mask("<0!16 1!16>"),
)

const breakdown = stack(
  pad(1.15), fog, call, hats.gain(.5).mask("<0!4 1!4>"),
  sub.gain(.45),
)

const build2 = stack(
  pad().lpf(saw.range(600, 2400).slow(8)), call, riser, hats, perc,
  horn("4.5:.28").lpf(saw.range(300, 1800).slow(8)).postgain(saw.range(.15, .33).slow(8)),
  brk.mask("<0!4 1!4>"),
).mask("<1!7 [1@3 0]>")

// zweiter Drop: mehr Zerre am Horn, Break-Layer, der Ruf durchgehend
const drop2 = stack(
  kick, snare, hats, oh, perc, brk, crash,
  bass("4.8:.27"), pad(.6), call.gain(.14), fog.gain(.08),
)

const outro = stack(
  pad(), fog, call.mask("<1!8 0!8>"),
  kick.mask("<1!8 0!8>"), snare.mask("<1!8 0!8>"), hats.mask("<1!12 0!4>"),
  sub.mask("<1!8 0!8>"),
)

arrange(
  [16, intro],
  [8,  build],
  [32, drop1],
  [8,  breakdown],
  [8,  build2],
  [32, drop2],
  [8,  outro],
)
