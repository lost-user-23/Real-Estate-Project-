const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const config = require('./config');
const AppError = require('./utils/AppError');
const { globalRateLimiter } = require('./middleware/globalRateLimiter');
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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

// CSRF cover for cookie auth: a state-changing request that names an Origin
// other than the allowed frontend is rejected. Requests without an Origin
// header (curl, server-to-server, tests) are allowed through.
function rejectForeignOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  if (config.corsOrigins.includes(stripTrailingSlash(origin))) return next();
  return next(AppError.forbidden());
}

// TODO: confirm with the host how many reverse proxies sit in front of the API
// and set TRUST_PROXY_HOPS to that exact number (usually 1). No deploy config
// is checked in, so the default stays 0. If the real count is higher, every
// client shares the proxy's IP and the rate limiters share one budget.
function createApp() {
  const app = express();
  app.set('trust proxy', trustProxyHops());

  // Defaults are enough: the API only serves JSON, and uploaded photos live on
  // Cloudinary rather than being served from this server.
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(rejectForeignOrigin);
  app.use(globalRateLimiter);
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
