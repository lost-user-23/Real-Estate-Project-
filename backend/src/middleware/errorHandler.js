const config = require('../config');

// Normalizes known Mongoose/MongoDB error shapes into an { status, message,
// details? } triple the response builder below already understands, so
// route handlers can just throw/reject and never touch res.json themselves.
function normalize(err) {
  if (err.name === 'ValidationError' && err.errors) {
    return {
      status: 400,
      message: 'Validation failed',
      details: Object.values(err.errors).map((e) => e.message),
    };
  }

  if (err.name === 'CastError') {
    return { status: 400, message: `Invalid ${err.path}: ${err.value}` };
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return {
      status: 409,
      message: field ? `${field} already in use` : 'Duplicate value',
    };
  }

  return {
    status: err.status || err.statusCode || 500,
    message: err.message,
    details: err.details,
  };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { status, message, details } = normalize(err);

  if (config.env !== 'test') {
    console.error(err);
  }

  res.status(status).json({
    error: {
      message: status === 500 ? 'Internal server error' : message,
      ...(details ? { details } : {}),
      ...(config.env === 'development' && status === 500 ? { stack: err.stack } : {}),
    },
  });
}

module.exports = errorHandler;
