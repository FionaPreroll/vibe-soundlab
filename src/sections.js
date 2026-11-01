// Reads the arrangement a track ends with, so the player can show its parts
// on the progress bar and jump to them:
//
//   arrange(
//     [16, intro],
//     [8,  build],
//     [32, drop1],
//   )

/** "drop1" → "Drop 1", "build_2" → "Build 2", "breakdown" → "Breakdown" */
export function sectionLabel(name) {
  const words = String(name)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/[_$]+/g, ' ')
    .trim();
  if (!words) return 'Part';
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

const OPEN = { '(': ')', '[': ']', '{': '}' };

// When a string or comment starts at `i`, returns the index of its last character
// (-1 if it never ends); otherwise returns `i` unchanged.
function skipLiteral(text, i) {
  const c = text[i];
  if (c === '"' || c === "'" || c === '`') return text.indexOf(c, i + 1);
  if (c === '/' && text[i + 1] === '/') {
    const end = text.indexOf('\n', i);
    return end === -1 ? text.length - 1 : end;
  }
  if (c === '/' && text[i + 1] === '*') {
    const end = text.indexOf('*/', i + 2);
    return end === -1 ? -1 : end + 1;
  }
  return i;
}

// Splits `text` at top-level commas, skipping strings, comments and nested brackets.
// Returns null when the brackets don't add up.
function splitTopLevel(text) {
  const parts = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const end = skipLiteral(text, i);
    if (end === -1) return null;
    if (end !== i) {
      i = end;
      continue;
    }
    const c = text[i];
    if (OPEN[c]) stack.push(OPEN[c]);
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) return null;
    } else if (c === ',' && stack.length === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  if (stack.length) return null;
  parts.push(text.slice(start));
  // Comments between entries are not part of them.
  return parts.map((p) => p.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').trim()).filter(Boolean);
}

// The text between the parentheses of the call whose "(" is at `open`, or null.
function callBody(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const end = skipLiteral(code, i);
    if (end === -1) return null;
    if (end !== i) {
      i = end;
      continue;
    }
    if (code[i] === '(') depth++;
    else if (code[i] === ')' && --depth === 0) return code.slice(open + 1, i);
  }
  return null;
}

/**
 * The parts of the last top-level `arrange(...)` in the code, as
 * [{ name, label, start, bars }], with `start` and `bars` in bars.
 * Returns [] when the track has no such arrangement or it can't be read.
 */
export function parseSections(code) {
  const calls = [...String(code).matchAll(/^arrange\s*\(/gm)];
  if (!calls.length) return [];
  const last = calls.at(-1);
  const body = callBody(code, last.index + last[0].length - 1);
  const entries = body === null ? null : splitTopLevel(body);
  if (!entries?.length) return [];
  const sections = [];
  let start = 0;
  for (const [index, entry] of entries.entries()) {
    const match = entry.match(/^\[\s*(\d+(?:\.\d+)?)\s*,\s*([\s\S]+?)\s*\]$/);
    if (!match) return [];
    const bars = Number(match[1]);
    if (!(bars > 0)) return [];
    const name = /^[A-Za-z_$][\w$]*$/.test(match[2]) ? match[2] : `part${index + 1}`;
    sections.push({ name, label: sectionLabel(name), start, bars });
    start += bars;
  }
  return sections;
}

/** The section playing at `bar` (0-based, may be fractional), or null. */
export function sectionAt(sections, bar) {
  if (bar == null || !Number.isFinite(bar)) return null;
  return sections.find((s) => bar >= s.start && bar < s.start + s.bars) ?? null;
}
