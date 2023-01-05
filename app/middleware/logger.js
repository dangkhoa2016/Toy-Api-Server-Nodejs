const fp = require('fastify-plugin');
const debug = require('debug')('toy-api-demo:->middleware->logger');

module.exports = fp(async (server, opts) => {

  const now = () => Date.now();

  /*
  server.addHook('preSerialization', function (req, reply, done) {
    debug('preSerialization', reply);
  });
  */

  server.addHook('preHandler', async function (request, reply) {
    reply.startTime = now();
    if (request.body)
      debug({ info: 'parse body', body: request.body });
  });

  server.addHook('onRequest', async (request, reply) => {
    reply.startTime = now();
    debug({
      info: 'received request', url: request.raw.url,
      method: request.method, id: request.id
    });
  });

  server.addHook('onResponse', async (request, reply) => {
    debug(
      {
        info: 'response completed',
        url: request.raw.url, // add url to response as well for simple correlating
        statusCode: reply.raw.statusCode,
        durationMs: now() - reply.startTime, // recreate duration in ms - use process.hrtime() - https://nodejs.org/api/process.html#process_process_hrtime_bigint for most accuracy
      }
    );
  });

});