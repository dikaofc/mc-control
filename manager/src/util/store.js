// Tiny JSON file-backed store. Single-file, atomic writes, no external deps.
import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(file) {
    this.file = file;
    this._data = {};
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      this._data = JSON.parse(raw || '{}');
    } catch {
      this._data = {};
    }
  }

  _save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this._data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  get(key, fallback) {
    return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : fallback;
  }

  set(key, value) {
    this._data[key] = value;
    this._save();
    return value;
  }

  // Mutate a sub-object by id inside an array.
  find(collection, id) {
    return (this._data[collection] || []).find((x) => x.id === id) || null;
  }

  list(collection) {
    return this._data[collection] || [];
  }

  insert(collection, item) {
    if (!this._data[collection]) this._data[collection] = [];
    this._data[collection].push(item);
    this._save();
    return item;
  }

  update(collection, id, patch) {
    const arr = this._data[collection] || [];
    const idx = arr.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    arr[idx] = { ...arr[idx], ...patch };
    this._save();
    return arr[idx];
  }

  remove(collection, id) {
    const arr = this._data[collection] || [];
    const idx = arr.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    arr.splice(idx, 1);
    this._save();
    return true;
  }
}

// Generate a reasonably unique id without external deps.
export function uid(prefix = 'id') {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${t}${r}`;
}
