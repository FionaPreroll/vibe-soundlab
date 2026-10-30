// Guitar shapes in standard tuning and their chord diagrams (src/guitar.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { NOTE_NAMES, QUALITIES } from '../src/chords.js';
import { SHAPES, STRING_NAMES, TUNING, chordDiagram, voicing, voicingNotes } from '../src/guitar.js';

const PC = Object.fromEntries(NOTE_NAMES.common.map((name, pc) => [name, pc]));
const frets = (shape) => shape.frets.map((f) => (f === null ? 'x' : f)).join(' ');
const shapeOf = (name) => {
  const [, root, quality] = /^([A-G][#b]?)(.*)$/.exec(name);
  return voicing({ root: PC[root] ?? NOTE_NAMES.flat.indexOf(root), quality });
};

/** What a shape must sound: the chord's tones (four-note chords may leave out the fifth), root lowest. */
function checkShape(root, quality, shape, label) {
  const { intervals } = QUALITIES[quality];
  const notes = voicingNotes(shape);
  const sounding = new Set(notes.map((n) => n % 12));
  const wanted = new Set(intervals.map((i) => (root + i) % 12));
  for (const pc of sounding) assert.ok(wanted.has(pc), `${label}: ${NOTE_NAMES.common[pc]} is not in the chord`);
  for (const pc of wanted) {
    const optional = intervals.length >= 4 && (pc - root + 12) % 12 === 7;
    assert.ok(sounding.has(pc) || optional, `${label}: ${NOTE_NAMES.common[pc]} is missing`);
  }
  assert.equal(notes[0] % 12, root, `${label}: the root is the lowest note`);
  assert.ok(notes.length >= 2, `${label}: at least two strings`);
  const fretted = shape.frets.filter((f) => f !== null && f > 0);
  if (fretted.length) assert.ok(Math.max(...fretted) - Math.min(...fretted) <= 4, `${label}: fits the hand`);
}

test('standard tuning, low E to high e', () => {
  assert.deepEqual(TUNING, [40, 45, 50, 55, 59, 64]);
  assert.deepEqual(STRING_NAMES, ['E', 'A', 'D', 'G', 'B', 'e']);
});

test('every open shape plays its chord', () => {
  for (const shape of SHAPES.open) checkShape(shape.root, shape.quality, shape, `${NOTE_NAMES.common[shape.root]}${shape.quality} open`);
});

test('every movable shape plays its chord on every fret', () => {
  for (const shape of SHAPES.movable) {
    const lowest = Math.min(...shape.frets.filter((f) => f !== null));
    for (let fret = Math.max(0, -lowest); fret <= 12; fret++) {
      const root = (TUNING[shape.on] + fret) % 12;
      const placed = { frets: shape.frets.map((f) => (f === null ? null : f + fret)) };
      checkShape(root, shape.quality, placed, `${NOTE_NAMES.common[root]}${shape.quality} on string ${shape.on + 1}, fret ${fret}`);
    }
  }
});

test('every chord the player names has a shape, low on the neck', () => {
  for (let root = 0; root < 12; root++) {
    for (const quality of Object.keys(QUALITIES)) {
      const label = `${NOTE_NAMES.common[root]}${quality}`;
      const shape = voicing({ root, quality });
      assert.ok(shape, label);
      checkShape(root, quality, shape, label);
      assert.ok(Math.max(...shape.frets.filter((f) => f !== null)) <= 12, `${label}: below the 12th fret`);
    }
  }
});

test('the shapes guitarists know come first', () => {
  assert.equal(frets(shapeOf('C')), 'x 3 2 0 1 0');
  assert.equal(frets(shapeOf('G')), '3 2 0 0 0 3');
  assert.equal(frets(shapeOf('Am7')), 'x 0 2 0 1 0');
  assert.equal(frets(shapeOf('Dsus4')), 'x x 0 2 3 3');
  const f = shapeOf('F');
  assert.equal(frets(f), '1 3 3 2 1 1');
  assert.deepEqual(f.barre, { fret: 1, from: 0, to: 5 });
  assert.equal(frets(shapeOf('Bb')), 'x 1 3 3 3 1');
  assert.equal(frets(shapeOf('F#m')), '2 4 4 2 2 2');
  assert.equal(frets(shapeOf('Cm7')), 'x 3 5 3 4 3');
  assert.equal(shapeOf('C').barre, null);
  assert.equal(shapeOf('Cm6').barre, null, 'no barre over a single string');
  assert.equal(voicing(null), null);
  assert.equal(voicing({ root: 0, quality: '13#11' }), null);
});

const doc = new JSDOM('').window.document;
const parts = (svg, selector) => [...svg.querySelectorAll(selector)];

test('a diagram shows the nut, open and muted strings and where the fingers go', () => {
  const svg = chordDiagram(doc, shapeOf('C'), 'C');
  assert.equal(svg.getAttribute('aria-label'), 'C: x 3 2 0 1 0 (low E to high e)');
  assert.equal(parts(svg, '.nut').length, 1);
  assert.equal(parts(svg, '.base').length, 0);
  assert.equal(parts(svg, 'line.string').length, 6);
  assert.equal(parts(svg, 'line.fret').length, 6);
  assert.deepEqual(parts(svg, '.mute').map((n) => n.textContent), ['×']);
  assert.equal(parts(svg, '.open').length, 2);
  assert.equal(parts(svg, '.dot').length, 3);
  assert.equal(parts(svg, '.dot.root').length, 2, 'both Cs');
  assert.equal(parts(svg, '.barre').length, 0);
});

test('a diagram higher up the neck names its first fret and draws the barre', () => {
  const svg = chordDiagram(doc, shapeOf('Bbm9'), 'Bbm9');
  assert.equal(parts(svg, '.nut').length, 0);
  assert.equal(parts(svg, '.base')[0].textContent, '6fr');
  assert.equal(parts(svg, '.barre').length, 1);
  // the barre covers four strings; the root on the low E and two fingers at the 8th fret get dots
  assert.equal(parts(svg, '.dot').length, 3);
  assert.equal(parts(svg, '.dot.root').length, 1);
  const open = chordDiagram(doc, { frets: [0, 2, 2, 1, 0, 0], barre: null, root: 4 });
  assert.equal(parts(open, '.open.root').length, 2, 'open E strings are roots');
  assert.equal(open.getAttribute('aria-label'), '0 2 2 1 0 0 (low E to high e)');
});
