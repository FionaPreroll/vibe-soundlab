// Reads the metadata block at the top of a track file:
//   // @title Nachtschicht
//   // @bpm 174
// Every line is optional; uploaded tracks often have none.

const NUMBER_FIELDS = new Set(['bpm', 'bars', 'order']);

/** Returns { title, style, bpm, key, bars, about } with whatever the header provides. */
export function parseHeader(code) {
  const meta = {};
  for (const line of String(code).split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (!trimmed.startsWith('//')) break;
    const match = trimmed.match(/^\/\/\s*@(\w+)\s+(.+)$/);
    if (!match) continue;
    const [, field, raw] = match;
    const value = raw.trim();
    if (NUMBER_FIELDS.has(field)) {
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) meta[field] = number;
    } else {
      meta[field] = value;
    }
  }
  return meta;
}

/** Track length in seconds, or null when bpm or bars is unknown. One bar is four beats. */
export function durationSeconds({ bpm, bars } = {}) {
  if (!bpm || !bars) return null;
  return (bars * 4 * 60) / bpm;
}

/** 198 → "3:18" */
export function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Turns a file name into a readable title: "deep-roller_v2.js" → "Deep roller v2". */
export function titleFromFileName(name) {
  const base = String(name).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  if (!base) return 'Untitled';
  return base.charAt(0).toUpperCase() + base.slice(1);
}
