const { statusCodes } = require('./variables');

const corsAllowedHeaders = ['Content-Type', 'Location'];
const corsExposedHeaders = ['Content-Disposition'];

function parseCorsOrigins(value) {
  if (!value) return [];

  if (Array.isArray(value))
    return value.map((origin) => String(origin).trim()).filter(Boolean);

  return String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function createCorsOriginValidator(options = {}) {
  const { corsOrigins = [], nodeEnv = 'development' } = options;
  const trustedOrigins = new Set(parseCorsOrigins(corsOrigins));
  const isProduction = nodeEnv === 'production';

  return function validateOrigin(origin, cb) {
    if (!origin) {
      cb(null, true);
      return;
    }

    if (!isProduction && trustedOrigins.size === 0) {
      cb(null, true);
      return;
    }

    if (trustedOrigins.has(origin)) {
      cb(null, true);
      return;
    }

    const error = new Error('Origin is not allowed by CORS');
    error.statusCode = statusCodes.FORBIDDEN;
    cb(error, false);
  };
}

module.exports = {
  corsAllowedHeaders,
  corsExposedHeaders,
  createCorsOriginValidator,
  parseCorsOrigins,
};
