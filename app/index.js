const debug = require('debug')('toy-api-server-nodejs:->index');
const Fastify = require('fastify');
const {
  corsAllowedHeaders,
  corsExposedHeaders,
  createCorsOriginValidator,
  parseCorsOrigins,
} = require('./libs/cors');
const ToysService = require('./services/toys_service');
const MemoryStore = require('./stores/memory_store');

function buildServer(options = {}) {
  const {
    corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS),
    logger = false,
    nodeEnv = process.env.NODE_ENV,
    toyStore = new MemoryStore(),
    toysService = new ToysService({ store: toyStore }),
  } = options;

  const server = Fastify({
    logger,
    pluginTimeout: 10000,
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
