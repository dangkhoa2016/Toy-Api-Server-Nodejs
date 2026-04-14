const fs = require('node:fs/promises');
const path = require('node:path');

class MemoryStore {
  constructor(options = {}) {
    const { toys = [], rateLimits = new Map(), snapshot = {} } = options;

    this.toys = [...toys];
    this.rateLimits = rateLimits;
    this.snapshot = {
      enabled: Boolean(snapshot.enabled),
      filePath: snapshot.filePath || null,
      intervalMs: Number.isFinite(snapshot.intervalMs)
        ? Math.max(0, snapshot.intervalMs)
        : 30000,
      timer: null,
    };
  }

  listToys(options = {}) {
    const { enabledOnly = false } = options;

    if (enabledOnly) return this.toys.filter((toy) => toy.enabled);

    return this.toys;
  }

  findToyById(id) {
    return this.toys.find((toy) => toy.id === id) || null;
  }

  findToyIndexById(id) {
    return this.toys.findIndex((toy) => toy.id === id);
  }

  nextToyId() {
    let nextId = 1;
    while (this.findToyById(nextId)) nextId += 1;

    return nextId;
  }

  saveToy(toy) {
    const existingIndex = this.findToyIndexById(toy.id);
    if (existingIndex === -1) this.toys.push(toy);
    else this.toys[existingIndex] = toy;

    return toy;
  }

  deleteToy(id) {
    const existingIndex = this.findToyIndexById(id);
    if (existingIndex === -1) return false;

    this.toys.splice(existingIndex, 1);
    return true;
  }

  getRateLimit(key) {
    return this.rateLimits.get(key);
  }

  setRateLimit(key, value) {
    this.rateLimits.set(key, value);
    return value;
  }

  hasSnapshot() {
    return this.snapshot.enabled && Boolean(this.snapshot.filePath);
  }

  getSnapshotFilePath() {
    return this.snapshot.filePath;
  }

  exportState() {
    return {
      rateLimits: Array.from(this.rateLimits.entries()),
      savedAt: new Date().toISOString(),
      toys: this.toys.map((toy) => ({
        ...toy,
        created_at:
          toy.created_at instanceof Date
            ? toy.created_at.toISOString()
            : toy.created_at,
        updated_at:
          toy.updated_at instanceof Date
            ? toy.updated_at.toISOString()
            : toy.updated_at,
      })),
      version: 1,
    };
  }

  importState(state = {}) {
    const toys = Array.isArray(state.toys)
      ? state.toys.map((toy) => ({
          ...toy,
          created_at: toy.created_at ? new Date(toy.created_at) : undefined,
          updated_at: toy.updated_at ? new Date(toy.updated_at) : undefined,
        }))
      : [];
    const rateLimits = Array.isArray(state.rateLimits)
      ? new Map(state.rateLimits)
      : new Map();

    this.toys = toys;
    this.rateLimits = rateLimits;
  }

  async restoreFromSnapshot() {
    if (!this.hasSnapshot()) return false;

    try {
      const rawState = await fs.readFile(this.snapshot.filePath, 'utf8');
      this.importState(JSON.parse(rawState));
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;

      throw error;
    }
  }

  async saveSnapshot() {
    if (!this.hasSnapshot()) return false;

    const filePath = this.snapshot.filePath;
    const dirPath = path.dirname(filePath);
    const tmpFilePath = `${filePath}.tmp`;

    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(
      tmpFilePath,
      JSON.stringify(this.exportState(), null, 2),
    );
    await fs.rename(tmpFilePath, filePath);

    return true;
  }

  startAutoSave(options = {}) {
    const { onError } = options;

    if (!this.hasSnapshot()) return false;
    if (this.snapshot.intervalMs <= 0) return false;
    if (this.snapshot.timer) return false;

    this.snapshot.timer = setInterval(() => {
      this.saveSnapshot().catch((error) => {
        if (typeof onError === 'function') onError(error);
      });
    }, this.snapshot.intervalMs);

    this.snapshot.timer.unref?.();
    return true;
  }

  stopAutoSave() {
    if (!this.snapshot.timer) return false;

    clearInterval(this.snapshot.timer);
    this.snapshot.timer = null;
    return true;
  }

  reset() {
    this.toys.length = 0;
    this.rateLimits.clear();
  }
}

module.exports = MemoryStore;
