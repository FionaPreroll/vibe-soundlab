// Guitar shapes for the chords in chords.js, in standard tuning (E A D G B E),
// and chord diagrams for them.
//
// Open chords come first where one exists (C, Am7, Dsus4 …); every other chord gets
// a movable barre shape with its root on the low E or the A string, as low on the
// neck as it fits.

import { QUALITIES } from './chords.js';

/** The open strings from low E to high e, as MIDI notes (E2 A2 D3 G3 B3 E4). */
export const TUNING = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

const PC = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

// Open chords, low E to high e; x = string not played.
const OPEN = [
  ['C', '', 'x32010'], ['A', '', 'x02220'], ['G', '', '320003'], ['E', '', '022100'], ['D', '', 'xx0232'],
  ['A', 'm', 'x02210'], ['E', 'm', '022000'], ['D', 'm', 'xx0231'],
  ['E', '5', '022xxx'], ['A', '5', 'x022xx'], ['D', '5', 'xx023x'],
  ['C', '7', 'x32310'], ['A', '7', 'x02020'], ['G', '7', '320001'], ['E', '7', '020100'], ['D', '7', 'xx0212'], ['B', '7', 'x21202'],
  ['C', 'maj7', 'x32000'], ['A', 'maj7', 'x02120'], ['G', 'maj7', '320002'], ['E', 'maj7', '021100'], ['D', 'maj7', 'xx0222'], ['F', 'maj7', 'xx3210'],
  ['A', 'm7', 'x02010'], ['E', 'm7', '022030'], ['D', 'm7', 'xx0211'], ['B', 'm7', 'x20202'],
  ['A', 'sus2', 'x02200'], ['D', 'sus2', 'xx0230'],
  ['A', 'sus4', 'x02230'], ['D', 'sus4', 'xx0233'], ['E', 'sus4', '022200'],
  ['A', '7sus4', 'x02030'], ['E', '7sus4', '020200'],
  ['A', '6', 'x02222'], ['C', '6', 'x32210'], ['D', '6', 'xx0202'], ['E', '6', '022120'], ['G', '6', '320000'],
  ['A', 'm6', 'x02212'], ['D', 'm6', 'xx0201'], ['E', 'm6', '022020'],
  ['C', 'add9', 'x32030'], ['E', 'add9', '024100'],
  ['E', '9', '020102'], ['E', 'm9', '022032'], ['E', 'maj9', '021102'],
  ['E', 'dim', '0120xx'], ['E', 'dim7', '012020'], ['E', 'm7b5', '010030'], ['E', 'aug', '032110'],
].map(([root, quality, frets]) => ({ root: PC[root], quality, frets: [...frets].map((f) => (f === 'x' ? null : Number(f))) }));

