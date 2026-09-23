const crypto = require('crypto');

const { loadMockData } = require('./seedData/loadMockData');
const {
  SeedValidationError,
  transformProperty,
  transformLocation,
  transformCategory,
  transformProject,
  transformArticle,
} = require('./seedData/transform');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const { User, Property, PropertyImage, Location, Category, Project, Article } = require('../src/models');

// Identifies the single dev admin account this script manages. Never a real
// person's address; used only so reruns upsert the same document.
const DEV_ADMIN_EMAIL = 'dev-admin@homenest.local';

const COLLECTIONS = ['users', 'properties', 'propertyImages', 'locations', 'categories', 'projects', 'articles'];

function makeSummary() {
  const summary = {};
  for (const name of COLLECTIONS) {
    summary[name] = { inserted: 0, updated: 0 };
  }
  return summary;
}

function tally(summary, collection, outcome) {
  summary[collection][outcome] += 1;
}

// Upsert-by-natural-key: every call site passes a filter built from a field
// that is already unique (or unique within this dataset), so reruns update
// the same document instead of creating duplicates. No documents are ever
// deleted here.
async function upsert(Model, filter, doc) {
  const existing = await Model.exists(filter);
  await Model.findOneAndUpdate(filter, { $set: doc }, {
    upsert: true,
    returnDocument: 'after',
    setDefaultsOnInsert: true,
  });
  return existing ? 'updated' : 'inserted';
}

function transformAll(mockData) {
  return {
    properties: mockData.MOCK_PROPERTIES.map(transformProperty),
    locations: mockData.MOCK_LOCATIONS.map(transformLocation),
    categories: mockData.MOCK_CATEGORIES.map(transformCategory),
    projects: mockData.MOCK_PROJECTS.map(transformProject),
    articles: mockData.MOCK_ARTICLES.map(transformArticle),
  };
}

async function seedDevAdmin(summary) {
  // The User schema has no password-hashing pipeline yet (no auth
  // implemented), so there is no real hash to store. Storing a plaintext
  // password would violate the "no plaintext" requirement, so instead this
  // stores a random value that cannot ever validate against any real
  // password check once one exists. It must be replaced through a real
  // credential-setting flow before this account can log in.
  const unusablePasswordHash = `unusable-seed-placeholder:${crypto.randomBytes(24).toString('hex')}`;

  const outcome = await upsert(
    User,
    { email: DEV_ADMIN_EMAIL },
    {
      email: DEV_ADMIN_EMAIL,
      name: 'HomeNest Dev Admin (seed)',
      role: 'admin',
      passwordHash: unusablePasswordHash,
    }
  );
  tally(summary, 'users', outcome);
}

async function seedCategories(summary, categories) {
  for (const { doc } of categories) {
    const outcome = await upsert(Category, { slug: doc.slug }, doc);
    tally(summary, 'categories', outcome);
  }
}

async function seedLocations(summary, locations) {
  for (const { doc } of locations) {
    const outcome = await upsert(Location, { city: doc.city, locality: doc.locality }, doc);
    tally(summary, 'locations', outcome);
  }
}

async function seedProjects(summary, projects) {
  for (const { doc } of projects) {
    // Project has no unique field in the schema; `name` is unique across the
    // 5 mock projects, so it is used as the natural upsert key here.
    const outcome = await upsert(Project, { name: doc.name }, doc);
    tally(summary, 'projects', outcome);
  }
}

async function seedArticles(summary, articles) {
  for (const { doc } of articles) {
    const outcome = await upsert(Article, { slug: doc.slug }, doc);
    tally(summary, 'articles', outcome);
  }
}

async function seedPropertiesAndImages(summary, properties) {
  for (const { doc, image } of properties) {
    const propertyOutcome = await upsert(Property, { slug: doc.slug }, doc);
    tally(summary, 'properties', propertyOutcome);

    if (!image) continue;

    const property = await Property.findOne({ slug: doc.slug }).select('_id').lean();
    const imageDoc = { propertyId: property._id, url: image.url, alt: image.alt, displayOrder: image.displayOrder };
    const imageOutcome = await upsert(
      PropertyImage,
      { propertyId: property._id, displayOrder: image.displayOrder },
      imageDoc
    );
    tally(summary, 'propertyImages', imageOutcome);
  }
}

function printSummary(summary) {
  console.log('\n[seed] summary:');
  for (const collection of COLLECTIONS) {
    const { inserted, updated } = summary[collection];
    console.log(`  ${collection.padEnd(15)} inserted: ${inserted}  updated: ${updated}  total: ${inserted + updated}`);
  }
}

async function main() {
  console.log('[seed] loading mock data from frontend/src/lib/mockData.js');
  const mockData = loadMockData();

  let transformed;
  try {
    transformed = transformAll(mockData);
  } catch (error) {
    if (error instanceof SeedValidationError) {
      console.error(`[seed] invalid mock data, aborting before any database writes:\n  ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  try {
    await connectToDatabase();
  } catch (error) {
    console.error(`[seed] could not connect to MongoDB: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const summary = makeSummary();

  try {
    await seedDevAdmin(summary);
    await seedCategories(summary, transformed.categories);
    await seedLocations(summary, transformed.locations);
    await seedProjects(summary, transformed.projects);
    await seedArticles(summary, transformed.articles);
    await seedPropertiesAndImages(summary, transformed.properties);
  } catch (error) {
    console.error('[seed] failed while writing to MongoDB:', error);
    process.exitCode = 1;
    return;
  } finally {
    await disconnectFromDatabase();
  }

  printSummary(summary);
  console.log('\n[seed] done.');
}

main().catch((error) => {
  console.error('[seed] unexpected error:', error);
  process.exitCode = 1;
});
