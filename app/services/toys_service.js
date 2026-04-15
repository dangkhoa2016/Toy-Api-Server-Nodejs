const {
  getToyPolicyDefaults,
  statusCodes,
  toyConstraints,
} = require('../libs/variables');
const debug = require('debug')('toy-api-server-nodejs:->services->toys-service');

function normalizePositiveInteger(value, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;

  return Math.max(1, Math.floor(numericValue));
}

function normalizeId(id) {
  if (id === null || typeof id === 'undefined' || id === '') return null;

  const numericId = Number(id);
  return Number.isInteger(numericId) ? numericId : null;
}

function isValidImageUri(image) {
  try {
    const parsedUrl = new URL(image);
    return toyConstraints.imageProtocols.includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

function validateName(name) {
  if (typeof name !== 'string') return 'Toy name is required';

  const trimmedName = name.trim();
  if (!trimmedName) return 'Toy name is required';

  if (trimmedName.length < toyConstraints.minNameLength) {
    return `Toy name must be at least ${toyConstraints.minNameLength} characters long`;
  }

  if (trimmedName.length > toyConstraints.maxNameLength) {
    return `Toy name must be at most ${toyConstraints.maxNameLength} characters long`;
  }

  return null;
}

function validateLikes(likes) {
  if (typeof likes !== 'undefined' && (!Number.isInteger(likes) || likes < 0)) {
    return 'Likes must be an integer greater than or equal to 0';
  }

  return null;
}

function validateImage(image) {
  if (typeof image !== 'string' || !image.trim())
    return 'Toy image is required';

  if (!isValidImageUri(image)) return 'Toy image must be a valid URI';

  return null;
}

class ToysService {
  constructor(options = {}) {
    const toyPolicyDefaults = getToyPolicyDefaults();
    const { maxToysPerIp, seedMaxToysPerIp, seedWindowMs, store, toyTtlMs } = options;

    if (!store) throw new Error('ToysService requires a store');

    this.maxToysPerIp = normalizePositiveInteger(
      maxToysPerIp ?? process.env.MAX_TOYS_PER_IP ?? toyPolicyDefaults.maxToysPerIp,
      toyPolicyDefaults.maxToysPerIp,
    );
    this.seedMaxToysPerIp = normalizePositiveInteger(
      seedMaxToysPerIp ??
        process.env.SEED_MAX_TOYS_PER_IP ??
        toyPolicyDefaults.seedMaxToysPerIp,
      toyPolicyDefaults.seedMaxToysPerIp,
    );
    this.seedWindowMs = normalizePositiveInteger(
      seedWindowMs ?? process.env.SEED_WINDOW_MS ?? toyPolicyDefaults.seedWindowMs,
      toyPolicyDefaults.seedWindowMs,
    );
    this.store = store;
    this.toyTtlMs = normalizePositiveInteger(
      toyTtlMs ?? process.env.TOY_TTL_MS ?? toyPolicyDefaults.toyTtlMs,
      toyPolicyDefaults.toyTtlMs,
    );
  }

  getSeedState(clientKey, referenceTime = Date.now()) {
    const seedState = this.store.getSeedState(clientKey);
    if (!seedState) return null;

    const firstCreateAt = Number(seedState.firstCreateAt);
    const successfulCreates = Number(seedState.successfulCreates);
    if (!Number.isFinite(firstCreateAt) || !Number.isFinite(successfulCreates)) {
      return null;
    }

    const seedExpiresAt = firstCreateAt + this.seedWindowMs;
    return {
      firstCreateAt,
      isActive:
        referenceTime < seedExpiresAt &&
        successfulCreates < this.seedMaxToysPerIp,
      seedExpiresAt,
      successfulCreates,
    };
  }

  pruneExpiredToys(referenceTime = new Date()) {
    return this.store.pruneExpiredToys(referenceTime);
  }

  sanitizeToy(toy) {
    if (!toy) return toy;

    const { created_by_ip: _createdByIp, expires_at: _expiresAt, ...publicToy } = toy;
    debug('Sanitizing toy:', { id: toy.id, name: toy.name, created_by_ip: _createdByIp, expires_at: _expiresAt });
    return publicToy;
  }

  async getToys(enabledOnly = false) {
    this.pruneExpiredToys();
    return this.store.listToys({ enabledOnly }).map((toy) => this.sanitizeToy(toy));
  }

  async saveToy(data) {
    this.pruneExpiredToys();

    if (!data)
      return {
        code: statusCodes.UNPROCESSABLE_ENTITY,
        error: 'Toy payload is required',
      };

    const nameError = validateName(data.name);
    if (nameError)
      return {
        code: statusCodes.UNPROCESSABLE_ENTITY,
        error: nameError,
      };

    const imageError = validateImage(data.image);
    if (imageError)
      return {
        code: statusCodes.UNPROCESSABLE_ENTITY,
        error: imageError,
      };

    const likesError = validateLikes(data.likes);
    if (likesError)
      return {
        code: statusCodes.UNPROCESSABLE_ENTITY,
        error: likesError,
      };

    const payload = { ...data };
    let existingToy = null;

    if (typeof payload.id !== 'undefined') {
      const normalizedId = normalizeId(payload.id);
      if (normalizedId === null)
        return {
          code: statusCodes.UNPROCESSABLE_ENTITY,
          error: 'Toy id must be an integer',
        };

      payload.id = normalizedId;
      existingToy = this.store.findToyById(normalizedId);
    }

    payload.image = payload.image.trim();
    payload.name = payload.name.trim();

    const timestamp = new Date();
    const createdAt = existingToy
      ? existingToy.created_at
      : payload.created_at || timestamp;
    const likes =
      typeof payload.likes === 'number'
        ? payload.likes
        : existingToy?.likes || 0;
    const enabled =
      typeof payload.enabled === 'boolean'
        ? payload.enabled
        : (existingToy?.enabled ?? true);
    const toy = {
      ...existingToy,
      ...payload,
      created_by_ip: existingToy?.created_by_ip ?? payload.created_by_ip,
      created_at: createdAt,
      expires_at:
        existingToy?.expires_at ||
        payload.expires_at ||
        new Date(timestamp.getTime() + this.toyTtlMs),
      updated_at: timestamp,
      likes,
      enabled,
    };

    if (typeof toy.id === 'undefined') toy.id = this.store.nextToyId();

    this.store.saveToy(toy);

    return {
      code: existingToy ? statusCodes.OK : statusCodes.DATA_CREATED,
      data: this.sanitizeToy(toy),
    };
  }

  async createToy(data, options = {}) {
    this.pruneExpiredToys();

    if (!data)
      return {
        code: statusCodes.UNPROCESSABLE_ENTITY,
        error: 'Toy payload is required',
      };

    const clientKey = options.clientKey || 'unknown';
    const now = Date.now();
    const seedState = this.getSeedState(clientKey, now);
    const allowedToyLimit = seedState?.isActive
      ? this.seedMaxToysPerIp
      : this.maxToysPerIp;

    debug('Creating toy', {
      clientKey,
      seedMode: Boolean(seedState?.isActive),
      seedSuccessfulCreates: seedState?.successfulCreates ?? 0,
      seedExpiresAt: seedState ? new Date(seedState.seedExpiresAt) : null,
    });
    const activeToyCount = this.store.countToysByClientKey(clientKey);
    debug('Active toy count', { clientKey, activeToyCount, allowedToyLimit });

    if (activeToyCount >= allowedToyLimit)
      return {
        code: statusCodes.TOO_MANY_REQUESTS,
        error: 'Toy quota exceeded for this IP address',
        details: {
          defaultLimit: this.maxToysPerIp,
          limit: allowedToyLimit,
          seedLimit: this.seedMaxToysPerIp,
          seedMode: Boolean(seedState?.isActive),
          seedWindowMs: this.seedWindowMs,
          ttlMs: this.toyTtlMs,
        },
      };

    const payload = { ...data };
    payload.created_by_ip = clientKey;
    payload.expires_at = new Date(now + this.toyTtlMs);
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    const result = await this.saveToy(payload);
    if (result.data) {
      this.store.setSeedState(clientKey, {
        firstCreateAt: seedState?.firstCreateAt ?? now,
        successfulCreates: (seedState?.successfulCreates ?? 0) + 1,
      });
    }

    return result;
  }

  async deleteToy(id) {
    this.pruneExpiredToys();

    const normalizedId = normalizeId(id);
    if (normalizedId === null)
      return {
        code: statusCodes.UNPROCESSABLE_ENTITY,
        error: 'Toy id is required',
      };

    const deleted = this.store.deleteToy(normalizedId);
    if (!deleted)
      return {
        code: statusCodes.NOT_FOUND,
        error: `Toy with id: [${normalizedId}] not found`,
      };

    return { code: statusCodes.OK, data: { deleted: true } };
  }

  async getToy(id) {
    this.pruneExpiredToys();

    const normalizedId = normalizeId(id);
    if (normalizedId === null)
      return {
        code: statusCodes.UNPROCESSABLE_ENTITY,
        error: 'Toy id is required',
      };

    const toy = this.store.findToyById(normalizedId);
    if (!toy)
      return {
        code: statusCodes.NOT_FOUND,
        error: `Toy with id: [${normalizedId}] not found`,
      };

    return { code: statusCodes.OK, data: this.sanitizeToy(toy) };
  }

  async likeToy(id, likes) {
    this.pruneExpiredToys();

    const normalizedId = normalizeId(id);
    if (normalizedId === null)
      return {
        code: statusCodes.UNPROCESSABLE_ENTITY,
        error: 'Toy id is required',
      };

    const likesError = validateLikes(likes);
    if (likesError)
      return {
        code: statusCodes.UNPROCESSABLE_ENTITY,
        error: likesError,
      };

    const toy = this.store.findToyById(normalizedId);
    if (!toy)
      return {
        code: statusCodes.NOT_FOUND,
        error: `Toy with id: [${normalizedId}] not found`,
      };

    const updatedToy = {
      ...toy,
      likes,
      updated_at: new Date(),
    };

    this.store.saveToy(updatedToy);
    return { code: statusCodes.OK, data: this.sanitizeToy(updatedToy) };
  }

  reset() {
    this.store.reset();
  }
}

module.exports = ToysService;
