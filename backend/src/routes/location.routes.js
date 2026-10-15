const express = require('express');
const rateLimit = require('express-rate-limit')
const AppError = require('../utils/AppError');
const { getPopularLocations, getPopularAreas, getLocationSuggestions } = require('../controllers/location.controller');
const { getFacilitiesByLocation } = require('../controllers/facility.controller');

const locationSuggestionsLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    handler: (req, res, next, options) => next(new AppError('Too many attempts, please try again later', options.statusCode)),
});

const router = express.Router();

router.get('/popular', getPopularLocations);
router.get('/areas', getPopularAreas);
router.get('/suggestions', locationSuggestionsLimiter, getLocationSuggestions);
router.get('/:locationId/facilities', getFacilitiesByLocation);

module.exports = router;