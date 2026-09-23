const morgan = require('morgan');
const config = require('../config');

const format = config.env === 'production' ? 'combined' : 'dev';

module.exports = morgan(format, {
  skip: () => config.env === 'test',
});
