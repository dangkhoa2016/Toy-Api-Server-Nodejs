const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { toysHelpers } = require('../app/libs');
const buildServer = require('../app');

async function createServer(options = {}) {
  toysHelpers.resetToys();

  const server = buildServer({
    basicAuth:
      typeof options.basicAuth === 'undefined'
        ? { enabled: false }
        : options.basicAuth,
    rateLimit:
      typeof options.rateLimit === 'undefined'
        ? { enabled: false }
        : options.rateLimit,
    securityHeaders:
      typeof options.securityHeaders === 'undefined'
        ? { enabled: false }
        : options.securityHeaders,
    snapshot:
      typeof options.snapshot === 'undefined'
        ? { enabled: false }
        : options.snapshot,
    ...options,
  });
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
    payload: { name: 'Car', image: 'https://example.com/car.png', likes: 2 },
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
    payload: {
      name: 'Boat',
      image: 'https://example.com/boat.png',
      likes: 3,
    },
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

test('toy routes validate name length, likes minimum, and image URI', async (t) => {
  const server = await createServer({ nodeEnv: 'test' });
  t.after(async () => {
    await server.close();
  });

  const shortNameResponse = await server.inject({
    method: 'POST',
    url: '/api/toys',
    payload: {
      name: 'A',
      image: 'https://example.com/car.png',
      likes: 1,
    },
  });
  const invalidImageResponse = await server.inject({
    method: 'POST',
    url: '/api/toys',
    payload: {
      name: 'Valid Name',
      image: 'car.png',
      likes: 1,
    },
  });

  const createdResponse = await server.inject({
    method: 'POST',
    url: '/api/toys',
    payload: {
      name: 'Valid Name',
      image: 'https://example.com/car.png',
      likes: 1,
    },
  });
  assert.equal(createdResponse.statusCode, 201);

  const invalidLikesResponse = await server.inject({
    method: 'PATCH',
    url: '/api/toys/1/likes',
    payload: { likes: -1 },
  });

  assert.equal(shortNameResponse.statusCode, 422);
  assert.match(
    shortNameResponse.json().error.message,
    /must NOT have fewer than 2 characters/i,
  );
  assert.equal(invalidImageResponse.statusCode, 422);
  assert.match(
    invalidImageResponse.json().error.message,
    /must match format "uri"/i,
  );
  assert.equal(invalidLikesResponse.statusCode, 422);
  assert.match(invalidLikesResponse.json().error.message, /must be >= 0/i);
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

test('responses expose request id and correlation id headers', async (t) => {
  const server = await createServer({ nodeEnv: 'production' });
  t.after(async () => {
    await server.close();
  });

  const response = await server.inject({
    method: 'GET',
    url: '/health',
    headers: {
      'x-correlation-id': 'corr-123',
      'x-request-id': 'req-456',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['x-correlation-id'], 'corr-123');
  assert.equal(response.headers['x-request-id'], 'req-456');
});

test('security headers are enabled when configured', async (t) => {
  const server = await createServer({
    nodeEnv: 'production',
    securityHeaders: { enabled: true },
  });
  t.after(async () => {
    await server.close();
  });

  const response = await server.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(typeof response.headers['referrer-policy'], 'string');
});

test('basic auth protects API routes and leaves health checks available', async (t) => {
  const server = await createServer({
    nodeEnv: 'production',
    basicAuth: {
      enabled: true,
      username: 'admin',
      password: 'secret',
    },
  });
  t.after(async () => {
    await server.close();
  });

  const unauthorizedResponse = await server.inject({
    method: 'GET',
    url: '/api/toys',
  });
  const authorizedResponse = await server.inject({
    method: 'GET',
    url: '/api/toys',
    headers: {
      authorization: `Basic ${Buffer.from('admin:secret').toString('base64')}`,
    },
  });
  const healthResponse = await server.inject({
    method: 'GET',
    url: '/health',
  });

  assert.equal(unauthorizedResponse.statusCode, 401);
  assert.equal(unauthorizedResponse.json().error.statusCode, 401);
  assert.equal(
    unauthorizedResponse.json().error.message,
    'Authentication required',
  );
  assert.equal(
    unauthorizedResponse.headers['www-authenticate'],
    'Basic realm="Toy API"',
  );

  assert.equal(authorizedResponse.statusCode, 200);
  assert.equal(healthResponse.statusCode, 200);
});

test('basic auth configuration fails fast when credentials are missing', async () => {
  await assert.rejects(
    createServer({
      nodeEnv: 'production',
      basicAuth: {
        enabled: true,
        username: 'admin',
      },
    }),
    /requires username and password/i,
  );
});

test('rate limiting blocks requests after threshold and exposes headers', async (t) => {
  const server = await createServer({
    nodeEnv: 'production',
    rateLimit: {
      enabled: true,
      max: 2,
      windowMs: 60000,
    },
  });
  t.after(async () => {
    await server.close();
  });

  const firstResponse = await server.inject({
    method: 'GET',
    url: '/api/toys',
  });
  const secondResponse = await server.inject({
    method: 'GET',
    url: '/api/toys',
  });
  const thirdResponse = await server.inject({
    method: 'GET',
    url: '/api/toys',
  });

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(firstResponse.headers['x-ratelimit-limit'], '2');
  assert.equal(firstResponse.headers['x-ratelimit-remaining'], '1');

  assert.equal(secondResponse.statusCode, 200);
  assert.equal(secondResponse.headers['x-ratelimit-remaining'], '0');

  assert.equal(thirdResponse.statusCode, 429);
  assert.equal(thirdResponse.json().error.statusCode, 429);
  assert.equal(thirdResponse.json().error.message, 'Rate limit exceeded');
  assert.equal(thirdResponse.headers['x-ratelimit-limit'], '2');
  assert.equal(thirdResponse.headers['x-ratelimit-remaining'], '0');
  assert.equal(typeof thirdResponse.headers['retry-after'], 'string');
});

test('cors allows trusted origins in production and blocks others', async (t) => {
  const server = await createServer({
    nodeEnv: 'production',
    basicAuth: {
      enabled: true,
      username: 'admin',
      password: 'secret',
    },
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

  const authenticatedResponse = await server.inject({
    method: 'GET',
    url: '/api/toys',
    headers: {
      authorization: `Basic ${Buffer.from('admin:secret').toString('base64')}`,
      origin: 'https://allowed.example',
    },
  });

  assert.equal(authenticatedResponse.statusCode, 200);
  assert.equal(
    authenticatedResponse.headers['access-control-allow-origin'],
    'https://allowed.example',
  );
});

test('server restores toys from snapshot on restart', async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'toy-server-'));
  const snapshotFilePath = path.join(tempDir, 'memory-store.snapshot.json');

  const serverA = await createServer({
    nodeEnv: 'production',
    snapshot: {
      enabled: true,
      filePath: snapshotFilePath,
      intervalMs: 0,
    },
  });
  t.after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createResponse = await serverA.inject({
    method: 'POST',
    url: '/api/toys',
    payload: {
      name: 'Snapshot Toy',
      image: 'https://example.com/snapshot-toy.png',
      likes: 4,
    },
  });
  assert.equal(createResponse.statusCode, 201);
  await serverA.close();

  const serverB = await createServer({
    nodeEnv: 'production',
    snapshot: {
      enabled: true,
      filePath: snapshotFilePath,
      intervalMs: 0,
    },
  });
  t.after(async () => {
    await serverB.close();
  });

  const listResponse = await serverB.inject({
    method: 'GET',
    url: '/api/toys',
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().length, 1);
  assert.equal(listResponse.json()[0].name, 'Snapshot Toy');
});

test('openapi json and swagger ui are exposed', async (t) => {
  const server = await createServer({ nodeEnv: 'test' });
  t.after(async () => {
    await server.close();
  });

  const openApiResponse = await server.inject({
    method: 'GET',
    url: '/openapi.json',
  });
  const docsResponse = await server.inject({
    method: 'GET',
    url: '/docs/',
  });

  assert.equal(openApiResponse.statusCode, 200);
  assert.equal(openApiResponse.json().openapi, '3.0.3');
  assert.ok(
    openApiResponse.json().paths['/api/toys'] ||
      openApiResponse.json().paths['/api/toys/'],
  );

  assert.equal(docsResponse.statusCode, 200);
  assert.match(docsResponse.headers['content-type'], /text\/html/i);
});

test('openapi exposes basic auth security scheme when auth is enabled', async (t) => {
  const server = await createServer({
    nodeEnv: 'production',
    basicAuth: {
      enabled: true,
      username: 'admin',
      password: 'secret',
    },
  });
  t.after(async () => {
    await server.close();
  });

  const openApiResponse = await server.inject({
    method: 'GET',
    url: '/openapi.json',
    headers: {
      authorization: `Basic ${Buffer.from('admin:secret').toString('base64')}`,
    },
  });

  assert.equal(openApiResponse.statusCode, 200);

  const document = openApiResponse.json();
  assert.deepEqual(document.security, [{ basicAuth: [] }]);
  assert.deepEqual(document.components.securitySchemes.basicAuth, {
    scheme: 'basic',
    type: 'http',
  });
  assert.deepEqual(document.paths['/health'].get.security, []);

  const toyListOperation =
    document.paths['/api/toys']?.get || document.paths['/api/toys/']?.get;
  assert.ok(toyListOperation);
  assert.equal(typeof toyListOperation.summary, 'string');
});
