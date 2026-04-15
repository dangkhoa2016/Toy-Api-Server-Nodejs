function getClientKey(request) {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return request.ip || request.socket?.remoteAddress || 'unknown';
}

function getRequestPath(request) {
  return request.raw.url?.split('?')[0] || request.url || '/';
}

module.exports = {
  getClientKey,
  getRequestPath,
};
