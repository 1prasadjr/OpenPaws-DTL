const isPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.getPrototypeOf(value) === Object.prototype;
};

const successResponse = (res, data, message, statusCode = 200) => {
  const payload = { success: true };

  if (message) {
    payload.message = message;
  }

  if (data !== undefined) {
    if (isPlainObject(data)) {
      Object.assign(payload, data);
    } else {
      payload.data = data;
    }
  }

  return res.status(statusCode).json(payload);
};

const errorResponse = (res, message, statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = {
  successResponse,
  errorResponse,
};
