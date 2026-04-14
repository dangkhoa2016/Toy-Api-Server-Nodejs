const fp = require('fastify-plugin');

module.exports = fp(async (server, _opts) => {
  server.decorateRequest('correlationId', null);
  server.decorateRequest('startTime', null);

  const getHeaderValue = (value) => {
    if (Array.isArray(value)) return value[0];

    return value;
  };

  server.addHook('preHandler', async function (request, _reply) {
    if (request.body) {
      request.log.debug(
        {
          correlationId: request.correlationId,
          event: 'request.body.parsed',
          requestId: request.id,
        },
        'request body parsed',
      );
    }
  });

  server.addHook('onRequest', async (request, reply) => {
    request.startTime = process.hrtime.bigint();
    request.correlationId =
      getHeaderValue(request.headers['x-correlation-id']) || request.id;

    reply.header('x-correlation-id', request.correlationId);
    reply.header('x-request-id', request.id);

    request.log.info(
      {
        correlationId: request.correlationId,
        event: 'request.received',
        method: request.method,
        requestId: request.id,
        url: request.raw.url,
      },
      'request received',
    );
  });

  server.addHook('onError', async (request, reply, error) => {
    const statusCode = Number.isInteger(error.statusCode)
      ? error.statusCode
      : reply.raw.statusCode;

    request.log.error(
      {
        correlationId: request.correlationId,
        error,
        event: 'request.failed',
        requestId: request.id,
        statusCode,
        url: request.raw.url,
      },
      'request failed',
    );
  });

  server.addHook('onResponse', async (request, reply) => {
    const durationMs = request.startTime
      ? Number(process.hrtime.bigint() - request.startTime) / 1000000
      : undefined;

    request.log.info(
      {
        correlationId: request.correlationId,
        durationMs,
        event: 'request.completed',
        method: request.method,
        requestId: request.id,
        statusCode: reply.raw.statusCode,
        url: request.raw.url,
      },
      'request completed',
    );
  });
});
