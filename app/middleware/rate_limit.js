const fp = require('fastify-plugin');
const {
  http: { sendError },
  variables: { statusCodes },
} = require('../libs');

const DEFAULT_SKIPPED_PATHS = new Set([
  '/healthz',
  '/favicon.ico',
  '/favicon.png',
]);

function getClientKey(request) {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return request.ip || request.socket?.remoteAddress || 'unknown';
}

function getRequestPath(request) {
  return request.raw.url?.split('?')[0] || request.url || '/';
}

module.exports = fp(async (server, options) => {
  const { enabled = false, max = 100, store, windowMs = 60000 } = options;

  if (!enabled) return;
  if (!store) throw new Error('Rate limit middleware requires a store');

  server.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') return;

    const requestPath = getRequestPath(request);
    if (DEFAULT_SKIPPED_PATHS.has(requestPath)) return;

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
