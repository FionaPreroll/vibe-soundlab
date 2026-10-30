// Drives the real player page (index.html) in jsdom, with a fake audio engine.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createApp, describeTrack } from '../src/app.js';
import { STORAGE_KEY } from '../src/library.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// the repo tracks in the order the player lists them, so new tracks need no test changes
const repoTracks = JSON.parse(readFileSync(new URL('../tracks/index.json', import.meta.url), 'utf8')).tracks;
const lastTrack = repoTracks.at(-1);
const lastTrackId = `repo:${lastTrack.file.replace(/\.js$/, '')}`;

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
    starts: [],
    seeks: [],
    async play(code, { from = 0 } = {}) {
      if (engine.failNext) {
        const err = engine.failNext;
        engine.failNext = null;
        throw err;
      }
      engine.played.push(code);
      engine.starts.push(from);
      engine.pos = from;
    },
    stop() {
      engine.stops++;
      engine.pos = null;
    },
    seek(bar) {
      engine.seeks.push(bar);
      engine.pos = bar;
      return true;
    },
    position: () => engine.pos,
    mixer: () => null,
    isPlaying: () => engine.pos !== null,
    locations: [],
    activeLocations: () => engine.locations,
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
  assert.deepEqual(names(), repoTracks.map((t) => t.title));
  assert.equal(names()[0], 'Nachtschicht');
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
  assert.equal($('[data-role=title]').textContent, lastTrack.title);
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
  assert.equal(names().length, repoTracks.length);
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
  engine.pos = 5.3;
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

const repeatButton = () => $('[data-role=repeat]');
const finish = async (app, engine, bars = 200) => {
  engine.pos = bars;
  app.updateProgress();
  await settle();
};

test('when a track ends, the next one starts', async () => {
  const { app, engine } = await start();
  click($('[data-role=play]'));
  await settle();
  engine.pos = 119.9;
  app.updateProgress();
  assert.equal(engine.played.length, 1, 'not before the end');
  await finish(app, engine, 120);
  assert.equal(engine.played.length, 2);
  assert.match(engine.played[1], /NEBELHORN/);
  assert.match($('[data-role=status]').textContent, /Playing Nebelhorn/);
});

test('repeat off stops after the last track', async () => {
  const { app, engine } = await start();
  app.select(lastTrackId);
  click($('[data-role=play]'));
  await settle();
  await finish(app, engine);
  assert.equal(engine.played.length, 1);
  assert.equal(engine.stops, 1);
  assert.match($('[data-role=status]').textContent, /End of playlist/);
  assert.equal($('[data-role=play]').textContent, 'Play');
});

test('repeat all starts over, repeat one plays the same track again', async () => {
  const storage = new MemoryStorage();
  const { app, engine } = await start({ storage });
  assert.equal(repeatButton().textContent, 'Repeat off');
  click(repeatButton());
  assert.equal(repeatButton().textContent, 'Repeat all');
  assert.equal(repeatButton().getAttribute('aria-pressed'), 'true');
  assert.equal(storage.data['vibe-player:repeat'], 'all');

  app.select(lastTrackId);
  click($('[data-role=play]'));
  await settle();
  await finish(app, engine);
  assert.match(engine.played.at(-1), /NACHTSCHICHT/);

  click(repeatButton());
  assert.equal(repeatButton().textContent, 'Repeat one');
  await finish(app, engine);
  assert.match(engine.played.at(-1), /NACHTSCHICHT/);
  assert.equal($('[data-role=title]').textContent, 'Nachtschicht');

  click(repeatButton());
  assert.equal(repeatButton().textContent, 'Repeat off');
  assert.equal(repeatButton().getAttribute('aria-pressed'), 'false');
});

test('the repeat mode is remembered', async () => {
  const storage = new MemoryStorage();
  storage.setItem('vibe-player:repeat', 'one');
  await start({ storage });
  assert.equal(repeatButton().textContent, 'Repeat one');
});

test('blocked storage does not break repeat', async () => {
  const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const { app } = await start({ storage });
  assert.equal(repeatButton().textContent, 'Repeat off');
  app.cycleRepeat();
  assert.equal(repeatButton().textContent, 'Repeat all');
});

