class MemoryStore {
  constructor(options = {}) {
    const { toys = [], rateLimits = new Map(), seedStates = new Map() } = options;

    this.toys = [...toys];
    this.rateLimits = rateLimits;
    this.seedStates = seedStates;
  }

  isToyExpired(toy, referenceTime = new Date()) {
    if (!toy?.expires_at) return false;

    const expiresAt =
      toy.expires_at instanceof Date
        ? toy.expires_at
        : new Date(toy.expires_at);
    if (!Number.isFinite(expiresAt.valueOf())) return false;

    return expiresAt.getTime() <= referenceTime.getTime();
  }

  listToys(options = {}) {
    const { clientKey, enabledOnly = false, referenceTime = new Date() } = options;

    const activeToys = this.toys.filter(
      (toy) => !this.isToyExpired(toy, referenceTime),
    );

    const filteredByClient = clientKey
      ? activeToys.filter((toy) => toy.created_by_ip === clientKey)
      : activeToys;

    if (enabledOnly) {
      return filteredByClient.filter((toy) => toy.enabled);
    }

    return filteredByClient;
  }

  findToyById(id) {
    return this.toys.find((toy) => toy.id === id && !this.isToyExpired(toy)) || null;
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

  countToysByClientKey(clientKey, options = {}) {
    if (!clientKey) return 0;

    return this.listToys({
      clientKey,
      referenceTime: options.referenceTime,
    }).length;
  }

  getRateLimit(key) {
    return this.rateLimits.get(key);
  }

  setRateLimit(key, value) {
    this.rateLimits.set(key, value);
    return value;
  }

  getSeedState(key) {
    return this.seedStates.get(key);
  }

  setSeedState(key, value) {
    this.seedStates.set(key, value);
    return value;
  }

  pruneExpiredToys(referenceTime = new Date()) {
    const initialCount = this.toys.length;
    this.toys = this.toys.filter(
      (toy) => !this.isToyExpired(toy, referenceTime),
    );

    return initialCount - this.toys.length;
  }

  cleanupRateLimits(referenceTime = Date.now()) {
    let removedCount = 0;

    for (const [key, entry] of this.rateLimits.entries()) {
      if (!entry || !Number.isFinite(entry.resetAt) || entry.resetAt <= referenceTime) {
        this.rateLimits.delete(key);
        removedCount += 1;
      }
    }

    return removedCount;
  }

  cleanupSeedStates(referenceTime = Date.now(), options = {}) {
    const { retentionMs = 0 } = options;
    let removedCount = 0;

    for (const [key, state] of this.seedStates.entries()) {
      const firstCreateAt = Number(state?.firstCreateAt);
      const successfulCreates = Number(state?.successfulCreates);
      const isInvalidState =
        !Number.isFinite(firstCreateAt) || !Number.isFinite(successfulCreates);
      const isExpiredState =
        Number.isFinite(retentionMs) && retentionMs >= 0
          ? firstCreateAt + retentionMs <= referenceTime
          : false;

      if (!isInvalidState && !isExpiredState) continue;

      this.seedStates.delete(key);
      removedCount += 1;
    }

    return removedCount;
  }

  reset() {
    this.toys.length = 0;
    this.rateLimits.clear();
    this.seedStates.clear();
  }
}

module.exports = MemoryStore;
