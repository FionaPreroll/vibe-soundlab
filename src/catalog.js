// Loads the tracks that ship with the repo: tracks/index.json lists the files.

export async function loadCatalog(fetchFn, base = 'tracks/') {
  const response = await fetchFn(`${base}index.json`);
  if (!response.ok) throw new Error(`Could not load the track list (${response.status}).`);
  const index = await response.json();
  return Promise.all(
    index.tracks.map(async ({ file }) => {
      const res = await fetchFn(`${base}${file}`);
      if (!res.ok) throw new Error(`Could not load ${file} (${res.status}).`);
      return { file, code: await res.text() };
    }),
  );
}
