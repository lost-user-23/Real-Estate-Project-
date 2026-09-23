const mongoose = require('mongoose');

const { Schema } = mongoose;

const categorySchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  listingCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  icon: {
    type: String,
    default: '',
  },
});

module.exports = mongoose.model('Category', categorySchema);
