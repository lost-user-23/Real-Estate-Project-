const Property = require('../models/Property');
const AppError = require('../utils/AppError');
const { generateUniqueSlug, isSlugCollision } = require('./property.service');

// How many times to retry when another request grabs the same slug between our
// "is it free?" check and our insert. Same idea as createProperty.
const SLUG_RETRIES = 3;

function isSourceUrlCollision(err) {
  return err?.code === 11000 && Boolean(err.keyPattern?.sourceUrl || err.keyValue?.sourceUrl);
}

// Fields a re-import may overwrite: everything the scraper sent, except the key.
function scrapedFields(value) {
  const { sourceUrl, ...fields } = value; // eslint-disable-line no-unused-vars
  return fields;
}

// Re-import of an existing listing. The filter itself says "still a draft", so
// the check and the write are ONE atomic step: if an admin publishes the
// listing a moment before we write, the filter no longer matches and nothing is
// overwritten. Only scraped fields are in $set, so status, verified, featured,
// featuredRank, publishedAt, ownerId and slug are never touched.
async function updateDraft(value) {
  const result = await Property.updateOne(
    { sourceUrl: value.sourceUrl, status: 'draft' },
    { $set: scrapedFields(value) },
    { runValidators: true }
  );
  return result.matchedCount > 0;
}

// First import of a listing: always a draft, no owner, not verified, not featured.
async function createDraft(value) {
  for (let attempt = 0; ; attempt += 1) {
    const slug = await generateUniqueSlug(value.title);
    try {
      return await Property.create({
        ...value,
        slug,
        ownerId: null,
        status: 'draft',
        verified: false,
        featured: false,
        featuredRank: null,
      });
    } catch (err) {
      if (!isSlugCollision(err)) throw err;
      if (attempt >= SLUG_RETRIES) {
        throw AppError.conflict('Could not create a unique link for this listing. Please try again.');
      }
    }
  }
}

// Saves one VALIDATED item (the `value` from validateImportItem), matching on
// its sourceUrl. Returns:
//   { status: 'created' }
//   { status: 'updated' }
//   { status: 'skipped', reason }   (listing exists but is no longer a draft)
// Throws on real failures (database down, repeated slug collisions); the caller
// turns those into a "failed" result for this one item.
async function upsertImportedProperty(value) {
  if (await updateDraft(value)) return { status: 'updated' };

  const existing = await Property.findOne({ sourceUrl: value.sourceUrl }).select('status').lean();
  if (existing) {
    return {
      status: 'skipped',
      reason: `Listing is no longer a draft (status: ${existing.status}), so it was not updated.`,
    };
  }

  try {
    await createDraft(value);
    return { status: 'created' };
  } catch (err) {
    // Two requests created the same new listing at the same moment and the
    // unique index let only one win. Ours becomes a normal re-import.
    if (!isSourceUrlCollision(err)) throw err;
    if (await updateDraft(value)) return { status: 'updated' };
    return { status: 'skipped', reason: 'Listing was created by another request and is no longer a draft, so it was not updated.' };
  }
}

module.exports = { upsertImportedProperty };
