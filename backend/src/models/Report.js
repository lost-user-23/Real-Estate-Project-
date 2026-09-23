const mongoose = require('mongoose');

const { Schema } = mongoose;

const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'rejected'];

const reportSchema = new Schema(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
    },
    listingUrlOrId: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'open',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
module.exports.REPORT_STATUSES = REPORT_STATUSES;
