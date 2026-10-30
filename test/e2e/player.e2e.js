// Browser smoke test: serves the site, loads Strudel from the CDN, plays every
// repo track for a few seconds and fails on any error Strudel or the page reports.
// Needs Playwright with Chromium and network access: pnpm run e2e
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STRUDEL_URL } from '../../src/engine.js';
import { HYDRA_URL } from '../../src/visuals.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const SECONDS_PER_TRACK = Number(process.env.E2E_SECONDS ?? 6);

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, path.endsWith('/') ? `${path}index.html` : path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'text/html' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost' } : undefined;
const browser = await chromium.launch({ proxy, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ ignoreHTTPSErrors: !!proxy });
// Serve @strudel/web from node_modules (same pinned version as the CDN URL), so the
// test also runs where the CDN is blocked.
const strudelDir = require.resolve('@strudel/web/dist/index.mjs').replace(/dist[/\\]index\.mjs$/, '');
const cdnBase = STRUDEL_URL.replace(/dist\/index\.mjs$/, '');
await page.route(`${cdnBase}**`, async (route) => {
  const file = join(strudelDir, route.request().url().slice(cdnBase.length).split('?')[0]);
  route.fulfill({ body: await readFile(file), contentType: 'text/javascript' });
});
// Hydra the same way: its browser build from node_modules.
const hydraFile = require.resolve('hydra-synth');
await page.route(HYDRA_URL, async (route) => route.fulfill({ body: await readFile(hydraFile), contentType: 'text/javascript' }));
const problems = [];
// what the test is doing, so errors say when they happened
let step = 'loading the page';
page.on('pageerror', (err) => problems.push(`${step}: page error: ${err.message}`));
page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error' || /\[eval\] error|error:/i.test(text)) problems.push(`${step}: console: ${text}`);
});

