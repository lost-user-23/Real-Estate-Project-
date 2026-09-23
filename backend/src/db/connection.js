const mongoose = require('mongoose');
const config = require('../config');

mongoose.set('strictQuery', true);

let connectPromise = null;

function connectToDatabase() {
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = mongoose
    .connect(config.mongodbUri, {
      dbName: config.mongodbDbName,
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => {
      console.log(`[db] connected to MongoDB database "${config.mongodbDbName}"`);
      return mongoose.connection;
    })
    .catch((error) => {
      // Startup does not depend on MongoDB being reachable so the API and
      // /health can still respond during local development or partial outages.
      console.error('[db] failed to connect to MongoDB:', error.message);
      connectPromise = null;
      throw error;
    });

  return connectPromise;
}

const READY_STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

function getConnectionStatus() {
  const readyState = mongoose.connection.readyState;
  return READY_STATE_LABELS[readyState] || 'unknown';
}

async function disconnectFromDatabase() {
  connectPromise = null;
  await mongoose.disconnect();
}

module.exports = {
  connectToDatabase,
  disconnectFromDatabase,
  getConnectionStatus,
};
