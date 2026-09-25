const mongoose = require('mongoose');
const Facility = require('../models/Facility');
const Location = require('../models/Location');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const {serializeFacility} = require('../utils/serializers/facility.serializer');

async function assertLocationExists(locationId) {
    if (!mongoose.Types.ObjectId.isValid(locationId)) {
        throw AppError.badRequest('locationId must be a valid ObjectId');
    }
    const location = await Location.findById(locationId);
    if (!location) {
        throw AppError.notFound('Location not found');
    }
}

const getFacilitiesByLocation = asyncHandler(async(req,res)=> {
    const {locationId} = req.params;
    await assertLocationExists(locationId);
    const facilities = await Facility.find({ locationId }).sort({ distanceKm: 1, name: 1 });
    res.json({ facilities: facilities.map(serializeFacility) });
});

const ALLOWED_FIELDS = ['locationId', 'name', 'type', 'address', 'distanceKm'];
function validateField(field, value) {
    switch(field) {
        case 'name':
        case 'address':
            if (typeof value !== 'string' || value.trim().length === 0 ){
                return `${field} must be a non-empty string`;
            }
            break;
        case 'type':
            if (!Facility.TYPES.includes(value)){
                return `type must be one of: ${Facility.TYPES.join(', ')}`;
            }
            break;
        case 'distanceKm':
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
                return 'distanceKm must be a non-negative number';
            }
            break;
            default:
            break;       
    }
    return null;
}

const createFacility = asyncHandler(async (req,res)=> {
    const validationErrors = [];
    for (const field of ALLOWED_FIELDS) {
        if (req.body[field] === undefined) {
            validationErrors.push(`${field} is required`);
            continue;
        }
        if (field === 'locationId') continue;
        const error = validateField(field, req.body[field]);
        if (error) validationErrors.push(error);
    }
    if (validationErrors.length > 0) {
        throw AppError.badRequest('Validation failed', validationErrors);
    }

    const {locationId, name, type, address, distanceKm} = req.body;
    await assertLocationExists(locationId);

    const facility = await Facility.create({locationId, name, type, address, distanceKm});
    res.status(201).json({facility: serializeFacility(facility)});
});

const updateFacility = asyncHandler(async(req,res)=> {
    const updates = {};
    const validationErrors = [];

    for (const field of ALLOWED_FIELDS) {
        if (req.body[field] === undefined) continue;
        if (field === 'locationId') continue;
        const error = validateField(field, req.body[field]);
        if (error) {
            validationErrors.push(error);
        } else {
            updates[field] = field === 'name' || field === 'address' ? req.body[field].trim() : req.body[field];
        }
    }
    if (validationErrors.length > 0) {
        throw AppError.badRequest('Validation failed', validationErrors);
    }
    if (req.body.locationId !== undefined) {
        await assertLocationExists(req.body.locationId);
        updates.locationId = req.body.locationId;
    }
    const facility = await Facility.findByIdAndUpdate(req.params.id,updates, {
        new: true,
        runValidators: true,
    });
    if (!facility) throw AppError.notFound('Facility not found');
    res.json({facility: serializeFacility(facility)});
});

const deleteFacility = asyncHandler(async (req,res)=> {
    const facility = await Facility.findByIdAndDelete(req.params.id);
    if (!facility) throw AppError.notFound('Facility not found');
    res.status(204).send();
});

module.exports = {getFacilitiesByLocation, createFacility, updateFacility,deleteFacility};