// Loads every track once and caches its events, so the track tests stay fast.
import { readFileSync, readdirSync } from 'node:fs';
import { parseHeader } from '../../src/header.js';
import { collect } from './harmony.js';
import { loadTrack } from './strudel.js';

export const TRACK_DIR = new URL('../../tracks/', import.meta.url);
export const trackFiles = () => readdirSync(TRACK_DIR).filter((f) => f.endsWith('.js')).sort();

const cache = new Map();

export function analyse(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      (async () => {
        const code = readFileSync(path, 'utf8');
        const meta = parseHeader(code);
        const loaded = await loadTrack(code);
        const haps = collect(loaded.pattern, meta.bars ?? 120);
        return { code, meta, ...loaded, haps };
      })(),
    );
  }
  return cache.get(path);
}

export const analyseTrack = (file) => analyse(new URL(file, TRACK_DIR));
