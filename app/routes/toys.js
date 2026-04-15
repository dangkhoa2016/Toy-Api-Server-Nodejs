const debug = require('debug')('toy-api-server-nodejs:->routes->toys');
const {
  http: { sendError },
  variables: { statusCodes },
} = require('../libs');
const updateActions = ['post', 'put', 'patch'];

const paramSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
  },
  required: ['id'],
};

const likeSchema = {
  type: 'object',
  properties: {
    likes: { type: 'integer' },
  },
  required: ['likes'],
};

const fields = {
  name: { type: 'string' },
  image: { type: 'string' },
  likes: { type: 'number' },
};

const dataSchema = {
  type: 'object',
  required: ['name', 'image'],
  properties: fields,
};

async function routes(fastify, options) {
  const toysService = options.service || fastify.toysService;

  async function saveToy(request, reply) {
    const { id } = request.params;
    const { name = '', likes = 0, image = '' } = request.body;

    const {
      code = statusCodes.UNPROCESSABLE_ENTITY,
      data,
      error,
    } = await toysService.saveToy({ name, likes, image, id });
    if (data) return reply.code(code).send(data);

    return sendError(reply, code, error || 'Unable to save toy');
  }

  async function deleteToy(request, reply) {
    const { id } = request.params;

    const {
      code = statusCodes.UNPROCESSABLE_ENTITY,
      data,
      error,
    } = await toysService.deleteToy(id);
    if (data) return reply.code(code).send(data);

    return sendError(reply, code, error || 'Unable to delete toy');
  }

  async function getToy(request, reply) {
    const { id } = request.params;

    const {
      code = statusCodes.NOT_FOUND,
      data,
      error,
    } = await toysService.getToy(id);
    if (data) return reply.code(code).send(data);

    return sendError(reply, code, error || 'Toy not found');
  }

  async function likeToy(request, reply) {
    const { id } = request.params;
    const { likes = 0 } = request.body;

    const {
      code = statusCodes.NOT_FOUND,
      data,
      error,
    } = await toysService.likeToy(id, likes);
    if (data) return reply.code(code).send(data);

    return sendError(reply, code, error || 'Unable to update likes');
  }

  //index
  fastify.get('/', { schema: {} }, async (_request, reply) => {
    try {
      return await toysService.getToys();
    } catch (error) {
      debug('/index Error getToys', error);
      return sendError(
        reply,
        statusCodes.INTERNAL_SERVER_ERROR,
        'Unable to list toys',
      );
    }
  });

  //show
  fastify.get('/:id', { schema: { params: paramSchema } }, getToy);

  //delete
  fastify.delete('/:id', { schema: { params: paramSchema } }, deleteToy);

  //create
  fastify.post('/', { schema: { body: dataSchema } }, saveToy);

  //update
  const updateDataOptions = {
    schema: { params: paramSchema, body: dataSchema },
  };
  updateActions.forEach((action) => {
    fastify[action]('/:id', updateDataOptions, saveToy);
  });

  //likes
  updateActions.forEach((action) => {
    fastify[action](
      '/:id/likes',
      { schema: { params: paramSchema, body: likeSchema } },
      likeToy,
    );
  });

  //export
  fastify.get('/export', async (_request, reply) => {
    let result;
    try {
      result = await toysService.getToys();
    } catch (error) {
      debug('/export Error getToys', error);
      return sendError(
        reply,
        statusCodes.INTERNAL_SERVER_ERROR,
        'Unable to export toys',
      );
    }

    const fileName = `export-toys-${new Date().valueOf()}.json`;
    reply.header('Content-Disposition', `attachment; filename=${fileName}`);
    reply.type('application/json');

    const buf = Buffer.from(JSON.stringify(result));
    reply.send(buf);
  });
}

module.exports = routes;
