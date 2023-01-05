// const debug = require('debug')('toy-api-demo:->routes->home');
const fs = require('fs');
const path = require('path');

async function routes(fastify, options) {

  fastify.get('/', async (request, reply) => {
    return 'Welcome !!!'
  });

  fastify.get('/favicon.ico', async (request, reply) => {
    const buffer = await fs.readFileSync(path.join(process.cwd(), './app/imgs/favicon.ico'));
    reply.type('image/x-icon').send(buffer);
  });

  fastify.get('/favicon.png', async (request, reply) => {
    const buffer = await fs.readFileSync(path.join(process.cwd(), './app/imgs/favicon.png'));
    reply.type('image/png').send(buffer);
  });

};

module.exports = routes;
