const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { validateImportItem, cleanedSourceUrl } = require('../utils/importProperty');
const importService = require('../services/import.service');
const { queueImageImportsBySourceUrl } = require('../services/importImages.service');

const MAX_BATCH_SIZE = 100;

// Checks and saves ONE item. Never throws: whatever goes wrong becomes a
// "failed" result so the other items of the request still run.
async function importItem(item, index, seen) {
  const sourceUrl = cleanedSourceUrl(item);
  try {
    const { value, errors, warnings } = validateImportItem(item);
    const problems = [...errors];
    if (sourceUrl && seen.has(sourceUrl)) {
      problems.push(`Duplicate sourceUrl in this request (same as index ${seen.get(sourceUrl)})`);
    }
    if (problems.length > 0) {
      return { index, sourceUrl, status: 'failed', errors: problems, warnings };
    }

    // Only an item that passed counts as the "first" of its URL, so an invalid
    // earlier item does not block a valid later one for the same listing.
    seen.set(sourceUrl, index);
    const outcome = await importService.upsertImportedProperty(value);
    return {
      index,
      sourceUrl: value.sourceUrl,
      status: outcome.status,
      errors: [],
      warnings,
      ...(outcome.status === 'skipped' ? { reason: outcome.reason } : {}),
    };
  } catch (err) {
    console.error(`[import] item ${index} failed unexpectedly:`, err);
    return { index, sourceUrl, status: 'failed', errors: ['Internal error while importing this item'], warnings: [] };
  }
}

// Saves each scraped item as a draft listing (or updates a draft), one after the
// other. The answer is always 200 once the request itself is valid. Photos are
// copied in the background AFTER the response has been sent.
const importProperties = asyncHandler(async (req, res) => {
  const properties = req.body?.properties;

  if (!Array.isArray(properties) || properties.length === 0) {
    throw AppError.badRequest('Validation failed', ['properties must be a non-empty array']);
  }
  if (properties.length > MAX_BATCH_SIZE) {
    throw AppError.badRequest('Validation failed', [`properties must contain at most ${MAX_BATCH_SIZE} items`]);
  }

  const seen = new Map();
  const results = [];
  for (let index = 0; index < properties.length; index += 1) {
    results.push(await importItem(properties[index], index, seen));
  }

  const count = (status) => results.filter((r) => r.status === status).length;
  res.status(200).json({
    created: count('created'),
    updated: count('updated'),
    skipped: count('skipped'),
    failed: count('failed'),
    results,
  });

  queueImageImportsBySourceUrl(
    results.filter((r) => r.status === 'created' || r.status === 'updated').map((r) => r.sourceUrl)
  );
});

module.exports = { importProperties, MAX_BATCH_SIZE };
