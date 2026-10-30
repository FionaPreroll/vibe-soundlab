// Songs from other GitHub repositories: where they live, what they are called, and
// the index the player lists them from. The examples copy the comment styles of the
// three repositories with made-up songs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { indexSource, serialize } from '../scripts/index-sources.js';
import { SOURCES, checkIndex, codeUrl, formatCredits, leadingComments, loadSources, pageUrl, readSongInfo, repoUrl, songGroup } from '../src/sources.js';

const index = JSON.parse(readFileSync(new URL('../sources/index.json', import.meta.url), 'utf8'));
const COMMIT = 'a'.repeat(40);
const source = { id: 'demo', repo: 'someone/strudel-songs', name: 'someone', commit: COMMIT, folders: { '': 'Songs', 'songs/game-ost': 'Game soundtracks' } };

test('comments at the top are read, line and block comments alike, up to the first code', () => {
  assert.deepEqual(leadingComments('\n// "Night Bus"\n//song @by Someone\n\nsetcpm(30)\n// not this'), ['"Night Bus"', 'song @by Someone']);
  assert.deepEqual(leadingComments('/*\n@title Night Bus\n * @by Someone\n*/\n$: s("bd")'), ['@title Night Bus', '@by Someone']);
  assert.deepEqual(leadingComments('/* @title Night Bus @by Someone */\n\n// more\ns("bd")'), ['@title Night Bus @by Someone', 'more']);
  assert.deepEqual(leadingComments('/* @title A */ s("bd")\n// later'), ['@title A']);
  assert.deepEqual(leadingComments('s("bd") // a comment after code'), []);
  assert.deepEqual(leadingComments(''), []);
});

test('a quoted title with notes and song and script credits', () => {
  const code = '// "Night Bus" (work in progress)\n// song @by The Band\n// script @by someone\nsetcps(1)\n';
  assert.deepEqual(readSongInfo(code, 'nightbus.js'), {
    title: 'Night Bus',
    note: 'Work in progress',
    credits: [
      { role: 'song', name: 'The Band' },
      { role: 'script', name: 'someone' },
    ],
  });
  assert.equal(readSongInfo('// "Night Bus" - Work In Progress\n$: s("bd")', 'a.js').note, 'Work In Progress');
  assert.equal(readSongInfo('// “Night Bus” Solo (Hymn Version)\n$: s("bd")', 'a.js').note, 'Solo (Hymn Version)');
  assert.equal(readSongInfo('// "Night Bus"\n$: s("bd")', 'a.js').note, undefined);
});

test('a quoted title with the author on the same line', () => {
  assert.deepEqual(readSongInfo('// "Night Bus" @by Someone\n\nsetcpm(30)', 'songs/night-bus.js'), {
    title: 'Night Bus',
    credits: [{ role: '', name: 'Someone' }],
  });
});

test('@title and @by tags, in line comments or a block', () => {
  assert.deepEqual(readSongInfo('// @title Cave Theme\n// @by A Composer\n// transcribed @by someone\n// Minified\n// @by someone\n// and @by Friend\n\nsetCpm(30)', 'cave.js'), {
    title: 'Cave Theme',
    credits: [
      { role: '', name: 'A Composer' },
      { role: 'transcribed', name: 'someone' },
      { role: 'and', name: 'Friend' },
    ],
  });
  assert.deepEqual(readSongInfo('/*\n@title Night Bus V2 @by The Band\n@by someone\n*/\n$: s("bd")', 'x.js'), {
    title: 'Night Bus V2',
    credits: [
      { role: '', name: 'The Band' },
      { role: '', name: 'someone' },
    ],
  });
  assert.deepEqual(readSongInfo('// @song by The Band\n// @script by someone', 'x.js').credits, [
    { role: 'song', name: 'The Band' },
    { role: 'script', name: 'someone' },
  ]);
});

test('without a title, a comment that spells out the file name, else the file name', () => {
  assert.equal(readSongInfo('// NIGHT BUS\nsetcps(1)', 'nightbus.js').title, 'Night Bus');
  assert.equal(readSongInfo('// Why is the night bus so late?\n// an example\n$: s("bd")', 'whyisthenightbus.js').title, 'Why is the night bus so late?');
  assert.equal(readSongInfo('// old bus has bad brakes\n$: s("bd")', 'oldtrain.js').title, 'Oldtrain');
  assert.equal(readSongInfo('// Bus\n$: s("bd")', 'bus.js').title, 'Bus', 'short names only match the file name itself');
  assert.equal(readSongInfo('setcps(1)\n$: s("bd")', 'songs/game-ost/night_bus.js').title, 'Night bus');
  assert.deepEqual(readSongInfo('', 'a.js'), { title: 'A' });
});

test('long titles and names are cut', () => {
  const info = readSongInfo(`// "${'Very '.repeat(30)}Long"\n// @by ${'Name '.repeat(20)}`, 'a.js');
  assert.equal(info.title.length, 80);
  assert.ok(info.title.endsWith('…'));
  assert.equal(info.credits[0].name.length, 60);
});