// Movable shapes: frets relative to the root on string `on` (0 = low E, 1 = A, 2 = D),
// null = string not played. `barre` shapes lay the index finger across the strings.
const MOVABLE = [
  { quality: '', on: 0, frets: [0, 2, 2, 1, 0, 0], barre: true },
  { quality: 'm', on: 0, frets: [0, 2, 2, 0, 0, 0], barre: true },
  { quality: '7', on: 0, frets: [0, 2, 0, 1, 0, 0], barre: true },
  { quality: 'm7', on: 0, frets: [0, 2, 0, 0, 0, 0], barre: true },
  { quality: 'maj7', on: 0, frets: [0, null, 1, 1, 0, null] },
  { quality: 'sus4', on: 0, frets: [0, 2, 2, 2, 0, 0], barre: true },
  { quality: '7sus4', on: 0, frets: [0, 2, 0, 2, 0, 0], barre: true },
  { quality: '5', on: 0, frets: [0, 2, 2, null, null, null] },
  { quality: 'm7b5', on: 0, frets: [0, null, 0, 0, -1, null] },
  { quality: 'dim7', on: 0, frets: [0, null, -1, 0, -1, null] },
  { quality: '9', on: 0, frets: [0, 2, 0, 1, 0, 2], barre: true },
  { quality: 'm9', on: 0, frets: [0, 2, 0, 0, 0, 2], barre: true },
  { quality: '6', on: 0, frets: [0, null, -1, 1, 0, null] },
  { quality: 'm6', on: 0, frets: [0, null, -1, 0, 0, null] },
  { quality: 'dim', on: 0, frets: [0, null, 2, 0, -1, null] },
  { quality: 'aug', on: 0, frets: [0, null, 2, 1, 1, 0] },
  { quality: 'add9', on: 0, frets: [0, null, 2, 1, 0, 2], barre: true },
  { quality: 'maj9', on: 0, frets: [0, -1, 1, -1, null, null] },
  { quality: '', on: 1, frets: [null, 0, 2, 2, 2, 0], barre: true },
  { quality: 'm', on: 1, frets: [null, 0, 2, 2, 1, 0], barre: true },
  { quality: '7', on: 1, frets: [null, 0, 2, 0, 2, 0], barre: true },
  { quality: 'm7', on: 1, frets: [null, 0, 2, 0, 1, 0], barre: true },
  { quality: 'maj7', on: 1, frets: [null, 0, 2, 1, 2, 0], barre: true },
  { quality: 'sus2', on: 1, frets: [null, 0, 2, 2, 0, 0], barre: true },
  { quality: 'sus4', on: 1, frets: [null, 0, 2, 2, 3, 0], barre: true },
  { quality: '7sus4', on: 1, frets: [null, 0, 2, 0, 3, 0], barre: true },
  { quality: '5', on: 1, frets: [null, 0, 2, 2, null, null] },
  { quality: '6', on: 1, frets: [null, 0, 2, 2, 2, 2] },
  { quality: 'm6', on: 1, frets: [null, 0, 2, 2, 1, 2] },
  { quality: 'dim', on: 1, frets: [null, 0, 1, 2, 1, null] },
  { quality: 'dim7', on: 1, frets: [null, 0, 1, 2, 1, 2] },
  { quality: 'm7b5', on: 1, frets: [null, 0, 1, 0, 1, null] },
  { quality: 'aug', on: 1, frets: [null, 0, 3, 2, 2, 1] },
  { quality: 'add9', on: 1, frets: [null, 0, 2, 4, 2, 0], barre: true },
  { quality: 'add9', on: 1, frets: [null, 0, -1, -3, 0, null] },
  { quality: '9', on: 1, frets: [null, 0, -1, 0, 0, 0] },
  { quality: 'm9', on: 1, frets: [null, 0, -2, 0, 0, null] },
  { quality: 'maj9', on: 1, frets: [null, 0, -1, 1, 0, null] },
  // root on the D string, for chords that sit high on the other two
  { quality: '', on: 2, frets: [null, null, 0, 2, 3, 2] },
  { quality: 'm', on: 2, frets: [null, null, 0, 2, 3, 1] },
  { quality: '7', on: 2, frets: [null, null, 0, 2, 1, 2] },
  { quality: 'maj7', on: 2, frets: [null, null, 0, 2, 2, 2] },
  { quality: 'm7', on: 2, frets: [null, null, 0, 2, 1, 1] },
  { quality: 'sus2', on: 2, frets: [null, null, 0, 2, 3, 0] },
  { quality: 'sus4', on: 2, frets: [null, null, 0, 2, 3, 3] },
];

/** Every shape the player knows, open and movable, for the tests. */
export const SHAPES = { open: OPEN, movable: MOVABLE };

const span = (frets) => {
  const fretted = frets.filter((f) => f !== null && f > 0);
  return fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
};

/**
 * A way to play the chord { root, quality }: { frets, barre, root } with one fret per
 * string from low E (null = not played, 0 = open), the barre as { fret, from, to }
 * strings, and the root's pitch class. Null for a chord there is no shape for.
 */
