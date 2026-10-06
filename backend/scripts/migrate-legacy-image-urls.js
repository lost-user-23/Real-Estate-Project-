// Re-hosts legacy image URLs (e.g. the seed's picsum.photos placeholders) on our
// own Cloudinary account, for rows the Cloudinary-only validation would now
// reject on edit. Covers Project.imageUrl and PropertyImage.url.
//
// Dry-run by default: nothing is uploaded or written without --apply.
//   node scripts/migrate-legacy-image-urls.js            # report only
//   node scripts/migrate-legacy-image-urls.js --apply    # upload and save
//
// Idempotent: rows whose URL already passes isOwnCloudinaryImageUrl are skipped,
// and every row gets its own deterministic public_id (legacy-<recordId>) with
// overwrite: true, so a re-run after a partial failure re-uses the same asset.
// A row that cannot be migrated is left untouched and listed at the end.
// Never prints credentials; logs only "old URL -> new URL" and error messages.
const config = require('../src/config');

const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];

// property-images/ is the cleanup boundary (see cloudinaryAssets.service), so
// legacy property assets stay deletable with their listing. Projects have no
// Cloudinary cleanup at all.
function targets() {
  return [
    { label: 'PropertyImage', modelName: 'PropertyImage', field: 'url', folder: `${config.cloudinaryFolder}/legacy`, storesPublicId: true },
    { label: 'Project', modelName: 'Project', field: 'imageUrl', folder: 'project-images/legacy', storesPublicId: false },
  ];
}

async function migrateTarget(target, { apply, models, cloudinary, isOwn }) {
  const Model = models[target.modelName];
  const stats = { scanned: 0, alreadyOwn: 0, migrated: 0, failed: [] };

  const rows = await Model.find({ [target.field]: { $type: 'string', $ne: '' } })
    .select(`_id ${target.field}`)
    .lean();

  for (const row of rows) {
    stats.scanned += 1;
    const oldUrl = row[target.field];
    if (isOwn(oldUrl)) {
      stats.alreadyOwn += 1;
      continue;
    }

    const publicId = `legacy-${row._id}`;
    if (!apply) {
      console.log(`[dry-run] ${target.label} ${row._id}: ${oldUrl} -> ${target.folder}/${publicId} (not uploaded)`);
      continue;
    }

    try {
      const result = await cloudinary.v2.uploader.upload(oldUrl, {
        folder: target.folder,
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        allowed_formats: ALLOWED_FORMATS,
      });
      if (!isOwn(result.secure_url)) throw new Error('uploaded URL failed own-cloud validation');

      const set = { [target.field]: result.secure_url };
      if (target.storesPublicId) set.publicId = result.public_id;
      // timestamps: false keeps updatedAt untouched; this is a re-host, not an edit.
      await Model.updateOne({ _id: row._id }, { $set: set }, { timestamps: false });

      stats.migrated += 1;
      console.log(`[migrated] ${target.label} ${row._id}: ${oldUrl} -> ${result.secure_url}`);
    } catch (error) {
      stats.failed.push({ id: String(row._id), url: oldUrl, reason: error?.message || String(error) });
      console.error(`[failed] ${target.label} ${row._id}: ${oldUrl} (${error?.message || error}); left untouched`);
    }
  }

  return stats;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
  const models = require('../src/models');
  const { isOwnCloudinaryImageUrl } = require('../src/services/cloudinaryAssets.service');

  console.log(`[migrate-legacy-image-urls] mode: ${apply ? 'APPLY' : 'dry-run (pass --apply to write)'}`);

  if (apply && !(config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret)) {
    console.error('[migrate-legacy-image-urls] Cloudinary credentials are not configured; aborting.');
    process.exitCode = 1;
    return;
  }

  try {
    await connectToDatabase();
  } catch (error) {
    console.error(`[migrate-legacy-image-urls] could not connect to MongoDB: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    const cloudinary = apply ? require('../src/config/cloudinary') : null;
    const unmigrated = [];
    for (const target of targets()) {
      const stats = await migrateTarget(target, { apply, models, cloudinary, isOwn: isOwnCloudinaryImageUrl });
      const pending = stats.scanned - stats.alreadyOwn - stats.migrated - stats.failed.length;
      console.log(
        `[migrate-legacy-image-urls] ${target.label}: scanned ${stats.scanned}, already own ${stats.alreadyOwn}, ` +
          `${apply ? `migrated ${stats.migrated}, failed ${stats.failed.length}` : `would migrate ${pending}`}`
      );
      unmigrated.push(...stats.failed.map((f) => ({ label: target.label, ...f })));
    }
    if (unmigrated.length > 0) {
      console.log('[migrate-legacy-image-urls] could not be migrated (left untouched):');
      for (const f of unmigrated) console.log(`  ${f.label} ${f.id} ${f.url} - ${f.reason}`);
      process.exitCode = 1;
    }
    console.log('[migrate-legacy-image-urls] done.');
  } catch (error) {
    console.error(`[migrate-legacy-image-urls] failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateTarget, targets };
