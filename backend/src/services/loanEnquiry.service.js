const mongoose = require('mongoose');
const LoanEnquiry = require('../models/LoanEnquiry');
const Property = require('../models/Property');
const AppError = require('../utils/AppError');

// An identical resubmission (double click, retry) inside this window returns
// the existing reference instead of writing a second document.
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

const PROPERTY_POPULATE = { path: 'propertyId', select: 'title slug' };

async function createLoanEnquiry(data, ipAddress) {
  if (data.propertyId) {
    const exists = await Property.exists({ _id: data.propertyId, status: 'published' });
    if (!exists) throw AppError.badRequest('Property not found');
  }

  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);
  const duplicate = await LoanEnquiry.findOne({
    phone: data.phone,
    loanType: data.loanType,
    amountInRupees: data.amountInRupees,
    createdAt: { $gte: since },
  }).select('_id');
  if (duplicate) return { enquiry: duplicate, created: false };

  const enquiry = await LoanEnquiry.create({
    ...data,
    consent: { ...data.consent, acceptedAt: new Date() },
    ipAddress,
  });
  return { enquiry, created: true };
}

async function listLoanEnquiries({ status, loanType, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
  if (loanType) filter.loanType = loanType;
  const skip = (page - 1) * limit;
  const [enquiries, total] = await Promise.all([
    LoanEnquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(PROPERTY_POPULATE),
    LoanEnquiry.countDocuments(filter),
  ]);
  return { enquiries, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function updateLoanEnquiryStatus(id, status) {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid loan enquiry id');
  const enquiry = await LoanEnquiry.findByIdAndUpdate(
    id,
    { status },
    { returnDocument: 'after', runValidators: true }
  ).populate(PROPERTY_POPULATE);
  if (!enquiry) throw AppError.notFound('Loan enquiry not found');
  return enquiry;
}

module.exports = { createLoanEnquiry, listLoanEnquiries, updateLoanEnquiryStatus };