export function voicing(chord) {
  if (!chord || !(chord.quality in QUALITIES)) return null;
  const open = OPEN.find((shape) => shape.root === chord.root && shape.quality === chord.quality);
  if (open) return { frets: open.frets, barre: null, root: chord.root };
  let best = null;
  for (const shape of MOVABLE.filter((s) => s.quality === chord.quality)) {
    const lowest = Math.min(...shape.frets.filter((f) => f !== null));
    let fret = (((chord.root - TUNING[shape.on]) % 12) + 12) % 12;
    // shapes reaching below the root need room for it
    while (fret + lowest < 0) fret += 12;
    const frets = shape.frets.map((f) => (f === null ? null : f + fret));
    // a stretch over five frets is hard; a barre a little harder than single fingers
    const cost = fret + (span(frets) > 3 ? 8 : 0) + (shape.barre ? 0.5 : 0);
    if (best === null || cost < best.cost) best = { cost, frets, shape, fret };
  }
  if (best === null) return null;
  const strings = best.frets.map((f, i) => (f === best.fret ? i : -1)).filter((i) => i >= 0);
  const barre = best.shape.barre && best.fret > 0 && strings.length > 1 ? { fret: best.fret, from: strings[0], to: strings.at(-1) } : null;
  return { frets: best.frets, barre, root: chord.root };
}

/** The notes a voicing sounds, low to high, as MIDI numbers. */
export const voicingNotes = ({ frets }) => frets.flatMap((f, i) => (f === null ? [] : [TUNING[i] + f]));

const SVG = 'http://www.w3.org/2000/svg';
const FRETS_SHOWN = 5;

/**
 * Draws a chord diagram: strings upright from low E (left) to high e, the nut or the
 * first fret shown on top, × and ○ over strings not played or played open, dots
 * where the fingers go (the root's dots marked) and the barre as a bar.
 */
export function chordDiagram(doc, shape, label = '') {
  const svg = doc.createElementNS(SVG, 'svg');
  const node = (tag, attrs, parent = svg) => {
    const el = doc.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    parent.append(el);
    return el;
  };
  svg.setAttribute('viewBox', '0 0 88 116');
  svg.setAttribute('class', 'diagram');
  svg.setAttribute('role', 'img');
  const frets = shape.frets.map((f) => (f === null ? 'x' : String(f))).join(' ');
  svg.setAttribute('aria-label', `${label}: ${frets} (low E to high e)`.trim().replace(/^: /, ''));
  const fretted = shape.frets.filter((f) => f !== null && f > 0);
  const top = fretted.length && Math.max(...fretted) > FRETS_SHOWN ? Math.min(...fretted) : 1;
  const x = (string) => 25 + string * 11;
  const y = (fret) => 22 + fret * 17;
  for (let fret = 0; fret <= FRETS_SHOWN; fret++) node('line', { x1: x(0), x2: x(5), y1: y(fret), y2: y(fret), class: 'fret' });
  for (let string = 0; string < 6; string++) node('line', { x1: x(string), x2: x(string), y1: y(0), y2: y(FRETS_SHOWN), class: 'string' });
  if (top === 1) node('rect', { x: x(0) - 1, y: y(0) - 3, width: x(5) - x(0) + 2, height: 4, class: 'nut' });
  else node('text', { x: x(0) - 5, y: y(0.5) + 4, class: 'base', 'text-anchor': 'end' }).textContent = `${top}fr`;
  const middle = (fret) => y(fret - top + 0.5);
  if (shape.barre) {
    node('rect', { x: x(shape.barre.from) - 5, y: middle(shape.barre.fret) - 5, width: x(shape.barre.to) - x(shape.barre.from) + 10, height: 10, rx: 5, class: 'barre' });
  }
  shape.frets.forEach((fret, string) => {
    if (fret === null) {
      node('text', { x: x(string), y: 13, class: 'mute', 'text-anchor': 'middle' }).textContent = '×';
    } else if (fret === 0) {
      node('circle', { cx: x(string), cy: 9, r: 3.5, class: shape.root === TUNING[string] % 12 ? 'open root' : 'open' });
    } else if (!(shape.barre && fret === shape.barre.fret && string > shape.barre.from && string <= shape.barre.to)) {
      node('circle', { cx: x(string), cy: middle(fret), r: 5, class: (TUNING[string] + fret) % 12 === shape.root ? 'dot root' : 'dot' });
    }
  });
  return svg;
}
