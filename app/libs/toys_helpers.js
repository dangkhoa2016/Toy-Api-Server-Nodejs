const debug = require('debug')('toy-api-server-nodejs:libs->toys_helpers');
const _ = require('lodash-core');
const { statusCodes, enableStatuses } = require('./variables');
const toys = [];

const normalizeId = function (id) {
  if (id === null || typeof id === 'undefined' || id === '')
    return null;

  const numericId = Number(id);
  return Number.isInteger(numericId) ? numericId : null;
};

const resetToys = function () {
  toys.length = 0;
};

const getToys = async function (enabled_only = false) {
  enabled_only = enabled_only || false;

  if (enabled_only)
    return toys.filter(toy => toy.enabled);
  else
    return toys;
};

const saveToy = async function (data) {
  if (!data) {
    debug(`saveToy: No data`);
    return { code: statusCodes.UNPROCESSABLE_ENTITY, error: 'Toy payload is required' };
  }

  if (!data.name) {
    debug(`saveToy: Empty name`);
    return { code: statusCodes.UNPROCESSABLE_ENTITY, error: 'Toy name is required' };
  }

  try {
    if (typeof data.id !== 'undefined') {
      const normalizedId = normalizeId(data.id);
      if (normalizedId === null) {
        debug('saveToy: Invalid id');
        return { code: statusCodes.UNPROCESSABLE_ENTITY, error: 'Toy id must be an integer' };
      }
      data.id = normalizedId;
    }

    if (!data.created_at)
      data.created_at = new Date();
    if (typeof data.enabled !== 'boolean')
      data.enabled = true;
    data.updated_at = new Date();

    const arr = await getToys();
    let code = statusCodes.DATA_CREATED;
    if (data.id) {
      const existingIndex = arr.findIndex(x => x.id === data.id);
      if (existingIndex !== -1) {
        arr[existingIndex] = { ...arr[existingIndex], ...data, ...{ enabled: _.includes(enableStatuses, data.enabled) } }
        code = statusCodes.OK;
        data = arr[existingIndex];
      } else
        arr.push(data);
    }
    else {
      let maxId = arr.length + 1;
      let existing = arr.find(x => x.id === maxId);
      while (existing) {
        maxId += 1;
        existing = arr.find(x => x.id === maxId);
      }
      data.id = maxId;
      arr.push(data);
    }

    if (code === statusCodes.OK)
      debug(`saveToy: Toy with id: [${data.id}] has been saved`);
    else
      debug(`saveToy: Toy with id: [${data.id}] has been created`);
    return { code, data };
  } catch (err) {
    debug('saveToy: Error', err);
    return { code: statusCodes.INTERNAL_SERVER_ERROR, error: err.message };
  }
};

const deleteToy = async function (id) {
  const normalizedId = normalizeId(id);
  if (normalizedId === null) {
    debug(`deleteToy: Id is blank`);
    return { code: statusCodes.UNPROCESSABLE_ENTITY, error: 'Toy id is required' };
  }

  try {
    const arr = await getToys();
    const existingIndex = arr.findIndex(x => x.id === normalizedId);
    if (existingIndex !== -1) {
      arr.splice(existingIndex, 1);
      debug(`deleteToy: Toy with id: [${normalizedId}] has been deleted`);
      return { code: statusCodes.OK, data: { deleted: true } };
    }

    debug(`deleteToy: Toy with id: [${normalizedId}] not found`);
    return { code: statusCodes.NOT_FOUND, error: `Toy with id: [${normalizedId}] not found` };
  } catch (err) {
    debug('deleteToy: Error', err);
    return { code: statusCodes.INTERNAL_SERVER_ERROR, error: err.message };
  }
};

const createToy = async function (data) {
  if (!data) {
    debug(`createToy: No data`);
    return { code: statusCodes.UNPROCESSABLE_ENTITY };
  }

  delete data.id;
  delete data.created_at;
  delete data.updated_at;

  return await saveToy(data);
};

const likeToy = async function (id, likes) {
  const normalizedId = normalizeId(id);
  if (normalizedId === null) {
    debug(`likeToy: No id`);
    return { code: statusCodes.UNPROCESSABLE_ENTITY, error: 'Toy id is required' };
  }

  if (typeof (likes) !== 'number') {
    debug(`likeToy: likes is not a valid number`);
    return { code: statusCodes.UNPROCESSABLE_ENTITY, error: 'Likes must be a number' };
  }

  try {
    const arr = await getToys();
    let code = statusCodes.NOT_FOUND;
    let data = null;
    const existingIndex = arr.findIndex(x => x.id === normalizedId);
    if (existingIndex !== -1) {
      code = statusCodes.OK;
      arr[existingIndex].likes = likes;
      data = arr[existingIndex];
    }

    if (code === statusCodes.OK) {
      debug(`likeToy: Toy with id: [${data.id}] has been saved`);
      return { code, data };
    } else {
      debug(`likeToy: Toy with id: [${normalizedId}] not found`);
      return { code, error: `Toy with id: [${normalizedId}] not found` };
    }
  } catch (err) {
    debug('likeToy: Error', err);
    return { code: statusCodes.INTERNAL_SERVER_ERROR, error: err.message };
  }
};

const getToy = async function (id) {
  const normalizedId = normalizeId(id);
  if (normalizedId === null) {
    debug(`getToy: Id is blank`);
    return { code: statusCodes.UNPROCESSABLE_ENTITY, error: 'Toy id is required' };
  }

  try {
    const arr = await getToys();
    const existingIndex = arr.findIndex(x => x.id === normalizedId);
    if (existingIndex !== -1)
      return { code: statusCodes.OK, data: arr[existingIndex] };

    debug(`getToy: Toy with id: [${normalizedId}] not found`);
    return { code: statusCodes.NOT_FOUND, error: `Toy with id: [${normalizedId}] not found` };
  } catch (err) {
    debug('getToy: Error', err);
    return { code: statusCodes.INTERNAL_SERVER_ERROR, error: err.message };
  }
};

module.exports = {
  getToys, likeToy,
  saveToy, getToy,
  createToy, deleteToy,
  resetToys,
}
