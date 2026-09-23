const express = require('express');
const cors = require('cors');
const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health.routes');
const { v1Router } = require('./routes');
const authRoutes = require('./routes/auth.routes');

function createApp() {
  const app = express();

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
