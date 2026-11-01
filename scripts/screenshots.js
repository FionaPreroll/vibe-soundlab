// Takes the screenshots the README shows, in docs/screenshots/: plays tracks in
// headless Chromium and photographs the parts of the player while they work.
// pnpm run screenshots. Needs Playwright's Chromium, like pnpm run e2e. The
// "Update screenshots" workflow runs this and opens a pull request with the new pictures.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { ROOT, contextOptions, launchBrowser, routeLibraries, serveSite } from '../test/e2e/site.js';

const OUT = join(ROOT, 'docs/screenshots');
// The track the player shows in most pictures, and the tracks whose visuals are shown.
const TRACK = 'Druckwelle';
const VISUALS = ['Nachtschicht', 'Polarlicht', 'Kernschmelze', 'Schwerkraft', 'Seriennummer', 'Rasterzeile'];

const problems = [];
const server = await serveSite();
const browser = await launchBrowser();
await mkdir(OUT, { recursive: true });

// A page on the player, in the dark scheme it starts in, at twice the pixels for sharp text.
async function open(viewport, deviceScaleFactor = 2) {
  const context = await browser.newContext({ ...contextOptions(), viewport, deviceScaleFactor, colorScheme: 'dark' });
  const page = await context.newPage();
  page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));
  await routeLibraries(page);
  await page.goto(server.url);
  await page.waitForSelector('.track .pick');
  return page;
}

// Plays a track from the start of its first drop (chorus in the chiptunes).
async function play(page, title) {
  await page.locator('.track .pick', { hasText: title }).first().click();
  if ((await page.textContent('[data-role=play]')) === 'Play') await page.click('[data-role=play]');
  await page.waitForFunction(
    (title) => /^Playing |Could not/.test(document.querySelector('[data-role=status]').textContent) && document.querySelector('[data-role=title]').textContent === title,
    title,
    { timeout: 60000 },
  );
  const status = await page.textContent('[data-role=status]');
  if (!status.startsWith('Playing')) throw new Error(`${title}: ${status}`);
  await page.locator('.sections .section', { hasText: /^(Drop|Chorus)/ }).first().click();
}

async function shoot(target, name, options = {}) {
  const path = join(OUT, `${name}.png`);
  await target.screenshot({ path, animations: 'disabled', ...options });
  console.log(`docs/screenshots/${name}.png`);
}

// Scrolls `first` to the top of the window and returns the part of it from the top of
// `first` to the bottom of `last`, at most `maxHeight` high and with `margin` around it.
// The visuals cover only the window, so the picture has to fit in it.
const clipOf = (page, { first, last = first, maxHeight = Infinity, margin = 0 }) =>
  page.evaluate(
    ([first, last, maxHeight, margin]) => {
      window.scrollBy(0, document.querySelector(first).getBoundingClientRect().top - margin);
      const top = document.querySelector(first).getBoundingClientRect();
      const bottom = document.querySelector(last).getBoundingClientRect();
      const height = Math.min(bottom.bottom - top.top, maxHeight) + 2 * margin;
      return { x: top.left - margin, y: top.top - margin, width: top.width + 2 * margin, height };
    },
    [first, last, maxHeight, margin],
  );

const setRange = (page, selector, value) =>
  page.$eval(
    selector,
    (input, value) => {
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    value,
  );

try {
  const page = await open({ width: 1280, height: 800 });
  await play(page, TRACK);
  // a few bars into the drop: chords are worked out ahead, the meters and visuals are up
  await page.waitForFunction(() => document.querySelectorAll('.chord svg.diagram').length >= 4, null, { timeout: 20000 });
  await page.waitForTimeout(3000);

  // The whole player, and its parts.
  await shoot(page, 'player');
  await shoot(page.locator('section.now'), 'now-playing');
  await shoot(page.locator('[data-role=chords]'), 'chords');
  // a taller window from here, so mixer and EQ fit in it together
  await page.setViewportSize({ width: 1280, height: 1000 });

  // Mixer and EQ: the bass channel in the EQ, with a little more low end and less mud.
  await page.click('.strip[data-target="2"] .name');
  await setRange(page, '.eq-band:nth-child(2) .band', 4);
  await setRange(page, '.eq-band:nth-child(3) .band', -5);
  await setRange(page, '.eq-band:nth-child(6) .band', 3);
  await page.waitForTimeout(1000);
  await shoot(page, 'mixer', { clip: await clipOf(page, { first: '[data-role=mixer]', last: '[data-role=eq]' }) });

  // Code: the notes that sound are marked. Scrolled to the first marked one.
  const code = page.locator('details.source');
  await code.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelectorAll('[data-role=code] .playing').length > 3, null, { timeout: 10000 });
  await page.$eval('[data-role=code-input]', (input) => {
    const first = document.querySelector('[data-role=code] .playing');
    input.scrollTop = Math.max(0, first.offsetTop - 60);
    input.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(400);
  await shoot(code, 'code');

  // A mistake while it plays: the music goes on and the line is marked.
  const original = await page.$eval('[data-role=code-input]', (input) => input.value);
  await page.$eval(
    '[data-role=code-input]',
    (input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    original.replace('setcpm(', 's("bd [sd")\nsetcpm('),
  );
  await page.focus('[data-role=code-input]');
  await page.keyboard.press('Control+Enter');
  await page.waitForSelector('[data-role=code-error]:not([hidden])', { timeout: 15000 });
  await page.waitForTimeout(400);
  await shoot(code, 'live-edit');
  await page.click('[data-role=revert]');

  // Songs from GitHub, switched on, with tzwaan's game soundtracks open.
  await page.click('[data-role=external-on]');
  await page.waitForSelector('[data-role=external-list] .source');
  await page.click('[data-role=external-list] .source[data-source=tzwaan] summary');
  await shoot(page, 'songs-from-github', { clip: await clipOf(page, { first: '.external', maxHeight: 640, margin: 12 }) });
  await page.click('[data-role=play]');
  await page.context().close();

  // Every track brings its own visuals: a few of them, without the player in front.
  // Hydra draws at half the window size, so twice the pixels would add nothing.
  const stage = await open({ width: 800, height: 500 }, 1);
  for (const title of VISUALS) {
    await play(stage, title);
    await stage.waitForTimeout(4000);
    if (!(await stage.$eval('[data-role=visuals]', (canvas) => canvas.classList.contains('on')))) problems.push(`${title}: no visuals`);
    await shoot(stage, `visuals-${title.toLowerCase()}`, { style: '.app { visibility: hidden; }' });
  }
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${[...new Set(problems)].join('\n')}`);
  process.exit(1);
}
