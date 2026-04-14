const debug = require('debug')('toy-api-server-nodejs:->index');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
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

function resolveSnapshotOptions(snapshotOptions = {}, nodeEnv) {
  const envEnabled = process.env.SNAPSHOT_ENABLED;
  const enabled =
    typeof snapshotOptions.enabled === 'boolean'
      ? snapshotOptions.enabled
      : envEnabled
        ? envEnabled !== 'false'
        : nodeEnv !== 'test';
  const intervalMs = Number(
    snapshotOptions.intervalMs ?? process.env.SNAPSHOT_INTERVAL_MS ?? 30000,
  );

  return {
    enabled,
    filePath:
      snapshotOptions.filePath ||
      process.env.SNAPSHOT_FILE_PATH ||
      path.join(process.cwd(), 'data', 'memory-store.snapshot.json'),
    intervalMs: Number.isFinite(intervalMs) ? Math.max(0, intervalMs) : 30000,
  };
}

function buildServer(options = {}) {
  const {
    corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS),
    logger,
    nodeEnv = process.env.NODE_ENV,
    snapshot,
    toyStore,
    toysService,
  } = options;
  const resolvedSnapshotOptions = resolveSnapshotOptions(snapshot, nodeEnv);
  const resolvedToyStore =
    toyStore || new MemoryStore({ snapshot: resolvedSnapshotOptions });
  const resolvedToysService =
    toysService || new ToysService({ store: resolvedToyStore });

  const server = Fastify({
    disableRequestLogging: true,
    genReqId: () => randomUUID(),
    logger: resolveLoggerOptions(logger, nodeEnv),
    pluginTimeout: 10000,
    requestIdHeader: 'x-request-id',
  });

  server.decorate('toyStore', resolvedToyStore);
  server.decorate('toysService', resolvedToysService);

  server.addHook('onReady', async () => {
    if (!resolvedToyStore.hasSnapshot()) return;

    try {
      const restored = await resolvedToyStore.restoreFromSnapshot();
      if (restored) {
        server.log.info(
          {
            event: 'memory_store.snapshot.restored',
            snapshotFilePath: resolvedToyStore.getSnapshotFilePath(),
            toyCount: resolvedToyStore.listToys().length,
          },
          'memory store restored from snapshot',
        );
      }

      resolvedToyStore.startAutoSave({
        onError: (error) => {
          server.log.error(
            {
              error,
              event: 'memory_store.snapshot.save_failed',
              snapshotFilePath: resolvedToyStore.getSnapshotFilePath(),
            },
            'memory store snapshot save failed',
          );
        },
      });
    } catch (error) {
      server.log.error(
        {
          error,
          event: 'memory_store.snapshot.restore_failed',
          snapshotFilePath: resolvedToyStore.getSnapshotFilePath(),
        },
        'memory store snapshot restore failed',
      );
      throw error;
    }
  });

  server.addHook('onClose', async () => {
    resolvedToyStore.stopAutoSave();

    if (!resolvedToyStore.hasSnapshot()) return;

    await resolvedToyStore.saveSnapshot();
    server.log.info(
      {
        event: 'memory_store.snapshot.saved',
        snapshotFilePath: resolvedToyStore.getSnapshotFilePath(),
        toyCount: resolvedToyStore.listToys().length,
      },
      'memory store snapshot saved',
    );
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
  server.register(require('./routes/toys'), {
    prefix: '/api/toys',
    service: resolvedToysService,
  });

  debug(`Server builder configured at: ${new Date().toISOString()}`);
  return server;
}

module.exports = buildServer;
