const express = require('express');

// Versioned API root. Feature routers (properties, locations, categories,
// projects, articles, auth, admin, ...) mount here as they are implemented;
// none exist yet in this initial backend setup.
const v1Router = express.Router();

module.exports = { v1Router };
