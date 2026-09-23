const config = require('../config');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  if (config.env !== 'test') {
    console.error(err);
  }

  res.status(status).json({
    error: {
      message: status === 500 ? 'Internal server error' : err.message,
      ...(config.env === 'development' && status === 500 ? { stack: err.stack } : {}),
    },
  });
}

module.exports = errorHandler;
