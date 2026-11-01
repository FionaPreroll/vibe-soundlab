// Songs from other people's GitHub repositories. Each repository has its own folder
// layout and its own way of naming songs in comments, and none uses this repo's header:
// this file knows where each one keeps its songs and reads titles and credits from them.
// scripts/index-sources.js writes sources/index.json with it, pinned to one commit per
// repository. The player lists the songs from that file and loads a song's code from
// GitHub, at that commit, only after the listener has switched these songs on.
import { titleFromFileName } from './header.js';

/**
 * The repositories. `folders` maps each folder that holds songs ('' is the top level)
 * to the heading the player shows; files anywhere else (helpers, libraries) are left out.
 */
export const SOURCES = [
  {
    id: 'eefano',
    repo: 'eefano/strudel-songs-collection',
    name: 'eefano',
    about: 'Covers and originals, from Cardiacs and The Sea Nymphs to Battiato and Morricone.',
    folders: { '': 'Songs', jamsessions: 'Jam sessions', tinkering: 'Tinkering' },
  },
  {
    id: 'tzwaan',
    repo: 'tzwaan/strudel-scripts',
    name: 'tzwaan',
    about: 'Trance, liquid and video game soundtracks.',
    folders: { songs: 'Songs', 'songs/game-ost': 'Game soundtracks' },
  },
  {
    id: 'maria',
    repo: 'Mariaareadne1/maria-live-codes',
    name: 'MariaAreadne',
    about: 'Live-coded covers from her videos.',
    folders: { songs: 'Covers' },
  },
];

export const INDEX_URL = 'sources/index.json';

