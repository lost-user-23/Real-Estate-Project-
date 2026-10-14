const mongoose = require('mongoose');

const { Schema } = mongoose;

// Decoration presets the home page hero knows how to draw.
const HERO_DECORATIONS = ['diwali', 'holi', 'christmas', 'new-year', 'tricolor', 'eid'];

const slideSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: null },
    alt: { type: String, default: '', trim: true },
  },
  { _id: false }
);

// A dated festival / event window. While `now` is inside it (and it is enabled)
// its decoration, greeting and optional text overrides replace the normal hero.
const eventSchema = new Schema({
  name: { type: String, required: true, trim: true },
  decoration: { type: String, enum: HERO_DECORATIONS, required: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  enabled: { type: Boolean, default: true },
  greeting: { type: String, default: '', trim: true },
  badge: { type: String, default: '', trim: true },
  titleLead: { type: String, default: '', trim: true },
  titleAccent: { type: String, default: '', trim: true },
  subtitle: { type: String, default: '', trim: true },
});

// Single document (key: 'hero'): the home page hero's editable content.
const heroBannerSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'hero' },
    slides: { type: [slideSchema], default: [] },
    badge: { type: String, default: '', trim: true },
    titleLead: { type: String, default: '', trim: true },
    titleAccent: { type: String, default: '', trim: true },
    subtitle: { type: String, default: '', trim: true },
    // When set, this decoration is always shown (a manual switch) and scheduled events are ignored.
    manualDecoration: { type: String, enum: [...HERO_DECORATIONS, null], default: null },
    events: { type: [eventSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HeroBanner', heroBannerSchema);
module.exports.HERO_DECORATIONS = HERO_DECORATIONS;
