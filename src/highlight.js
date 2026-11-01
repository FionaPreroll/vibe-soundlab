// Syntax highlighting for Strudel code, and live marks on the parts of
// mini-notation that are playing, like the strudel.cc editor shows them.
//
// The tokenizer knows just enough JavaScript for track files. Double-quoted and
// backtick strings are mini-notation in Strudel; their atoms ("f1", "bd", "12")
// become tokens of their own, so a playing note can be marked exactly.

const KEYWORDS = new Set([
  'async', 'await', 'break', 'case', 'const', 'continue', 'default', 'do', 'else', 'export', 'for', 'function', 'if',
  'import', 'in', 'let', 'new', 'of', 'return', 'switch', 'this', 'typeof', 'var', 'while',
]);
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
const DECLARE = new Set(['const', 'let', 'var', 'function']);

// Characters that structure mini-notation rather than name a sound or a value.
const MINI_OPERATORS = '~@!*/:<>[]{}(),|?_ .^%';
const MINI_NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

function miniTokens(text, offset) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const start = i;
    if (/\s/.test(text[i])) {
      while (i < text.length && /\s/.test(text[i])) i++;
      tokens.push({ type: 'space', start: offset + start, end: offset + i });
      continue;
    }
    // "." between digits belongs to a number, "-" in front of one too
    const isOperator = (j) => MINI_OPERATORS.includes(text[j]) && !(text[j] === '.' && /\d/.test(text[j + 1] ?? ''));
    if (isOperator(i) && !(text[i] === '-' && /\d/.test(text[i + 1] ?? ''))) {
      tokens.push({ type: 'mini-op', start: offset + i, end: offset + i + 1 });
      i++;
      continue;
    }
    i++;
    while (i < text.length && !/\s/.test(text[i]) && !isOperator(i)) i++;
    const word = text.slice(start, i);
    tokens.push({ type: MINI_NUMBER.test(word) ? 'mini-number' : 'mini-word', start: offset + start, end: offset + i });
  }
  return tokens;
}

// Where the string opened at `start` ends: the index of its closing quote, or,
// for a string that is never closed, the end of its line (or of the code).
function closeQuote(code, start) {
  const quote = code[start];
  let i = start + 1;
  while (i < code.length && code[i] !== quote) {
    if (quote !== '`' && code[i] === '\n') return { close: i, closed: false };
    if (code[i] === '\\') i++;
    i++;
  }
  return i < code.length ? { close: i, closed: true } : { close: code.length, closed: false };
}

/**
 * Splits code into tokens { type, start, end } that cover every character.
 * Types: comment, string, mini-quote, mini-word, mini-number, mini-op, number,
 * keyword, literal, def, call, method, property, name, operator, space.
 */
export function tokenize(code) {
  const tokens = [];
  const push = (type, start, end) => tokens.push({ type, start, end });
  // the last token that is not a space or comment, to tell methods from names
  let previous = null;
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    const start = i;
    if (/\s/.test(c)) {
      while (i < code.length && /\s/.test(code[i])) i++;
      push('space', start, i);
      continue;
    }
    if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i++;
      push('comment', start, i);
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 2;
      push('comment', start, i);
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const { close, closed } = closeQuote(code, i);
      i = closed ? close + 1 : close;
      const body = code.slice(start + 1, close);
      if (c === "'" || (c === '`' && body.includes('${'))) {
        push('string', start, i);
      } else {
        // mini-notation: quotes, then the atoms inside
        push('mini-quote', start, start + 1);
        tokens.push(...miniTokens(body, start + 1));
        if (closed) push('mini-quote', close, i);
      }
      previous = tokens.at(-1);
      continue;
    }
    if (/\d/.test(c) || (c === '.' && /\d/.test(code[i + 1] ?? ''))) {
      const match = code.slice(i).match(/^(0x[\da-f]+|\d*\.?\d+(e[+-]?\d+)?)/i);
      i += match[0].length;
      push('number', start, i);
      previous = tokens.at(-1);
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      while (i < code.length && /[\w$]/.test(code[i])) i++;
      const word = code.slice(start, i);
      const next = code.slice(i).match(/^\s*(\S)/)?.[1];
      const afterDot = previous?.type === 'operator' && code.slice(previous.start, previous.end) === '.';
      let type = 'name';
      if (KEYWORDS.has(word) && !afterDot) type = 'keyword';
      else if (LITERALS.has(word) && !afterDot) type = 'literal';
      else if (previous?.type === 'keyword' && DECLARE.has(code.slice(previous.start, previous.end))) type = 'def';
      else if (afterDot) type = next === '(' ? 'method' : 'property';
      else if (next === '(') type = 'call';
      push(type, start, i);
      previous = tokens.at(-1);
      continue;
    }
    i += code.startsWith('=>', i) ? 2 : 1;
    push('operator', start, i);
    previous = tokens.at(-1);
  }
  return tokens;
}

/**
 * Renders highlighted code into `container` (a <code> element) and returns a
 * marker: mark(locations) outlines the tokens that overlap any of the given
 * { start, end } ranges and clears the marks it set before.
 */
export function renderCode(container, code) {
  const doc = container.ownerDocument;
  const tokens = tokenize(code);
  const nodes = tokens.map(({ type, start, end }) => {
    const text = code.slice(start, end);
    if (type === 'space') return doc.createTextNode(text);
    const span = doc.createElement('span');
    span.className = `tok-${type}`;
    span.textContent = text;
    return span;
  });
  container.replaceChildren(...nodes);

  // Only mini-notation atoms can be marked; keep them sorted by start for lookups.
  const atoms = tokens.flatMap((t, i) => (t.type === 'mini-word' || t.type === 'mini-number' ? [{ ...t, node: nodes[i] }] : []));
  let marked = new Set();

  function atomsIn({ start, end }) {
    let lo = 0;
    let hi = atoms.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (atoms[mid].end <= start) lo = mid + 1;
      else hi = mid;
    }
    const found = [];
    for (let i = lo; i < atoms.length && atoms[i].start < end; i++) found.push(atoms[i].node);
    return found;
  }

  return {
    atoms: atoms.length,
    mark(locations = []) {
      const next = new Set();
      for (const location of locations) for (const node of atomsIn(location)) next.add(node);
      for (const node of marked) if (!next.has(node)) node.classList.remove('playing');
      for (const node of next) if (!marked.has(node)) node.classList.add('playing');
      marked = next;
      return next.size;
    },
  };
}