const MAX_TITLE = 80;
const clip = (text, max = MAX_TITLE) => {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** The folder heading for a file, or null when the file is not a song of this source. */
export function songGroup(source, path) {
  if (!/\.js$/i.test(path) || path.split('/').includes('..')) return null;
  const cut = path.lastIndexOf('/');
  const folder = cut === -1 ? '' : path.slice(0, cut);
  return Object.hasOwn(source.folders, folder) ? source.folders[folder] : null;
}

/**
 * The comments at the top of a file, before its first line of code, one entry per
 * line, without the comment marks. Both `//` lines and `/* … *\/` blocks count.
 */
export function leadingComments(code) {
  const lines = [];
  let inBlock = false;
  for (const raw of String(code).split('\n')) {
    let line = raw.trim();
    if (!inBlock) {
      if (line === '') continue;
      if (line.startsWith('//')) {
        lines.push(line.replace(/^\/\/+/, ''));
        continue;
      }
      if (!line.startsWith('/*')) break;
      line = line.slice(2);
      inBlock = true;
    }
    const end = line.indexOf('*/');
    if (end !== -1) {
      lines.push(line.slice(0, end));
      inBlock = false;
      if (line.slice(end + 2).trim() !== '') break;
    } else {
      lines.push(line.replace(/^\*(?!\/)/, ''));
    }
  }
  return lines.map((line) => line.trim()).filter(Boolean);
}

// `"Aztec Challenge" (work in progress)`: a quoted title and what follows it.
const QUOTED = /^["“]([^"”]+)["”]\s*(.*)$/;
const letters = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
const baseName = (path) => String(path).split('/').pop().replace(/\.[^.]+$/, '');

/** "(work in progress)" → "Work in progress", "- Work In Progress" → "Work In Progress" */
function cleanNote(text) {
  let note = text.replace(/@by\b.*$/, '').replace(/^[-–—:,\s]+/, '').trim();
  if (/^\([^()]*\)$/.test(note)) note = note.slice(1, -1).trim();
  return note ? clip(capitalize(note)) : null;
}

function titleOf(lines, path) {
  for (const line of lines) {
    const tagged = line.match(/@title\s+(.+?)(?=\s+@\w|$)/);
    if (tagged) return { title: clip(tagged[1]), note: null };
  }
  for (const line of lines) {
    const quoted = line.match(QUOTED);
    if (quoted) return { title: clip(quoted[1]), note: cleanNote(quoted[2]) };
  }
  // A comment that starts with the file name spelled out: "// HAPPY BIRTHDAY" in
  // happybirthday.js, "// Why does my brain works so bad?" in whydoesmybrain.js.
  const name = letters(baseName(path));
  const spelled = name.length >= 4 && lines.find((line) => !line.includes('@') && letters(line).startsWith(name));
  if (spelled) {
    const title = spelled === spelled.toUpperCase() ? spelled.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : spelled;
    return { title: clip(title), note: null };
  }
  return { title: titleFromFileName(baseName(path)), note: null };
}

/**
 * Who made it, from lines like "song @by Cardiacs", "script @by eefano",
 * "transcribed @by tzwaan", "@by Toby Fox" or "@song by Parquet Courts".
 * Returns [{ role, name }], role '' when the line names no role.
 */
function creditsOf(lines) {
  const credits = [];
  for (const line of lines) {
    let role;
    let name;
    const tag = line.match(/^@(\w+)\s+by\s+(.+)$/i);
    const by = line.match(/^(.*?)@by\s+(.+)$/);
    if (tag) [, role, name] = tag;
    else if (by) {
      [, role, name] = by;
      // the rest of a title line: `"Feel Good Inc" @by …`, `@title Insomnia @by …`
      if (/["“”]|@title/.test(role)) role = '';
    } else continue;
    name = clip(name.replace(/\s+@\w.*$/, ''), 60);
    role = clip(role, 40).toLowerCase();
    // "@by tzwaan" after "Transcribed @by tzwaan" says nothing new
    const known = credits.some((c) => c.name === name && (c.role === role || role === ''));
    if (name && !known) credits.push({ role, name });
  }
  return credits;
}

/**
 * What the player shows for a song: { title, note, credits }. Uses whatever the file
 * offers, in this order: an `@title` tag, a quoted title in the first comments, a
 * comment that spells out the file name, and else the file name itself.
 */
export function readSongInfo(code, path) {
  const lines = leadingComments(code);
  const { title, note } = titleOf(lines, path);
  const info = { title };
  if (note) info.note = note;
  const credits = creditsOf(lines);
  if (credits.length) info.credits = credits;
  return info;
}

/** [{ role: 'song', name: 'Cardiacs' }, { role: 'script', name: 'eefano' }] → "Song by Cardiacs · script by eefano" */
export function formatCredits(credits = []) {
  const text = credits.map(({ role, name }) => (role ? `${role} by ${name}` : `by ${name}`)).join(' · ');
  return capitalize(text);
}

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

/** The song's code at the indexed commit, so the player runs exactly what it listed. */
export const codeUrl = (source, path) => `https://raw.githubusercontent.com/${source.repo}/${source.commit}/${encodePath(path)}`;

/** The song's page on GitHub, at the indexed commit. */
export const pageUrl = (source, path) => `https://github.com/${source.repo}/blob/${source.commit}/${encodePath(path)}`;

export const repoUrl = (source) => `https://github.com/${source.repo}`;

const REPO = /^[\w.-]+\/[\w.-]+$/;
const COMMIT = /^[0-9a-f]{40}$/;

/**
 * Keeps the sources and songs of an index that the player can use: a known repository
 * name, a full commit, and songs with a title in one of the source's folders.
 */
export function checkIndex(index) {
  const sources = Array.isArray(index?.sources) ? index.sources : [];
  return sources
    .filter((source) => typeof source?.id === 'string' && REPO.test(source.repo ?? '') && COMMIT.test(source.commit ?? ''))
    .map((source) => ({
      ...source,
      name: typeof source.name === 'string' ? source.name : source.repo,
      songs: (Array.isArray(source.songs) ? source.songs : []).filter(
        (song) => typeof song?.path === 'string' && typeof song.title === 'string' && /\.js$/i.test(song.path) && !song.path.split('/').includes('..'),
      ),
    }))
    .filter((source) => source.songs.length > 0);
}

/** Loads sources/index.json. Throws with a message for the player when it can't. */
export async function loadSources(fetchFn, url = INDEX_URL) {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Could not load the list of songs from GitHub (${response.status}).`);
  return checkIndex(await response.json());
}
