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

test('memory store prunes expired toys and counts active toys per ip', () => {
  const store = new MemoryStore();
  const referenceTime = new Date('2024-01-01T00:15:00.000Z');

  store.saveToy({
    id: 1,
    name: 'Expired Toy',
    enabled: true,
    created_by_ip: '203.0.113.10',
    expires_at: new Date('2024-01-01T00:10:00.000Z'),
  });
  store.saveToy({
    id: 2,
    name: 'Active Toy',
    enabled: true,
    created_by_ip: '203.0.113.10',
    expires_at: new Date('2024-01-01T00:20:00.000Z'),
  });

  assert.equal(
    store.countToysByClientKey('203.0.113.10', { referenceTime }),
    1,
  );
  assert.equal(store.pruneExpiredToys(referenceTime), 1);
  assert.equal(store.listToys({ referenceTime }).length, 1);
  assert.equal(store.findToyById(1), null);
});

test('memory store cleans up expired rate limit entries', () => {
  const store = new MemoryStore({
    rateLimits: new Map([
      ['expired', { count: 20, resetAt: 1000 }],
      ['active', { count: 1, resetAt: 10000 }],
    ]),
  });

  assert.equal(store.cleanupRateLimits(5000), 1);
  assert.equal(store.getRateLimit('expired'), undefined);
  assert.deepEqual(store.getRateLimit('active'), { count: 1, resetAt: 10000 });
});
