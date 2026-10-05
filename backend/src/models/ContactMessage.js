const mongoose = require('mongoose');

const { Schema } = mongoose;

const CONTACT_MESSAGE_STATUSES = ['new', 'read', 'archived'];

const ContactMessageSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 16,
      match: [/^\+?\d{7,15}$/, 'Invalid phone number'],
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: CONTACT_MESSAGE_STATUSES,
      default: 'new',
    },
    ipAddress: {
      type: String,
      trim: true,
      select: false,
    },
  },
  { timestamps: true }
);

ContactMessageSchema.index({ status: 1, createdAt: -1 });

const ContactMessage = mongoose.model('ContactMessage', ContactMessageSchema);

module.exports = ContactMessage;
module.exports.CONTACT_MESSAGE_STATUSES = CONTACT_MESSAGE_STATUSES;
