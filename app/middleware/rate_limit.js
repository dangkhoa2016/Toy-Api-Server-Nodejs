const fp = require('fastify-plugin');
const {
  http: { sendError },
  requestClient: { getClientKey, getRequestPath },
  variables: { statusCodes },
} = require('../libs');

const DEFAULT_SKIPPED_PATHS = new Set([
  '/health',
  '/favicon.ico',
  '/favicon.png',
]);

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

module.exports = fp(async (server, options) => {
  const {
    enabled = false,
    max = 20,
    methods = ['POST'],
    paths = ['/api/toys'],
    store,
    windowMs = 300000,
  } = options;

  if (!enabled) return;
  if (!store) throw new Error('Rate limit middleware requires a store');

  const allowedMethods = new Set(
    methods.map((method) => method.toUpperCase()),
  );
  const allowedPaths = new Set(paths.map((pathname) => normalizePath(pathname)));

  server.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') return;

    const requestPath = getRequestPath(request);
    if (DEFAULT_SKIPPED_PATHS.has(requestPath)) return;
    if (!allowedMethods.has(request.method.toUpperCase())) return;
    if (!allowedPaths.has(normalizePath(requestPath))) return;

    const clientKey = getClientKey(request);
    const now = Date.now();
    const currentEntry = store.getRateLimit(clientKey);
    const resetAt =
      currentEntry &&
      Number.isFinite(currentEntry.resetAt) &&
      currentEntry.resetAt > now
        ? currentEntry.resetAt
        : now + windowMs;
    const nextEntry =
      currentEntry && currentEntry.resetAt > now
        ? { ...currentEntry }
        : { count: 0, resetAt };

    nextEntry.count += 1;
    store.setRateLimit(clientKey, nextEntry);

    const remaining = Math.max(0, max - nextEntry.count);
    reply.header('x-ratelimit-limit', String(max));
    reply.header('x-ratelimit-remaining', String(remaining));
    reply.header(
      'x-ratelimit-reset',
      String(Math.ceil(nextEntry.resetAt / 1000)),
    );

    if (nextEntry.count <= max) return;

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((nextEntry.resetAt - now) / 1000),
    );
    reply.header('retry-after', String(retryAfterSeconds));

    request.log.warn(
      {
        clientKey,
        correlationId: request.correlationId,
        event: 'rate_limit.blocked',
        requestId: request.id,
        resetAt: nextEntry.resetAt,
      },
      'request blocked by rate limit',
    );

    return sendError(
      reply,
      statusCodes.TOO_MANY_REQUESTS,
      'Rate limit exceeded',
      {
        limit: max,
        retryAfterSeconds,
        windowMs,
      },
    );
  });
});
