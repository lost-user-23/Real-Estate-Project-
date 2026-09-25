const express = require('express');

// Versioned API root. Feature routers (properties, locations, categories,
// projects, articles, auth, admin, ...) mount here as they are implemented.
const v1Router = express.Router();

v1Router.use('/properties', require('./property.routes'));
v1Router.use('/categories', require('./category.routes'));
v1Router.use('/locations', require('./location.routes'));
v1Router.use('/admin', require('./admin.router'));
module.exports = { v1Router };
