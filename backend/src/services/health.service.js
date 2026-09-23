const { getConnectionStatus } = require('../db/connection');

function getHealthStatus() {
  const mongoStatus = getConnectionStatus();
  return {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    mongo: {
      status: mongoStatus,
    },
  };
}

module.exports = { getHealthStatus };
