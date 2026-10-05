const mongoose = require('mongoose');
const ContactMessage = require('../models/ContactMessage');
const AppError = require('../utils/AppError');

async function createContactMessage(data, ipAddress) {
  return ContactMessage.create({ ...data, ipAddress });
}

async function listContactMessages({ status, page, limit }) {
  const filter = status ? { status } : {};
  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ContactMessage.countDocuments(filter),
  ]);

  return { messages, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function updateContactMessageStatus(id, status) {
  if (!mongoose.isValidObjectId(id)) {
    throw AppError.badRequest('Invalid contact message id');
  }

  const message = await ContactMessage.findByIdAndUpdate(
    id,
    { status },
    { returnDocument: 'after', runValidators: true }
  );
  if (!message) throw AppError.notFound('Contact message not found');
  return message;
}

module.exports = { createContactMessage, listContactMessages, updateContactMessageStatus };
