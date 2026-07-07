function success(data, message) {
  return {
    ok: true,
    code: RESPONSE_CODES.SUCCESS,
    data: data || null,
    message: message || ''
  };
}

function fail(message, code, detail) {
  return {
    ok: false,
    code: code || RESPONSE_CODES.ERROR,
    data: null,
    message: message || 'Request failed',
    detail: detail || null
  };
}

function notFound(message) {
  return fail(message || 'Resource not found', RESPONSE_CODES.NOT_FOUND, null);
}

function forbidden(message) {
  return fail(message || 'Access denied', RESPONSE_CODES.FORBIDDEN, null);
}

function validationError(message, detail) {
  return fail(message || 'Validation failed', RESPONSE_CODES.VALIDATION_ERROR, detail || null);
}
