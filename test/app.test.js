// Drives the real player page (index.html) in jsdom, with a fake audio engine.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createApp, describeTrack } from '../src/app.js';
import { STORAGE_KEY } from '../src/library.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const response = (body, ok = true, status = 200) => ({ ok, status, json: async () => JSON.parse(body), text: async () => body });
const repoFetch = async (url) => {
  try {
    return response(readFileSync(new URL(`../${url}`, import.meta.url), 'utf8'));
  } catch {
    return response('', false, 404);
  }
};

function fakeEngine({ failInit = false } = {}) {
  const engine = {
    played: [],
    stops: 0,
    failNext: null,
    pos: null,
    init: async () => {
      if (failInit) throw new Error('CDN unreachable');
    },
    async play(code) {
      if (engine.failNext) {
        const err = engine.failNext;
        engine.failNext = null;
        throw err;
      }
      engine.played.push(code);
    },
    stop() {
      engine.stops++;
    },
    position: () => engine.pos,
  };
  return engine;
}

class MemoryStorage {
  data = {};
  getItem(k) {
    return k in this.data ? this.data[k] : null;
  }
  setItem(k, v) {
    this.data[k] = String(v);
  }
}

let dom;
let doc;
beforeEach(() => {
  dom = new JSDOM(html, { url: 'https://example.test/vibe-soundlab/' });
  doc = dom.window.document;
});

const $ = (sel) => doc.querySelector(sel);
const $$ = (sel) => [...doc.querySelectorAll(sel)];
const names = () => $$('.track .name').map((n) => n.textContent);
const click = (node) => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const settle = () => new Promise((r) => setTimeout(r, 0));
const fileLike = (name, text) => ({ name, size: Buffer.byteLength(text), text: async () => text });

async function start(options = {}) {
  const engine = options.engine ?? fakeEngine();
  const app = await createApp({
    root: $('[data-role=app]'),
    engine,
    fetchFn: options.fetchFn ?? repoFetch,
    storage: options.storage ?? null,
    location: options.location ?? dom.window.location,
  });
  return { app, engine };
}

