const mongoose = require('mongoose');
const { Schema } = mongoose;
const FACILITY_TYPES = ['school', 'hospital', 'mall', 'transit', 'park', 'restaurant'];
const facilitySchema = new Schema({
  locationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: FACILITY_TYPES,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  distanceKm: {
    type: Number,
    required: true,
    min: 0,
  },
});

facilitySchema.index({ locationId: 1, type: 1 });

const Facility = mongoose.model('Facility', facilitySchema);
Facility.TYPES = FACILITY_TYPES;
module.exports = Facility;