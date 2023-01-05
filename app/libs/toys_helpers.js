const debug = require('debug')('toy-api-demo:libs->toys_helpers');
const _ = require('lodash-core');
const { statusCodes, enableStatuses } = require('./variables');
const toys = [];

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
    return { code: statusCodes.UNPROCESSABLE_ENTITY };
  }

  if (!data.name) {
    debug(`saveToy: Empty name`);
    return { code: statusCodes.UNPROCESSABLE_ENTITY };
  }

  try {
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
    return { code, message: data };
  } catch (err) {
    debug('saveToy: Error', err);
    return { code: statusCodes.INTERNAL_SERVER_ERROR, error: err.message };
  }
};

const deleteToy = async function (id) {
  if (!id) {
    debug(`deleteToy: Id is blank`);
    return { code: statusCodes.UNPROCESSABLE_ENTITY };
  }

  try {
    const arr = await getToys();
    const existingIndex = arr.findIndex(x => x.id === id);
    if (existingIndex !== -1) {
      arr.splice(existingIndex, 1);
      debug(`deleteToy: Toy with id: [${id}] has been deleted`);
    } else
      debug(`deleteToy: Toy with id: [${id}] not found`);

    return { code: statusCodes.OK, message: { deleted: true } };
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
  if (!id) {
    debug(`likeToy: No id`);
    return { code: statusCodes.UNPROCESSABLE_ENTITY };
  }

  if (typeof (likes) !== 'number') {
    debug(`likeToy: likes is not a valid number`);
    return { code: statusCodes.UNPROCESSABLE_ENTITY };
  }

  try {
    const arr = await getToys();
    let code = statusCodes.NOT_FOUND;
    let data = null;
    const existingIndex = arr.findIndex(x => x.id === id);
    if (existingIndex !== -1) {
      code = statusCodes.OK;
      arr[existingIndex].likes = likes;
      data = arr[existingIndex];
    }

    if (code === statusCodes.OK) {
      debug(`likeToy: Toy with id: [${data.id}] has been saved`);
      return { code, message: data };
    } else {
      debug(`likeToy: Toy with id: [${id}] not found`);
      return { code, error: `Toy with id: [${id}] not found` };
    }
  } catch (err) {
    debug('likeToy: Error', err);
    return { code: statusCodes.INTERNAL_SERVER_ERROR, error: err.message };
  }
};

const getToy = async function (id) {
  if (!id) {
    debug(`getToy: Id is blank`);
    return { code: statusCodes.UNPROCESSABLE_ENTITY };
  }

  try {
    const arr = await getToys();
    const existingIndex = arr.findIndex(x => x.id === id);
    if (existingIndex !== -1)
      return { code: statusCodes.OK, message: arr[existingIndex] };

    debug(`getToy: Toy with id: [${id}] not found`);
    return { code: statusCodes.NOT_FOUND, error: `Toy with id: [${id}] not found` };
  } catch (err) {
    debug('getToy: Error', err);
    return { code: statusCodes.INTERNAL_SERVER_ERROR, error: err.message };
  }
};

module.exports = {
  getToys, likeToy,
  saveToy, getToy,
  createToy, deleteToy,
}
