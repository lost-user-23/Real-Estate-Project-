process.env.MONGODB_DB_NAME = 'homenest_test_location_live_counts';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const Location = require('../src/models/Location');
const Property = require('../src/models/Property');

const app = createApp();

function makeProperty(overrides = {}) {
  return {
    slug: `property-${new mongoose.Types.ObjectId()}`,
    title: 'Test Property',
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 1000,
    priceInRupees: 1000000,
    city: 'Ahmedabad',
    locality: 'Bopal',
    status: 'published',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([Location.deleteMany({}), Property.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('live activeListingCount on location endpoints', () => {
  async function seedBopal() {
    // The stored count is deliberately wrong so only a live count can pass.
    await Location.create([
      { city: 'Ahmedabad', locality: 'Bopal', activeListingCount: 99, popular: true, popularRank: 1 },
      { city: 'Ahmedabad', locality: null, activeListingCount: 99 },
    ]);
    await Property.create([
      makeProperty(),
      makeProperty(),
      makeProperty({ status: 'draft', publishedAt: null }),
      makeProperty({ status: 'archived' }),
      makeProperty({ locality: 'Satellite' }),
      makeProperty({ city: 'Surat', locality: 'Adajan' }),
    ]);
  }

  it('locality suggestion counts only published listings and matches the results total', async () => {
    await seedBopal();

    const suggestions = await request(app).get('/api/v1/locations/suggestions').query({ q: 'bopal' });
    expect(suggestions.status).toBe(200);
    const row = suggestions.body.locations.find((l) => l.locality === 'Bopal');
    expect(row.activeListingCount).toBe(2);

    const results = await request(app).get('/api/v1/properties').query({ city: 'Ahmedabad', locality: 'Bopal' });
    expect(results.body.meta.total).toBe(row.activeListingCount);
  });

  it('city suggestion matches the city-filtered results total', async () => {
    await seedBopal();

    const suggestions = await request(app).get('/api/v1/locations/suggestions').query({ q: 'ahmed' });
    const row = suggestions.body.locations.find((l) => l.locality === null);
    expect(row.activeListingCount).toBe(3);

    const results = await request(app).get('/api/v1/properties').query({ city: 'Ahmedabad' });
    expect(results.body.meta.total).toBe(row.activeListingCount);
  });

  it('returns 0 for a location with no published listings and keeps the response shape', async () => {
    await Location.create({ city: 'Nowhere', locality: null, activeListingCount: 7 });

    const res = await request(app).get('/api/v1/locations/suggestions').query({ q: 'nowhere' });
    expect(res.body.locations[0].activeListingCount).toBe(0);
    expect(Object.keys(res.body.locations[0]).sort()).toEqual(
      ['activeListingCount', 'city', 'id', 'imageAlt', 'imageUrl', 'locality', 'popular', 'popularRank']
    );
  });

  it('popular locations use the same live count', async () => {
    await seedBopal();

    const res = await request(app).get('/api/v1/locations/popular');
    expect(res.status).toBe(200);
    expect(res.body.locations[0].activeListingCount).toBe(2);
  });
});
