process.env.MONGODB_DB_NAME = 'homenest_test_city_lower';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const { normalizeCity } = require('../src/utils/normalizeCity');
const { planUpdate, backfillModel } = require('../scripts/backfill-city-lower');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const Project = require('../src/models/Project');
const Location = require('../src/models/Location');

const app = createApp();

async function registerAdmin() {
  const email = `city-${new mongoose.Types.ObjectId()}@example.com`;
  const res = await registerVerified(app, { email, password: 'password123' });
  await User.findByIdAndUpdate(res.body.user.id, { role: 'admin' });
  return { Authorization: `Bearer ${tokenFromResponse(res)}` };
}

let counter = 0;
function createProperty(overrides = {}) {
  counter += 1;
  return Property.create({
    slug: `city-prop-${counter}`,
    title: `City property ${counter}`,
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 1000,
    priceInRupees: 1000000,
    city: 'New Delhi',
    status: 'published',
    publishedAt: new Date('2026-01-01'),
    ...overrides,
  });
}

function createProject(overrides = {}) {
  counter += 1;
  return Project.create({
    name: `City project ${counter}`,
    developer: 'Acme',
    city: 'New Delhi',
    startingPriceInRupees: 1000,
    status: 'published',
    publishedAt: new Date('2026-01-01'),
    ...overrides,
  });
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Property.deleteMany({}),
    Project.deleteMany({}),
    Location.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('normalizeCity', () => {
  it('trims, collapses inner whitespace and lowercases', () => {
    expect(normalizeCity('  New   DELHI\t')).toBe('new delhi');
  });

  it('returns an empty string for non-strings', () => {
    expect(normalizeCity(undefined)).toBe('');
    expect(normalizeCity(null)).toBe('');
    expect(normalizeCity(['a'])).toBe('');
    expect(normalizeCity(5)).toBe('');
  });
});

describe('cityLower on create and save', () => {
  it('is set on create for all three models', async () => {
    const property = await createProperty({ city: '  NEW   Delhi ' });
    const project = await createProject({ city: 'PUNE' });
    const location = await Location.create({ city: ' Mumbai ', locality: 'Andheri  West' });

    expect(property.cityLower).toBe('new delhi');
    expect(project.cityLower).toBe('pune');
    expect(location.cityLower).toBe('mumbai');
    expect(location.localityLower).toBe('andheri west');
  });

  it('follows a city change made through save()', async () => {
    const property = await createProperty({ city: 'Delhi' });
    property.city = 'Goa';
    await property.save();

    const stored = await Property.findById(property._id).lean();
    expect(stored.cityLower).toBe('goa');
  });

  it('follows an admin city change through the single-item update path', async () => {
    const headers = await registerAdmin();
    const property = await createProperty({ city: 'Delhi' });

    const res = await request(app).patch(`/api/v1/properties/${property._id}`).set(headers).send({ city: 'Chennai' });

    expect(res.status).toBe(200);
    expect(res.body.property).not.toHaveProperty('cityLower');
    expect((await Property.findById(property._id).lean()).cityLower).toBe('chennai');
  });

  it('is set when an admin creates a project, and never serialized', async () => {
    const headers = await registerAdmin();

    const res = await request(app)
      .post('/api/v1/admin/projects')
      .set(headers)
      .send({ name: 'P', developer: 'D', city: ' Kochi ', startingPriceInRupees: 10 });

    expect(res.status).toBe(201);
    expect(res.body.project).not.toHaveProperty('cityLower');
    expect((await Project.findById(res.body.project._id).lean()).cityLower).toBe('kochi');
  });
});

describe('city matching on cityLower', () => {
  it('matches mixed-case and padded city input on the property list', async () => {
    await createProperty({ title: 'In Delhi', city: 'New Delhi' });
    await createProperty({ title: 'In Goa', city: 'Goa' });

    for (const input of ['new delhi', 'NEW DELHI', '  New   Delhi  ']) {
      const res = await request(app).get('/api/v1/properties').query({ city: input });
      expect(res.status).toBe(200);
      expect(res.body.properties.map((p) => p.title)).toEqual(['In Delhi']);
    }
  });

  it('treats regex characters in city literally and ignores array input safely', async () => {
    await createProperty({ city: 'New Delhi' });

    const dot = await request(app).get('/api/v1/properties').query({ city: '.*' });
    const arr = await request(app).get('/api/v1/properties?city=a&city=b');

    expect(dot.body.properties).toEqual([]);
    expect(arr.status).toBe(200);
    expect(arr.body.properties).toEqual([]);
  });

  it('matches padded input on featured and builders', async () => {
    await createProperty({ title: 'Pick', city: 'New Delhi', featured: true });
    await createProject({ city: 'New Delhi' });

    const featured = await request(app).get('/api/v1/properties/featured').query({ city: ' NEW  delhi ' });
    const builders = await request(app).get('/api/v1/projects/builders').query({ city: ' NEW  delhi ' });

    expect(featured.body.scope).toBe('city');
    expect(featured.body.properties.map((p) => p.title)).toEqual(['Pick']);
    expect(builders.body.builders).toHaveLength(1);
  });
});

describe('cityLower on query-level writes', () => {
  it('bulk update of city keeps cityLower in sync', async () => {
    const headers = await registerAdmin();
    const a = await createProperty({ city: 'Delhi' });
    const b = await createProperty({ city: 'Delhi' });

    const res = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set(headers)
      .send({ ids: [String(a._id), String(b._id)], updates: { city: '  NAVI   Mumbai ' } });

    expect(res.status).toBe(200);
    const stored = await Property.find({ _id: { $in: [a._id, b._id] } }).lean();
    expect(stored.map((p) => p.cityLower)).toEqual(['navi mumbai', 'navi mumbai']);

    const list = await request(app).get('/api/v1/properties').query({ city: 'navi mumbai' });
    expect(list.body.properties).toHaveLength(2);
  });

  it('bulk update without a city leaves cityLower alone', async () => {
    const headers = await registerAdmin();
    const a = await createProperty({ city: 'Delhi' });

    await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set(headers)
      .send({ ids: [String(a._id)], updates: { featured: true } });

    expect((await Property.findById(a._id).lean()).cityLower).toBe('delhi');
  });

  it('location update keeps cityLower and localityLower in sync', async () => {
    const headers = await registerAdmin();
    const location = await Location.create({ city: 'Mumbai', locality: 'Andheri' });

    const res = await request(app)
      .patch(`/api/v1/admin/locations/${location._id}`)
      .set(headers)
      .send({ city: '  PUNE ', locality: 'Kothrud  Depot' });

    expect(res.status).toBe(200);
    expect(res.body.location).not.toHaveProperty('cityLower');
    const stored = await Location.findById(location._id).lean();
    expect(stored.cityLower).toBe('pune');
    expect(stored.localityLower).toBe('kothrud depot');

    await request(app).patch(`/api/v1/admin/locations/${location._id}`).set(headers).send({ locality: null });
    expect((await Location.findById(location._id).lean()).localityLower).toBeNull();
  });
});

describe('GET /api/v1/locations/suggestions ordering and prefix behavior', () => {
  it('matches prefixes only, not substrings', async () => {
    await Location.create({ city: 'Bengaluru' });

    const prefix = await request(app).get('/api/v1/locations/suggestions').query({ q: 'ben' });
    const inner = await request(app).get('/api/v1/locations/suggestions').query({ q: 'galuru' });

    expect(prefix.body.locations).toHaveLength(1);
    expect(inner.body.locations).toEqual([]);
  });

  it('lists city matches before locality-only matches, then alphabetical', async () => {
    await Location.create([
      { city: 'Pune', locality: 'Mundhwa' },
      { city: 'Mumbai', locality: 'Powai' },
      { city: 'Delhi', locality: 'Munirka' },
      { city: 'Mumbai' },
      { city: 'Munnar' },
    ]);

    const res = await request(app).get('/api/v1/locations/suggestions').query({ q: 'mu' });

    expect(res.body.locations.map((l) => [l.city, l.locality])).toEqual([
      ['Mumbai', null],
      ['Mumbai', 'Powai'],
      ['Munnar', null],
      ['Delhi', 'Munirka'],
      ['Pune', 'Mundhwa'],
    ]);
  });

  it('normalizes padded and mixed-case queries and still caps at 6', async () => {
    await Location.create(Array.from({ length: 8 }, (_, i) => ({ city: `Testville ${i}` })));

    const res = await request(app).get('/api/v1/locations/suggestions').query({ q: '  TESTVILLE  ' });

    expect(res.body.locations.map((l) => l.city)).toEqual(
      Array.from({ length: 6 }, (_, i) => `Testville ${i}`)
    );
  });

  it('does not leak the lowercase fields', async () => {
    await Location.create({ city: 'Pune', locality: 'Baner' });

    const res = await request(app).get('/api/v1/locations/suggestions').query({ q: 'pun' });

    expect(res.body.locations[0]).not.toHaveProperty('cityLower');
    expect(res.body.locations[0]).not.toHaveProperty('localityLower');
  });
});

describe('backfill-city-lower', () => {
  it('planUpdate returns only the fields that differ', () => {
    expect(planUpdate({ city: ' Pune ' }, { withLocality: false })).toEqual({ cityLower: 'pune' });
    expect(planUpdate({ city: 'Pune', cityLower: 'pune' }, { withLocality: false })).toBeNull();
    expect(planUpdate({ city: 'Pune', cityLower: 'PUNE' }, { withLocality: false })).toEqual({ cityLower: 'pune' });
    expect(
      planUpdate({ city: 'Pune', cityLower: 'pune', locality: 'Baner  Road' }, { withLocality: true })
    ).toEqual({ localityLower: 'baner road' });
    expect(
      planUpdate({ city: 'Pune', cityLower: 'pune', locality: null, localityLower: null }, { withLocality: true })
    ).toBeNull();
    expect(planUpdate({ city: 'Pune', cityLower: 'pune', locality: null }, { withLocality: true })).toBeNull();
  });

  it('fills missing values and is a no-op on the second run', async () => {
    await createProperty({ city: 'New Delhi' });
    await createProperty({ city: 'Goa' });
    await Property.collection.updateMany({}, { $unset: { cityLower: '' } });
    const before = await Property.find({}).select('updatedAt').lean();

    const first = await backfillModel(Property, { withLocality: false });
    const second = await backfillModel(Property, { withLocality: false });

    expect(first).toEqual({ scanned: 2, updated: 2 });
    expect(second).toEqual({ scanned: 2, updated: 0 });
    const after = await Property.find({}).select('cityLower updatedAt').lean();
    expect(after.map((p) => p.cityLower).sort()).toEqual(['goa', 'new delhi']);
    expect(after.map((p) => String(p.updatedAt)).sort()).toEqual(before.map((p) => String(p.updatedAt)).sort());
  });

  it('backfills Location locality too', async () => {
    await Location.create({ city: 'Mumbai', locality: 'Andheri' });
    await Location.collection.updateMany({}, { $unset: { cityLower: '', localityLower: '' } });

    await backfillModel(Location, { withLocality: true });

    const [stored] = await Location.find({}).lean();
    expect(stored.cityLower).toBe('mumbai');
    expect(stored.localityLower).toBe('andheri');
  });
});
