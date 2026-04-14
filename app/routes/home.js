// const debug = require('debug')('toy-api-server-nodejs:->routes->home');
const fs = require('fs');
const path = require('path');

const faviconIco = fs.readFileSync(
  path.join(process.cwd(), './app/imgs/favicon.ico'),
);
const faviconPng = fs.readFileSync(
  path.join(process.cwd(), './app/imgs/favicon.png'),
);

async function routes(fastify, _options) {
  fastify.get(
    '/',
    {
      schema: {
        response: {
          200: { type: 'string' },
        },
        summary: 'Show welcome message',
        tags: ['system'],
      },
    },
    async (_request, _reply) => {
      return 'Welcome !!!';
    },
  );

  fastify.get(
    '/health',
    {
      schema: {
        response: {
          200: { $ref: 'HealthStatus#' },
        },
        summary: 'Check service health',
        tags: ['system'],
      },
    },
    async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    },
  );

  fastify.get(
    '/favicon.ico',
    { schema: { hide: true } },
    async (_request, reply) => {
      reply.type('image/x-icon').send(faviconIco);
    },
  );

  fastify.get(
    '/favicon.png',
    { schema: { hide: true } },
    async (_request, reply) => {
      reply.type('image/png').send(faviconPng);
    },
  );
}

module.exports = routes;
