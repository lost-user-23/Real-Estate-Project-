// Read-only audit: lists rows whose image URL would be rejected by the
// Cloudinary-only rule (see isValidImageUrl in cloudinaryAssets.service).
// Covers Article.imageUrl, Location.imageUrl, Project.imageUrl and
// PropertyImage.url. It only reads; nothing is ever written.
//
// Seed rows may legitimately use hosts that the frontend allows (picsum,
// unsplash) but this backend validator rejects, so read the failing rows
// before treating any of them as broken data to fix.
//
// Usage: npm run audit:image-urls

const TARGETS = [
  { name: 'Article', field: 'imageUrl' },
  { name: 'Location', field: 'imageUrl' },
  { name: 'Project', field: 'imageUrl' },
  // Photos are separate documents; propertyId says which listing owns each one.
  { name: 'PropertyImage', field: 'url', extra: 'propertyId' },
];

async function auditModel(Model, { field, extra }) {
  const failing = [];
  let checked = 0;
  const { isValidImageUrl } = require('../src/services/cloudinaryAssets.service');

  const projection = extra ? `${field} ${extra}` : field;
  for await (const doc of Model.find({ [field]: { $ne: null } }).select(projection).lean().cursor()) {
    checked += 1;
    if (!isValidImageUrl(doc[field])) failing.push(doc);
  }

  return { checked, failing };
}

async function main() {
  const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
  const models = require('../src/models');

  try {
    await connectToDatabase();
  } catch (error) {
    console.error(`[audit-image-urls] could not connect to MongoDB: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    for (const target of TARGETS) {
      const { checked, failing } = await auditModel(models[target.name], target);
      console.log(`[audit-image-urls] ${target.name}: checked ${checked}, failing ${failing.length}`);
      for (const doc of failing) {
        const owner = target.extra ? ` ${target.extra}=${String(doc[target.extra])}` : '';
        console.log(`  ${String(doc._id)}${owner} ${JSON.stringify(doc[target.field])}`);
      }
    }
    console.log('[audit-image-urls] done.');
  } catch (error) {
    console.error(`[audit-image-urls] failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  main();
}

module.exports = { auditModel, TARGETS };
