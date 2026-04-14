const debug = require('debug')('toy-api-server-nodejs:->index');
const { randomUUID } = require('node:crypto');
const Fastify = require('fastify');
const {
  corsAllowedHeaders,
  corsExposedHeaders,
  createCorsOriginValidator,
  parseCorsOrigins,
} = require('./libs/cors');
const ToysService = require('./services/toys_service');
const MemoryStore = require('./stores/memory_store');

function resolveLoggerOptions(logger, nodeEnv) {
  if (logger === false) return false;

  if (logger && typeof logger === 'object') return logger;

  if (logger === true) {
    return {
      level:
        process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug'),
    };
  }

  if (nodeEnv === 'production') {
    return {
      level: process.env.LOG_LEVEL || 'info',
    };
  }

  return false;
}

function buildServer(options = {}) {
  const {
    corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS),
    logger,
    nodeEnv = process.env.NODE_ENV,
    toyStore = new MemoryStore(),
    toysService = new ToysService({ store: toyStore }),
  } = options;

  const server = Fastify({
    disableRequestLogging: true,
    genReqId: () => randomUUID(),
    logger: resolveLoggerOptions(logger, nodeEnv),
    pluginTimeout: 10000,
    requestIdHeader: 'x-request-id',
  });

  server.decorate('toyStore', toyStore);
  server.decorate('toysService', toysService);

  server.register(require('./middleware/logger'));

  server.register(require('@fastify/cors'), {
    allowedHeaders: corsAllowedHeaders,
    exposedHeaders: corsExposedHeaders,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: createCorsOriginValidator({ corsOrigins, nodeEnv }),
  });

  server.register(require('./routes/errors'));
  server.register(require('./routes/home'));
  server.register(require('./routes/toys'), {
    prefix: '/api/toys',
    service: toysService,
  });

  debug(`Server builder configured at: ${new Date().toISOString()}`);
  return server;
}

module.exports = buildServer;
