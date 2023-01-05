const debug = require('debug')('toy-api-demo:->routes->errors');
const fp = require('fastify-plugin');
const { variables: { statusCodes }, } = require('../libs');

module.exports = fp(async (fastify, options) => {

  fastify.decorate('notFound', (request, reply) => {
    reply.code(statusCodes.NOT_FOUND).send({ error: '404 - Not Found.', message: 'Please go home' });
  });

  fastify.decorate('exception', (request, reply) => {
    // debug('exception', request);
    reply.code(statusCodes.INTERNAL_SERVER_ERROR).send({ error: '500 - Internal Server Error.', message: 'Please go home' });
  });

  fastify.get('/404', async (request, reply) => {
    return fastify.notFound(request, reply);
  });

  fastify.get('/500', async (request, reply) => {
    return fastify.exception(request, reply);
  });

  fastify.setErrorHandler(async (error, request, reply) => {
    debug('fastify.setErrorHandler', error, request.headers);
    if (error.validation)
      return reply.code(statusCodes.UNPROCESSABLE_ENTITY).send({ error: error.message });

    return fastify.exception(request, reply);
  });

  fastify.setNotFoundHandler(fastify.notFound);

});
