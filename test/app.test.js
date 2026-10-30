// Drives the real player page (index.html) in jsdom, with a fake audio engine.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createApp, describeError, describeTrack } from '../src/app.js';
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
      engine.code = code;
      engine.ver++;
    },
    stop() {
      engine.stops++;
      engine.pos = null;
      engine.code = null;
    },
    // changes made while a track plays (see engine.update)
    updates: [],
    failUpdate: null,
    code: null,
    async update(code) {
      if (engine.failUpdate) {
        const err = engine.failUpdate;
        engine.failUpdate = null;
        throw err;
      }
      engine.updates.push(code);
      engine.code = code;
      engine.ver++;
    },
    playingCode: () => engine.code,
    // the events the chords are found in
    ver: 0,
    version: () => engine.ver,
    haps: [],
    query: (begin, end) => engine.haps.filter((h) => h.whole.begin < end && h.whole.end > begin),
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
    visuals: options.visuals ?? null,
    // the chords are worked out at once, however busy the test machine is
    clock: () => 0,
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

const visualsButton = () => $('[data-role=visuals-toggle]');
const fakeVisuals = () => ({ enabled: [], setEnabled(on) { this.enabled.push(on); } });

test('the visuals switch turns the Hydra visuals off and on and remembers it', async () => {
  const storage = new MemoryStorage();
  const visuals = fakeVisuals();
  await start({ storage, visuals });
  assert.equal(visualsButton().hidden, false);
  assert.equal(visualsButton().textContent, 'Visuals on');
  assert.deepEqual(visuals.enabled, [true]);
  click(visualsButton());
  assert.equal(visualsButton().textContent, 'Visuals off');
  assert.equal(visualsButton().getAttribute('aria-pressed'), 'false');
  assert.deepEqual(visuals.enabled, [true, false]);
  assert.equal(storage.data['vibe-player:visuals'], 'off');
  click(visualsButton());
  assert.equal(visualsButton().getAttribute('aria-pressed'), 'true');
  assert.equal(storage.data['vibe-player:visuals'], 'on');
});

test('visuals switched off stay off on the next visit', async () => {
  const storage = new MemoryStorage();
  storage.setItem('vibe-player:visuals', 'off');
  const visuals = fakeVisuals();
  await start({ storage, visuals });
  assert.equal(visualsButton().textContent, 'Visuals off');
  assert.deepEqual(visuals.enabled, [false]);
});

