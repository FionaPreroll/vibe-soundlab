// Songs load sample sets from other sites with samples('https://…/strudel.json').
// Strudel stops the whole song when one of them doesn't load. Here the song plays on
// without it, and the player says which site failed and, as far as a page can tell, why.

// A sample list that takes longer than this is left out (it still arrives later).
export const SAMPLES_TIMEOUT_MS = 10000;

const LATE = Symbol('late');

/**
 * The site a samples() argument loads from, as people know it: "tij.men",
 * "github.com/tidalcycles/dirt-samples", "shabda.ndre.gr".
 */
export function sampleSite(source) {
  const github = /^github:([^/]+)(?:\/([^/]+))?/.exec(source);
  if (github) return `github.com/${github[1]}/${github[2] || 'samples'}`;
  const bubo = /^bubo:([^/]+)/.exec(source);
  if (bubo) return `github.com/Bubobubobubobubo/dough-${bubo[1]}`;
  if (source.startsWith('shabda')) return 'shabda.ndre.gr';
  try {
    return new URL(source).host || source;
  } catch {
    return source;
  }
}

/**
 * Why a sample list did not load. Strudel only says that it didn't, so the list is
 * asked for once more: 'unreachable' (no answer, or the site doesn't let other pages
 * read its files, which a page can't tell apart), 'status' (an error page, with
 * `status`), 'format' (not a sample list) or 'late' (with `seconds`). Null when
 * there is no web address to ask.
 */
export async function diagnose(url, { fetchFn = fetch, timeout = SAMPLES_TIMEOUT_MS } = {}) {
  if (!/^https?:\/\//.test(url ?? '')) return null;
  let response;
  try {
    response = await within(fetchFn(url), timeout);
  } catch {
    return { reason: 'unreachable' };
  }
  if (response === LATE) return { reason: 'late', seconds: timeout / 1000 };
  if (!response.ok) return { reason: 'status', status: response.status };
  return { reason: 'format' };
}

/**
 * Wraps Strudel's samples() for the songs. A sample list from another site that
 * fails or takes longer than `timeout` ms is reported to `onSkip({ site, url, reason,
 * … })` (see diagnose) and left out, so the song plays with the sounds it has. Sample
 * maps written in the code are the song's own, so their mistakes still stop it.
 */
export function forgivingSamples(samples, { onSkip, fetchFn = fetch, timeout = SAMPLES_TIMEOUT_MS }) {
  return async function forgiving(source, ...rest) {
    if (typeof source !== 'string') return samples(source, ...rest);
    const site = sampleSite(source);
    let loaded;
    try {
      loaded = await within(samples(source, ...rest), timeout);
    } catch (err) {
      // Strudel's error names the address it asked, with github: and the like resolved.
      const url = /error loading "([^"]+)"/.exec(err?.message ?? '')?.[1] ?? source;
      onSkip({ site, url, ...((await diagnose(url, { fetchFn, timeout })) ?? { reason: 'failed' }) });
      return undefined;
    }
    if (loaded === LATE) {
      onSkip({ site, url: source, reason: 'late', seconds: timeout / 1000 });
      return undefined;
    }
    return loaded;
  };
}

/** Resolves to LATE if `promise` takes longer than `ms`. */
async function within(promise, ms) {
  let timer = null;
  const late = new Promise((resolve) => {
    timer = setTimeout(() => resolve(LATE), ms);
  });
  try {
    return await Promise.race([promise, late]);
  } finally {
    clearTimeout(timer);
  }
}

const REASONS = {
  unreachable: () => 'the site did not answer, or it does not let other web pages load its files',
  status: ({ status }) => `the site answered with error ${status}`,
  format: () => 'what the site sent is not a list of samples',
  late: ({ seconds }) => `the site took longer than ${seconds} seconds to answer`,
};

/**
 * What the player says about sample sets a song could not load: "Its samples from
 * tij.men did not load (…). It plays on with the standard sounds, …". Empty when none.
 */
export function describeSkipped(skipped) {
  if (!skipped?.length) return '';
  const bySite = new Map();
  for (const skip of skipped) if (!bySite.has(skip.site)) bySite.set(skip.site, skip);
  const parts = [...bySite.values()].map((skip) => {
    const why = REASONS[skip.reason]?.(skip);
    return `Its samples from ${skip.site} did not load${why ? ` (${why})` : ''}.`;
  });
  return `${parts.join(' ')} It plays on with the standard sounds, so some parts may sound different or be missing.`;
}
