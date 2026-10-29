import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_UPLOAD_BYTES, checkCode, checkFile, readUpload } from '../src/upload.js';

const file = (name, text, size = Buffer.byteLength(text)) => ({ name, size, text: async () => text });

test('accepts Strudel files', () => {
  for (const name of ['track.js', 'a.MJS', 'b.txt', 'c.strudel']) assert.equal(checkFile({ name, size: 10 }), null, name);
});

test('rejects other files, empty files and huge files', () => {
  assert.match(checkFile({ name: 'song.wav', size: 10 }), /not a Strudel file/);
  assert.match(checkFile({ size: 10 }), /This file is not/);
  assert.match(checkFile(), /not a Strudel file/);
  assert.match(checkFile({ name: 'a.js', size: 0 }), /empty/);
  assert.match(checkFile({ name: 'a.js', size: MAX_UPLOAD_BYTES + 1 }), /larger than 256 KB/);
});

test('rejects blank or binary contents', () => {
  assert.match(checkCode('a.js', '  \n'), /empty/);
  assert.match(checkCode('a.js', undefined), /empty/);
  assert.match(checkCode('a.js', 'ab\u0000cd'), /binary/);
  assert.equal(checkCode('a.js', 's("bd")'), null);
});

test('reads a valid upload', async () => {
  assert.deepEqual(await readUpload(file('beat.js', 's("bd sd")')), { name: 'beat.js', code: 's("bd sd")' });
});

test('reports why an upload was refused', async () => {
  assert.match((await readUpload(file('beat.png', 'x'))).error, /not a Strudel file/);
  assert.match((await readUpload(file('beat.js', '   ', 3))).error, /empty/);
});
