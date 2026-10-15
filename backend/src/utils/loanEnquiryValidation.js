const mongoose = require('mongoose');
const AppError = require('./AppError');
const { LOAN_TYPES, MIN_LOAN_AMOUNT, MAX_LOAN_AMOUNT } = require('../models/LoanEnquiry');

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^\+?\d{7,15}$/;

// Must stay in sync with frontend/src/lib/lenders.mjs (a frontend test checks it).
// The value is the loan type the lender entry is for.
const KNOWN_LENDERS = {
  'icici-home-loan': 'home',
  'hdfc-home-loan': 'home',
  'sbi-home-loan': 'home',
  'icici-personal-loan': 'personal',
  'hdfc-personal-loan': 'personal',
  'sbi-personal-loan': 'personal',
};

// Versions of the consent wording shown on the form. Wording needs business/legal approval.
const CONSENT_TEXT_VERSIONS = ['loan-callback-2026-10-draft'];

const isMissing = (v) => v === undefined || v === null || v === '';
const asString = (v) => (typeof v === 'string' ? v.trim() : '');

function validateLoanEnquiry(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = [];

  const name = asString(b.name);
  if (typeof b.name !== 'string' || name.length < 2 || name.length > 80) {
    errors.push('Name must be 2 to 80 characters');
  }

  const phone = asString(b.phone).replace(/[\s\-()]/g, '');
  if (typeof b.phone !== 'string' || !PHONE_RE.test(phone)) {
    errors.push('Enter a valid phone number');
  }

  let email;
  if (!isMissing(b.email)) {
    email = asString(b.email).toLowerCase();
    if (typeof b.email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
      errors.push('Enter a valid email address');
    }
  }

  if (typeof b.loanType !== 'string' || !LOAN_TYPES.includes(b.loanType)) {
    errors.push(`loanType must be one of: ${LOAN_TYPES.join(', ')}`);
  }

  const amount = b.amountInRupees;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < MIN_LOAN_AMOUNT || amount > MAX_LOAN_AMOUNT) {
    errors.push(`Amount must be a number between ${MIN_LOAN_AMOUNT} and ${MAX_LOAN_AMOUNT} rupees`);
  }

  let city;
  if (!isMissing(b.city)) {
    city = asString(b.city);
    if (typeof b.city !== 'string' || city.length > 80) errors.push('City must be at most 80 characters');
  }

  let preferredLenderId;
  if (!isMissing(b.preferredLenderId)) {
    preferredLenderId = b.preferredLenderId;
    if (typeof preferredLenderId !== 'string' || !Object.hasOwn(KNOWN_LENDERS, preferredLenderId)) {
      errors.push('Unknown lender');
    } else if (KNOWN_LENDERS[preferredLenderId] !== b.loanType) {
      errors.push('Lender does not offer the selected loan type');
    }
  }

  let propertyId;
  if (!isMissing(b.propertyId)) {
    propertyId = b.propertyId;
    if (typeof propertyId !== 'string' || !/^[a-f\d]{24}$/i.test(propertyId) || !mongoose.isValidObjectId(propertyId)) {
      errors.push('Invalid property id');
    }
  }

  const consent = b.consent;
  if (!consent || typeof consent !== 'object' || consent.accepted !== true) {
    errors.push('You must agree to be contacted to submit this request');
  } else if (typeof consent.textVersion !== 'string' || !CONSENT_TEXT_VERSIONS.includes(consent.textVersion)) {
    errors.push('Unknown consent version');
  }

  if (errors.length) throw AppError.badRequest(errors.join(', '));

  const clean = {
    name,
    phone,
    loanType: b.loanType,
    amountInRupees: amount,
    consent: { accepted: true, textVersion: consent.textVersion },
  };
  if (email) clean.email = email;
  if (city) clean.city = city;
  if (preferredLenderId) clean.preferredLenderId = preferredLenderId;
  if (propertyId) clean.propertyId = propertyId;
  return clean;
}

module.exports = { validateLoanEnquiry, KNOWN_LENDERS, CONSENT_TEXT_VERSIONS };