test('lists the repo tracks in order and selects the first', async () => {
  await start();
  assert.deepEqual(names(), ['Nachtschicht', 'Nebelhorn', 'Glasregen', 'Polarlicht', 'Druckwelle', 'Kernschmelze', 'Starkstrom']);
  assert.equal($('[data-role=title]').textContent, 'Nachtschicht');
  assert.match($('[data-role=details]').textContent, /Dark techstep · F minor · 174 BPM · 2:46/);
  assert.match($('[data-role=code]').textContent, /NACHTSCHICHT/);
  assert.match($('[data-role=open]').href, /^https:\/\/strudel\.cc\/#/);
  assert.equal($('.track.selected .name').textContent, 'Nachtschicht');
});

test('play and stop toggle the engine and the button', async () => {
  const { engine } = await start();
  const play = $('[data-role=play]');
  click(play);
  await settle();
  assert.equal(engine.played.length, 1);
  assert.equal(play.textContent, 'Stop');
  assert.equal(play.getAttribute('aria-pressed'), 'true');
  assert.match($('[data-role=status]').textContent, /Playing Nachtschicht/);
  assert.ok($('.track.playing'));
  click(play);
  await settle();
  assert.equal(engine.stops, 1);
  assert.equal(play.textContent, 'Play');
  assert.match($('[data-role=status]').textContent, /Stopped/);
});

test('picking another track while playing switches playback', async () => {
  const { engine } = await start();
  click($('[data-role=play]'));
  await settle();
  click($$('.track .pick')[2]);
  await settle();
  assert.equal(engine.played.length, 2);
  assert.match(engine.played[1], /GLASREGEN/);
  assert.equal(dom.window.location.hash, '#glasregen');
});

test('picking a track while stopped only selects it', async () => {
  const { engine } = await start();
  click($$('.track .pick')[1]);
  await settle();
  assert.equal(engine.played.length, 0);
  assert.equal($('[data-role=title]').textContent, 'Nebelhorn');
});

test('next and previous wrap around the list', async () => {
  await start();
  click($('[data-role=prev]'));
  assert.equal($('[data-role=title]').textContent, 'Starkstrom');
  click($('[data-role=next]'));
  click($('[data-role=next]'));
  assert.equal($('[data-role=title]').textContent, 'Nebelhorn');
});

test('space toggles playback, except while typing', async () => {
  const { engine } = await start();
  doc.body.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  await settle();
  assert.equal(engine.played.length, 1);
  $('[data-role=file]').dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  doc.body.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
  await settle();
  assert.equal(engine.stops, 0);
});

test('a link to a track opens it', async () => {
  dom = new JSDOM(html, { url: 'https://example.test/#polarlicht' });
  doc = dom.window.document;
  await start();
  assert.equal($('[data-role=title]').textContent, 'Polarlicht');
});

test('errors while playing are shown, not thrown', async () => {
  const engine = fakeEngine();
  await start({ engine });
  engine.failNext = new Error('sound supersaw not found');
  click($('[data-role=play]'));
  await settle();
  const status = $('[data-role=status]');
  assert.match(status.textContent, /Could not play Nachtschicht: sound supersaw not found/);
  assert.ok(status.classList.contains('error'));
  assert.equal($('[data-role=play]').textContent, 'Play');
  engine.failNext = 'plain failure';
  click($('[data-role=play]'));
  await settle();
  assert.match(status.textContent, /plain failure/);
});

test('uploads are added, selected, kept and removable', async () => {
  const storage = new MemoryStorage();
  const { app, engine } = await start({ storage });
  await app.addFiles([fileLike('my-roller.js', '// @title My Roller\n// @bpm 172\ns("bd")')]);
  assert.deepEqual(names().at(-1), 'My Roller');
  assert.equal($('[data-role=title]').textContent, 'My Roller');
  assert.match($('[data-role=status]').textContent, /Added My Roller/);
  assert.ok($('.track.uploaded'));
  assert.ok(JSON.parse(storage.data[STORAGE_KEY]).length === 1);

  click($('[data-role=play]'));
  await settle();
  click($('.track.uploaded .remove'));
  assert.equal(engine.stops, 1);
  assert.equal(names().length, 7);
  assert.equal($('[data-role=title]').textContent, 'Nachtschicht');
});

test('uploads without a header use the file name', async () => {
  const { app } = await start();
  await app.addFiles([fileLike('late_night.txt', 's("bd sd")')]);
  assert.equal($('[data-role=title]').textContent, 'Late night');
  assert.equal($('[data-role=about]').textContent, 'Uploaded: late_night.txt');
});

test('removing an upload that is not selected keeps the selection', async () => {
  const { app } = await start();
  await app.addFiles([fileLike('a.js', 's("bd")')]);
  app.select('repo:nebelhorn');
  app.removeUpload('upload:a');
  assert.equal($('[data-role=title]').textContent, 'Nebelhorn');
});

test('uploads from earlier visits come back', async () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify([{ name: 'old.js', code: '// @title Old one\ns("bd")' }]));
  await start({ storage });
  assert.equal(names().at(-1), 'Old one');
});

test('refused files are explained', async () => {
  const { app } = await start();
  const added = await app.addFiles([fileLike('cover.png', 'x'), fileLike('ok.js', 's("bd")')]);
  assert.equal(added.length, 1);
  assert.match($('[data-role=status]').textContent, /cover.png is not a Strudel file/);
  await app.addFiles([fileLike('empty.js', '  ')]);
  assert.match($('[data-role=status]').textContent, /empty.js is empty/);
});

