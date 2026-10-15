const mongoose = require('mongoose');

const { Schema } = mongoose;

const LOAN_ENQUIRY_STATUSES = ['new', 'contacted', 'closed'];
const LOAN_TYPES = ['home', 'personal'];
// Documented bounds for the requested amount (rupees).
const MIN_LOAN_AMOUNT = 10_000;
const MAX_LOAN_AMOUNT = 500_000_000; // 50 crore

const LoanEnquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 16,
      match: [/^\+?\d{7,15}$/, 'Invalid phone number'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    loanType: { type: String, required: true, enum: LOAN_TYPES },
    amountInRupees: {
      type: Number,
      required: true,
      min: MIN_LOAN_AMOUNT,
      max: MAX_LOAN_AMOUNT,
      validate: { validator: Number.isFinite, message: 'Amount must be a finite number' },
    },
    city: { type: String, trim: true, maxlength: 80 },
    preferredLenderId: { type: String, trim: true, maxlength: 60 },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    consent: {
      accepted: {
        type: Boolean,
        required: true,
        validate: { validator: (v) => v === true, message: 'Consent is required' },
      },
      textVersion: { type: String, required: true, trim: true, maxlength: 60 },
      acceptedAt: { type: Date, required: true, default: Date.now },
    },
    status: { type: String, enum: LOAN_ENQUIRY_STATUSES, default: 'new' },
    // Rate-limit / audit only; never serialised.
    ipAddress: { type: String, trim: true, select: false },
  },
  { timestamps: true }
);

LoanEnquirySchema.index({ status: 1, createdAt: -1 });
LoanEnquirySchema.index({ loanType: 1, createdAt: -1 });

const LoanEnquiry = mongoose.model('LoanEnquiry', LoanEnquirySchema);

module.exports = LoanEnquiry;
module.exports.LOAN_ENQUIRY_STATUSES = LOAN_ENQUIRY_STATUSES;
module.exports.LOAN_TYPES = LOAN_TYPES;
module.exports.MIN_LOAN_AMOUNT = MIN_LOAN_AMOUNT;
module.exports.MAX_LOAN_AMOUNT = MAX_LOAN_AMOUNT;
