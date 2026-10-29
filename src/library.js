// The list of tracks the player can choose from: the ones shipped in the repo
// plus the ones uploaded in this browser. Uploads are kept in local storage.
import { parseHeader, titleFromFileName } from './header.js';

export const STORAGE_KEY = 'vibe-player:uploads';

const slug = (name) =>
  String(name)
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'track';

function makeTrack(source, file, code) {
  const meta = parseHeader(code);
  return {
    id: `${source}:${slug(file)}`,
    source,
    file,
    code,
    meta: { ...meta, title: meta.title || titleFromFileName(file) },
  };
}

export class Library {
  constructor({ storage = null } = {}) {
    this.storage = storage;
    this.tracks = [];
  }

  list() {
    return [...this.tracks];
  }

  get(id) {
    return this.tracks.find((t) => t.id === id) ?? null;
  }

  /** Finds a track by id, or by the bare name used in links (#nachtschicht). */
  find(name) {
    return this.get(name) ?? this.tracks.find((t) => t.id.split(':')[1] === slug(name)) ?? null;
  }

  addRepoTrack({ file, code }) {
    const track = makeTrack('repo', file, code);
    this.#put(track);
    return track;
  }

  /** Adds an uploaded track. Uploading a file with the same name again replaces it. */
  addUpload({ name, code }) {
    const track = makeTrack('upload', name, code);
    this.#put(track);
    this.save();
    return track;
  }

  /** Removes an uploaded track. Repo tracks can't be removed. */
  remove(id) {
    const track = this.get(id);
    if (!track || track.source !== 'upload') return false;
    this.tracks = this.tracks.filter((t) => t.id !== id);
    this.save();
    return true;
  }

  /** The track `step` places after (or before, if negative) the given one, wrapping around. */
  neighbour(id, step = 1) {
    if (this.tracks.length === 0) return null;
    const index = this.tracks.findIndex((t) => t.id === id);
    if (index === -1) return this.tracks[0];
    const n = this.tracks.length;
    return this.tracks[(((index + step) % n) + n) % n];
  }

  save() {
    if (!this.storage) return;
    const uploads = this.tracks.filter((t) => t.source === 'upload').map((t) => ({ name: t.file, code: t.code }));
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(uploads));
    } catch {
      // Storage full or blocked: uploads still work for this visit.
    }
  }

  /** Brings back uploads from earlier visits. Returns how many were restored. */
  restore() {
    if (!this.storage) return 0;
    let saved;
    try {
      saved = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return 0;
    }
    if (!Array.isArray(saved)) return 0;
    let count = 0;
    for (const item of saved) {
      if (typeof item?.name !== 'string' || typeof item?.code !== 'string') continue;
      this.#put(makeTrack('upload', item.name, item.code));
      count++;
    }
    return count;
  }

  #put(track) {
    const index = this.tracks.findIndex((t) => t.id === track.id);
    if (index === -1) this.tracks.push(track);
    else this.tracks[index] = track;
  }
}
