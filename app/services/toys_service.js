const { statusCodes, toyConstraints } = require('../libs/variables');

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
    const { store } = options;

    if (!store) throw new Error('ToysService requires a store');

    this.store = store;
  }

  async getToys(enabledOnly = false) {
    return this.store.listToys({ enabledOnly });
  }

  async saveToy(data) {
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
      created_at: createdAt,
      updated_at: timestamp,
      likes,
      enabled,
    };

    if (typeof toy.id === 'undefined') toy.id = this.store.nextToyId();

    this.store.saveToy(toy);

    return {
      code: existingToy ? statusCodes.OK : statusCodes.DATA_CREATED,
      data: toy,
    };
  }

  async createToy(data) {
    if (!data)
      return {
        code: statusCodes.UNPROCESSABLE_ENTITY,
        error: 'Toy payload is required',
      };

    const payload = { ...data };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    return this.saveToy(payload);
  }

  async deleteToy(id) {
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

    return { code: statusCodes.OK, data: toy };
  }

  async likeToy(id, likes) {
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
    return { code: statusCodes.OK, data: updatedToy };
  }

  reset() {
    this.store.reset();
  }
}

module.exports = ToysService;