try {
  await page.goto(url);
  await page.waitForSelector('.track .pick');
  const titles = await page.$$eval('.track .name', (nodes) => nodes.map((n) => n.textContent));
  console.log(`tracks: ${titles.join(', ')}`);
  for (let i = 0; i < titles.length; i++) {
    step = `playing ${titles[i]}`;
    await page.click(`.track:nth-child(${i + 1}) .pick`);
    if ((await page.textContent('[data-role=play]')) === 'Play') await page.click('[data-role=play]');
    await page.waitForFunction(
      (title) => new RegExp(`Playing ${title}|Could not`).test(document.querySelector('[data-role=status]').textContent),
      titles[i],
      { timeout: 60000 },
    );
    const status = await page.textContent('[data-role=status]');
    if (!status.startsWith('Playing')) problems.push(`${titles[i]}: ${status}`);
    await page.waitForTimeout(SECONDS_PER_TRACK * 1000);
    const state = await page.evaluate(async (url) => {
      const { getAudioContext } = await import(url);
      return getAudioContext().state;
    }, STRUDEL_URL);
    const progress = await page.textContent('[data-role=progress]');
    console.log(`${titles[i]}: ${status} · ${progress} · audio ${state}`);
    if (state !== 'running') problems.push(`${titles[i]}: audio context is ${state}`);
    const visuals = await page.$eval('[data-role=visuals]', (canvas) => canvas.classList.contains('on'));
    if (!visuals) problems.push(`${titles[i]}: the Hydra visuals did not start`);
    const bar = Number(progress.match(/Bar (\d+)/)?.[1]);
    const expected = Math.ceil((SECONDS_PER_TRACK * Number(status.match(/(\d+) BPM/)?.[1] ?? 174)) / 240) + 2;
    if (!(bar >= 1 && bar <= expected)) problems.push(`${titles[i]}: expected to start from bar 1, now at ${progress}`);
  }

  // Seek: jump into the first drop of the last track and keep playing from there.
  const jump = async (bar) => {
    step = `seeking to bar ${bar + 1}`;
    await page.$eval(
      '[data-role=seek]',
      (input, value) => {
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
      bar,
    );
    await page.waitForTimeout(2500);
    const progress = await page.textContent('[data-role=progress]');
    const at = Number(progress.match(/Bar (\d+)/)?.[1]);
    console.log(`seek to bar ${bar + 1}: ${progress} ${await page.textContent('[data-role=section]')}`);
    if (!(at >= bar + 1 && at <= bar + 5)) problems.push(`seek to bar ${bar + 1}: now at ${progress}`);
  };
  await jump(24);

  // Mixer: in the drop, drums and bass reach their own strips; muting the bass silences its strip.
  step = 'mixer';
  // Peak level of each strip over one second: one analyser block is only 43 ms, and a
  // sparse drum part can be quiet for that long.
  const levels = () =>
    page.evaluate(async () => {
      const graph = window.vibePlayer.engine.mixer();
      if (!graph) return null;
      const targets = ['master', 1, 2, 3];
      const peaks = Object.fromEntries(targets.map((t) => [t, 0]));
      for (let i = 0; i < 20; i++) {
        for (const target of targets) {
          const analyser = graph.analyser(target);
          const data = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(data);
          peaks[target] = Math.max(peaks[target], ...data.map(Math.abs));
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return peaks;
    });
  const loud = await levels();
  console.log(`mixer peaks: ${JSON.stringify(loud)}`);
  if (!loud) problems.push('mixer: no audio graph');
  else if (!(loud[1] > 0.01 && loud[2] > 0.01 && loud.master > 0.01)) problems.push(`mixer: expected drums, bass and master to play, got ${JSON.stringify(loud)}`);
  await page.click('.strip[data-target="2"] .mute');
  await page.waitForTimeout(600);
  const muted = await levels();
  if (!(muted?.[2] < 0.001 && muted?.[1] > 0.01)) problems.push(`mixer: muting the bass should silence only it, got ${JSON.stringify(muted)}`);
  await page.click('.strip[data-target="2"] .mute');

  // Code: highlighted, with the sounding notes marked.
  step = 'code marks';
  const marks = await page.$$eval('[data-role=code] .playing', (nodes) => nodes.map((n) => n.textContent));
  console.log(`marked in the code: ${marks.slice(0, 8).join(' ')}${marks.length > 8 ? ' …' : ''}`);
  if (marks.length === 0) problems.push('code: no notes marked while playing');

  // Visuals: the switch hides them and brings them back.
  step = 'visuals switch';
  const visualsOn = () => page.$eval('[data-role=visuals]', (canvas) => canvas.classList.contains('on'));
  await page.click('[data-role=visuals-toggle]');
  if (await visualsOn()) problems.push('visuals: still shown after switching them off');
  await page.click('[data-role=visuals-toggle]');
  if (!(await visualsOn())) problems.push('visuals: not shown after switching them back on');
  console.log('visuals: on for every track, the switch works');

  await jump(8);

  // Playlist: a two-bar upload at the end of the list, repeat all → Nachtschicht follows it.
  step = 'playlist';
  await page.setInputFiles('[data-role=file]', {
    name: 'short.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from('// @title Short\n// @bpm 174\n// @bars 2\nsetcpm(174 / 4)\ns("bd*4").bank("RolandTR909")\n'),
  });
  await page.waitForFunction(() => document.querySelector('[data-role=title]').textContent === 'Short');
  while ((await page.textContent('[data-role=repeat]')) !== 'Repeat all') await page.click('[data-role=repeat]');
  await page.click('[data-role=play]');
  await page.waitForFunction(() => /Playing Nachtschicht/.test(document.querySelector('[data-role=status]').textContent), null, { timeout: 30000 });
  console.log('playlist: Short → Nachtschicht');
  await page.click('[data-role=play]');
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${[...new Set(problems)].join('\n')}`);
  process.exit(1);
}
console.log('e2e ok');
