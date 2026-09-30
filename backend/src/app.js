const express = require('express');
const cors = require('cors');
const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health.routes');
const { v1Router } = require('./routes');
const authRoutes = require('./routes/auth.routes');

// Number of reverse proxies in front of the app (TRUST_PROXY_HOPS). Express
// then takes the client IP from X-Forwarded-For, which the rate limiters key
// on. Always a hop count, never `true`: trusting every hop would let a client
// spoof its IP with its own X-Forwarded-For header. Defaults to 0 (no proxy).
function trustProxyHops() {
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  return Number.isInteger(hops) && hops > 0 ? hops : 0;
}

function createApp() {
  const app = express();
  app.set('trust proxy', trustProxyHops());

  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(requestLogger);
  
  app.use('/health', healthRoutes);
  app.use('/api/v1', v1Router);
  app.use('/api/auth', authRoutes)
  
  app.use(notFound);
  app.use(errorHandler);


  return app;
}

module.exports = createApp;
