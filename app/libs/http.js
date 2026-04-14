function errorPayload(statusCode, message, details) {
  const payload = {
    error: {
      statusCode,
      message,
    },
  };

  if (typeof details !== 'undefined')
    payload.error.details = details;

  return payload;
}

function sendError(reply, statusCode, message, details) {
  return reply.code(statusCode).send(errorPayload(statusCode, message, details));
}

module.exports = {
  errorPayload,
  sendError,
};