const MemoryStore = require('../stores/memory_store');
const ToysService = require('../services/toys_service');

const defaultService = new ToysService({ store: new MemoryStore() });

module.exports = {
  getToys: (...args) => defaultService.getToys(...args),
  likeToy: (...args) => defaultService.likeToy(...args),
  saveToy: (...args) => defaultService.saveToy(...args),
  getToy: (...args) => defaultService.getToy(...args),
  createToy: (...args) => defaultService.createToy(...args),
  deleteToy: (...args) => defaultService.deleteToy(...args),
  resetToys: () => defaultService.reset(),
  getService: () => defaultService,
};
