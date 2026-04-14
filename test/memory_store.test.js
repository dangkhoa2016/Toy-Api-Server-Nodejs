const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
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

test('memory store saves and restores snapshots', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'toy-store-'));
  const snapshotFilePath = path.join(tempDir, 'memory-store.snapshot.json');

  const sourceStore = new MemoryStore({
    snapshot: {
      enabled: true,
      filePath: snapshotFilePath,
      intervalMs: 0,
    },
  });
  sourceStore.saveToy({
    id: 1,
    name: 'Robot',
    image: 'https://example.com/robot.png',
    likes: 2,
    enabled: true,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: new Date('2024-01-02T00:00:00.000Z'),
  });
  sourceStore.setRateLimit('127.0.0.1', {
    count: 2,
    resetAt: '2024-01-03T00:00:00.000Z',
  });

  await sourceStore.saveSnapshot();

  const restoredStore = new MemoryStore({
    snapshot: {
      enabled: true,
      filePath: snapshotFilePath,
      intervalMs: 0,
    },
  });
  const restored = await restoredStore.restoreFromSnapshot();

  assert.equal(restored, true);
  assert.equal(restoredStore.listToys().length, 1);
  assert.equal(restoredStore.findToyById(1).name, 'Robot');
  assert.equal(restoredStore.findToyById(1).created_at instanceof Date, true);
  assert.deepEqual(restoredStore.getRateLimit('127.0.0.1'), {
    count: 2,
    resetAt: '2024-01-03T00:00:00.000Z',
  });
});
