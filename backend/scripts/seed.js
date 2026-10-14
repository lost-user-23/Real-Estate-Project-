const fs = require('fs');
const path = require('path');

const { parseCsv } = require('./seedData/parseCsv');
const { buildProjects } = require('./seedData/builders');
const { transformRow, buildImages, deriveLocations, deriveCategories } = require('./seedData/transformDataset');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const { Property, PropertyImage, Location, Category, Project, Article } = require('../src/models');

const DATASET_DIR = path.resolve(__dirname, '../../DataSet');
const BATCH_SIZE = 1000;

// Mumbai has far more rows than every other city, so by default only every
// second Mumbai row is imported (slugs keep the original row number, so the
// kept rows are stable). --full-mumbai imports all of them.
const HALVED_FILE_PREFIX = 'mumbai';

// Usage: npm run seed -- [file.csv] [--replace-seeded] [--full-mumbai]
//   file.csv          CSV inside the DataSet folder (default: every .csv there)
//   --replace-seeded  first deletes previously seeded/mock data: properties with
//                     no owner and no scraper source (and their images), plus all locations,
//                     categories, projects and articles.
function parseArgs(argv) {
  return {
    replace: argv.includes('--replace-seeded'),
    fullMumbai: argv.includes('--full-mumbai'),
    files: argv.filter((a) => !a.startsWith('--')),
  };
}

function resolveFiles(files) {
  if (files.length > 0) return files.map((f) => path.resolve(DATASET_DIR, f));
  return fs
    .readdirSync(DATASET_DIR)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .map((f) => path.join(DATASET_DIR, f));
}

async function bulkUpsert(Model, ops, label) {
  let done = 0;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    await Model.bulkWrite(ops.slice(i, i + BATCH_SIZE), { ordered: false });
    done += Math.min(BATCH_SIZE, ops.length - i);
    process.stdout.write(`\r[seed] ${label}: ${done}/${ops.length}`);
  }
  if (ops.length > 0) process.stdout.write('\n');
}

// Seeded listings have no owner AND no `source`. Scraper-imported listings also
// have no owner, but they carry a `source`, so --replace-seeded must leave them alone.
const SEEDED_FILTER = { ownerId: null, source: { $exists: false } };

async function removeSeededProperties() {
  const seeded = await Property.find(SEEDED_FILTER).select('_id').lean();
  await PropertyImage.deleteMany({ propertyId: { $in: seeded.map((p) => p._id) } });
  return Property.deleteMany(SEEDED_FILTER);
}

async function main() {
  const { replace, fullMumbai, files } = parseArgs(process.argv.slice(2));
  const csvFiles = resolveFiles(files);
  if (csvFiles.length === 0) {
    console.error(`[seed] no .csv files found in ${DATASET_DIR}`);
    process.exitCode = 1;
    return;
  }

  const properties = [];
  const skipped = new Map();
  let rowNumber = 0;
  for (const file of csvFiles) {
    const fileName = path.basename(file);
    const halve = !fullMumbai && fileName.toLowerCase().startsWith(HALVED_FILE_PREFIX);
    // Slugs are keyed per file so adding a file never renumbers another's rows.
    const slugPrefix = halve ? '' : `${fileName.split('_')[0].toLowerCase()}-`;
    console.log(`[seed] reading ${fileName}${halve ? ' (every 2nd row)' : ''}`);
    let fileRow = 0;
    for (const row of parseCsv(fs.readFileSync(file, 'utf8'))) {
      rowNumber += 1;
      fileRow += 1;
      if (halve && fileRow % 2 === 0) {
        skipped.set('Mumbai halved', (skipped.get('Mumbai halved') || 0) + 1);
        continue;
      }
      const result = transformRow(row, rowNumber, `${slugPrefix}${fileRow}`);
      if (result.doc) properties.push(result.doc);
      else skipped.set(result.skipped, (skipped.get(result.skipped) || 0) + 1);
    }
  }
  console.log(`[seed] ${properties.length} listings ready, ${rowNumber - properties.length} skipped`);
  for (const [reason, count] of skipped) console.log(`  skipped ${count}: ${reason}`);

  try {
    await connectToDatabase();
  } catch (error) {
    console.error(`[seed] could not connect to MongoDB: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    if (replace) {
      const removed = await removeSeededProperties();
      await Promise.all([Location.deleteMany({}), Category.deleteMany({}), Project.deleteMany({}), Article.deleteMany({})]);
      console.log(`[seed] removed ${removed.deletedCount} seeded properties and all locations/categories/projects/articles`);
    }

    const publishedAt = new Date();
    await bulkUpsert(
      Property,
      properties.map((doc) => ({
        updateOne: { filter: { slug: doc.slug }, update: { $set: doc, $setOnInsert: { publishedAt } }, upsert: true },
      })),
      'properties'
    );
    // Re-create each listing's photos: look the ids up by slug (upserts above
    // don't return ids for existing rows), clear old photos, insert fresh ones.
    const imagesBySlug = new Map(properties.map((doc) => [doc.slug, buildImages(doc)]));
    const slugs = [...imagesBySlug.keys()];
    let imageCount = 0;
    for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
      const batch = await Property.find({ slug: { $in: slugs.slice(i, i + BATCH_SIZE) } })
        .select('_id slug')
        .lean();
      await PropertyImage.deleteMany({ propertyId: { $in: batch.map((p) => p._id) } });
      const docs = batch.flatMap((p) => imagesBySlug.get(p.slug).map((image) => ({ ...image, propertyId: p._id })));
      await PropertyImage.insertMany(docs, { ordered: false });
      imageCount += docs.length;
      process.stdout.write(`[seed] images: ${imageCount}`);
    }
    if (imageCount > 0) process.stdout.write('\n');
    await bulkUpsert(
      Location,
      deriveLocations(properties).map((doc) => ({
        updateOne: {
          filter: { cityLower: doc.cityLower, localityLower: doc.localityLower },
          update: { $set: doc },
          upsert: true,
        },
      })),
      'locations'
    );
    // Projects feed the builders directory (grouped by developer). Localities
    // come from the listings seeded for the same city, most common first.
    const localityCounts = new Map();
    for (const { city, locality } of properties) {
      if (!locality) continue;
      const counts = localityCounts.get(city) || new Map();
      counts.set(locality, (counts.get(locality) || 0) + 1);
      localityCounts.set(city, counts);
    }
    const localitiesByCity = new Map(
      [...localityCounts].map(([city, counts]) => [city, [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name]) => name)])
    );
    await bulkUpsert(
      Project,
      buildProjects(localitiesByCity, publishedAt).map(({ publishedAt: at, ...doc }) => ({
        updateOne: {
          filter: { name: doc.name, cityLower: doc.cityLower },
          update: { $set: doc, $setOnInsert: { publishedAt: at } },
          upsert: true,
        },
      })),
      'projects'
    );
    await bulkUpsert(
      Category,
      deriveCategories(properties).map((doc) => ({
        updateOne: { filter: { slug: doc.slug }, update: { $set: doc }, upsert: true },
      })),
      'categories'
    );
  } catch (error) {
    console.error('[seed] failed while writing to MongoDB:', error);
    process.exitCode = 1;
    return;
  } finally {
    await disconnectFromDatabase();
  }

  console.log('[seed] done.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[seed] unexpected error:', error);
    process.exitCode = 1;
  });
}

module.exports = { removeSeededProperties };
