// The code panel as an editor. A transparent textarea lies over the highlighted code,
// so the code keeps its colours and the marks on the notes that sound, and can be
// changed while it plays: Ctrl+Enter (⌘+Enter) applies the change, Ctrl+. stops.

import { renderCode } from './highlight.js';

// Above this many characters, the colours catch up after a pause in typing
// (the text shows plain meanwhile), so typing stays quick in very long songs.
export const LARGE_CODE = 60000;

/**
 * `input` is the textarea, `layer` the <pre> with the highlighted `code` under it and
 * `errorLine` a marker inside the layer. `onChange(text)` hears every edit,
 * `onApply(text)` Ctrl+Enter and `onStop()` Ctrl+.
 */
export function createEditor({ input, layer, code, errorLine, onChange = () => {}, onApply = () => {}, onStop = () => {}, later = setTimeout, cancel = clearTimeout }) {
  const doc = input.ownerDocument;
  let marker = renderCode(code, '');
  let shown = null;
  let timer = null;

  // Keeps the code under the textarea where the textarea has scrolled to.
  function follow() {
    layer.style.transform = `translate(${-input.scrollLeft}px, ${-input.scrollTop}px)`;
  }

  function paint() {
    cancel(timer);
    timer = null;
    const text = input.value;
    layer.classList.remove('stale');
    if (text === shown) return;
    shown = text;
    // The <pre> would drop a last empty line, and the two would no longer line up.
    marker = renderCode(code, text.endsWith('\n') ? `${text} ` : text);
    input.style.setProperty('--lines', String(text.split('\n').length));
    follow();
  }

  function clearError() {
    errorLine.hidden = true;
  }

  // Inserts text at the cursor so that undo still works where the browser allows it.
  function insert(text) {
    const done = typeof doc.execCommand === 'function' && doc.execCommand('insertText', false, text);
    if (!done) {
      input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
      input.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
    }
  }

  input.addEventListener('input', () => {
    clearError();
    if (input.value.length > LARGE_CODE) {
      layer.classList.add('stale');
      cancel(timer);
      timer = later(paint, 300);
    } else {
      paint();
    }
    onChange(input.value);
  });
  input.addEventListener('scroll', follow);
  input.addEventListener('keydown', (event) => {
    const command = event.ctrlKey || event.metaKey;
    if (command && event.key === 'Enter') {
      event.preventDefault();
      onApply(input.value);
    } else if (command && event.key === '.') {
      event.preventDefault();
      onStop();
    } else if (event.key === 'Tab' && !event.shiftKey && !command && !event.altKey) {
      // two spaces, as the tracks are indented; Escape first to leave the editor with Tab
      event.preventDefault();
      insert('  ');
    } else if (event.key === 'Escape') {
      input.blur();
    }
  });

  return {
    /** Shows other code (another track, or the code as it was). */
    setValue(text) {
      if (text === input.value && text === shown) return;
      input.value = text;
      clearError();
      paint();
      input.scrollTop = 0;
      input.scrollLeft = 0;
      follow();
    },
    value: () => input.value,
    /** Code can't be changed while it is still loading. */
    setReadOnly(readOnly) {
      input.readOnly = readOnly;
    },
    /** Outlines the notes at these places in the code (see renderCode). */
    mark: (locations) => marker.mark(locations),
    /** Marks the line an error is on ({ line }) and scrolls it into view, or clears the mark. */
    showError(location) {
      if (!location) return clearError();
      errorLine.style.setProperty('--line', String(location.line - 1));
      errorLine.hidden = false;
      const height = Number.parseFloat(doc.defaultView.getComputedStyle(input).lineHeight) || 18.75;
      const top = (location.line - 1) * height;
      if (top < input.scrollTop || top + height > input.scrollTop + input.clientHeight) {
        input.scrollTop = Math.max(0, top - input.clientHeight / 3);
        follow();
      }
    },
    /** Puts the cursor at a position in the code. */
    focusAt(position) {
      input.focus();
      input.setSelectionRange(position, position);
    },
  };
}
