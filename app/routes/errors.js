const debug = require('debug')('toy-api-server-nodejs:->routes->errors');
const fp = require('fastify-plugin');
const {
  http: { sendError },
  variables: { statusCodes },
} = require('../libs');

module.exports = fp(async (fastify, _options) => {
  fastify.decorate('notFound', (request, reply) => {
    return sendError(reply, statusCodes.NOT_FOUND, 'Route not found');
  });

  fastify.decorate('exception', (request, reply) => {
    return sendError(
      reply,
      statusCodes.INTERNAL_SERVER_ERROR,
      'Internal Server Error',
    );
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
      return sendError(reply, statusCodes.UNPROCESSABLE_ENTITY, error.message);

    const statusCode = Number.isInteger(error.statusCode)
      ? error.statusCode
      : statusCodes.INTERNAL_SERVER_ERROR;

    if (statusCode >= statusCodes.INTERNAL_SERVER_ERROR)
      return fastify.exception(request, reply);

    return sendError(reply, statusCode, error.message || 'Request failed');
  });

  fastify.setNotFoundHandler(fastify.notFound);
});
