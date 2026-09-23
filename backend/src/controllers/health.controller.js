const { getHealthStatus } = require('../services/health.service');

function getHealth(req, res) {
  res.status(200).json(getHealthStatus());
}

module.exports = { getHealth };
