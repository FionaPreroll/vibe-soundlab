// What the browser test and the screenshots share: a small server for the site and
// a Chromium page that loads Strudel, Hydra and the soundfonts from node_modules
// (the same pinned versions as the CDN URLs), so both also run where the CDN is blocked.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SOUNDFONTS_URL, STRUDEL_URL } from '../../src/engine.js';
import { HYDRA_URL } from '../../src/visuals.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

// Serves the repository folder on a free port; resolves to { url, close }.
export async function serveSite() {
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
  return { url: `http://localhost:${server.address().port}/`, close: () => server.close() };
}

// Chromium that may play sound without a click; goes through HTTPS_PROXY when one is set.
export function launchBrowser() {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost' } : undefined;
  return chromium.launch({ proxy, args: ['--autoplay-policy=no-user-gesture-required'] });
}

// Context options that go with launchBrowser().
export const contextOptions = () => ({ ignoreHTTPSErrors: !!process.env.HTTPS_PROXY });

// Answers the page's requests for Strudel, Hydra and the soundfonts module from node_modules.
export async function routeLibraries(page) {
  const strudelDir = require.resolve('@strudel/web/dist/index.mjs').replace(/dist[/\\]index\.mjs$/, '');
  const cdnBase = STRUDEL_URL.replace(/dist\/index\.mjs$/, '');
  await page.route(`${cdnBase}**`, async (route) => {
    const file = join(strudelDir, route.request().url().slice(cdnBase.length).split('?')[0]);
    route.fulfill({ body: await readFile(file), contentType: 'text/javascript' });
  });
  const hydraFile = require.resolve('hydra-synth');
  await page.route(HYDRA_URL, async (route) => route.fulfill({ body: await readFile(hydraFile), contentType: 'text/javascript' }));
  const fontsFile = require.resolve('@strudel/soundfonts/dist/index.mjs');
  await page.route(SOUNDFONTS_URL, async (route) => route.fulfill({ body: await readFile(fontsFile), contentType: 'text/javascript' }));
}
