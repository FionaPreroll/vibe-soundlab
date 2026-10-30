// The code editor: a textarea over the highlighted code (src/editor.js), in jsdom.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { LARGE_CODE, createEditor } from '../src/editor.js';

let dom;
let doc;
let input;
let layer;
let code;
let errorLine;

beforeEach(() => {
  dom = new JSDOM('<div class="editor"><pre><span class="error-line" hidden></span><code></code></pre><textarea></textarea></div>');
  doc = dom.window.document;
  input = doc.querySelector('textarea');
  layer = doc.querySelector('pre');
  code = doc.querySelector('code');
  errorLine = doc.querySelector('.error-line');
});

function make(options = {}) {
  const seen = { changes: [], applied: [], stops: 0, waiting: [] };
  const editor = createEditor({
    input,
    layer,
    code,
    errorLine,
    onChange: (text) => seen.changes.push(text),
    onApply: (text) => seen.applied.push(text),
    onStop: () => seen.stops++,
    later: (fn) => (seen.waiting.push(fn), seen.waiting.length),
    cancel: () => {},
    ...options,
  });
  return { editor, seen };
}

const type = (text) => {
  input.value = text;
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};
const key = (init) => {
  const event = new dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  input.dispatchEvent(event);
  return event;
};

test('shows code with its colours, under the textarea that holds it', () => {
  const { editor } = make();
  editor.setValue('note("c3 e3")\n');
  assert.equal(input.value, 'note("c3 e3")\n');
  assert.equal(editor.value(), 'note("c3 e3")\n');
  assert.equal(code.querySelector('.tok-call').textContent, 'note');
  assert.equal(code.textContent, 'note("c3 e3")\n ', 'a last empty line keeps its height');
  assert.equal(input.style.getPropertyValue('--lines'), '2');
  const first = code.firstChild;
  editor.setValue('note("c3 e3")\n');
  assert.equal(code.firstChild, first, 'the same code is not drawn again');
});

test('typing redraws the colours and reports the change', () => {
  const { editor, seen } = make();
  editor.setValue('s("bd")');
  type('s("bd sd")');
  assert.deepEqual(seen.changes, ['s("bd sd")']);
  assert.equal(code.querySelectorAll('.tok-mini-word').length, 2);
  assert.equal(editor.mark([{ start: 3, end: 5 }]), 1, 'the marks follow the new code');
  assert.equal(code.querySelector('.playing').textContent, 'bd');
});

test('very long code shows plain while typing and its colours after a pause', () => {
  const { seen } = make();
  const long = `// ${'x'.repeat(LARGE_CODE)}\ns("bd")`;
  type(long);
  assert.ok(layer.classList.contains('stale'));
  assert.equal(seen.waiting.length, 1);
  seen.waiting[0]();
  assert.equal(layer.classList.contains('stale'), false);
  assert.match(code.textContent, /s\("bd"\)$/);
});

test('Ctrl+Enter applies, Ctrl+. stops, Tab indents, Escape leaves', () => {
  const { editor, seen } = make();
  editor.setValue('s("bd")');
  assert.equal(key({ key: 'Enter', ctrlKey: true }).defaultPrevented, true);
  key({ key: 'Enter', metaKey: true });
  assert.deepEqual(seen.applied, ['s("bd")', 's("bd")']);
  key({ key: '.', ctrlKey: true });
  assert.equal(seen.stops, 1);
  input.setSelectionRange(0, 0);
  assert.equal(key({ key: 'Tab' }).defaultPrevented, true);
  assert.equal(input.value, '  s("bd")');
  assert.deepEqual(seen.changes.at(-1), '  s("bd")', 'indenting is an edit too');
  assert.equal(key({ key: 'Tab', shiftKey: true }).defaultPrevented, false, 'Shift+Tab moves focus as usual');
  assert.equal(key({ key: 'Enter' }).defaultPrevented, false, 'Enter alone is a new line');
  input.focus();
  key({ key: 'Escape' });
  assert.notEqual(doc.activeElement, input);
});

test('Tab uses the browser\'s own insert when it has one, so undo works', () => {
  const inserted = [];
  doc.execCommand = (command, _, text) => (inserted.push([command, text]), true);
  const { editor } = make();
  editor.setValue('x');
  key({ key: 'Tab' });
  assert.deepEqual(inserted, [['insertText', '  ']]);
});

test('an error marks its line and scrolls to it; typing clears the mark', () => {
  const { editor } = make();
  editor.setValue(Array.from({ length: 200 }, (_, i) => `// line ${i + 1}`).join('\n'));
  Object.defineProperty(input, 'clientHeight', { value: 300 });
  editor.showError({ line: 120, column: 1, position: 0 });
  assert.equal(errorLine.hidden, false);
  assert.equal(errorLine.style.getPropertyValue('--line'), '119');
  assert.ok(input.scrollTop > 0, 'scrolled to the line');
  assert.match(layer.style.transform, /translate\(-?0px, -\d+(\.\d+)?px\)/);
  const scrolled = input.scrollTop;
  editor.showError({ line: 121 });
  assert.equal(input.scrollTop, scrolled, 'a line in view stays where it is');
  type(input.value + ' ');
  assert.equal(errorLine.hidden, true);
  editor.showError({ line: 2 });
  editor.showError(null);
  assert.equal(errorLine.hidden, true);
});

test('the cursor can be put at an error, and code that loads is read-only', () => {
  const { editor } = make();
  editor.setValue('abc\ndef');
  editor.focusAt(5);
  assert.equal(doc.activeElement, input);
  assert.equal(input.selectionStart, 5);
  editor.setReadOnly(true);
  assert.equal(input.readOnly, true);
  editor.setReadOnly(false);
  assert.equal(input.readOnly, false);
});

test('the colours move with the textarea when it scrolls', () => {
  make();
  input.scrollTop = 40;
  input.scrollLeft = 12;
  input.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(layer.style.transform, 'translate(-12px, -40px)');
});
