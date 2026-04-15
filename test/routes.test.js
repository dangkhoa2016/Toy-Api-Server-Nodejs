const assert = require('node:assert/strict');
const { test } = require('node:test');

const { toysHelpers } = require('../app/libs');
const buildServer = require('../app');

async function createServer(options = {}) {
  toysHelpers.resetToys();

  const server = buildServer(options);
  await server.ready();
  return server;
}

test('toy routes support CRUD and like flows', async (t) => {
  const server = await createServer({ nodeEnv: 'test' });
  t.after(async () => {
    await server.close();
  });

  const createdResponse = await server.inject({
    method: 'POST',
    url: '/api/toys',
    payload: { name: 'Car', image: 'car.png', likes: 2 },
  });

  assert.equal(createdResponse.statusCode, 201);
  const createdToy = createdResponse.json();
  assert.equal(createdToy.id, 1);

  const listResponse = await server.inject({ method: 'GET', url: '/api/toys' });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().length, 1);

  const showResponse = await server.inject({
    method: 'GET',
    url: '/api/toys/1',
  });
  assert.equal(showResponse.statusCode, 200);
  assert.equal(showResponse.json().name, 'Car');

  const updateResponse = await server.inject({
    method: 'PUT',
    url: '/api/toys/1',
    payload: { name: 'Boat', image: 'boat.png', likes: 3 },
  });
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().name, 'Boat');

  const likeResponse = await server.inject({
    method: 'PATCH',
    url: '/api/toys/1/likes',
    payload: { likes: 10 },
  });
  assert.equal(likeResponse.statusCode, 200);
  assert.equal(likeResponse.json().likes, 10);

  const deleteResponse = await server.inject({
    method: 'DELETE',
    url: '/api/toys/1',
  });
  assert.equal(deleteResponse.statusCode, 200);
  assert.deepEqual(deleteResponse.json(), { deleted: true });

  const missingDeleteResponse = await server.inject({
    method: 'DELETE',
    url: '/api/toys/1',
  });
  assert.equal(missingDeleteResponse.statusCode, 404);
  assert.equal(missingDeleteResponse.json().error.statusCode, 404);

  const removedDeleteRouteResponse = await server.inject({
    method: 'GET',
    url: '/api/toys/1/delete',
  });
  assert.equal(removedDeleteRouteResponse.statusCode, 404);
  assert.equal(
    removedDeleteRouteResponse.json().error.message,
    'Route not found',
  );
});

test('toy routes return standardized validation errors', async (t) => {
  const server = await createServer({ nodeEnv: 'test' });
  t.after(async () => {
    await server.close();
  });

  const response = await server.inject({
    method: 'POST',
    url: '/api/toys',
    payload: { image: 'missing-name.png' },
  });

  assert.equal(response.statusCode, 422);
  const payload = response.json();
  assert.equal(payload.error.statusCode, 422);
  assert.match(payload.error.message, /name/i);
});

test('health returns service status', async (t) => {
  const server = await createServer({ nodeEnv: 'test' });
  t.after(async () => {
    await server.close();
  });

  const response = await server.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.status, 'ok');
  assert.equal(typeof payload.timestamp, 'string');
  assert.equal(typeof payload.uptime, 'number');
});

test('cors allows trusted origins in production and blocks others', async (t) => {
  const server = await createServer({
    nodeEnv: 'production',
    corsOrigins: ['https://allowed.example'],
  });
  t.after(async () => {
    await server.close();
  });

  const allowedResponse = await server.inject({
    method: 'OPTIONS',
    url: '/api/toys',
    headers: {
      origin: 'https://allowed.example',
      'access-control-request-method': 'GET',
    },
  });

  assert.equal(allowedResponse.statusCode, 204);
  assert.equal(
    allowedResponse.headers['access-control-allow-origin'],
    'https://allowed.example',
  );

  const blockedResponse = await server.inject({
    method: 'GET',
    url: '/api/toys',
    headers: {
      origin: 'https://blocked.example',
    },
  });

  assert.equal(blockedResponse.statusCode, 403);
  assert.equal(blockedResponse.json().error.statusCode, 403);
  assert.equal(
    blockedResponse.json().error.message,
    'Origin is not allowed by CORS',
  );
});
