const debug = require('debug')('toy-api-server-nodejs:->index');
const Fastify = require('fastify');
const { corsAllowedHeaders, corsExposedHeaders, createCorsOriginValidator, parseCorsOrigins } = require('./libs/cors');

function buildServer(options = {}) {
  const {
    corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS),
    logger = false,
    nodeEnv = process.env.NODE_ENV,
  } = options;

  const server = Fastify({
    logger,
    pluginTimeout: 10000,
  });

  server.register(require('./middleware/logger'));

  server.register(require('@fastify/cors'), {
    allowedHeaders: corsAllowedHeaders,
    exposedHeaders: corsExposedHeaders,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: createCorsOriginValidator({ corsOrigins, nodeEnv }),
  });

  server.register(require('./routes/errors'));
  server.register(require('./routes/home'));
  server.register(require('./routes/toys'), { prefix: '/api/toys' });

  debug(`Server builder configured at: ${new Date().toISOString()}`);
  return server;
}

module.exports = buildServer;
