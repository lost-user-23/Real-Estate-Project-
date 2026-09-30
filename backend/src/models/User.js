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
    // Set for password-based accounts; omitted for external-auth identities.
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