test('the file picker and drag and drop add uploads', async () => {
  await start();
  const input = $('[data-role=file]');
  Object.defineProperty(input, 'files', { value: [fileLike('picked.js', '// @title Picked\ns("bd")')], configurable: true });
  input.dispatchEvent(new dom.window.Event('change'));
  await settle();
  await settle();
  assert.ok(names().includes('Picked'));

  const drop = $('[data-role=drop]');
  drop.dispatchEvent(new dom.window.Event('dragover', { cancelable: true }));
  assert.ok(drop.classList.contains('over'));
  drop.dispatchEvent(new dom.window.Event('dragleave'));
  assert.ok(!drop.classList.contains('over'));
  const event = new dom.window.Event('drop', { cancelable: true });
  event.dataTransfer = { files: [fileLike('dropped.js', '// @title Dropped\ns("bd")')] };
  drop.dispatchEvent(event);
  await settle();
  await settle();
  assert.ok(names().includes('Dropped'));
  assert.ok(event.defaultPrevented);
  const empty = new dom.window.Event('drop', { cancelable: true });
  drop.dispatchEvent(empty);
  await settle();
});

test('shows the bar position while playing', async () => {
  const { app, engine } = await start();
  app.updateProgress();
  assert.equal($('[data-role=progress]').textContent, '');
  click($('[data-role=play]'));
  await settle();
  engine.pos = 125.3;
  app.updateProgress();
  assert.equal($('[data-role=progress]').textContent, 'Bar 6 / 120');
  await app.addFiles([fileLike('loop.js', 's("bd")')]);
  click($('[data-role=play]'));
  await settle();
  engine.pos = 3.2;
  app.updateProgress();
  assert.equal($('[data-role=progress]').textContent, 'Bar 4');
});

test('the player still works for uploads when the track list fails to load', async () => {
  const { app } = await start({ fetchFn: async () => response('', false, 500) });
  assert.match($('[data-role=status]').textContent, /Could not load the track list \(500\)\. You can still upload tracks\./);
  assert.equal($('[data-role=play]').disabled, true);
  assert.equal($('[data-role=title]').textContent, 'No track');
  await app.play();
  app.select('nothing');
  await app.addFiles([fileLike('mine.js', 's("bd")')]);
  assert.equal($('[data-role=play]').disabled, false);
});

test('a Strudel load failure is reported', async () => {
  await start({ engine: fakeEngine({ failInit: true }) });
  await settle();
  assert.match($('[data-role=status]').textContent, /Could not load Strudel: CDN unreachable/);
});

test('works without a location to sync', async () => {
  const { app } = await start({ location: null });
  app.select('repo:glasregen');
  assert.equal($('[data-role=title]').textContent, 'Glasregen');
});

test('describeTrack leaves out what is unknown', () => {
  assert.equal(describeTrack({}), '');
  assert.equal(describeTrack({ style: 'Liquid', bpm: 172 }), 'Liquid · 172 BPM');
});

// An engine whose play() waits until the test lets it finish.
function slowEngine() {
  const engine = fakeEngine();
  engine.pending = [];
  engine.play = (code) =>
    new Promise((resolve, reject) => {
      engine.played.push(code);
      engine.pending.push({ resolve, reject });
    });
  return engine;
}

test('while a track loads, the button says so and ignores clicks', async () => {
  const engine = slowEngine();
  await start({ engine });
  const play = $('[data-role=play]');
  click(play);
  assert.equal(play.textContent, 'Loading…');
  assert.equal(play.disabled, true);
  click(play);
  await settle();
  assert.equal(engine.played.length, 1);
  engine.pending[0].resolve();
  await settle();
  assert.equal(play.textContent, 'Stop');
});

test('switching tracks quickly plays the last one picked', async () => {
  const engine = slowEngine();
  const { app } = await start({ engine });
  app.select('repo:nebelhorn', { autoplay: true });
  app.select('repo:glasregen', { autoplay: true });
  engine.pending[1].resolve();
  await settle();
  engine.pending[0].reject(new Error('superseded'));
  await settle();
  assert.match($('[data-role=status]').textContent, /Playing Glasregen/);
  assert.equal($('.track.playing .name').textContent, 'Glasregen');
});

test('stopping while a track loads keeps it silent', async () => {
  const engine = slowEngine();
  const { app } = await start({ engine });
  app.play();
  app.stop();
  assert.equal(engine.stops, 1);
  engine.pending[0].resolve();
  await settle();
  assert.equal(engine.stops, 2);
  assert.match($('[data-role=status]').textContent, /Stopped/);
  assert.equal($('[data-role=play]').textContent, 'Play');
});
