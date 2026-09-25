const Location = require('../models/Location');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { serializeLocation } = require('../utils/serializers/location.serializer');

const getPopularLocations = asyncHandler(async (req, res) => {
    const locations = await Location.find({ popular: true }).sort({ popularRank: 1 }).limit(12);
    res.json({ locations: locations.map(serializeLocation) });
});

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const getLocationSuggestions = asyncHandler(async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
        throw AppError.badRequest('Query parameter "q" is required');
    }

    const regex = new RegExp(escapeRegExp(q.trim()), 'i');
    const locations = await Location.find({
        $or: [{ city: regex }, { locality: regex }],
    }).limit(6);

    res.json({ locations: locations.map(serializeLocation) });
});

const ALLOWED_FIELDS = ['city', 'locality', 'activeListingCount', 'popular', 'popularRank', 'imageUrl', 'imageAlt'];

function validateField(field, value) {
    switch (field) {
        case 'city':
            if (typeof value !== 'string' || value.trim().length === 0) {
                return `${field} must be a non-empty string`;
            }
            break;
        case 'locality':
            if (value !== null && (typeof value !== 'string' || value.trim().length === 0)) {
                return `${field} must be a non-empty string or null`;
            }
            break;

        case 'imageUrl':
        case 'imageAlt':
            if (value !== null && typeof value !== 'string') {
                return `${field} must be a string or null`;
            }
            break;
        case 'activeListingCount':
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
                return 'activeListingCount must be a non-negative number';
            }
            break;
        case 'popularRank':
            if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
                return 'popularRank must be a non-negative number or null';
            }
            break;
        case 'popular':
            if (typeof value !== 'boolean') {
                return 'popular must be a boolean';
            }
            break;
    default:
            break;
    }
    return null;
}
const updateLocation = asyncHandler(async (req, res) => {
    const updates = {};
    const validationErrors = [];

    for (const field of ALLOWED_FIELDS) {
        if (req.body[field] !== undefined) {
            const error = validateField(field, req.body[field]);
            if (error) {
                validationErrors.push(error);
            } else {
                updates[field] = ['city', 'locality'].includes(field) && req.body[field] !== null
                    ? req.body[field].trim()
                    : req.body[field];
            }
        }
    }

    if (validationErrors.length > 0) {
        throw AppError.badRequest('Validation failed', validationErrors);
    }
    const location = await Location.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
    });
    if (!location) throw AppError.notFound('Location not found');
    res.json({ location: serializeLocation(location) });
});

module.exports = {getPopularLocations, getLocationSuggestions, updateLocation};