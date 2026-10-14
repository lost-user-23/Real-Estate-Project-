const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');
const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ALLOWED_IMAGE_FORMATS } = require('../config/uploadConfig');
const { isValidImageUrl } = require('../services/cloudinaryAssets.service');
const heroService = require('../services/hero.service');

const MAX_SLIDES = 8;
const MAX_EVENTS = 40;
const LIMITS = { badge: 80, titleLead: 80, titleAccent: 80, subtitle: 240, greeting: 120, name: 80, alt: 160 };
const TEXT_FIELDS = ['badge', 'titleLead', 'titleAccent', 'subtitle'];

function checkText(errors, label, value, max) {
  if (typeof value !== 'string') errors.push(`${label} must be a string`);
  else if (value.trim().length > max) errors.push(`${label} must be at most ${max} characters`);
}

function validateSlides(slides, errors) {
  if (!Array.isArray(slides)) return errors.push('slides must be an array');
  if (slides.length > MAX_SLIDES) errors.push(`at most ${MAX_SLIDES} slides are allowed`);
  slides.forEach((slide, i) => {
    if (!slide || !isValidImageUrl(slide.url)) errors.push(`slides[${i}].url must be a valid Cloudinary image URL`);
    if (slide?.alt !== undefined) checkText(errors, `slides[${i}].alt`, slide.alt, LIMITS.alt);
  });
}

function validateEvents(events, errors) {
  if (!Array.isArray(events)) return errors.push('events must be an array');
  if (events.length > MAX_EVENTS) errors.push(`at most ${MAX_EVENTS} events are allowed`);
  events.forEach((event, i) => {
    const at = `events[${i}]`;
    if (!event || typeof event !== 'object') return errors.push(`${at} must be an object`);
    if (typeof event.name !== 'string' || !event.name.trim()) errors.push(`${at}.name is required`);
    else checkText(errors, `${at}.name`, event.name, LIMITS.name);
    if (!heroService.HERO_DECORATIONS.includes(event.decoration)) {
      errors.push(`${at}.decoration must be one of: ${heroService.HERO_DECORATIONS.join(', ')}`);
    }
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) errors.push(`${at} needs valid startsAt and endsAt dates`);
    else if (end < start) errors.push(`${at}.endsAt must not be before startsAt`);
    if (event.enabled !== undefined && typeof event.enabled !== 'boolean') errors.push(`${at}.enabled must be a boolean`);
    for (const field of [...TEXT_FIELDS, 'greeting']) {
      if (event[field] !== undefined) checkText(errors, `${at}.${field}`, event[field], LIMITS[field]);
    }
  });
}

const getPublicHero = asyncHandler(async (req, res) => {
  res.json({ hero: await heroService.getPublicHero() });
});

const getAdminHero = asyncHandler(async (req, res) => {
  res.json({ hero: await heroService.getAdminHero() });
});

const updateHero = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = [];

  for (const field of TEXT_FIELDS) {
    if (body[field] !== undefined) checkText(errors, field, body[field], LIMITS[field]);
  }
  if (body.slides !== undefined) validateSlides(body.slides, errors);
  if (body.events !== undefined) validateEvents(body.events, errors);
  if (body.manualDecoration !== undefined && body.manualDecoration !== null && !heroService.HERO_DECORATIONS.includes(body.manualDecoration)) {
    errors.push(`manualDecoration must be null or one of: ${heroService.HERO_DECORATIONS.join(', ')}`);
  }
  if (errors.length) throw AppError.badRequest('Invalid hero content', errors);

  const fields = { ...body };
  if (Array.isArray(body.slides)) {
    fields.slides = body.slides.map((s) => ({ url: s.url, publicId: s.publicId || null, alt: (s.alt || '').trim() }));
  }
  res.json({ hero: await heroService.updateHero(fields) });
});

// Hero images live in their own folder, separate from per-user listing photos.
const uploadHeroImage = asyncHandler(async (req, res) => {
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.v2.uploader.upload_stream(
      {
        folder: `${config.cloudinaryFolder}/hero`,
        public_id: crypto.randomUUID(),
        resource_type: 'image',
        allowed_formats: ALLOWED_IMAGE_FORMATS,
      },
      (err, uploaded) => (err ? reject(err) : resolve(uploaded))
    );
    stream.end(req.file.buffer);
  });
  res.status(201).json({ url: result.secure_url, publicId: result.public_id });
});

module.exports = { getPublicHero, getAdminHero, updateHero, uploadHeroImage };
