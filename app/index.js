const debug = require('debug')('toy-api-server-nodejs:->index');
const { randomUUID } = require('node:crypto');
const Fastify = require('fastify');
const {
  corsAllowedHeaders,
  corsExposedHeaders,
  createCorsOriginValidator,
  parseCorsOrigins,
} = require('./libs/cors');
const { swaggerUiLogo, swaggerUiTheme } = require('./libs/branding');
const { registerApiSchemas } = require('./libs/api_schemas');
const { getToyPolicyDefaults, timeConstants } = require('./libs/variables');
const ToysService = require('./services/toys_service');
const MemoryStore = require('./stores/memory_store');

function resolveLoggerOptions(logger, nodeEnv) {
  debug('Resolving logger options', { logger, nodeEnv });
  const envLogLevel = process.env.LOG_LEVEL;

  if (logger === false) return false;

  if (logger && typeof logger === 'object') return logger;

  if (logger === true) {
    return {
      level:
        process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug'),
    };
  }

  if (envLogLevel) {
    return {
      level: envLogLevel,
    };
  }

  if (nodeEnv === 'production') {
    return {
      level: 'info',
    };
  }

  return false;
}

function resolveRateLimitOptions(rateLimitOptions = {}, nodeEnv) {
  const toyPolicyDefaults = getToyPolicyDefaults();
  const envEnabled = process.env.RATE_LIMIT_ENABLED;
  const enabled =
    typeof rateLimitOptions.enabled === 'boolean'
      ? rateLimitOptions.enabled
      : envEnabled
        ? envEnabled !== 'false'
        : nodeEnv !== 'test';
  const max = Number(rateLimitOptions.max ?? process.env.RATE_LIMIT_MAX ?? 20);
  const methods = rateLimitOptions.methods || ['POST'];
  const paths = rateLimitOptions.paths || ['/api/toys'];
  const windowMs = Number(
    rateLimitOptions.windowMs ??
      process.env.RATE_LIMIT_WINDOW_MS ??
      toyPolicyDefaults.rateLimitWindowMs,
  );

  return {
    enabled,
    max: Number.isFinite(max) ? Math.max(1, Math.floor(max)) : 100,
    methods,
    paths,
    windowMs: Number.isFinite(windowMs)
      ? Math.max(1000, Math.floor(windowMs))
      : toyPolicyDefaults.rateLimitWindowMs,
  };
}

function resolveToyPolicyOptions(toyPolicyOptions = {}) {
  const toyPolicyDefaults = getToyPolicyDefaults();
  const cleanupIntervalMs = Number(
    toyPolicyOptions.cleanupIntervalMs ??
      process.env.TOY_CLEANUP_INTERVAL_MS ??
      toyPolicyDefaults.cleanupIntervalMs,
  );
  const maxToysPerIp = Number(
    toyPolicyOptions.maxToysPerIp ??
      process.env.MAX_TOYS_PER_IP ??
      toyPolicyDefaults.maxToysPerIp,
  );
  const seedMaxToysPerIp = Number(
    toyPolicyOptions.seedMaxToysPerIp ??
      process.env.SEED_MAX_TOYS_PER_IP ??
      toyPolicyDefaults.seedMaxToysPerIp,
  );
  const seedWindowMs = Number(
    toyPolicyOptions.seedWindowMs ??
      process.env.SEED_WINDOW_MS ??
      toyPolicyDefaults.seedWindowMs,
  );
  const toyTtlMs = Number(
    toyPolicyOptions.toyTtlMs ?? process.env.TOY_TTL_MS ?? toyPolicyDefaults.toyTtlMs,
  );

  return {
    cleanupIntervalMs: Number.isFinite(cleanupIntervalMs)
      ? Math.max(1000, Math.floor(cleanupIntervalMs))
      : timeConstants.MS_PER_MINUTE,
    maxToysPerIp: Number.isFinite(maxToysPerIp)
      ? Math.max(1, Math.floor(maxToysPerIp))
      : toyPolicyDefaults.maxToysPerIp,
    seedMaxToysPerIp: Number.isFinite(seedMaxToysPerIp)
      ? Math.max(1, Math.floor(seedMaxToysPerIp))
      : toyPolicyDefaults.seedMaxToysPerIp,
    seedWindowMs: Number.isFinite(seedWindowMs)
      ? Math.max(1000, Math.floor(seedWindowMs))
      : toyPolicyDefaults.seedWindowMs,
    toyTtlMs: Number.isFinite(toyTtlMs)
      ? Math.max(1000, Math.floor(toyTtlMs))
      : toyPolicyDefaults.toyTtlMs,
  };
}

function resolveSecurityHeadersOptions(securityHeadersOptions = {}, nodeEnv) {
  const envEnabled = process.env.SECURITY_HEADERS_ENABLED;
  const enabled =
    typeof securityHeadersOptions.enabled === 'boolean'
      ? securityHeadersOptions.enabled
      : envEnabled
        ? envEnabled !== 'false'
        : nodeEnv !== 'test';

  return {
    enabled,
    options: {
      contentSecurityPolicy: false,
      ...(securityHeadersOptions.options || {}),
    },
  };
}

