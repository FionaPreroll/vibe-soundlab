// Wires the player page together. Everything it touches (DOM root, engine,
// fetch, storage) is passed in, so tests can drive it without a browser.
import { loadCatalog } from './catalog.js';
import { durationSeconds, formatDuration } from './header.js';
import { Library } from './library.js';
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
  const state = { selected: null, playing: null, status: '', error: false };

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
    code.textContent = track ? track.code : '';
    openLink.href = track ? strudelUrl(track.code) : 'https://strudel.cc/';
    const isPlaying = track !== null && state.playing === track.id;
    playButton.textContent = isPlaying ? 'Stop' : 'Play';
    playButton.setAttribute('aria-pressed', String(isPlaying));
    playButton.disabled = !track;
  }

  function render() {
    renderList();
    renderNow();
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

  async function play() {
    const track = library.get(state.selected);
    if (!track) return;
    setStatus(`Loading ${track.meta.title}…`);
    try {
      await engine.play(track.code);
      state.playing = track.id;
      setStatus(`Playing ${track.meta.title}`);
    } catch (err) {
      state.playing = null;
      setStatus(`Could not play ${track.meta.title}: ${err?.message ?? err}`, true);
    }
    render();
  }

  function stop() {
    engine.stop();
    state.playing = null;
    setStatus('Stopped');
    render();
  }

  function toggle() {
    return state.playing && state.playing === state.selected ? stop() : play();
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

  function updateProgress() {
    const track = library.get(state.playing);
    const pos = engine.position();
    if (!track || pos == null) {
      progress.textContent = '';
      return;
    }
    const bars = track.meta.bars;
    const barNow = bars ? (Math.floor(pos) % bars) + 1 : Math.floor(pos) + 1;
    progress.textContent = bars ? `Bar ${barNow} / ${bars}` : `Bar ${barNow}`;
  }

  playButton.addEventListener('click', () => toggle());
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

  return { library, state, select, play, stop, toggle, addFiles, removeUpload, updateProgress };
}
