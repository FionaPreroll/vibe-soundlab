// Writes tracks/index.json from the headers of the files in tracks/.
// Run after adding or renaming a track: pnpm run tracks
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHeader } from '../src/header.js';

export const TRACK_DIR = fileURLToPath(new URL('../tracks/', import.meta.url));

/** Builds the index for every .js file in the folder, sorted by @order, then file name. */
export function buildIndex(dir = TRACK_DIR) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const tracks = files.map((file) => ({ file, ...parseHeader(readFileSync(join(dir, file), 'utf8')) }));
  const rank = (t) => t.order ?? Infinity;
  tracks.sort((a, b) => rank(a) - rank(b) || a.file.localeCompare(b.file));
  return { tracks };
}

export const serialize = (index) => `${JSON.stringify(index, null, 2)}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(TRACK_DIR, 'index.json'), serialize(buildIndex()));
  console.log('tracks/index.json updated');
}
