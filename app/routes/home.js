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
  fastify.get('/', async (_request, _reply) => {
    return 'Welcome !!!';
  });

  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  fastify.get('/favicon.ico', async (_request, reply) => {
    reply.type('image/x-icon').send(faviconIco);
  });

  fastify.get('/favicon.png', async (_request, reply) => {
    reply.type('image/png').send(faviconPng);
  });
}

module.exports = routes;
