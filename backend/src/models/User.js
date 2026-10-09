const mongoose = require('mongoose');

const { Schema } = mongoose;

const USER_ROLES = ['user', 'admin'];

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Set for password-based accounts. Absent for an account that registered
    // but has not verified yet: the password is chosen on the verify step, so
    // whoever registers an address first never gets to pick its password.
    passwordHash: {
      type: String,
      select: false,
    },
    // Identifier from an external auth provider (e.g. OAuth subject).
    externalAuthId: {
      type: String,
    },
    name: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    // Set whenever the password changes; tokens issued before this are rejected
    // by the protect middleware.
    passwordChangedAt: {
      type: Date,
    },
    // Accounts that predate verification are backfilled to true
    // (npm run backfill:email-verified).
    emailVerified: {
      type: Boolean,
      default: false,
    },
    // SHA-256 of the emailed token; the raw token is never stored.
    verifyTokenHash: {
      type: String,
      select: false,
    },
    verifyTokenExpiry: {
      type: Date,
      select: false,
    },
    // Which flow the outstanding token completes. Decides whether verifying
    // also sets the password ('register') or moves pendingEmail ('email-change').
    verifyTokenPurpose: {
      type: String,
      enum: ['register', 'email-change'],
      select: false,
    },
    // --- Password-reset OTP fields ---
    // Keyed HMAC of the emailed OTP; the raw code is never stored.
    resetOtpHash: {
      type: String,
      select: false,
    },
    resetOtpExpiry: {
      type: Date,
      select: false,
    },
    // How many wrong codes have been tried against the current OTP.
    resetOtpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    // When the last reset mail went out; drives per-account cooldown.
    resetOtpSentAt: {
      type: Date,
      select: false,
    },
    // HMAC of the reset token's random jti; atomically consumed with a password
    // reset so a verified OTP cannot produce a reusable password reset.
    resetTokenHash: {
      type: String,
      select: false,
    },
    resetTokenExpiry: {
      type: Date,
      select: false,
    },
    // When the last verification mail went out; drives the per-account cooldown.
    verifyTokenSentAt: {
      type: Date,
      select: false,
    },
    // When the last "someone tried to register your address" notice went out;
    // a separate cooldown so it never delays a verification mail.
    accountNoticeSentAt: {
      type: Date,
      select: false,
    },
    // Address awaiting confirmation. It never replaces `email` until the link
    // sent to it is used, and is re-checked for uniqueness at that moment.
    pendingEmail: {
      type: String,
      lowercase: true,
      trim: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'user',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
module.exports.USER_ROLES = USER_ROLES;
