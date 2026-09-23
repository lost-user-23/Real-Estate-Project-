const config = require('./config');
const createApp = require('./app');
const { connectToDatabase, disconnectFromDatabase } = require('./db/connection');

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[server] listening on port ${config.port} (${config.env})`);
});

// The server starts and serves /health even if this fails, so a MongoDB
// outage during local development or deploy doesn't block the whole API.
connectToDatabase().catch(() => {});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[server] received ${signal}, shutting down gracefully`);

  server.close(async (err) => {
    if (err) {
      console.error('[server] error while closing HTTP server:', err);
      process.exitCode = 1;
    }

    try {
      await disconnectFromDatabase();
    } catch (dbErr) {
      console.error('[server] error while closing MongoDB connection:', dbErr);
    }

    process.exit(process.exitCode || 0);
  });

  // Force-exit if connections don't close in time.
  setTimeout(() => {
    console.error('[server] forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
