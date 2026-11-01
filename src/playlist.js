// Playlist rules: which track comes next and when a track is over.

export const REPEAT_MODES = ['off', 'all', 'one'];
export const REPEAT_LABELS = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' };

/** off → all → one → off */
export function nextRepeatMode(mode) {
  const index = REPEAT_MODES.indexOf(mode);
  return REPEAT_MODES[(index + 1) % REPEAT_MODES.length];
}

/** Reads a stored mode, falling back to off for anything unknown. */
export function parseRepeatMode(value) {
  return REPEAT_MODES.includes(value) ? value : 'off';
}

/**
 * The id to play after `id` finishes, or null to stop.
 * off: next track, stop after the last · all: next track, wrap around · one: the same track.
 */
export function trackAfter(ids, id, mode) {
  if (ids.length === 0) return null;
  if (mode === 'one' && ids.includes(id)) return id;
  const index = ids.indexOf(id);
  if (index === -1) return ids[0];
  if (index < ids.length - 1) return ids[index + 1];
  return mode === 'all' ? ids[0] : null;
}

/** A track with a known length is over once playback reaches its last bar's end. */
export function hasEnded(position, bars) {
  return Boolean(bars) && position != null && position >= bars;
}
