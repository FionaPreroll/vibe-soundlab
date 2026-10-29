import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Library, STORAGE_KEY } from '../src/library.js';

class MemoryStorage {
  constructor(initial = {}) {
    this.data = { ...initial };
  }
  getItem(key) {
    return key in this.data ? this.data[key] : null;
  }
  setItem(key, value) {
    this.data[key] = String(value);
  }
}

const header = (title) => `// @title ${title}\n// @bpm 174\ns("bd")`;

test('repo tracks get ids, metadata and a title fallback', () => {
  const lib = new Library();
  const a = lib.addRepoTrack({ file: 'nachtschicht.js', code: header('Nachtschicht') });
  const b = lib.addRepoTrack({ file: 'no_header.js', code: 's("bd")' });
  assert.equal(a.id, 'repo:nachtschicht');
  assert.equal(a.meta.bpm, 174);
  assert.equal(b.meta.title, 'No header');
  assert.deepEqual(lib.list().map((t) => t.id), ['repo:nachtschicht', 'repo:no-header']);
});

test('uploads are saved, replaced by name and restored', () => {
  const storage = new MemoryStorage();
  const lib = new Library({ storage });
  lib.addUpload({ name: 'My Beat!.js', code: header('First') });
  lib.addUpload({ name: 'My Beat!.js', code: header('Second') });
  assert.equal(lib.list().length, 1);
  assert.equal(lib.get('upload:my-beat').meta.title, 'Second');

  const again = new Library({ storage });
  assert.equal(again.restore(), 1);
  assert.equal(again.get('upload:my-beat').meta.title, 'Second');
});

test('restore ignores broken or foreign data', () => {
  assert.equal(new Library({ storage: new MemoryStorage({ [STORAGE_KEY]: '{oops' }) }).restore(), 0);
  assert.equal(new Library({ storage: new MemoryStorage({ [STORAGE_KEY]: '{"a":1}' }) }).restore(), 0);
  const mixed = JSON.stringify([{ name: 'ok.js', code: 's("bd")' }, { name: 3 }, null]);
  assert.equal(new Library({ storage: new MemoryStorage({ [STORAGE_KEY]: mixed }) }).restore(), 1);
  assert.equal(new Library().restore(), 0);
  assert.equal(new Library({ storage: new MemoryStorage() }).restore(), 0);
});

test('a full or blocked storage does not break uploads', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
  const lib = new Library({ storage });
  assert.equal(lib.addUpload({ name: 'a.js', code: 's("bd")' }).id, 'upload:a');
});

test('only uploads can be removed', () => {
  const lib = new Library();
  lib.addRepoTrack({ file: 'a.js', code: 's("bd")' });
  lib.addUpload({ name: 'b.js', code: 's("sd")' });
  assert.equal(lib.remove('repo:a'), false);
  assert.equal(lib.remove('upload:missing'), false);
  assert.equal(lib.remove('upload:b'), true);
  assert.deepEqual(lib.list().map((t) => t.id), ['repo:a']);
});

test('find accepts ids and bare names from links', () => {
  const lib = new Library();
  lib.addRepoTrack({ file: 'glasregen.js', code: 's("bd")' });
  assert.equal(lib.find('repo:glasregen').file, 'glasregen.js');
  assert.equal(lib.find('Glasregen').file, 'glasregen.js');
  assert.equal(lib.find('nothing'), null);
});

test('neighbour wraps around in both directions', () => {
  const lib = new Library();
  assert.equal(lib.neighbour('x'), null);
  for (const f of ['a.js', 'b.js', 'c.js']) lib.addRepoTrack({ file: f, code: 's("bd")' });
  assert.equal(lib.neighbour('repo:c', 1).id, 'repo:a');
  assert.equal(lib.neighbour('repo:a', -1).id, 'repo:c');
  assert.equal(lib.neighbour('repo:a').id, 'repo:b');
  assert.equal(lib.neighbour('missing', 1).id, 'repo:a');
});

test('names without letters still get an id', () => {
  assert.equal(new Library().addUpload({ name: '!!!.js', code: 's("bd")' }).id, 'upload:track');
});
