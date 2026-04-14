function registerApiSchemas(server) {
  server.addSchema({
    $id: 'ErrorResponse',
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          statusCode: { type: 'integer' },
          message: { type: 'string' },
          details: {},
        },
        required: ['statusCode', 'message'],
      },
    },
    required: ['error'],
  });

  server.addSchema({
    $id: 'Toy',
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      image: { type: 'string', format: 'uri' },
      likes: { type: 'integer' },
      enabled: { type: 'boolean' },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'name', 'image', 'likes', 'enabled'],
  });

  server.addSchema({
    $id: 'ToyList',
    type: 'array',
    items: { $ref: 'Toy#' },
  });

  server.addSchema({
    $id: 'DeleteResponse',
    type: 'object',
    properties: {
      deleted: { type: 'boolean' },
    },
    required: ['deleted'],
  });

  server.addSchema({
    $id: 'HealthStatus',
    type: 'object',
    properties: {
      status: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
      uptime: { type: 'number' },
    },
    required: ['status', 'timestamp', 'uptime'],
  });
}

module.exports = {
  registerApiSchemas,
};