test('credits read as one line', () => {
  assert.equal(
    formatCredits([
      { role: 'song', name: 'The Band' },
      { role: 'script', name: 'someone' },
    ]),
    'Song by The Band · script by someone',
  );
  assert.equal(formatCredits([{ role: '', name: 'A Composer' }, { role: 'transcribed', name: 'someone' }]), 'By A Composer · transcribed by someone');
  assert.equal(formatCredits(), '');
});

test('only .js files in a source folder are songs, under that folder heading', () => {
  assert.equal(songGroup(source, 'night.js'), 'Songs');
  assert.equal(songGroup(source, 'songs/game-ost/cave.js'), 'Game soundtracks');
  assert.equal(songGroup(source, 'functions/helper.js'), null);
  assert.equal(songGroup(source, 'songs/cave.js'), null);
  assert.equal(songGroup(source, 'README.md'), null);
  assert.equal(songGroup(source, '../night.js'), null);
  assert.equal(songGroup(source, 'toString'), null);
});

test('code and pages link to the indexed commit', () => {
  assert.equal(codeUrl(source, 'songs/game-ost/a b.js'), `https://raw.githubusercontent.com/someone/strudel-songs/${COMMIT}/songs/game-ost/a%20b.js`);
  assert.equal(pageUrl(source, 'night.js'), `https://github.com/someone/strudel-songs/blob/${COMMIT}/night.js`);
  assert.equal(repoUrl(source), 'https://github.com/someone/strudel-songs');
});

test('an index keeps only what the player can safely link to', () => {
  const song = { path: 'night.js', title: 'Night', group: 'Songs' };
  const sources = checkIndex({
    sources: [
      { id: 'ok', repo: 'a/b', commit: COMMIT, songs: [song, { path: '../x.js', title: 'X' }, { path: 'y.md', title: 'Y' }, { path: 'z.js' }, null] },
      { id: 'branch', repo: 'a/b', commit: 'main', songs: [song] },
      { id: 'odd', repo: 'a/b/c', commit: COMMIT, songs: [song] },
      { id: 'empty', repo: 'a/b', commit: COMMIT, songs: [] },
      { repo: 'a/b', commit: COMMIT, songs: [song] },
    ],
  });
  assert.deepEqual(sources, [{ id: 'ok', repo: 'a/b', name: 'a/b', commit: COMMIT, songs: [song] }]);
  assert.deepEqual(checkIndex(null), []);
  assert.deepEqual(checkIndex({ sources: [{ id: 'x', repo: 'a/b', commit: COMMIT, name: 'X' }] }), []);
});

test('the index loads from the site, with a message when it cannot', async () => {
  const urls = [];
  const fetchFn = async (url) => (urls.push(url), { ok: true, json: async () => index });
  assert.equal((await loadSources(fetchFn)).length, SOURCES.length);
  assert.deepEqual(urls, ['sources/index.json']);
  await assert.rejects(loadSources(async () => ({ ok: false, status: 404 })), /Could not load the list of songs from GitHub \(404\)/);
});

test('the index script lists songs by folder and title and reports what it left out', () => {
  const files = {
    'zebra.js': '// "Zebra"\ns("bd")',
    'songs/game-ost/cave.js': '// @title Cave\ns("bd")',
    'apple.js': 's("bd")',
    'functions/helper.js': 'register("x", (p) => p)',
    'lib/prebake.js': '',
  };
  const { entry, skipped } = indexSource(source, { commit: COMMIT, date: '2026-10-03T16:46:27+02:00', files });
  assert.deepEqual(entry, {
    id: 'demo',
    repo: 'someone/strudel-songs',
    name: 'someone',
    commit: COMMIT,
    date: '2026-10-03',
    songs: [
      { path: 'apple.js', group: 'Songs', title: 'Apple' },
      { path: 'zebra.js', group: 'Songs', title: 'Zebra' },
      { path: 'songs/game-ost/cave.js', group: 'Game soundtracks', title: 'Cave' },
    ],
  });
  assert.deepEqual(skipped, ['functions/helper.js', 'lib/prebake.js']);
  assert.match(serialize([entry]), /^\{\n "_about": "Songs from other GitHub repositories/);
});

test('the committed index covers every source, pinned, with songs from their folders', () => {
  assert.deepEqual(index.sources.map((s) => s.id), SOURCES.map((s) => s.id));
  assert.deepEqual(checkIndex(index).map((s) => s.songs.length), index.sources.map((s) => s.songs.length), 'nothing in it is dropped');
  for (const entry of index.sources) {
    const config = SOURCES.find((s) => s.id === entry.id);
    assert.equal(entry.repo, config.repo);
    assert.match(entry.commit, /^[0-9a-f]{40}$/);
    assert.ok(entry.songs.length > 0, entry.id);
    assert.equal(new Set(entry.songs.map((s) => s.path)).size, entry.songs.length, `${entry.id}: paths are unique`);
    for (const song of entry.songs) {
      assert.equal(song.group, songGroup(config, song.path), song.path);
      assert.ok(song.title.trim().length > 0, song.path);
    }
  }
});