test('the mixer shows the channel names of the track that plays', async () => {
  const { app } = await start();
  const channels = () => $$('.strip .name').map((n) => n.textContent).slice(0, 4);
  assert.deepEqual(channels(), ['Drums', 'Bass', 'Pad', 'Snare']);
  const [chip] = await app.addFiles([fileLike('chip.js', '// @mixer Noise, Bass, Arpeggio\ns("bd")')]);
  assert.deepEqual(channels(), ['Noise', 'Bass', 'Arpeggio', 'Snare'], 'the selected track names them');
  await app.play();
  app.select('repo:nachtschicht');
  assert.deepEqual(channels(), ['Noise', 'Bass', 'Arpeggio', 'Snare'], 'the playing track wins');
  app.stop();
  assert.deepEqual(channels(), ['Drums', 'Bass', 'Pad', 'Snare']);
  assert.equal(chip.meta.mixer, 'Noise, Bass, Arpeggio');
});

test('uploads without a length keep looping', async () => {
  const { app, engine } = await start();
  await app.addFiles([fileLike('loop.js', 's("bd")')]);
  click($('[data-role=play]'));
  await settle();
  await finish(app, engine, 500);
  assert.equal(engine.played.length, 1);
  assert.equal($('[data-role=progress]').textContent, 'Bar 501');
});

test('no auto-advance while the next track is still loading', async () => {
  const engine = slowEngine();
  const { app } = await start({ engine });
  app.play();
  engine.pending[0].resolve();
  await settle();
  engine.pos = 120;
  app.updateProgress();
  app.updateProgress();
  assert.equal(engine.played.length, 2);
});

const seekBar = () => $('[data-role=seek]');
const dragTo = (bar) => {
  seekBar().value = String(bar);
  seekBar().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};
const release = () => seekBar().dispatchEvent(new dom.window.Event('change', { bubbles: true }));
const sectionButtons = () => $$('[data-role=sections] .section');

test('the seek bar shows the parts and length of the selected track', async () => {
  await start();
  assert.equal(seekBar().max, '120');
  assert.equal(seekBar().disabled, false);
  assert.equal(seekBar().value, '0');
  assert.deepEqual(
    sectionButtons().map((b) => b.textContent),
    ['Intro', 'Build', 'Drop 1', 'Breakdown', 'Build 2', 'Drop 2', 'Outro'],
  );
  const drop = sectionButtons()[2];
  assert.equal(drop.parentElement.style.left, '20%');
  assert.equal(drop.title, 'Drop 1: bars 25–56');
  assert.equal($('[data-role=time]').textContent, '0:00');
  assert.equal($('[data-role=length]').textContent, '2:46');
  assert.equal($('[data-role=progress]').textContent, '');
  assert.equal($('[data-role=section]').textContent, '');
});

test('the seek bar follows playback', async () => {
  const { app, engine } = await start();
  click($('[data-role=play]'));
  await settle();
  engine.pos = 30.5;
  app.updateProgress();
  assert.equal(seekBar().value, '30');
  assert.equal(seekBar().style.getPropertyValue('--fill'), `${(30.5 / 120) * 100}%`);
  assert.equal($('[data-role=time]').textContent, '0:42');
  assert.equal($('[data-role=progress]').textContent, 'Bar 31 / 120');
  assert.equal($('[data-role=section]').textContent, '· Drop 1');
  assert.ok(sectionButtons()[2].classList.contains('current'));
  assert.equal(seekBar().getAttribute('aria-valuetext'), 'Bar 31 of 120');
  engine.pos = -0.1;
  app.updateProgress();
  assert.equal($('[data-role=progress]').textContent, 'Bar 1 / 120', 'never before the start');
  click($('[data-role=play]'));
  await settle();
  app.updateProgress();
  assert.equal(seekBar().value, '0');
  assert.equal($('[data-role=progress]').textContent, '');
});

test('dragging previews the target, letting go jumps there', async () => {
  const { app, engine } = await start();
  click($('[data-role=play]'));
  await settle();
  engine.pos = 4;
  dragTo(80);
  assert.equal($('[data-role=progress]').textContent, 'Bar 81 / 120');
  assert.equal($('[data-role=section]').textContent, '· Drop 2');
  app.updateProgress();
  assert.equal(seekBar().value, '80', 'playback does not pull the handle back while dragging');
  assert.deepEqual(engine.seeks, []);
  release();
  assert.deepEqual(engine.seeks, [80]);
  assert.equal(app.state.scrub, null);
  assert.equal($('[data-role=progress]').textContent, 'Bar 81 / 120');
  dragTo(120);
  release();
  assert.deepEqual(engine.seeks, [80, 119], 'the last bar at most');
});

