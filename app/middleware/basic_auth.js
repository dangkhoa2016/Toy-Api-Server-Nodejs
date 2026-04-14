const { timingSafeEqual } = require('node:crypto');
const fp = require('fastify-plugin');
const {
  http: { sendError },
  variables: { statusCodes },
} = require('../libs');

const DEFAULT_REALM = 'Toy API';
const DEFAULT_SKIPPED_PATHS = new Set([
  '/health',
  '/favicon.ico',
  '/favicon.png',
]);

function getRequestPath(request) {
  return request.raw.url?.split('?')[0] || request.url || '/';
}

function decodeCredentials(headerValue) {
  if (typeof headerValue !== 'string' || !headerValue.startsWith('Basic ')) {
    return null;
  }

  try {
    const decoded = Buffer.from(headerValue.slice(6).trim(), 'base64').toString(
      'utf8',
    );
    const separatorIndex = decoded.indexOf(':');

    if (separatorIndex === -1) return null;

    return {
      password: decoded.slice(separatorIndex + 1),
      username: decoded.slice(0, separatorIndex),
    };
  } catch {
    return null;
  }
}

function safeEqual(value, expected) {
  const valueBuffer = Buffer.from(String(value), 'utf8');
  const expectedBuffer = Buffer.from(String(expected), 'utf8');

  if (valueBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(valueBuffer, expectedBuffer);
}

function credentialsMatch(credentials, expectedUsername, expectedPassword) {
  if (!credentials) return false;

  return (
    safeEqual(credentials.username, expectedUsername) &&
    safeEqual(credentials.password, expectedPassword)
  );
}

module.exports = fp(async (server, options) => {
  const {
    enabled = false,
    password,
    realm = DEFAULT_REALM,
    skippedPaths = DEFAULT_SKIPPED_PATHS,
    username,
  } = options;

  if (!enabled) return;

  if (!username || !password) {
    throw new Error('Basic auth middleware requires username and password');
  }

  const protectedPaths = new Set(skippedPaths);

  server.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') return;

    const requestPath = getRequestPath(request);
    if (protectedPaths.has(requestPath)) return;

    const credentials = decodeCredentials(request.headers.authorization);
    if (credentialsMatch(credentials, username, password)) return;

    reply.header('www-authenticate', `Basic realm="${realm}"`);

    request.log.warn(
      {
        correlationId: request.correlationId,
        event: 'basic_auth.rejected',
        requestId: request.id,
        requestPath,
      },
      'request rejected by basic auth',
    );

    return sendError(
      reply,
      statusCodes.UNAUTHORIZED,
      'Authentication required',
    );
  });
});
