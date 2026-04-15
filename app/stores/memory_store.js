class MemoryStore {
  constructor(options = {}) {
    const { toys = [], rateLimits = new Map() } = options;

    this.toys = [...toys];
    this.rateLimits = rateLimits;
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

  reset() {
    this.toys.length = 0;
    this.rateLimits.clear();
  }
}

module.exports = MemoryStore;