test('seeking while stopped starts playback there', async () => {
  const { engine } = await start();
  dragTo(56);
  release();
  await settle();
  assert.deepEqual(engine.starts, [56]);
  assert.match($('[data-role=status]').textContent, /Playing Nachtschicht/);
  assert.equal($('[data-role=progress]').textContent, 'Bar 57 / 120');
  assert.equal($('[data-role=section]').textContent, '· Breakdown');
});

test('a part of the track can be clicked to jump to it', async () => {
  const { engine } = await start();
  click($('[data-role=play]'));
  await settle();
  click(sectionButtons()[5]);
  assert.deepEqual(engine.seeks, [72]);
  assert.ok(sectionButtons()[5].classList.contains('current'));
});

test('no seeking while a track loads or without a known length', async () => {
  const engine = slowEngine();
  engine.seek = (bar) => engine.seeks.push(bar);
  engine.seeks = [];
  const { app } = await start({ engine });
  app.play();
  assert.equal(seekBar().disabled, true);
  app.seekTo(30);
  assert.equal(engine.played.length, 1);
  assert.deepEqual(engine.seeks, []);
  engine.pending[0].resolve();
  await settle();

  await app.addFiles([fileLike('loop.js', '// @bpm 172\ns("bd")')]);
  assert.equal(seekBar().disabled, true);
  assert.equal($('[data-role=sections]').hidden, true);
  assert.equal($('[data-role=length]').textContent, '');
  app.seekTo(4);
  assert.deepEqual(engine.seeks, []);
});

test('the clock is blank when the tempo is unknown', async () => {
  const { app } = await start();
  await app.addFiles([fileLike('short.js', '// @bars 8\narrange([4, a], [4, b])')]);
  assert.equal(seekBar().max, '8');
  assert.equal($('[data-role=time]').textContent, '');
  assert.deepEqual(sectionButtons().map((b) => b.textContent), ['A', 'B']);
});

test('with nothing selected the clock rests at zero', async () => {
  await start({ fetchFn: async () => response('', false, 500) });
  assert.equal($('[data-role=time]').textContent, '0:00');
  assert.equal(seekBar().disabled, true);
  assert.equal(seekBar().getAttribute('aria-valuetext'), 'Unknown length');
});

test('every animation frame redraws the mixer', async () => {
  const drawn = [];
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect: () => drawn.push('clear'),
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  });
  const { app } = await start();
  app.drawFrame(1000);
  assert.equal(drawn.length, 10, 'nine strips and the EQ view');
  assert.equal(app.mixer.eqTarget(), 'master');
});

test('the code is highlighted and the sounding notes are marked', async () => {
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  const { app, engine } = await start();
  const code = $('[data-role=code]');
  assert.equal(code.querySelector('.tok-keyword').textContent, 'const');
  assert.ok(code.querySelectorAll('.tok-mini-word').length > 100);
  const track = app.library.get('repo:nachtschicht').code;
  const at = (text) => ({ start: track.indexOf(text), end: track.indexOf(text) + text.length });
  engine.locations = [at('RolandJD990')];
  app.drawFrame(0);
  assert.equal(code.querySelectorAll('.playing').length, 0, 'nothing marked while stopped');

  click($('[data-role=play]'));
  await settle();
  app.drawFrame(100);
  assert.deepEqual([...code.querySelectorAll('.playing')].map((n) => n.textContent), ['RolandJD990']);
  engine.locations = [];
  app.drawFrame(110);
  assert.equal(code.querySelectorAll('.playing').length, 1, 'at most 30 updates a second');
  app.drawFrame(200);
  assert.equal(code.querySelectorAll('.playing').length, 0);

  engine.locations = [at('RolandJD990')];
  code.closest('details').open = false;
  app.drawFrame(300);
  assert.equal(code.querySelectorAll('.playing').length, 0, 'no work while the code is hidden');
  code.closest('details').open = true;

  app.select('repo:nebelhorn');
  await settle();
  assert.match(code.textContent, /NEBELHORN/);
  const before = code.firstChild;
  app.updateProgress();
  app.select('repo:nebelhorn');
  assert.equal(code.firstChild, before, 'the same code is not rendered again');
});