test('without visuals there is no switch, and blocked storage leaves them on', async () => {
  await start();
  assert.equal(visualsButton().hidden, true);
  const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const { app } = await start({ storage, visuals: fakeVisuals() });
  assert.equal(visualsButton().textContent, 'Visuals on');
  app.toggleVisuals();
  assert.equal(visualsButton().textContent, 'Visuals off');
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

// Songs from other GitHub repositories, with a made-up index and made-up songs.
const COMMIT = 'd'.repeat(40);
const songIndex = {
  sources: [
    {
      id: 'demo',
      repo: 'someone/strudel-songs',
      name: 'someone',
      about: 'Covers and originals.',
      commit: COMMIT,
      songs: [
        { path: 'nightbus.js', group: 'Songs', title: 'Night Bus', note: 'Work in progress', credits: [{ role: 'song', name: 'The Band' }, { role: 'script', name: 'someone' }] },
        { path: 'dawn.js', group: 'Songs', title: 'Dawn' },
        { path: 'jams/rain.js', group: 'Jam sessions', title: 'Rain Jam' },
      ],
    },
    {
      id: 'other',
      repo: 'another/live-codes',
      name: 'another',
      commit: COMMIT,
      songs: [{ path: 'songs/cave.js', group: 'Covers', title: 'Cave Theme', credits: [{ role: '', name: 'A Composer' }] }],
    },
  ],
};
const raw = (repo, path) => `https://raw.githubusercontent.com/${repo}/${COMMIT}/${path}`;
const songCode = {
  [raw('someone/strudel-songs', 'nightbus.js')]: '// "Night Bus" (work in progress)\nsetcpm(30)\n$: note("c3 e3").s("gm_piano")._pianoroll()',
  [raw('someone/strudel-songs', 'dawn.js')]: '$: s("bd*2")',
  [raw('someone/strudel-songs', 'jams/rain.js')]: '// @bpm 120\n// @bars 8\n$: s("hh*8")',
  [raw('another/live-codes', 'songs/cave.js')]: '$: n("0 2").scale("c:minor").o(2)',
};

/** Serves the repo, the song index and the songs, and notes every URL asked for. */
function githubFetch({ index = songIndex, songs = songCode } = {}) {
  const urls = [];
  const fetchFn = async (url) => {
    urls.push(url);
    if (url === 'sources/index.json') return index ? response(JSON.stringify(index)) : response('', false, 500);
    if (url.startsWith('https://')) return url in songs ? response(songs[url]) : response('', false, 404);
    return repoFetch(url);
  };
  fetchFn.urls = urls;
  fetchFn.external = () => urls.filter((u) => u === 'sources/index.json' || u.startsWith('https://'));
  return fetchFn;
}

const songNames = () => $$('[data-role=external-list] .song:not([hidden]) .name').map((n) => n.firstChild.textContent);
const sourceList = (id) => $(`[data-role=external-list] [data-source="${id}"]`);
const pickSong = (id) => click($(`.song[data-id="${id}"] .pick`));

async function startWithSongs(options = {}) {
  const fetchFn = options.fetchFn ?? githubFetch();
  const started = await start({ ...options, fetchFn });
  return { ...started, fetchFn };
}

test('songs from GitHub stay hidden and unloaded until switched on', async () => {
  const { fetchFn } = await startWithSongs();
  assert.equal($('[data-role=external-consent]').hidden, false);
  assert.equal($('[data-role=external-browse]').hidden, true);
  assert.deepEqual(
    $$('[data-role=external-names] a').map((a) => [a.textContent, a.href]),
    [
      ['eefano', 'https://github.com/eefano/strudel-songs-collection'],
      ['tzwaan', 'https://github.com/tzwaan/strudel-scripts'],
      ['MariaAreadne', 'https://github.com/Mariaareadne1/maria-live-codes'],
    ],
  );
  assert.match($('[data-role=external-consent]').textContent, /eefano, tzwaan and MariaAreadne share .* runs its code in this page/);
  assert.deepEqual(fetchFn.external(), [], 'nothing asked from GitHub, not even the list');
  assert.deepEqual(names(), repoTracks.map((t) => t.title));
});

test('switched on, they are listed per repository and folder, and the choice is kept', async () => {
  const storage = new MemoryStorage();
  const { app, fetchFn } = await startWithSongs({ storage });
  click($('[data-role=external-on]'));
  await settle();
  assert.equal(storage.data['vibe-player:external'], 'on');
  assert.equal($('[data-role=external-consent]').hidden, true);
  assert.equal($('[data-role=external-browse]').hidden, false);
  assert.deepEqual(fetchFn.external(), ['sources/index.json'], 'only the list; songs load when picked');
  assert.deepEqual($$('.source .source-name').map((n) => n.textContent), ['someone', 'another']);
  assert.deepEqual($$('.source .count').map((n) => n.textContent), ['3 songs', '1 songs']);
  assert.match(sourceList('demo').querySelector('.source-about').textContent, /Covers and originals\. someone\/strudel-songs/);
  assert.deepEqual($$('[data-source="demo"] .group').map((n) => n.textContent), ['Songs', 'Jam sessions']);
  assert.deepEqual(songNames(), ['Night Bus', 'Dawn', 'Rain Jam', 'Cave Theme']);
  const night = $('.song[data-id="ext:demo-nightbus"]');
  assert.equal(night.querySelector('.name small').textContent, 'Work in progress');
  assert.equal(night.querySelector('.sub').textContent, 'Song by The Band · script by someone');
  assert.equal(sourceList('demo').open, false, 'folded until opened');
  assert.deepEqual(names(), repoTracks.map((t) => t.title), 'the track list stays as it was');
  await app.showExternal();
  assert.equal(fetchFn.external().length, 1, 'switching on twice loads once');

  dom = new JSDOM(html, { url: 'https://example.test/vibe-soundlab/' });
  doc = dom.window.document;
  const again = githubFetch();
  await start({ storage, fetchFn: again });
  assert.equal($('[data-role=external-browse]').hidden, false, 'on again on the next visit');
  assert.deepEqual(songNames(), ['Night Bus', 'Dawn', 'Rain Jam', 'Cave Theme']);
});

test('picking a song loads its code from GitHub at the listed commit and shows where it is from', async () => {
  const { app, engine, fetchFn } = await startWithSongs();
  await app.showExternal();
  pickSong('ext:demo-nightbus');
  assert.match($('[data-role=status]').textContent, /Loading Night Bus from GitHub…/);
  assert.equal($('[data-role=open]').href, 'https://strudel.cc/', 'no code to open yet');
  await settle();
  assert.match($('[data-role=open]').href, /^https:\/\/strudel\.cc\/#.+/);
  assert.deepEqual(fetchFn.external().slice(1), [raw('someone/strudel-songs', 'nightbus.js')]);
  assert.equal($('[data-role=status]').textContent, '');
  assert.equal($('[data-role=title]').textContent, 'Night Bus');
  assert.equal($('[data-role=details]').textContent, 'Song by The Band · script by someone');
  assert.equal($('[data-role=about]').textContent, 'Work in progress');
  assert.equal($('[data-role=origin]').hidden, false);
  assert.equal($('[data-role=origin]').textContent, 'From someone/strudel-songs/nightbus.js on GitHub');
  assert.equal($('[data-role=origin] a').href, `https://github.com/someone/strudel-songs/blob/${COMMIT}/nightbus.js`);
  assert.match($('[data-role=code]').textContent, /_pianoroll/);
  assert.ok($('.song[data-id="ext:demo-nightbus"]').classList.contains('selected'));
  assert.equal($('.song.selected .pick').hasAttribute('aria-current'), true);
  assert.equal(location().hash, '#demo-nightbus');
  assert.deepEqual($$('.strip .name').map((n) => n.textContent).slice(0, 3), ['Orbit 1', 'Orbit 2', 'Orbit 3']);
  assert.equal(engine.played.length, 0, 'picking only loads it');

  click($('[data-role=play]'));
  await settle();
  assert.equal(engine.played[0], songCode[raw('someone/strudel-songs', 'nightbus.js')]);
  assert.ok($('.song[data-id="ext:demo-nightbus"]').classList.contains('playing'));
  pickSong('ext:demo-dawn');
  await settle();
  assert.equal(engine.played[1], '$: s("bd*2")', 'while playing, picking a song plays it once it has loaded');
  assert.equal(fetchFn.external().filter((u) => u.endsWith('nightbus.js')).length, 1, 'loaded once');
  assert.equal($('[data-role=origin]').hidden, false);
  app.select('repo:nachtschicht');
  assert.equal($('[data-role=origin]').hidden, true);
});
const location = () => dom.window.location;

test('songs that GitHub cannot deliver are explained', async () => {
  const big = 'x'.repeat(300 * 1024);
  const fetchFn = githubFetch({ songs: { [raw('someone/strudel-songs', 'dawn.js')]: big, [raw('someone/strudel-songs', 'jams/rain.js')]: '   ' } });
  const { app, engine } = await startWithSongs({ fetchFn });
  await app.showExternal();
  pickSong('ext:demo-nightbus');
  await settle();
  assert.equal($('[data-role=status]').textContent, 'Could not load Night Bus: GitHub answered 404.');
  assert.equal($('[data-role=status]').classList.contains('error'), true);
  pickSong('ext:demo-dawn');
  await settle();
  assert.match($('[data-role=status]').textContent, /Could not load Dawn: dawn\.js is larger than 256 KB\./);
  await app.select('ext:demo-jams-rain', { autoplay: true });
  assert.match($('[data-role=status]').textContent, /Could not play Rain Jam: jams\/rain\.js is empty\./);
  assert.equal(engine.played.length, 0);

  const offline = async (url) => {
    if (url.startsWith('https://')) throw new TypeError('Failed to fetch');
    return githubFetch()(url);
  };
  dom = new JSDOM(html, { url: 'https://example.test/vibe-soundlab/' });
  doc = dom.window.document;
  const second = await start({ fetchFn: offline });
  await second.app.showExternal();
  pickSong('ext:other-songs-cave');
  await settle();
  assert.equal($('[data-role=status]').textContent, "Could not load Cave Theme: GitHub can't be reached (Failed to fetch).");
});

test('a song picked away from before its code arrives leaves the status alone', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const plain = githubFetch();
  const fetchFn = async (url) => (url.endsWith('nightbus.js') ? (await gate, response('', false, 503)) : plain(url));
  const { app } = await startWithSongs({ fetchFn });
  await app.showExternal();
  pickSong('ext:demo-nightbus');
  app.select('repo:nebelhorn');
  release();
  await settle();
  await settle();
  assert.equal($('[data-role=title]').textContent, 'Nebelhorn');
  assert.doesNotMatch($('[data-role=status]').textContent, /Could not/);
});

test('stopping while a song comes from GitHub keeps it silent', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const plain = githubFetch();
  const fetchFn = async (url) => (url.endsWith('dawn.js') ? (await gate, plain(url)) : plain(url));
  const { app, engine } = await startWithSongs({ fetchFn });
  await app.showExternal();
  app.select('ext:demo-dawn');
  const playing = app.play();
  app.stop();
  release();
  await playing;
  assert.equal(engine.played.length, 0);
  assert.match($('[data-role=status]').textContent, /Stopped/);
});

test('finding songs filters by title, credits and folder and opens their lists', async () => {
  const { app } = await startWithSongs();
  await app.showExternal();
  const find = $('[data-role=external-find]');
  const type = (text) => {
    find.value = text;
    find.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  type('the band');
  assert.deepEqual(songNames(), ['Night Bus']);
  assert.equal(sourceList('demo').open, true);
  assert.equal(sourceList('other').hidden, true);
  assert.equal($('[data-source="demo"] .songs:last-of-type').hidden, true, 'a folder without matches hides');
  type('composer cave');
  assert.deepEqual(songNames(), ['Cave Theme']);
  type('jam');
  assert.deepEqual(songNames(), ['Rain Jam']);
  type('nothing like this');
  assert.deepEqual(songNames(), []);
  assert.equal($('[data-role=external-none]').hidden, false);
  type('');
  assert.deepEqual(songNames(), ['Night Bus', 'Dawn', 'Rain Jam', 'Cave Theme']);
  assert.equal(sourceList('demo').open, false, 'back as it was');
  assert.equal($('[data-role=external-none]').hidden, true);
});

test('lists keep being open or folded as the listener left them', async () => {
  const { app } = await startWithSongs();
  await app.showExternal();
  const demo = sourceList('demo');
  demo.open = true;
  demo.dispatchEvent(new dom.window.Event('toggle'));
  const find = $('[data-role=external-find]');
  find.value = 'cave';
  find.dispatchEvent(new dom.window.Event('input'));
  demo.dispatchEvent(new dom.window.Event('toggle'));
  find.value = '';
  find.dispatchEvent(new dom.window.Event('input'));
  assert.equal(demo.open, true);
  demo.open = false;
  demo.dispatchEvent(new dom.window.Event('toggle'));
  find.dispatchEvent(new dom.window.Event('input'));
  assert.equal(demo.open, false);
});

test('next, previous and the end of a song stay in the list it is in', async () => {
  const { app, engine } = await startWithSongs();
  await app.showExternal();
  app.select('ext:demo-dawn');
  click($('[data-role=next]'));
  assert.equal($('[data-role=title]').textContent, 'Rain Jam');
  click($('[data-role=next]'));
  click($('[data-role=next]'));
  assert.equal($('[data-role=title]').textContent, 'Night Bus', 'wraps around within the songs from GitHub');
  assert.equal(sourceList('demo').open, true, 'the list of the song shown opens');
  click($('[data-role=prev]'));
  assert.equal($('[data-role=title]').textContent, 'Cave Theme');
  assert.equal(sourceList('other').open, true);

  // Rain Jam has a length (@bars 8): when it ends, the next song from GitHub plays.
  await app.select('ext:demo-jams-rain', { autoplay: true });
  engine.pos = 8;
  app.updateProgress();
  await settle();
  assert.equal($('[data-role=title]').textContent, 'Cave Theme');

  app.select(lastTrackId);
  click($('[data-role=next]'));
  assert.equal($('[data-role=title]').textContent, 'Nachtschicht', 'the tracks keep to their own list');
});

test('switched off, the songs go away, and a song from GitHub that plays stops', async () => {
  const storage = new MemoryStorage();
  const { app, engine } = await startWithSongs({ storage });
  await app.showExternal();
  await app.select('ext:demo-dawn', { autoplay: true });
  assert.equal(engine.played.length, 1);
  click($('[data-role=external-off]'));
  assert.equal(engine.stops, 1);
  assert.equal(storage.data['vibe-player:external'], 'off');
  assert.equal($('[data-role=external-consent]').hidden, false);
  assert.equal($('[data-role=external-list]').children.length, 0);
  assert.equal(app.library.list().some((t) => t.source === 'external'), false);
  assert.equal($('[data-role=title]').textContent, 'Nachtschicht');

  await app.showExternal();
  app.select('ext:demo-dawn');
  await app.select('repo:nebelhorn', { autoplay: true });
  click($('[data-role=external-off]'));
  assert.equal(engine.stops, 1, 'a track from this repo keeps playing');
  assert.equal($('[data-role=title]').textContent, 'Nebelhorn');
});

test('a link to a song from GitHub opens it when they are switched on', async () => {
  const storage = new MemoryStorage();
  storage.setItem('vibe-player:external', 'on');
  dom = new JSDOM(html, { url: 'https://example.test/vibe-soundlab/#other-songs-cave' });
  doc = dom.window.document;
  await startWithSongs({ storage });
  assert.equal($('[data-role=title]').textContent, 'Cave Theme');
  assert.equal(sourceList('other').open, true);
  await settle();
  assert.match($('[data-role=code]').textContent, /scale/);

  dom = new JSDOM(html, { url: 'https://example.test/vibe-soundlab/#other-songs-cave' });
  doc = dom.window.document;
  await startWithSongs();
  assert.equal($('[data-role=title]').textContent, 'Nachtschicht', 'switched off, the link falls back to the first track');
});

test('when the list of songs does not load, the player says so and keeps working', async () => {
  const { app } = await startWithSongs({ fetchFn: githubFetch({ index: null }) });
  await app.showExternal();
  assert.equal($('[data-role=status]').textContent, 'Could not load the list of songs from GitHub (500).');
  assert.equal($('[data-role=external-list]').children.length, 0);
  assert.equal($('[data-role=external-none]').hidden, true);
  assert.deepEqual(names(), repoTracks.map((t) => t.title));
});

test('blocked storage does not stop the songs from GitHub', async () => {
  const storage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  const { app } = await startWithSongs({ storage });
  await app.showExternal();
  assert.deepEqual(songNames(), ['Night Bus', 'Dawn', 'Rain Jam', 'Cave Theme']);
  app.hideExternal();
  assert.deepEqual(songNames(), []);
});

test('describeTrack puts the credits first', () => {
  assert.equal(describeTrack({ credits: 'By A Composer', bpm: 120, bars: 8 }), 'By A Composer · 120 BPM · 0:16');
});


// Changing the code, in the editor over the highlighted code.
const editorInput = () => $('[data-role=code-input]');
function typeCode(text) {
  editorInput().value = text;
  editorInput().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}
const pressKey = (init) => editorInput().dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
const located = (message, location) => Object.assign(new Error(message), { location });

test('the code can be changed: the change is kept, marked and opens in strudel.cc', async () => {
  const storage = new MemoryStorage();
  const { app } = await start({ storage });
  const original = app.library.get('repo:nachtschicht').code;
  assert.equal(editorInput().value, original);
  assert.equal(editorInput().readOnly, false);
  assert.equal($('[data-role=edited]').hidden, true);
  assert.equal($('[data-role=revert]').hidden, true);
  const changed = original.replace('const bpm = 174', 'const bpm = 170');
  typeCode(changed);
  assert.equal($('[data-role=edited]').hidden, false);
  assert.equal($('[data-role=revert]').hidden, false);
  assert.ok($('.track[data-id="repo:nachtschicht"]').classList.contains('edited'));
  assert.match($('[data-role=code-hint]').textContent, /Play or Ctrl\+Enter plays it as changed/);
  assert.deepEqual(JSON.parse(storage.data['vibe-player:drafts']), { 'repo:nachtschicht': changed });

  // the next visit
  dom = new JSDOM(html, { url: 'https://example.test/vibe-soundlab/' });
  doc = dom.window.document;
  await start({ storage });
  assert.equal(editorInput().value, changed);
  assert.equal($('[data-role=edited]').hidden, false);
  // changed back by hand: no change any more
  typeCode(original);
  assert.equal($('[data-role=edited]').hidden, true);
  assert.deepEqual(JSON.parse(storage.data['vibe-player:drafts']), {});
});

test('strudel.cc gets the code as changed', async () => {
  const { app } = await start();
  const original = $('[data-role=open]').href;
  typeCode(`${app.library.get('repo:nachtschicht').code}\n// mine`);
  assert.notEqual($('[data-role=open]').href, original);
  app.select('repo:nebelhorn');
  app.select('repo:nachtschicht');
  assert.match(editorInput().value, /\/\/ mine$/, 'a change stays when another track was picked in between');
});

test('Play and Ctrl+Enter play the code as changed', async () => {
  const { engine } = await start();
  typeCode('s("bd*2")');
  click($('[data-role=play]'));
  await settle();
  assert.deepEqual(engine.played, ['s("bd*2")']);
  assert.equal($('[data-role=apply]').disabled, true, 'nothing to update: it plays as it is');
  click($('[data-role=play]'));
  await settle();
  pressKey({ key: 'Enter', ctrlKey: true });
  await settle();
  assert.deepEqual(engine.played, ['s("bd*2")', 's("bd*2")']);
  pressKey({ key: '.', ctrlKey: true });
  assert.equal(engine.stops, 2);
});

test('while a track plays, Update swaps the change in without starting it again', async () => {
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  const { app, engine } = await start();
  click($('[data-role=play]'));
  await settle();
  const original = app.library.get('repo:nachtschicht').code;
  const at = (code, text) => ({ start: code.indexOf(text), end: code.indexOf(text) + text.length });
  engine.locations = [at(original, 'RolandJD990')];
  app.drawFrame(100);
  assert.equal($$('[data-role=code] .playing').length, 1);
  const changed = `// faster\n${original}`;
  typeCode(changed);
  assert.equal($('[data-role=apply]').disabled, false);
  assert.match($('[data-role=code-hint]').textContent, /Changed, not playing yet/);
  app.drawFrame(200);
  assert.equal($$('[data-role=code] .playing').length, 0, 'the marks would land in the wrong places');
  click($('[data-role=apply]'));
  await settle();
  assert.deepEqual(engine.updates, [changed]);
  assert.equal(engine.played.length, 1, 'not started again');
  assert.match($('[data-role=status]').textContent, /Playing Nachtschicht \(updated\)/);
  assert.equal($('[data-role=apply]').disabled, true);
  engine.locations = [at(changed, 'RolandJD990')];
  app.drawFrame(300);
  assert.deepEqual($$('[data-role=code] .playing').map((n) => n.textContent), ['RolandJD990']);
});

test('a change with an error keeps the music playing and shows where the error is', async () => {
  const { app, engine } = await start();
  click($('[data-role=play]'));
  await settle();
  typeCode('note("c3")\n  .s("saw"');
  engine.failUpdate = located('Unexpected token (2:11)', { position: 21, line: 2, column: 11 });
  pressKey({ key: 'Enter', ctrlKey: true });
  await settle();
  assert.match($('[data-role=status]').textContent, /Not updated, Nachtschicht plays on as before\. Line 2: Unexpected token$/);
  assert.ok($('[data-role=status]').classList.contains('error'));
  assert.equal($('[data-role=play]').textContent, 'Stop');
  const error = $('[data-role=code-error]');
  assert.equal(error.hidden, false);
  assert.equal(error.textContent, 'Line 2: Unexpected token (show)');
  assert.equal($('[data-role=error-line]').hidden, false);
  click(error);
  assert.equal(doc.activeElement, editorInput());
  assert.equal(editorInput().selectionStart, 21);
  // picking another track and back keeps the error with its code
  app.select('repo:nebelhorn');
  assert.equal($('[data-role=code-error]').hidden, true);
  app.select('repo:nachtschicht');
  assert.equal($('[data-role=code-error]').hidden, false);
  // fixing it clears the error
  typeCode('note("c3")\n  .s("saw")');
  assert.equal($('[data-role=code-error]').hidden, true);
  assert.equal($('[data-role=error-line]').hidden, true);
  engine.failUpdate = new Error('nope is not defined');
  click($('[data-role=apply]'));
  await settle();
  assert.equal($('[data-role=code-error]').textContent, 'nope is not defined', 'no place to show');
  click($('[data-role=code-error]'));
});

test('an error when a track starts is shown in its code too', async () => {
  const { engine } = await start();
  engine.failNext = located('[mini] parse error at line 1: Expected "]" but "\\"" found.', { position: 5, line: 1, column: 6 });
  click($('[data-role=play]'));
  await settle();
  assert.match($('[data-role=status]').textContent, /Could not play Nachtschicht: Line 1: Mini-notation: the string ends before a bracket or group in it is closed\./);
  assert.equal($('[data-role=error-line]').hidden, false);
  click($('[data-role=play]'));
  await settle();
  assert.equal($('[data-role=code-error]').hidden, true, 'it plays now: the error is gone');
});

test('Undo my changes brings back the track as it is, also while it plays', async () => {
  const storage = new MemoryStorage();
  const { app, engine } = await start({ storage });
  const original = app.library.get('repo:nachtschicht').code;
  typeCode('s("bd")');
  click($('[data-role=play]'));
  await settle();
  click($('[data-role=revert]'));
  await settle();
  assert.equal(editorInput().value, original);
  assert.deepEqual(engine.updates, [original], 'and it plays as it was');
  assert.equal($('[data-role=revert]').hidden, true);
  assert.deepEqual(JSON.parse(storage.data['vibe-player:drafts']), {});
  assert.equal(app.revert(), null, 'nothing to undo');
  typeCode('s("sd")');
  app.stop();
  app.revert();
  assert.deepEqual(engine.updates, [original], 'stopped: only the code comes back');
});

test('the engine’s errors while playing are shown', async () => {
  const { app, engine } = await start();
  app.playbackError(new Error('ignored'), { stopped: true });
  assert.doesNotMatch($('[data-role=status]').textContent, /ignored/, 'nothing plays');
  click($('[data-role=play]'));
  await settle();
  app.playbackError(new Error('v.nope is undefined'));
  assert.match($('[data-role=status]').textContent, /Error while playing Nachtschicht: v.nope is undefined/);
  typeCode('s("bd*100000")');
  engine.code = 's("bd")';
  app.playbackError(new Error('The pattern plays 4000 notes'), { reverted: true, code: 's("bd")' });
  assert.match($('[data-role=status]').textContent, /Your change failed while playing, so the version before it plays again\. The pattern plays 4000 notes/);
  assert.equal($('[data-role=apply]').disabled, false, 'the change can be tried again');
  assert.equal($('[data-role=code-error]').textContent, 'The pattern plays 4000 notes');
  app.playbackError(new Error('too slow'), { stopped: true });
  assert.match($('[data-role=status]').textContent, /Stopped Nachtschicht: too slow/);
  assert.equal($('[data-role=play]').textContent, 'Play');
  assert.equal($('.track.playing'), null);
});

test('a playback error while the next track loads frees the button', async () => {
  const engine = slowEngine();
  const { app } = await start({ engine });
  app.play();
  app.playbackError(new Error('flood'), { stopped: true });
  assert.equal($('[data-role=play]').textContent, 'Play');
  assert.equal($('[data-role=play]').disabled, false);
  engine.pending[0].resolve();
  await settle();
  assert.equal($('[data-role=play]').textContent, 'Play', 'the stopped play does not come back');
});

test('errors in the visuals are shown', async () => {
  const { app } = await start();
  app.visualsError(new Error('energyy is not defined'));
  assert.match($('[data-role=status]').textContent, /^The visuals stopped: energyy is not defined/);
  click($('[data-role=play]'));
  await settle();
  app.visualsError(new Error('x'));
  assert.match($('[data-role=status]').textContent, /The visuals stopped in Nachtschicht: x/);
});

test('code that is still loading from GitHub cannot be changed', async () => {
  const { app } = await startWithSongs();
  await app.showExternal();
  pickSong('ext:demo-dawn');
  assert.equal(editorInput().readOnly, true);
  typeCode('typed too early');
  await settle();
  assert.equal(editorInput().value, '$: s("bd*2")', 'the song as it came');
  assert.equal(editorInput().readOnly, false);
  assert.equal($('[data-role=edited]').hidden, true);
});

test('removing an upload drops its change', async () => {
  const storage = new MemoryStorage();
  const { app } = await start({ storage });
  await app.addFiles([fileLike('mine.js', 's("bd")')]);
  typeCode('s("sd")');
  assert.deepEqual(Object.keys(JSON.parse(storage.data['vibe-player:drafts'])), ['upload:mine']);
  app.removeUpload('upload:mine');
  assert.deepEqual(JSON.parse(storage.data['vibe-player:drafts']), {});
});

test('blocked or broken storage keeps changes for the visit', async () => {
  const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  const { app } = await start({ storage: blocked });
  typeCode('s("bd")');
  assert.equal($('[data-role=edited]').hidden, false);
  app.toggleSimpleChords();
  assert.equal($('[data-role=chords-simple]').getAttribute('aria-pressed'), 'true');
  const broken = new MemoryStorage();
  broken.setItem('vibe-player:drafts', '{not json');
  dom = new JSDOM(html, { url: 'https://example.test/vibe-soundlab/' });
  doc = dom.window.document;
  await start({ storage: broken });
  assert.equal($('[data-role=edited]').hidden, true);
});

test('error messages name the line and say what is wrong', () => {
  assert.equal(describeError(located('Unexpected token (3:5)', { line: 3 })), 'Line 3: Unexpected token');
  assert.equal(describeError(new Error('x is not defined')), 'x is not defined');
  assert.equal(describeError('plain'), 'plain');
});

// Guitar chords, from the events the engine gives.
const noteHap = (note, begin, end) => ({ value: { note }, whole: { begin, end }, part: { begin, end } });
const chordHaps = (names, begin, end) => names.split(' ').map((note) => noteHap(note, begin, end));

test('the chords of what plays are shown with their guitar shapes', async () => {
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  const storage = new MemoryStorage();
  const { app, engine } = await start({ storage });
  assert.equal($('[data-role=chords-none]').textContent, 'The chords show up here while a track plays.');
  assert.equal($('[data-role=chord-row]').hidden, true);
  engine.haps = [...chordHaps('f2 ab2 c3 eb3', 0, 2), ...chordHaps('db2 f2 ab2 c3', 2, 3.5), ...chordHaps('bb2 db3 f3', 3.5, 4)];
  click($('[data-role=play]'));
  await settle();
  engine.pos = 0.2;
  app.drawFrame(1000);
  const shown = () => $$('.chord').map((c) => `${c.querySelector('.when').textContent} ${c.querySelector('.chord-name').textContent}`);
  assert.deepEqual(shown(), ['Now Fm7', 'Bar 3 Dbmaj7', 'Bar 4 · beat 3 Bbm', 'Bar 5 –'], 'flats, as in F minor; nothing plays after bar 4');
  assert.equal($$('.chord svg.diagram').length, 3);
  assert.ok($('.chord.now'));
  assert.equal($('.chord svg').getAttribute('aria-label'), 'Fm7: 1 3 1 1 1 1 (low E to high e)');
  assert.equal($('[data-role=chords-none]').hidden, true);

  app.drawFrame(1050);
  engine.pos = 2.4;
  app.drawFrame(1060);
  assert.equal(shown()[0], 'Now Fm7', 'at most ten updates a second');
  app.drawFrame(1200);
  assert.deepEqual(shown(), ['Now Dbmaj7', 'Bar 4 · beat 3 Bbm', 'Bar 5 –']);
  const row = $('[data-role=chord-row]').firstChild;
  app.drawFrame(1400);
  assert.equal($('[data-role=chord-row]').firstChild, row, 'nothing new, nothing redrawn');

  click($('[data-role=chords-simple]'));
  app.drawFrame(1600);
  assert.deepEqual(shown(), ['Now Db', 'Bar 4 · beat 3 Bbm', 'Bar 5 –']);
  assert.equal(storage.data['vibe-player:chords'], 'simple');
  click($('[data-role=chords-simple]'));
  assert.equal(storage.data['vibe-player:chords'], 'full');

  click($('[data-role=play]'));
  app.drawFrame(2000);
  assert.equal($('[data-role=chord-row]').hidden, true);
  assert.equal($('[data-role=chords-none]').textContent, 'The chords show up here while a track plays.');
});

test('simple chords are remembered for the next visit', async () => {
  const storage = new MemoryStorage();
  storage.setItem('vibe-player:chords', 'simple');
  await start({ storage });
  assert.equal($('[data-role=chords-simple]').getAttribute('aria-pressed'), 'true');
});

test('drums alone have no chords, and new code finds them again', async () => {
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  const { app, engine } = await start();
  engine.haps = [{ value: { s: 'bd' }, whole: { begin: 0, end: 0.25 }, part: { begin: 0, end: 0.25 } }];
  click($('[data-role=play]'));
  await settle();
  engine.pos = 0;
  app.drawFrame(1000);
  assert.equal($('[data-role=chords-none]').textContent, 'No chords here: only drums, noise or single notes play.');
  engine.haps = chordHaps('c3 e3 g3', 0, 20);
  app.drawFrame(1200);
  assert.equal($('[data-role=chords-none]').hidden, false, 'what was worked out stays until the pattern changes');
  typeCode('note("c e g")');
  click($('[data-role=apply]'));
  await settle();
  app.drawFrame(1400);
  assert.deepEqual($$('.chord .chord-name').map((n) => n.textContent), ['C']);
});

test('a stretch with no chord, and a song without a key', async () => {
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  const { app, engine } = await start();
  await app.addFiles([fileLike('loop.js', 's("bd")')]);
  engine.haps = [...chordHaps('c#3 f3 g#3', 0, 1), noteHap('c3', 1, 2)];
  click($('[data-role=play]'));
  await settle();
  engine.pos = 0;
  app.drawFrame(1000);
  assert.deepEqual($$('.chord .chord-name').map((n) => n.textContent), ['C#', '–'], 'sharps, as the notes are written');
  assert.equal($$('.chord .no-chord').map((n) => n.textContent).join(), 'No chord');
});