function resolveBasicAuthOptions(basicAuthOptions = {}) {
  const envEnabled = process.env.BASIC_AUTH_ENABLED;
  const enabled =
    typeof basicAuthOptions.enabled === 'boolean'
      ? basicAuthOptions.enabled
      : envEnabled
        ? envEnabled !== 'false'
        : false;

  return {
    enabled,
    password:
      basicAuthOptions.password || process.env.BASIC_AUTH_PASSWORD || '',
    realm: basicAuthOptions.realm || process.env.BASIC_AUTH_REALM || 'Toy API',
    skippedPaths: basicAuthOptions.skippedPaths,
    username:
      basicAuthOptions.username || process.env.BASIC_AUTH_USERNAME || '',
  };
}

function buildServer(options = {}) {
  const {
    basicAuth,
    corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS),
    logger,
    nodeEnv = process.env.NODE_ENV,
    rateLimit,
    securityHeaders,
    toyPolicy,
    toyStore,
    toysService,
  } = options;
  const resolvedRateLimitOptions = resolveRateLimitOptions(rateLimit, nodeEnv);
  const resolvedToyPolicyOptions = resolveToyPolicyOptions(toyPolicy);
  const resolvedSecurityHeadersOptions = resolveSecurityHeadersOptions(
    securityHeaders,
    nodeEnv,
  );
  const resolvedBasicAuthOptions = resolveBasicAuthOptions(basicAuth);
  const resolvedToyStore = toyStore || new MemoryStore();
  const resolvedToysService =
    toysService ||
    new ToysService({
      maxToysPerIp: resolvedToyPolicyOptions.maxToysPerIp,
      seedMaxToysPerIp: resolvedToyPolicyOptions.seedMaxToysPerIp,
      seedWindowMs: resolvedToyPolicyOptions.seedWindowMs,
      store: resolvedToyStore,
      toyTtlMs: resolvedToyPolicyOptions.toyTtlMs,
    });
  let maintenanceTimer = null;

  const server = Fastify({
    disableRequestLogging: true,
    genReqId: () => randomUUID(),
    logger: resolveLoggerOptions(logger, nodeEnv),
    pluginTimeout: 10000,
    requestIdHeader: 'x-request-id',
  });

  server.decorate('toyStore', resolvedToyStore);
  server.decorate('toysService', resolvedToysService);

  server.register(require('@fastify/swagger'), {
    openapi: {
      components: resolvedBasicAuthOptions.enabled
        ? {
            securitySchemes: {
              basicAuth: {
                scheme: 'basic',
                type: 'http',
              },
            },
          }
        : undefined,
      info: {
        title: 'Toy API Server',
        version: '1.0.0',
        description:
          'Fastify-based toy API with in-memory storage, TTL cleanup, rate limiting, and optional basic auth.',
      },
      security: resolvedBasicAuthOptions.enabled ? [{ basicAuth: [] }] : [],
      tags: [
        { name: 'system', description: 'Operational endpoints' },
        { name: 'toys', description: 'Toy resource operations' },
      ],
    },
  });

  server.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    logo: swaggerUiLogo,
    theme: swaggerUiTheme,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  registerApiSchemas(server);

  server.get(
    '/openapi.json',
    { schema: { hide: true } },
    async (_request, reply) => {
      reply.type('application/json').send(server.swagger());
    },
  );

  server.addHook('onReady', async () => {
    if (!maintenanceTimer) {
      maintenanceTimer = setInterval(() => {
        const expiredToyCount = resolvedToyStore.pruneExpiredToys();
        const clearedRateLimitCount = resolvedToyStore.cleanupRateLimits();
        const clearedSeedStateCount = resolvedToyStore.cleanupSeedStates(
          Date.now(),
          {
            retentionMs:
              resolvedToyPolicyOptions.seedWindowMs +
              resolvedToyPolicyOptions.toyTtlMs,
          },
        );

        if (!expiredToyCount && !clearedRateLimitCount && !clearedSeedStateCount)
          return;

        server.log.info(
          {
            clearedRateLimitCount,
            clearedSeedStateCount,
            event: 'memory_store.maintenance.completed',
            expiredToyCount,
            toyCount: resolvedToyStore.listToys().length,
          },
          'memory store maintenance completed',
        );
      }, resolvedToyPolicyOptions.cleanupIntervalMs);
      maintenanceTimer.unref?.();
    }

  });

  server.addHook('onClose', async () => {
    if (maintenanceTimer) {
      clearInterval(maintenanceTimer);
      maintenanceTimer = null;
    }

  });

  server.register(require('./middleware/logger'));

  if (resolvedSecurityHeadersOptions.enabled) {
    server.register(
      require('@fastify/helmet'),
      resolvedSecurityHeadersOptions.options,
    );
  }

  server.register(require('./middleware/rate_limit'), {
    ...resolvedRateLimitOptions,
    store: resolvedToyStore,
  });

  server.register(require('@fastify/cors'), {
    allowedHeaders: corsAllowedHeaders,
    exposedHeaders: corsExposedHeaders,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: createCorsOriginValidator({ corsOrigins, nodeEnv }),
  });

  server.register(require('./middleware/basic_auth'), resolvedBasicAuthOptions);

  server.register(require('./routes/errors'));
  server.register(require('./routes/home'));
  server.register(require('./routes/toys'), {
    prefix: '/api/toys',
    service: resolvedToysService,
  });

  debug(`Server builder configured at: ${new Date().toISOString()}`);
  return server;
}

module.exports = buildServer;
