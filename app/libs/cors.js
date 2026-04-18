const { statusCodes } = require('./variables');

const corsAllowedHeaders = [
  'Authorization',
  'Content-Type',
  'Location',
  'X-Correlation-Id',
  'X-Request-Id',
];
const corsExposedHeaders = [
  'Content-Disposition',
  'X-Correlation-Id',
  'X-Request-Id',
];
const corsMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

function parseCorsOrigins(value) {
  if (!value) return [];

  if (Array.isArray(value))
    return value.map((origin) => String(origin).trim()).filter(Boolean);

  return String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getHeaderValue(value) {
  if (Array.isArray(value)) return value[0];

  return value;
}

function parseUrl(value) {
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

function isLoopbackOrigin(origin) {
  const parsedOrigin = parseUrl(origin);
  if (!parsedOrigin) return false;

  return isLoopbackHostname(parsedOrigin.hostname);
}

function getRequestPublicOrigin(request) {
  if (!request) return null;

  const forwardedProtocol =
    getHeaderValue(request.headers['x-forwarded-proto']) ||
    getHeaderValue(request.headers['x-forwarded-scheme']) ||
    getHeaderValue(request.headers['x-scheme']);
  const forwardedHost = getHeaderValue(request.headers['x-forwarded-host']);
  const host = forwardedHost || getHeaderValue(request.headers.host);
  const protocol = forwardedProtocol || request.protocol;

  if (!host || !protocol) return null;

  return `${protocol}://${host}`;
}

function isSameOrigin(left, right) {
  const leftUrl = parseUrl(left);
  const rightUrl = parseUrl(right);
  if (!leftUrl || !rightUrl) return false;

  return leftUrl.origin === rightUrl.origin;
}

function isTrustedDocsProxyOrigin(origin, trustedOrigins, request) {
  if (!request || !isLoopbackOrigin(origin)) return false;

  const referer = parseUrl(getHeaderValue(request.headers.referer));
  if (!referer || !referer.pathname.startsWith('/docs')) return false;

  if (trustedOrigins.has(referer.origin)) return true;

  const requestPublicOrigin = getRequestPublicOrigin(request);
  if (!requestPublicOrigin) return false;

  return isSameOrigin(referer.origin, requestPublicOrigin);
}

function isCorsOriginAllowed(origin, options = {}, request) {
  const { corsOrigins = [], nodeEnv = 'development' } = options;
  const trustedOrigins = new Set(parseCorsOrigins(corsOrigins));
  const isProduction = nodeEnv === 'production';

  if (!origin) return true;

  if (!isProduction && trustedOrigins.size === 0) return true;

  if (trustedOrigins.has(origin)) return true;

  const requestPublicOrigin = getRequestPublicOrigin(request);
  if (
    requestPublicOrigin &&
    isSameOrigin(origin, requestPublicOrigin) &&
    (trustedOrigins.has(requestPublicOrigin) || !isProduction)
  ) {
    return true;
  }

  if (isTrustedDocsProxyOrigin(origin, trustedOrigins, request)) return true;

  return false;
}

function createCorsOriginValidator(options = {}) {
  return function validateOrigin(origin, cb) {
    if (isCorsOriginAllowed(origin, options)) {
      cb(null, true);
      return;
    }

    const error = new Error('Origin is not allowed by CORS');
    error.statusCode = statusCodes.FORBIDDEN;
    cb(error, false);
  };
}

function createCorsOptionsResolver(options = {}) {
  const {
    allowedHeaders = corsAllowedHeaders,
    exposedHeaders = corsExposedHeaders,
    methods = corsMethods,
  } = options;

  return function resolveCorsOptions(request, cb) {
    cb(null, {
      allowedHeaders,
      exposedHeaders,
      methods,
      origin(origin, done) {
        if (isCorsOriginAllowed(origin, options, request)) {
          done(null, true);
          return;
        }

        const error = new Error('Origin is not allowed by CORS');
        error.statusCode = statusCodes.FORBIDDEN;
        done(error, false);
      },
    });
  };
}

module.exports = {
  corsAllowedHeaders,
  corsExposedHeaders,
  corsMethods,
  createCorsOptionsResolver,
  createCorsOriginValidator,
  parseCorsOrigins,
};
