const express = require('express');
const rateLimit = require('express-rate-limit')
const { getPopularLocations, getLocationSuggestions } = require('../controllers/location.controller');
const { getFacilitiesByLocation } = require('../controllers/facility.controller');

const locationSuggestionsLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: { message: 'Too many attempts, please try again later' },
});

const router = express.Router();

router.get('/popular', getPopularLocations);
router.get('/suggestions', locationSuggestionsLimiter, getLocationSuggestions);
router.get('/:locationId/facilities', getFacilitiesByLocation);

module.exports = router;