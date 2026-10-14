process.env.MONGODB_DB_NAME = 'homenest_test_import_upsert';

const mongoose = require('mongoose');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const { Property, PropertyImage } = require('../src/models');
const { validateImportItem } = require('../src/utils/importProperty');
const { upsertImportedProperty } = require('../src/services/import.service');
const { removeSeededProperties } = require('../scripts/seed');

function item(overrides = {}) {
  return {
    source: '99acres',
    sourceUrl: 'https://www.99acres.com/example-1',
    title: '2 BHK Apartment for Rent in Koregaon Park',
    intent: 'rent',
    propertyType: 'apartment',
    areaSqft: 1100,
    priceInRupees: 42000,
    city: 'Pune',
    locality: 'Koregaon Park',
    description: 'Spacious, well-lit flat close to the metro.',
    bhk: 2,
    contactNumber: '9876543210',
    imageUrls: [1, 2, 3, 4, 5].map((n) => `https://cdn.example.com/photo-${n}.jpg`),
    ...overrides,
  };
}

// The same cleaned shape the real pipeline hands to the service.
function value(overrides) {
  const result = validateImportItem(item(overrides));
  expect(result.errors).toEqual([]);
  return result.value;
}

function plainListing(overrides = {}) {
  return {
    slug: `plain-${new mongoose.Types.ObjectId()}`,
    title: 'Plain website listing',
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 900,
    priceInRupees: 5000000,
    city: 'Pune',
    ...overrides,
  };
}

beforeAll(async () => {
  await connectToDatabase();
  await Property.init(); // waits until the indexes (incl. the sourceUrl one) exist
});

