const { Prisma } = require('../config/prisma');
const { ZodError } = require('zod');
const { errorResponse } = require('../utils/apiResponse');

const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ZodError) {
    return errorResponse(res, 'Validation failed', 400);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Duplicate record already exists', 409);
    }

    if (err.code === 'P2025') {
      return errorResponse(res, 'Record not found', 404);
    }
  }

  if (err && err.code === 'P1001') {
    return errorResponse(res, 'Database connection is unavailable', 503);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  return errorResponse(res, message, statusCode);
};

module.exports = errorMiddleware;
