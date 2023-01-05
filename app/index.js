const debug = require('debug')('toy-api-demo:->index');

// CommonJs
const server = require('fastify')({
  // disableRequestLogging: true,
  logger: false, pluginTimeout: 10000
});

server.register(require('./middleware/logger'));

server.register(require('@fastify/cors'), {
  exposedHeaders: ['Content-Disposition'],
  allowedHeaders: ['Content-Type', 'Location'],
  origin: (origin, cb) => {
    // allow all
    cb(null, true);

    /* allow special host
    if (/localhost/.test(origin)) {
      //  Request from localhost will pass
      cb(null, true);
      return;
    }
    // Generate an error on other origins, disabling access
    cb(new Error("Not allowed"));
    */ 
  }
});

server.register(require('./routes/errors'));
server.register(require('./routes/home'));
server.register(require('./routes/toys'), { prefix: '/api/toys' });

debug(`Server Started at: ${new Date()}`);
module.exports = server;