afterEach(async () => {
  await Promise.all([Property.deleteMany({}), PropertyImage.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('sourceUrl unique index', () => {
  it('is a partial unique index that only covers string sourceUrls', async () => {
    const indexes = await Property.collection.indexes();
    const index = indexes.find((i) => i.key.sourceUrl === 1);
    expect(index).toBeDefined();
    expect(index.unique).toBe(true);
    expect(index.partialFilterExpression).toEqual({ sourceUrl: { $type: 'string' } });
  });

  it('allows many documents without sourceUrl (existing listings)', async () => {
    await Property.create(Array.from({ length: 5 }, () => plainListing()));
    // Raw inserts too: one with the field missing and one with an explicit null.
    await Property.collection.insertMany([
      { ...plainListing(), createdAt: new Date() },
      { ...plainListing(), sourceUrl: null, createdAt: new Date() },
      { ...plainListing(), sourceUrl: null, createdAt: new Date() },
    ]);
    expect(await Property.countDocuments()).toBe(8);
  });

  it('rejects two documents with the same sourceUrl', async () => {
    await Property.create(plainListing({ sourceUrl: 'https://example.com/a', source: 'x' }));
    await expect(
      Property.create(plainListing({ sourceUrl: 'https://example.com/a', source: 'x' }))
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('does not add a sourceUrl or source field to website listings', async () => {
    const created = await Property.create(plainListing());
    const raw = await Property.collection.findOne({ _id: created._id });
    expect(raw).not.toHaveProperty('sourceUrl');
    expect(raw).not.toHaveProperty('source');
  });
});

describe('upsertImportedProperty: first import', () => {
  it('creates a draft with no owner, not verified, not featured', async () => {
    const result = await upsertImportedProperty(value());
    expect(result).toEqual({ status: 'created' });

    const saved = await Property.findOne({ sourceUrl: 'https://www.99acres.com/example-1' }).select('+contactNumber').lean();
    expect(saved).toMatchObject({
      status: 'draft',
      ownerId: null,
      verified: false,
      featured: false,
      featuredRank: null,
      publishedAt: null,
      source: '99acres',
      title: '2 BHK Apartment for Rent in Koregaon Park',
      cityLower: 'pune',
      priceInRupees: 42000,
      areaSqft: 1100,
    });
    expect(saved.slug).toMatch(/^2-bhk-apartment-for-rent-in-koregaon-park/);
  });

  it('saves two listings with the same title under different slugs', async () => {
    await upsertImportedProperty(value({ sourceUrl: 'https://example.com/one' }));
    await upsertImportedProperty(value({ sourceUrl: 'https://example.com/two' }));
    const slugs = (await Property.find().lean()).map((p) => p.slug);
    expect(slugs).toHaveLength(2);
    expect(new Set(slugs).size).toBe(2);
  });

  it('survives two simultaneous first imports of the same listing', async () => {
    const results = await Promise.all([
      upsertImportedProperty(value({ sourceUrl: 'https://example.com/race' })),
      upsertImportedProperty(value({ sourceUrl: 'https://example.com/race' })),
    ]);
    expect(await Property.countDocuments({ sourceUrl: 'https://example.com/race' })).toBe(1);
    expect(results.map((r) => r.status).sort()).toEqual(expect.arrayContaining(['created']));
    for (const r of results) expect(['created', 'updated']).toContain(r.status);
  });
});

describe('upsertImportedProperty: re-import', () => {
  it('updates a draft in place instead of creating a copy', async () => {
    await upsertImportedProperty(value());
    const before = await Property.findOne({ sourceUrl: 'https://www.99acres.com/example-1' }).lean();

    const result = await upsertImportedProperty(
      value({ title: 'Renamed 2 BHK flat in Koregaon Park', priceInRupees: 45000, bhk: 3 })
    );
    expect(result).toEqual({ status: 'updated' });
    expect(await Property.countDocuments()).toBe(1);

    const after = await Property.findOne({ sourceUrl: 'https://www.99acres.com/example-1' }).lean();
    expect(after).toMatchObject({ title: 'Renamed 2 BHK flat in Koregaon Park', priceInRupees: 45000, bhk: 3 });
    expect(after.slug).toBe(before.slug); // the web address never changes
    expect(String(after._id)).toBe(String(before._id));
  });

  it('resets optional fields the scraper no longer sends', async () => {
    await upsertImportedProperty(value({ locality: 'Baner', bhk: 2, furnished: 'furnished' }));
    await upsertImportedProperty(value({ locality: undefined, bhk: undefined, furnished: undefined }));
    const saved = await Property.findOne().lean();
    expect(saved).toMatchObject({ locality: null, bhk: null, furnished: null });
  });

  it('never touches status, verified, featured or ownership on a draft', async () => {
    await upsertImportedProperty(value());
    // A draft can still carry admin-set flags; import must not reset them.
    await Property.updateOne({}, { $set: { verified: true, featured: true, featuredRank: 3 } });

    await upsertImportedProperty(value({ priceInRupees: 99999 }));
    const saved = await Property.findOne().lean();
    expect(saved).toMatchObject({
      status: 'draft', verified: true, featured: true, featuredRank: 3, ownerId: null, priceInRupees: 99999,
    });
  });

  it.each(['published', 'archived'])('skips a %s listing and changes nothing', async (status) => {
    await upsertImportedProperty(value());
    await Property.updateOne({}, { $set: { status, verified: true } });
    const before = await Property.findOne().lean();

    const result = await upsertImportedProperty(value({ title: 'Different title entirely', priceInRupees: 1 }));
    expect(result.status).toBe('skipped');
    expect(result.reason).toContain(status);

    const after = await Property.findOne().lean();
    expect(after).toEqual(before);
    expect(await Property.countDocuments()).toBe(1);
  });

  it('matches on the cleaned sourceUrl, so tracking params do not create a copy', async () => {
    await upsertImportedProperty(value({ sourceUrl: 'https://Example.com/p/9/?utm_source=a#x' }));
    const result = await upsertImportedProperty(value({ sourceUrl: 'https://example.com/p/9' }));
    expect(result.status).toBe('updated');
    expect(await Property.countDocuments()).toBe(1);
  });
});

describe('seed --replace-seeded scoping', () => {
  it('deletes seeded listings and their images but keeps imported and user-owned ones', async () => {
    const seeded = await Property.create(plainListing({ ownerId: null }));
    await upsertImportedProperty(value());
    const imported = await Property.findOne({ source: '99acres' });
    const owner = new mongoose.Types.ObjectId();
    const userOwned = await Property.create(plainListing({ ownerId: owner }));

    await PropertyImage.create([
      { propertyId: seeded._id, url: 'https://picsum.photos/seed/a/800/600' },
      { propertyId: imported._id, url: 'https://example.com/img.jpg' },
      { propertyId: userOwned._id, url: 'https://example.com/img2.jpg' },
    ]);

    const removed = await removeSeededProperties();
    expect(removed.deletedCount).toBe(1);

    expect(await Property.exists({ _id: seeded._id })).toBeNull();
    expect(await Property.exists({ _id: imported._id })).not.toBeNull();
    expect(await Property.exists({ _id: userOwned._id })).not.toBeNull();

    expect(await PropertyImage.countDocuments({ propertyId: seeded._id })).toBe(0);
    expect(await PropertyImage.countDocuments({ propertyId: imported._id })).toBe(1);
    expect(await PropertyImage.countDocuments({ propertyId: userOwned._id })).toBe(1);
  });
});
