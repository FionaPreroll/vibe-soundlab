// Browser smoke test: serves the site, loads Strudel from the CDN, plays every
// repo track for a few seconds and fails on any error Strudel or the page reports.
// Needs Playwright with Chromium and network access: npm run e2e
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STRUDEL_URL } from '../../src/engine.js';

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
const problems = [];
page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));
page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error' || /\[eval\] error|error:/i.test(text)) problems.push(`console: ${text}`);
});

try {
  await page.goto(url);
  await page.waitForSelector('.track .pick');
  const titles = await page.$$eval('.track .name', (nodes) => nodes.map((n) => n.textContent));
  console.log(`tracks: ${titles.join(', ')}`);
  for (let i = 0; i < titles.length; i++) {
    await page.click(`.track:nth-child(${i + 1}) .pick`);
    if ((await page.textContent('[data-role=play]')) === 'Play') await page.click('[data-role=play]');
    await page.waitForFunction(() => /Playing|Could not/.test(document.querySelector('[data-role=status]').textContent), null, { timeout: 60000 });
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
    const bar = Number(progress.match(/Bar (\d+)/)?.[1]);
    const expected = Math.ceil((SECONDS_PER_TRACK * Number(status.match(/(\d+) BPM/)?.[1] ?? 174)) / 240) + 2;
    if (!(bar >= 1 && bar <= expected)) problems.push(`${titles[i]}: expected to start from bar 1, now at ${progress}`);
  }
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
