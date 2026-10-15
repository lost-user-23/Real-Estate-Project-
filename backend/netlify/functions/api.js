const serverless = require('serverless-http');
const createApp = require('../../src/app');
const { connectToDatabase } = require('../../src/db/connection');

// Netlify may hand the function its own path (/.netlify/functions/api/...)
// instead of the public one the redirect in netlify.toml matched. Strip it so
// Express sees /api/v1/... and /health either way.
const FUNCTION_PREFIX = '/.netlify/functions/api';

const handleRequest = serverless(createApp(), {
  request(request) {
    if (request.url.startsWith(FUNCTION_PREFIX)) {
      request.url = request.url.slice(FUNCTION_PREFIX.length) || '/';
    }
  },
});

// connectToDatabase() memoises its promise, so a warm container reuses the
// connection and only a cold start pays for the handshake. Unlike server.js a
// failed connect is not swallowed here: a request that needs the database
// would otherwise just buffer until Mongoose times out.
module.exports.handler = async (event, context) => {
  // Return as soon as the response is sent instead of waiting for the open
  // MongoDB socket to drain.
  context.callbackWaitsForEmptyEventLoop = false;
  await connectToDatabase();
  return handleRequest(event, context);
};
