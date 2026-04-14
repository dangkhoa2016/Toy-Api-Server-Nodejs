const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');

const { toysHelpers } = require('../app/libs');

beforeEach(() => {
  toysHelpers.resetToys();
});

test('createToy creates a new toy in memory', async () => {
  const result = await toysHelpers.createToy({ name: 'Robot', image: 'robot.png', likes: 1 });

  assert.equal(result.code, 201);
  assert.equal(result.data.id, 1);
  assert.equal(result.data.name, 'Robot');

  const toys = await toysHelpers.getToys();
  assert.equal(toys.length, 1);
});

test('saveToy updates an existing toy', async () => {
  const created = await toysHelpers.createToy({ name: 'Robot', image: 'robot.png', likes: 1 });
  const updated = await toysHelpers.saveToy({ id: created.data.id, name: 'Drone', image: 'drone.png', likes: 4 });

  assert.equal(updated.code, 200);
  assert.equal(updated.data.id, created.data.id);
  assert.equal(updated.data.name, 'Drone');
  assert.equal(updated.data.likes, 4);
});

test('getToy returns a toy by id', async () => {
  const created = await toysHelpers.createToy({ name: 'Train', image: 'train.png', likes: 2 });
  const result = await toysHelpers.getToy(created.data.id);

  assert.equal(result.code, 200);
  assert.equal(result.data.name, 'Train');
});

test('likeToy updates likes for an existing toy', async () => {
  const created = await toysHelpers.createToy({ name: 'Puzzle', image: 'puzzle.png', likes: 0 });
  const result = await toysHelpers.likeToy(created.data.id, 9);

  assert.equal(result.code, 200);
  assert.equal(result.data.likes, 9);
});

test('deleteToy removes an existing toy and returns 404 for missing ids', async () => {
  const created = await toysHelpers.createToy({ name: 'Blocks', image: 'blocks.png', likes: 0 });
  const deleted = await toysHelpers.deleteToy(created.data.id);
  const missing = await toysHelpers.deleteToy(created.data.id);

  assert.equal(deleted.code, 200);
  assert.deepEqual(deleted.data, { deleted: true });
  assert.equal(missing.code, 404);
  assert.match(missing.error, /not found/i);
});