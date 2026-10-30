// Wires the player page together. Everything it touches (DOM root, engine,
// fetch, storage) is passed in, so tests can drive it without a browser.
import { loadCatalog } from './catalog.js';
import { durationSeconds, formatDuration } from './header.js';
import { renderCode } from './highlight.js';
import { Library } from './library.js';
import { channelNames } from './mixer.js';
import { createMixerPanel } from './mixer-panel.js';
import { REPEAT_LABELS, hasEnded, nextRepeatMode, parseRepeatMode, trackAfter } from './playlist.js';
import { parseSections, sectionAt } from './sections.js';
import { strudelUrl } from './share.js';
import { readUpload } from './upload.js';

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

/** "Liquid / atmospheric · C minor · 172 BPM · 2:58" */
export function describeTrack(meta) {
  const length = formatDuration(durationSeconds(meta));
  return [meta.style, meta.key, meta.bpm && `${meta.bpm} BPM`, length].filter(Boolean).join(' · ');
}

export async function createApp({ root, engine, fetchFn, storage = null, location = null }) {
  const doc = root.ownerDocument;
  const library = new Library({ storage });
  const REPEAT_KEY = 'vibe-player:repeat';
  let storedRepeat = null;
  try {
    storedRepeat = storage?.getItem(REPEAT_KEY) ?? null;
  } catch {
    // Blocked storage: start with repeat off.
  }
  const state = {
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
  const seekBar = q('[data-role=seek]');
  const sectionList = q('[data-role=sections]');
  const sectionName = q('[data-role=section]');
  const timeNow = q('[data-role=time]');
  const timeTotal = q('[data-role=length]');

  const mixer = createMixerPanel({ mixerRoot: q('[data-role=mixer]'), eqRoot: q('[data-role=eq]'), engine, storage });

  // Sections only change with the code, so each track's are read once.
  const sectionCache = new Map();
  const sectionsOf = (track) => {
    if (!sectionCache.has(track.code)) sectionCache.set(track.code, parseSections(track.code));
    return sectionCache.get(track.code);
  };

  function setStatus(text, error = false) {
    state.status = text;
    state.error = error;
    status.textContent = text;
    status.classList.toggle('error', error);
  }

  function renderList() {
    list.replaceChildren(
      ...library.list().map((track) => {
        const pick = el(doc, 'button', { class: 'pick', type: 'button', 'data-id': track.id }, [
          el(doc, 'span', { class: 'name', text: track.meta.title }),
          el(doc, 'span', { class: 'sub', text: describeTrack(track.meta) || track.file }),
        ]);
        pick.addEventListener('click', () => select(track.id, { autoplay: state.playing !== null }));
        const item = el(doc, 'li', { class: 'track', 'data-id': track.id }, [pick]);
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
    about.textContent = track?.meta.about ?? (track?.source === 'upload' ? `Uploaded: ${track.file}` : '');
    showCode(track);
    openLink.href = track ? strudelUrl(track.code) : 'https://strudel.cc/';
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

  // The code is highlighted once per track; while it plays, its sounding notes get marked.
  let marker = null;
  let shownCode = null;
  function showCode(track) {
    const text = track ? track.code : '';
    if (text === shownCode) return;
    shownCode = text;
    marker = renderCode(code, text);
  }

  const codePanel = code.closest('details');
  let lastMark = -Infinity;
  function markPlaying(now) {
    if (now - lastMark < 1000 / 30) return;
    lastMark = now;
    const live = state.playing !== null && state.playing === state.selected && state.loading === null;
    marker.mark(live && codePanel?.open !== false ? engine.activeLocations() : []);
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
    renderNow();
    // The mixer names the channels of the track that plays, or else of the one selected.
    mixer.setNames(channelNames(library.get(state.playing ?? state.selected)?.meta.mixer));
  }

  function select(id, { autoplay = false } = {}) {
    const track = library.get(id);
    if (!track) return null;
    state.selected = id;
    if (location) location.hash = id.split(':')[1];
    render();
    if (autoplay) return play();
    return null;
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
      await engine.play(track.code, { from });
      if (mine !== request) {
        // Stop was pressed while this track was loading: silence it again.
        if (state.loading === null && state.playing === null) engine.stop();
        return;
      }
      state.playing = track.id;
      setStatus(`Playing ${track.meta.title}`);
    } catch (err) {
      if (mine !== request) return;
      state.playing = null;
      setStatus(`Could not play ${track.meta.title}: ${err?.message ?? err}`, true);
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
    setStatus('Stopped');
    render();
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

  function cycleRepeat() {
    state.repeat = nextRepeatMode(state.repeat);
    try {
      storage?.setItem(REPEAT_KEY, state.repeat);
    } catch {
      // Not remembered, but still works for this visit.
    }
    renderNow();
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
      const next = trackAfter(library.list().map((t) => t.id), track.id, state.repeat);
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

  playButton.addEventListener('click', () => toggle());
  repeatButton.addEventListener('click', () => cycleRepeat());
  // Dragging only previews the target; letting go (or a key press) jumps there.
  seekBar.addEventListener('input', () => {
    state.scrub = Number(seekBar.value);
    renderSeek();
  });
  seekBar.addEventListener('change', () => seekTo(Number(seekBar.value)));
  q('[data-role=prev]').addEventListener('click', () => select(library.neighbour(state.selected, -1)?.id, { autoplay: state.playing !== null }));
  q('[data-role=next]').addEventListener('click', () => select(library.neighbour(state.selected, 1)?.id, { autoplay: state.playing !== null }));
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
  const wanted = location?.hash ? library.find(decodeURIComponent(location.hash.slice(1))) : null;
  state.selected = (wanted ?? library.list()[0])?.id ?? null;
  render();

  /** Called every animation frame with its time in ms: draws the meters and the EQ. */
  function drawFrame(now) {
    mixer.draw(now);
    markPlaying(now);
  }

  return { engine, library, state, mixer, select, play, stop, toggle, seekTo, addFiles, removeUpload, updateProgress, cycleRepeat, drawFrame };
}
