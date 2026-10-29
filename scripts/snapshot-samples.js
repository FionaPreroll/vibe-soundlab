// Refreshes test/fixtures/sample-banks.json: the sample names (and how many
// variations each has) that tracks can rely on. Needs network access.
import { writeFileSync } from 'node:fs';

const SOURCES = {
  dirt: 'https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/strudel.json',
  machines: 'https://raw.githubusercontent.com/felixroos/dough-samples/main/tidal-drum-machines.json',
};

const out = {
  _about:
    'Sample names and counts the tracks may use: tidalcycles/dirt-samples and the tidal-drum-machines map from felixroos/dough-samples. Regenerate with scripts/snapshot-samples.js.',
};
for (const [key, url] of Object.entries(SOURCES)) {
  const map = await (await fetch(url)).json();
  out[key] = Object.fromEntries(
    Object.entries(map)
      .filter(([name]) => !name.startsWith('_'))
      .map(([name, files]) => [name, Array.isArray(files) ? files.length : Object.keys(files).length])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}
writeFileSync(new URL('../test/fixtures/sample-banks.json', import.meta.url), `${JSON.stringify(out, null, 0)}\n`);
console.log('test/fixtures/sample-banks.json updated');
