const debug = require('debug')('toy-api-server-nodejs:->routes->toys');
const {
  http: { sendError },
  requestClient: { getClientKey },
  variables: { statusCodes, toyConstraints },
} = require('../libs');
const updateActions = ['post', 'put', 'patch'];

const paramSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'integer', minimum: 1 },
  },
  required: ['id'],
};

const likeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    likes: { type: 'integer', minimum: 0 },
  },
  required: ['likes'],
};

const fields = {
  name: {
    type: 'string',
    minLength: toyConstraints.minNameLength,
    maxLength: toyConstraints.maxNameLength,
  },
  image: { type: 'string', format: 'uri' },
  likes: { type: 'integer', minimum: 0 },
};

const dataSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'image'],
  properties: fields,
};

const toyListRouteSchema = {
  response: {
    200: { $ref: 'ToyList#' },
    500: { $ref: 'ErrorResponse#' },
  },
  summary: 'List toys',
  tags: ['toys'],
};

const toyResponseSchema = {
  200: { $ref: 'Toy#' },
  404: { $ref: 'ErrorResponse#' },
  422: { $ref: 'ErrorResponse#' },
};

const toyMutationResponseSchema = {
  200: { $ref: 'Toy#' },
  201: { $ref: 'Toy#' },
  422: { $ref: 'ErrorResponse#' },
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

  async function createToy(request, reply) {
    const clientKey = getClientKey(request);
    const { name = '', likes = 0, image = '' } = request.body;

    const {
      code = statusCodes.UNPROCESSABLE_ENTITY,
      data,
      details,
      error,
    } = await toysService.createToy({ name, likes, image }, { clientKey });
    if (data) return reply.code(code).send(data);

    return sendError(reply, code, error || 'Unable to create toy', details);
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
  fastify.get('/', { schema: toyListRouteSchema }, async (_request, reply) => {
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
  fastify.get(
    '/:id',
    {
      schema: {
        params: paramSchema,
        response: toyResponseSchema,
        summary: 'Get a toy by id',
        tags: ['toys'],
      },
    },
    getToy,
  );

  //delete
  fastify.delete(
    '/:id',
    {
      schema: {
        params: paramSchema,
        response: {
          200: { $ref: 'DeleteResponse#' },
          404: { $ref: 'ErrorResponse#' },
          422: { $ref: 'ErrorResponse#' },
        },
        summary: 'Delete a toy',
        tags: ['toys'],
      },
    },
    deleteToy,
  );

  //create
  fastify.post(
    '/',
    {
      schema: {
        body: dataSchema,
        response: toyMutationResponseSchema,
        summary: 'Create a toy',
        tags: ['toys'],
      },
    },
    createToy,
  );

  //update
  const updateDataOptions = {
    schema: {
      params: paramSchema,
      body: dataSchema,
      response: toyMutationResponseSchema,
      summary: 'Update a toy',
      tags: ['toys'],
    },
  };
  updateActions.forEach((action) => {
    fastify[action]('/:id', updateDataOptions, saveToy);
  });

  //likes
  updateActions.forEach((action) => {
    fastify[action](
      '/:id/likes',
      {
        schema: {
          params: paramSchema,
          body: likeSchema,
          response: toyResponseSchema,
          summary: 'Update toy likes',
          tags: ['toys'],
        },
      },
      likeToy,
    );
  });

  //export
  fastify.get(
    '/export',
    {
      schema: {
        response: {
          200: { type: 'string', format: 'binary' },
          500: { $ref: 'ErrorResponse#' },
        },
        summary: 'Export toys as JSON file',
        tags: ['toys'],
      },
    },
    async (_request, reply) => {
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
    },
  );
}

module.exports = routes;
