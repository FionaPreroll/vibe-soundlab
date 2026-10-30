// Wires the player page together. Everything it touches (DOM root, engine,
// fetch, storage) is passed in, so tests can drive it without a browser.
import { loadCatalog } from './catalog.js';
import { chordName, createChordTracker, spellingFor } from './chords.js';
import { createEditor } from './editor.js';
import { plainMessage } from './guard.js';
import { chordDiagram, voicing } from './guitar.js';
import { durationSeconds, formatDuration } from './header.js';
import { Library } from './library.js';
import { channelNames } from './mixer.js';
import { createMixerPanel } from './mixer-panel.js';
import { REPEAT_LABELS, hasEnded, nextRepeatMode, parseRepeatMode, trackAfter } from './playlist.js';
import { parseSections, sectionAt } from './sections.js';
import { strudelUrl } from './share.js';
import { SOURCES, loadSources, repoUrl } from './sources.js';
import { MAX_UPLOAD_BYTES, checkCode, readUpload } from './upload.js';

const el = (doc, tag, props = {}, children = []) => {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('data-')) node.setAttribute(key, value);
    else node[key] = value;
  }
  for (const child of children) node.append(child);
  return node;
};

/** "Liquid / atmospheric · C minor · 172 BPM · 2:58", or "Song by Cardiacs · script by eefano" */
export function describeTrack(meta) {
  const length = formatDuration(durationSeconds(meta));
  return [meta.credits, meta.style, meta.key, meta.bpm && `${meta.bpm} BPM`, length].filter(Boolean).join(' · ');
}

const isExternal = (track) => track?.source === 'external';

/** An error as the player shows it: "Line 3: Unexpected token" (no "(3:11)" at the end). */
export function describeError(err) {
  const message = plainMessage(err);
  return err?.location ? `Line ${err.location.line}: ${message}` : message;
}

