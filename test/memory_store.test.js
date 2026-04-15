const assert = require('node:assert/strict');
const { test } = require('node:test');

const { MemoryStore } = require('../app/libs');

test('memory store allocates ids, stores toys, and clears state', () => {
  const store = new MemoryStore();

  assert.equal(store.nextToyId(), 1);

  store.saveToy({ id: 1, name: 'Car', enabled: true });
  store.saveToy({ id: 3, name: 'Plane', enabled: false });

  assert.equal(store.nextToyId(), 2);
  assert.equal(store.listToys().length, 2);
  assert.equal(store.listToys({ enabledOnly: true }).length, 1);
  assert.equal(store.findToyById(3).name, 'Plane');

  store.setRateLimit('127.0.0.1', { count: 1 });
  assert.deepEqual(store.getRateLimit('127.0.0.1'), { count: 1 });

  assert.equal(store.deleteToy(99), false);
  assert.equal(store.deleteToy(1), true);

  store.reset();
  assert.equal(store.listToys().length, 0);
  assert.equal(store.getRateLimit('127.0.0.1'), undefined);
});