export async function createApp({ root, engine, fetchFn, storage = null, location = null, visuals = null, clock = () => performance.now() }) {
  const doc = root.ownerDocument;
  const library = new Library({ storage });
  const REPEAT_KEY = 'vibe-player:repeat';
  let storedRepeat = null;
  try {
    storedRepeat = storage?.getItem(REPEAT_KEY) ?? null;
  } catch {
    // Blocked storage: start with repeat off.
  }
  const VISUALS_KEY = 'vibe-player:visuals';
  let storedVisuals = null;
  try {
    storedVisuals = storage?.getItem(VISUALS_KEY) ?? null;
  } catch {
    // Blocked storage: visuals on.
  }
  // Songs from other repositories run their code in this page, so they only show up
  // once the listener has switched them on. The choice is remembered.
  const EXTERNAL_KEY = 'vibe-player:external';
  let storedExternal = null;
  try {
    storedExternal = storage?.getItem(EXTERNAL_KEY) ?? null;
  } catch {
    // Blocked storage: off until switched on.
  }
  // Code changed in the editor, per track, kept for the next visit.
  const DRAFTS_KEY = 'vibe-player:drafts';
  const drafts = new Map();
  try {
    for (const [id, code] of Object.entries(JSON.parse(storage?.getItem(DRAFTS_KEY) ?? '{}'))) if (typeof code === 'string') drafts.set(id, code);
  } catch {
    // Blocked storage or a broken entry: no drafts.
  }
  const CHORDS_KEY = 'vibe-player:chords';
  let storedChords = null;
  try {
    storedChords = storage?.getItem(CHORDS_KEY) ?? null;
  } catch {
    // Blocked storage: full chords.
  }
  const state = {
    external: storedExternal === 'on',
    // the code that plays (the track's, or as changed in the editor)
    playingCode: null,
    // the last error in the selected track's code, as describeError shows it
    codeError: null,
    simpleChords: storedChords === 'simple',
    // the repositories from sources/index.json, once loaded
    sources: [],
    visuals: storedVisuals !== 'off',
    selected: null,
    playing: null,
    loading: null,
    status: '',
    error: false,
    repeat: parseRepeatMode(storedRepeat),
    // the bar the seek bar is being dragged to, or null
    scrub: null,
  };

  const q = (sel) => root.querySelector(sel);
  const list = q('[data-role=list]');
  const title = q('[data-role=title]');
  const details = q('[data-role=details]');
  const about = q('[data-role=about]');
  const code = q('[data-role=code]');
  const status = q('[data-role=status]');
  const playButton = q('[data-role=play]');
  const openLink = q('[data-role=open]');
  const fileInput = q('[data-role=file]');
  const dropZone = q('[data-role=drop]');
  const progress = q('[data-role=progress]');
  const repeatButton = q('[data-role=repeat]');
  const visualsButton = q('[data-role=visuals-toggle]');
  const seekBar = q('[data-role=seek]');
  const sectionList = q('[data-role=sections]');
  const sectionName = q('[data-role=section]');
  const timeNow = q('[data-role=time]');
  const timeTotal = q('[data-role=length]');
  const origin = q('[data-role=origin]');
  const externalConsent = q('[data-role=external-consent]');
  const externalBrowse = q('[data-role=external-browse]');
  const externalList = q('[data-role=external-list]');
  const externalFind = q('[data-role=external-find]');
  const externalNone = q('[data-role=external-none]');
  const applyButton = q('[data-role=apply]');
  const revertButton = q('[data-role=revert]');
  const editedBadge = q('[data-role=edited]');
  const codeHint = q('[data-role=code-hint]');
  const codeError = q('[data-role=code-error]');
  const chordRow = q('[data-role=chord-row]');
  const chordsNone = q('[data-role=chords-none]');
  const chordsSimple = q('[data-role=chords-simple]');

  const mixer = createMixerPanel({ mixerRoot: q('[data-role=mixer]'), eqRoot: q('[data-role=eq]'), engine, storage });

  /** The code a track plays: as changed in the editor, else its own (null until loaded). */
  const codeFor = (track) => (track ? (drafts.get(track.id) ?? track.code) : null);

  // Sections only change with the code, so each version's are read once. While a track
  // plays they come from the code that plays.
  const sectionCache = new Map();
  const sectionsOf = (track) => {
    const text = (state.playing === track.id && state.playingCode) || codeFor(track) || '';
    if (!sectionCache.has(text)) sectionCache.set(text, parseSections(text));
    return sectionCache.get(text);
  };

  function setStatus(text, error = false) {
    state.status = text;
    state.error = error;
    status.textContent = text;
    status.classList.toggle('error', error);
  }

  function renderList() {
    list.replaceChildren(
      ...library.list().filter((track) => !isExternal(track)).map((track) => {
        const pick = el(doc, 'button', { class: 'pick', type: 'button', 'data-id': track.id }, [
          el(doc, 'span', { class: 'name', text: track.meta.title }),
          el(doc, 'span', { class: 'sub', text: describeTrack(track.meta) || track.file }),
        ]);
        pick.addEventListener('click', () => select(track.id, { autoplay: state.playing !== null }));
        const item = el(doc, 'li', { class: 'track', 'data-id': track.id }, [pick]);
        item.classList.toggle('edited', drafts.has(track.id));
        if (track.source === 'upload') {
          item.classList.add('uploaded');
          const remove = el(doc, 'button', { class: 'remove', type: 'button', text: '×', title: `Remove ${track.meta.title}` });
          remove.setAttribute('aria-label', `Remove ${track.meta.title}`);
          remove.addEventListener('click', () => removeUpload(track.id));
          item.append(remove);
        }
        item.classList.toggle('selected', track.id === state.selected);
        item.classList.toggle('playing', track.id === state.playing);
        if (track.id === state.selected) pick.setAttribute('aria-current', 'true');
        return item;
      }),
    );
  }

  function renderNow() {
    const track = library.get(state.selected);
    title.textContent = track ? track.meta.title : 'No track';
    details.textContent = track ? describeTrack(track.meta) : '';
    about.textContent = track?.meta.about ?? (track?.source === 'upload' ? `Uploaded: ${track.file}` : track?.meta.note ?? '');
    origin.hidden = !isExternal(track);
    if (isExternal(track)) {
      const link = el(doc, 'a', { href: track.origin.page, target: '_blank', rel: 'noopener', text: `${track.origin.repo}/${track.file}` });
      origin.replaceChildren('From ', link, ' on GitHub');
    }
    showCode(track);
    const text = codeFor(track);
    openLink.href = text != null ? strudelUrl(text) : 'https://strudel.cc/';
    const isPlaying = track !== null && state.playing === track.id;
    const isLoading = track !== null && state.loading === track.id;
    playButton.textContent = isLoading ? 'Loading…' : isPlaying ? 'Stop' : 'Play';
    playButton.setAttribute('aria-pressed', String(isPlaying));
    playButton.disabled = !track || isLoading;
    repeatButton.textContent = REPEAT_LABELS[state.repeat];
    repeatButton.dataset.mode = state.repeat;
    repeatButton.setAttribute('aria-pressed', String(state.repeat !== 'off'));
    renderSections(track);
    renderSeek();
  }

  // The code panel is an editor (editor.js). It shows the selected track's code as
  // changed so far; while the track plays, Update swaps the changed code in.
  const editor = createEditor({
    input: q('[data-role=code-input]'),
    layer: q('[data-role=code-layer]'),
    code,
    errorLine: q('[data-role=error-line]'),
    onChange: (text) => edited(text),
    onApply: () => apply(),
    onStop: () => stop(),
  });
  let shownTrack = null;

  function showCode(track) {
    if (track?.id !== shownTrack || codeFor(track) !== editor.value()) {
      shownTrack = track?.id ?? null;
      editor.setValue(codeFor(track) ?? '');
      editor.showError(state.codeError?.track === shownTrack ? state.codeError.location : null);
    }
    editor.setReadOnly(!track || track.code === null);
    renderCodeTools(track);
  }

  // The code differs from what plays (so its marks would land in the wrong places).
  const isDirty = (track) => state.playing === track?.id && state.playingCode !== null && editor.value() !== state.playingCode;

  function renderCodeTools(track = library.get(state.selected)) {
    const playingThis = track !== null && state.playing === track.id && state.loading === null;
    const dirty = isDirty(track);
    applyButton.disabled = !playingThis || !dirty;
    revertButton.hidden = !drafts.has(track?.id);
    editedBadge.hidden = !drafts.has(track?.id);
    codeHint.textContent = !track || track.code === null
      ? ''
      : dirty
        ? 'Changed, not playing yet: press Update or Ctrl+Enter.'
        : playingThis
          ? 'Change the code while it plays, then press Update or Ctrl+Enter. Ctrl+. stops.'
          : 'Change the code here; Play or Ctrl+Enter plays it as changed.';
    const error = state.codeError?.track === track?.id ? state.codeError : null;
    codeError.hidden = error === null;
    codeError.textContent = error ? `${error.text}${error.location ? ' (show)' : ''}` : '';
  }

  function rememberDrafts() {
    try {
      storage?.setItem(DRAFTS_KEY, JSON.stringify(Object.fromEntries(drafts)));
    } catch {
      // Too big or blocked: kept for this visit.
    }
  }

  function edited(text) {
    const track = library.get(state.selected);
    if (!track || track.code === null) return;
    if (text === track.code) drafts.delete(track.id);
    else drafts.set(track.id, text);
    rememberDrafts();
    if (state.codeError?.track === track.id) state.codeError = null;
    openLink.href = strudelUrl(text);
    renderCodeTools(track);
    for (const item of list.children) if (item.dataset.id === track.id) item.classList.toggle('edited', drafts.has(track.id));
  }

  function setCodeError(track, err) {
    state.codeError = { track: track.id, text: describeError(err), location: err?.location ?? null };
    if (state.selected === track.id) editor.showError(state.codeError.location);
  }

  function clearCodeError(track) {
    if (state.codeError?.track !== track.id) return;
    state.codeError = null;
    if (state.selected === track.id) editor.showError(null);
  }

  /**
   * Ctrl+Enter or Update: while the selected track plays, its changed code takes over
   * without starting again; otherwise the track plays as changed.
   */
  async function apply() {
    const track = library.get(state.selected);
    if (!track || track.code === null || state.loading !== null) return;
    if (state.playing !== track.id || !engine.update) return play();
    const text = editor.value();
    try {
      await engine.update(text);
      if (state.playing !== track.id) return;
      // undone right away, because it failed as it started (see playbackError)
      if (engine.playingCode && engine.playingCode() !== text) return;
      state.playingCode = text;
      clearCodeError(track);
      setStatus(`Playing ${track.meta.title} (updated)`);
    } catch (err) {
      if (state.playing !== track.id) return;
      setCodeError(track, err);
      setStatus(`Not updated, ${track.meta.title} plays on as before. ${describeError(err)}`, true);
    }
    renderNow();
  }

  function revert() {
    const track = library.get(state.selected);
    if (!track || !drafts.has(track.id)) return null;
    drafts.delete(track.id);
    rememberDrafts();
    clearCodeError(track);
    render();
    return state.playing === track.id ? apply() : null;
  }

  const codePanel = code.closest('details');
  let lastMark = -Infinity;
  function markPlaying(now) {
    if (now - lastMark < 1000 / 30) return;
    lastMark = now;
    const track = library.get(state.selected);
    const live = state.playing !== null && state.playing === state.selected && state.loading === null && !isDirty(track);
    editor.mark(live && codePanel?.open !== false ? engine.activeLocations() : []);
  }

  // Guitar chords of what plays (chords.js finds them, guitar.js draws the shapes).
  const chords = createChordTracker({ query: (begin, end) => engine.query?.(begin, end) ?? [], clock });
  let chordsOf = null;
  let chordsShown = null;
  let lastChords = -Infinity;
  const diagrams = new Map();

  function diagramFor(chord, name) {
    if (!diagrams.has(name)) diagrams.set(name, chordDiagram(doc, voicing(chord), name));
    return diagrams.get(name).cloneNode(true);
  }

  // "Bar 17", or "Bar 17 · beat 3" for a chord that comes in the middle of the bar.
  const barLabel = (start) => `Bar ${Math.floor(start) + 1}${Number.isInteger(start) ? '' : ` · beat ${Math.round((start % 1) * 4) + 1}`}`;

  function renderChords(now) {
    if (now - lastChords < 1000 / 10) return;
    lastChords = now;
    const track = library.get(state.playing);
    const pos = track && state.loading === null ? engine.position() : null;
    const version = engine.version?.() ?? 0;
    if (chordsOf !== `${track?.id}|${version}`) {
      chordsOf = `${track?.id}|${version}`;
      chords.reset();
    }
    let changes = [];
    let note = 'The chords show up here while a track plays.';
    if (pos != null) {
      chords.fill(pos, 8, 4);
      changes = chords.upcoming(pos, 4, { simple: state.simpleChords });
      if (chords.isSlow()) note = 'This song is too heavy to look ahead in, so there are no chords for it.';
      else if (changes.length === 0) note = 'Listening for chords…';
      else if (changes.every((change) => change.chord === null)) note = 'No chords here: only drums, noise or single notes play.';
    }
    const spelling = spellingFor({ key: track?.meta.key, spelled: chords.spelled() });
    const named = changes.map((change) => ({ ...change, name: chordName(change.chord, spelling) }));
    const view = `${note}|${state.simpleChords}|${named.map((c) => `${c.start}:${c.name}`).join(',')}`;
    if (view === chordsShown) return;
    chordsShown = view;
    const shown = named.length > 0 && !named.every((change) => change.chord === null);
    chordRow.hidden = !shown;
    chordsNone.hidden = shown;
    chordsNone.textContent = note;
    chordRow.replaceChildren(
      ...(shown ? named : []).map((change, i) => {
        const item = el(doc, 'li', { class: i === 0 ? 'chord now' : 'chord' }, [
          el(doc, 'span', { class: 'when', text: i === 0 ? 'Now' : barLabel(change.start) }),
          el(doc, 'span', { class: 'chord-name', text: change.name || '–' }),
        ]);
        // every chord the tracker names has a shape (see the guitar tests)
        item.append(change.chord ? diagramFor(change.chord, change.name) : el(doc, 'span', { class: 'no-chord', text: 'No chord' }));
        return item;
      }),
    );
  }

  function toggleSimpleChords() {
    state.simpleChords = !state.simpleChords;
    try {
      storage?.setItem(CHORDS_KEY, state.simpleChords ? 'simple' : 'full');
    } catch {
      // Not remembered, but switched for this visit.
    }
    chordsSimple.setAttribute('aria-pressed', String(state.simpleChords));
    lastChords = -Infinity;
  }

  // The parts of the arrangement as buttons under the seek bar, sized by their length.
  function renderSections(track) {
    const bars = track?.meta.bars;
    const sections = track && bars ? sectionsOf(track).filter((s) => s.start < bars) : [];
    sectionList.replaceChildren(
      ...sections.map((section) => {
        const length = Math.min(section.bars, bars - section.start);
        const button = el(doc, 'button', { type: 'button', class: 'section', text: section.label, 'data-start': String(section.start) });
        button.title = `${section.label}: bars ${section.start + 1}–${section.start + length}`;
        button.addEventListener('click', () => seekTo(section.start));
        const item = el(doc, 'li', {}, [button]);
        item.style.left = `${(section.start / bars) * 100}%`;
        item.style.width = `${(length / bars) * 100}%`;
        return item;
      }),
    );
    sectionList.hidden = sections.length === 0;
  }

  /** Bars → "m:ss" at the track's tempo, or '' when the tempo is unknown. */
  const clockTime = (meta, bars) => (meta.bpm ? formatDuration((Math.max(0, bars) * 240) / meta.bpm) : '');

  // Seek bar, clock and current part for the selected track at bar position `pos`.
  function renderSeek(pos = engine.position()) {
    const track = library.get(state.selected);
    const bars = track?.meta.bars ?? null;
    const live = track !== null && state.playing === track.id && state.loading === null && pos != null;
    const at = state.scrub ?? (live ? Math.max(0, pos) : 0);
    seekBar.max = String(bars ?? 1);
    seekBar.disabled = !track || !bars || state.loading !== null;
    if (state.scrub === null) seekBar.value = String(bars ? Math.min(Math.floor(at), bars) : 0);
    seekBar.style.setProperty('--fill', `${bars ? Math.min(100, (at / bars) * 100) : 0}%`);
    seekBar.setAttribute('aria-valuetext', bars ? `Bar ${Math.floor(at) + 1} of ${bars}` : 'Unknown length');
    const meta = track?.meta ?? {};
    timeNow.textContent = clockTime(meta, at) || (track ? '' : '0:00');
    timeTotal.textContent = track ? formatDuration(durationSeconds(meta)) : '';
    if (live || state.scrub !== null) {
      const barNow = bars ? (Math.floor(at) % bars) + 1 : Math.floor(at) + 1;
      progress.textContent = bars ? `Bar ${barNow} / ${bars}` : `Bar ${barNow}`;
    } else {
      progress.textContent = '';
    }
    const current = track ? sectionAt(sectionsOf(track), live || state.scrub !== null ? at : 0) : null;
    sectionName.textContent = current && (live || state.scrub !== null) ? `· ${current.label}` : '';
    for (const button of sectionList.querySelectorAll('.section')) {
      button.classList.toggle('current', current !== null && Number(button.dataset.start) === current.start);
    }
  }

  function render() {
    renderList();
    markExternal();
    renderNow();
    // The mixer names the channels of the track that plays, or else of the one selected.
    mixer.setNames(channelNames(library.get(state.playing ?? state.selected)?.meta.mixer));
  }

  function select(id, { autoplay = false } = {}) {
    const track = library.get(id);
    if (!track) return null;
    state.selected = id;
    if (location) location.hash = id.split(':')[1];
    if (isExternal(track)) reveal(track);
    render();
    if (autoplay) return play();
    if (track.code === null) preload(track);
    return null;
  }

  // Code of songs from other repositories, loaded from GitHub the first time it is needed.
  const codeLoads = new Map();
  function codeOf(track) {
    if (track.code !== null) return Promise.resolve(track.code);
    if (!codeLoads.has(track.id)) codeLoads.set(track.id, fetchCode(track).finally(() => codeLoads.delete(track.id)));
    return codeLoads.get(track.id);
  }

  async function fetchCode(track) {
    let response;
    try {
      response = await fetchFn(track.origin.url);
    } catch (err) {
      throw new Error(`GitHub can't be reached (${err?.message ?? err}).`);
    }
    if (!response.ok) throw new Error(`GitHub answered ${response.status}.`);
    const code = await response.text();
    const problem = code.length > MAX_UPLOAD_BYTES ? `${track.file} is larger than ${MAX_UPLOAD_BYTES / 1024} KB.` : checkCode(track.file, code);
    if (problem) throw new Error(problem);
    library.setCode(track.id, code);
    return code;
  }

  // Shows a song's code as soon as it is picked; playing it waits for the same load.
  async function preload(track) {
    const loading = `Loading ${track.meta.title} from GitHub…`;
    setStatus(loading);
    try {
      await codeOf(track);
      if (state.status === loading) setStatus('');
    } catch (err) {
      if (state.selected === track.id) setStatus(`Could not load ${track.meta.title}: ${err.message}`, true);
    }
    if (state.selected === track.id) renderNow();
  }

  // Every play or stop request gets a number; when an older request finishes
  // after a newer one was made, its result is dropped.
  let request = 0;

  async function play({ from = 0 } = {}) {
    const track = library.get(state.selected);
    if (!track || state.loading === track.id) return;
    const mine = ++request;
    state.loading = track.id;
    setStatus(`Loading ${track.meta.title}…`);
    renderNow();
    try {
      const code = codeFor(track) ?? (await codeOf(track));
      // Stopped, or another track picked, while the code came from GitHub.
      if (mine !== request) return;
      await engine.play(code, { from });
      if (mine !== request) {
        // Stop was pressed while this track was loading: silence it again.
        if (state.loading === null && state.playing === null) engine.stop();
        return;
      }
      state.playing = track.id;
      state.playingCode = code;
      clearCodeError(track);
      setStatus(`Playing ${track.meta.title}`);
    } catch (err) {
      if (mine !== request) return;
      state.playing = null;
      state.playingCode = null;
      setCodeError(track, err);
      setStatus(`Could not play ${track.meta.title}: ${describeError(err)}`, true);
    } finally {
      if (state.loading === track.id && mine === request) state.loading = null;
    }
    render();
  }

  function stop() {
    request++;
    state.loading = null;
    engine.stop();
    state.playing = null;
    state.playingCode = null;
    setStatus('Stopped');
    render();
  }

  /**
   * The engine reports an error from a track that plays (see engine.js): it stopped,
   * a change that failed while playing was undone, or a stretch of it went silent.
   */
  function playbackError(err, { stopped = false, reverted = false, code: before = null } = {}) {
    const track = library.get(state.loading ?? state.playing);
    if (!track) return;
    if (stopped) {
      request++;
      state.loading = null;
      state.playing = null;
      state.playingCode = null;
      setCodeError(track, err);
      setStatus(`Stopped ${track.meta.title}: ${describeError(err)}`, true);
    } else if (reverted) {
      state.playingCode = before;
      setCodeError(track, err);
      setStatus(`Your change failed while playing, so the version before it plays again. ${describeError(err)}`, true);
    } else {
      setStatus(`Error while playing ${track.meta.title}: ${describeError(err)}`, true);
    }
    render();
  }

  /** The visuals stopped because of an error in their code (see visuals.js). */
  function visualsError(err) {
    const track = library.get(state.playing);
    setStatus(`The visuals stopped${track ? ` in ${track.meta.title}` : ''}: ${describeError(err)}`, true);
  }

  function toggle() {
    return state.playing && state.playing === state.selected ? stop() : play();
  }

  /**
   * Jumps to a bar (0-based) of the selected track. While it plays, playback jumps
   * there; otherwise it starts there.
   */
  function seekTo(bar) {
    const track = library.get(state.selected);
    const bars = track?.meta.bars;
    state.scrub = null;
    if (!track || !bars || state.loading !== null) return renderSeek();
    const target = Math.min(Math.max(0, Math.floor(bar)), bars - 1);
    if (state.playing !== track.id) return play({ from: target });
    engine.seek(target);
    return renderSeek();
  }

  function removeUpload(id) {
    if (state.playing === id) stop();
    if (drafts.delete(id)) rememberDrafts();
    library.remove(id);
    if (state.selected === id) state.selected = library.list()[0]?.id ?? null;
    render();
  }

  async function addFiles(files) {
    const results = await Promise.all([...files].map(readUpload));
    const errors = results.filter((r) => r.error).map((r) => r.error);
    const added = results.filter((r) => !r.error).map((r) => library.addUpload(r));
    if (added.length) select(added[0].id);
    else render();
    if (errors.length) setStatus(errors.join(' '), true);
    else if (added.length) setStatus(`Added ${added.map((t) => t.meta.title).join(', ')}`);
    return added;
  }

  function renderVisuals() {
    visualsButton.hidden = visuals === null;
    visualsButton.textContent = state.visuals ? 'Visuals on' : 'Visuals off';
    visualsButton.setAttribute('aria-pressed', String(state.visuals));
    visuals?.setEnabled(state.visuals);
  }

  function toggleVisuals() {
    state.visuals = !state.visuals;
    try {
      storage?.setItem(VISUALS_KEY, state.visuals ? 'on' : 'off');
    } catch {
      // Not remembered, but still switched for this visit.
    }
    renderVisuals();
  }

  function cycleRepeat() {
    state.repeat = nextRepeatMode(state.repeat);
    try {
      storage?.setItem(REPEAT_KEY, state.repeat);
    } catch {
      // Not remembered, but still works for this visit.
    }
    renderNow();
  }

  // Songs from GitHub have a list of their own: next, previous and the end of a song
  // stay in the list the track is in.
  const sameList = (id) => {
    const external = isExternal(library.get(id));
    return (track) => isExternal(track) === external;
  };

  // The songs from GitHub: the switch, then one foldable list per repository,
  // built when they load; render() only marks the selected and playing one.
  const openSources = new Set();
  const names = SOURCES.map(({ name, repo }) => el(doc, 'a', { href: `https://github.com/${repo}`, target: '_blank', rel: 'noopener', text: name }));
  q('[data-role=external-names]').replaceChildren(...names.flatMap((link, i) => [i === 0 ? '' : i === names.length - 1 ? ' and ' : ', ', link]));

  function renderExternal() {
    externalConsent.hidden = state.external;
    externalBrowse.hidden = !state.external;
    const songs = library.list().filter(isExternal);
    externalList.replaceChildren(
      ...state.sources.map((source) => {
        const mine = songs.filter((track) => track.origin.id === source.id);
        const details = el(doc, 'details', { class: 'source', 'data-source': source.id }, [
          el(doc, 'summary', {}, [el(doc, 'span', { class: 'source-name', text: source.name }), el(doc, 'span', { class: 'count', text: `${mine.length} songs` })]),
          el(doc, 'p', { class: 'source-about' }, [`${source.about ?? ''} `, el(doc, 'a', { href: repoUrl(source), target: '_blank', rel: 'noopener', text: source.repo })]),
          ...[...new Set(mine.map((track) => track.origin.group))].flatMap((group) => [
            el(doc, 'h3', { class: 'group', text: group }),
            el(doc, 'ul', { class: 'songs' }, mine.filter((track) => track.origin.group === group).map(songItem)),
          ]),
        ]);
        details.open = openSources.has(source.id);
        details.addEventListener('toggle', () => {
          if (externalFind.value.trim() !== '') return;
          if (details.open) openSources.add(source.id);
          else openSources.delete(source.id);
        });
        return details;
      }),
    );
    findExternal();
    markExternal();
  }

  function songItem(track) {
    const { title, note, credits } = track.meta;
    const pick = el(doc, 'button', { class: 'pick', type: 'button', 'data-id': track.id }, [
      el(doc, 'span', { class: 'name' }, [title, ...(note ? [' ', el(doc, 'small', { text: note })] : [])]),
      ...(credits ? [el(doc, 'span', { class: 'sub', text: credits })] : []),
    ]);
    pick.addEventListener('click', () => select(track.id, { autoplay: state.playing !== null }));
    const item = el(doc, 'li', { class: 'song', 'data-id': track.id }, [pick]);
    item.dataset.find = [title, note, credits, track.file, track.origin.group].filter(Boolean).join(' ').toLowerCase();
    return item;
  }

  function markExternal() {
    for (const item of externalList.querySelectorAll('.song')) {
      const { id } = item.dataset;
      item.classList.toggle('selected', id === state.selected);
      item.classList.toggle('playing', id === state.playing);
      item.querySelector('.pick').toggleAttribute('aria-current', id === state.selected);
    }
  }

  // Opens the list a song is in, so a song picked by a link or by next/previous shows.
  function reveal(track) {
    openSources.add(track.origin.id);
    const details = externalList.querySelector(`[data-source="${track.origin.id}"]`);
    if (details) details.open = true;
  }

  // Filters the songs by title, note, credits, file and folder; matches open their list.
  function findExternal() {
    const words = externalFind.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const details of externalList.querySelectorAll('.source')) {
      let inSource = 0;
      for (const list of details.querySelectorAll('.songs')) {
        let inGroup = 0;
        for (const item of list.children) {
          item.hidden = !words.every((word) => item.dataset.find.includes(word));
          if (!item.hidden) inGroup++;
        }
        list.hidden = inGroup === 0;
        list.previousElementSibling.hidden = inGroup === 0;
        inSource += inGroup;
      }
      details.hidden = inSource === 0;
      details.open = words.length > 0 ? inSource > 0 : openSources.has(details.dataset.source);
      shown += inSource;
    }
    externalNone.hidden = shown > 0 || state.sources.length === 0;
  }

  async function loadExternal() {
    try {
      state.sources = await loadSources(fetchFn);
      for (const source of state.sources) for (const song of source.songs) library.addExternal(source, song);
    } catch (err) {
      setStatus(err?.message ?? String(err), true);
    }
  }

  function rememberExternal() {
    try {
      storage?.setItem(EXTERNAL_KEY, state.external ? 'on' : 'off');
    } catch {
      // Not remembered, but switched for this visit.
    }
  }

  async function showExternal() {
    if (state.external) return;
    state.external = true;
    rememberExternal();
    renderExternal();
    await loadExternal();
    renderExternal();
    render();
  }

  function hideExternal() {
    if (isExternal(library.get(state.playing)) || isExternal(library.get(state.loading))) stop();
    state.external = false;
    rememberExternal();
    library.removeExternal();
    state.sources = [];
    if (!library.get(state.selected)) state.selected = library.list()[0]?.id ?? null;
    renderExternal();
    render();
  }

  /** Called a few times a second: shows the position and moves on when a track ends. */
  function updateProgress() {
    const track = library.get(state.playing);
    const pos = engine.position();
    if (!track || pos == null) {
      renderSeek(pos);
      return;
    }
    if (state.loading === null && hasEnded(pos, track.meta.bars)) {
      const next = trackAfter(library.list().filter(sameList(track.id)).map((t) => t.id), track.id, state.repeat);
      if (next === null) {
        stop();
        setStatus('End of playlist');
      } else {
        select(next, { autoplay: true });
      }
      return;
    }
    renderSeek(pos);
  }

  q('[data-role=external-on]').addEventListener('click', () => showExternal());
  q('[data-role=external-off]').addEventListener('click', () => hideExternal());
  externalFind.addEventListener('input', () => findExternal());
  playButton.addEventListener('click', () => toggle());
  applyButton.addEventListener('click', () => apply());
  revertButton.addEventListener('click', () => revert());
  codeError.addEventListener('click', () => {
    if (state.codeError?.location) editor.focusAt(state.codeError.location.position);
  });
  chordsSimple.addEventListener('click', () => toggleSimpleChords());
  chordsSimple.setAttribute('aria-pressed', String(state.simpleChords));
  repeatButton.addEventListener('click', () => cycleRepeat());
  visualsButton.addEventListener('click', () => toggleVisuals());
  renderVisuals();
  // Dragging only previews the target; letting go (or a key press) jumps there.
  seekBar.addEventListener('input', () => {
    state.scrub = Number(seekBar.value);
    renderSeek();
  });
  seekBar.addEventListener('change', () => seekTo(Number(seekBar.value)));
  const step = (by) => select(library.neighbour(state.selected, by, sameList(state.selected))?.id, { autoplay: state.playing !== null });
  q('[data-role=prev]').addEventListener('click', () => step(-1));
  q('[data-role=next]').addEventListener('click', () => step(1));
  fileInput.addEventListener('change', async () => {
    await addFiles(fileInput.files);
    fileInput.value = '';
  });
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('over');
    return addFiles(event.dataTransfer?.files ?? []);
  });
  doc.addEventListener('keydown', (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target?.tagName ?? '');
    if (event.code === 'Space' && !typing) {
      event.preventDefault();
      toggle();
    }
  });

  // Start loading Strudel right away, so the first click on Play can start audio.
  let engineError = null;
  engine.init().catch((err) => {
    engineError = `Could not load Strudel: ${err?.message ?? err}`;
    setStatus(engineError, true);
  });

  setStatus('Loading tracks…');
  try {
    for (const entry of await loadCatalog(fetchFn)) library.addRepoTrack(entry);
    setStatus(engineError ?? '', engineError !== null);
  } catch (err) {
    setStatus(`${err.message} You can still upload tracks.`, true);
  }
  library.restore();
  if (state.external) await loadExternal();
  renderExternal();
  const wanted = location?.hash ? library.find(decodeURIComponent(location.hash.slice(1))) : null;
  state.selected = (wanted ?? library.list()[0])?.id ?? null;
  const first = library.get(state.selected);
  if (isExternal(first)) reveal(first);
  render();
  if (first?.code === null) preload(first);

  /** Called every animation frame with its time in ms: meters, EQ, code marks and chords. */
  function drawFrame(now) {
    mixer.draw(now);
    markPlaying(now);
    renderChords(now);
  }

  return {
    engine,
    library,
    state,
    mixer,
    select,
    play,
    stop,
    toggle,
    seekTo,
    apply,
    revert,
    playbackError,
    visualsError,
    toggleSimpleChords,
    addFiles,
    removeUpload,
    updateProgress,
    cycleRepeat,
    toggleVisuals,
    showExternal,
    hideExternal,
    drawFrame,
  };
}
