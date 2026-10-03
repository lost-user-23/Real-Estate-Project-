process.env.MONGODB_DB_NAME = 'homenest_test_saved_properties';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const PropertyImage = require('../src/models/PropertyImage');
const SavedProperty = require('../src/models/SavedProperty');
const propertyService = require('../src/services/property.service');

const app = createApp();
const BASE = '/api/v1/saved-properties';
const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function registerUser(email) {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123' });
  return { token: res.body.token, id: res.body.user.id };
}

let counter = 0;
async function createListing(ownerId, status = 'published') {
  counter += 1;
  const property = await Property.create({
    ownerId,
    slug: `saved-${counter}`,
    title: `Saved ${counter}`,
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 900,
    priceInRupees: 5000000,
    city: 'Delhi',
    contactNumber: '9999999999',
    status,
  });
  await PropertyImage.create({ propertyId: property._id, url: 'https://example.com/a.jpg' });
  return property;
}

const save = (token, id) => request(app).post(`${BASE}/${id}`).set(auth(token));
const unsave = (token, id) => request(app).delete(`${BASE}/${id}`).set(auth(token));
const listIds = (token) => request(app).get(`${BASE}/ids`).set(auth(token));
const list = (token, query = '') => request(app).get(`${BASE}${query}`).set(auth(token));

let owner;
let me;
let other;

beforeAll(async () => {
  await connectToDatabase();
});

beforeEach(async () => {
  owner = await registerUser('owner@example.com');
  me = await registerUser('me@example.com');
  other = await registerUser('other@example.com');
});

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Property.deleteMany({}),
    PropertyImage.deleteMany({}),
    SavedProperty.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('authentication', () => {
  const id = new mongoose.Types.ObjectId().toString();
  it.each([
    ['get', `${BASE}/ids`],
    ['get', BASE],
    ['post', `${BASE}/${id}`],
    ['delete', `${BASE}/${id}`],
  ])('%s %s returns 401 without a token', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/saved-properties/:propertyId', () => {
  it('saves a published property', async () => {
    const property = await createListing(owner.id);
    const res = await save(me.token, property._id);
    expect(res.status).toBe(200);
    expect(await SavedProperty.countDocuments({ userId: me.id, propertyId: property._id })).toBe(1);
  });

  it('is idempotent: saving twice returns 200 both times and keeps one row', async () => {
    const property = await createListing(owner.id);
    const first = await save(me.token, property._id);
    const second = await save(me.token, property._id);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await SavedProperty.countDocuments({ userId: me.id, propertyId: property._id })).toBe(1);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await save(me.token, 'not-an-id');
    expect(res.status).toBe(400);
  });

  it('returns 404 for a missing, draft or archived property', async () => {
    const draft = await createListing(owner.id, 'draft');
    const archived = await createListing(owner.id, 'archived');
    const missing = new mongoose.Types.ObjectId();
    for (const id of [missing, draft._id, archived._id]) {
      const res = await save(me.token, id);
      expect(res.status).toBe(404);
    }
    expect(await SavedProperty.countDocuments({})).toBe(0);
  });
});

describe('GET /api/v1/saved-properties/ids', () => {
  it("returns only the caller's saved ids as strings", async () => {
    const a = await createListing(owner.id);
    const b = await createListing(owner.id);
    await save(me.token, a._id);
    await save(other.token, b._id);

    const res = await listIds(me.token);
    expect(res.status).toBe(200);
    expect(res.body.propertyIds).toEqual([String(a._id)]);
    expect(typeof res.body.propertyIds[0]).toBe('string');
  });
});

describe('GET /api/v1/saved-properties', () => {
  it('returns serialized properties with images, newest saved first, without contactNumber', async () => {
    const a = await createListing(owner.id);
    const b = await createListing(owner.id);
    const c = await createListing(owner.id);
    await save(me.token, a._id);
    await save(me.token, b._id);
    await save(other.token, c._id);

    const res = await list(me.token);
    expect(res.status).toBe(200);
    expect(res.body.properties.map((p) => p._id)).toEqual([String(b._id), String(a._id)]);
    res.body.properties.forEach((p) => {
      expect(p.images).toHaveLength(1);
      expect(p).not.toHaveProperty('contactNumber');
    });
    expect(res.body.meta).toEqual({ total: 2, page: 1, limit: 20, totalPages: 1 });
  });

  it('reports totalPages of at least 1 when empty', async () => {
    const res = await list(me.token);
    expect(res.status).toBe(200);
    expect(res.body.properties).toEqual([]);
    expect(res.body.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
  });

  it('clamps limit to 50 and falls back to defaults for invalid values', async () => {
    const big = await list(me.token, '?limit=500');
    expect(big.body.meta.limit).toBe(50);
    const bad = await list(me.token, '?page=abc&limit=0');
    expect(bad.body.meta.page).toBe(1);
    expect(bad.body.meta.limit).toBe(20);
  });

  it('paginates without repeating items', async () => {
    const listings = [];
    for (let i = 0; i < 3; i += 1) {
      const p = await createListing(owner.id);
      await save(me.token, p._id);
      listings.push(String(p._id));
    }
    const newestFirst = [...listings].reverse();

    const page1 = await list(me.token, '?page=1&limit=2');
    const page2 = await list(me.token, '?page=2&limit=2');
    expect(page1.body.meta).toEqual({ total: 3, page: 1, limit: 2, totalPages: 2 });
    expect(page2.body.meta.page).toBe(2);
    expect(page1.body.properties.map((p) => p._id)).toEqual(newestFirst.slice(0, 2));
    expect(page2.body.properties.map((p) => p._id)).toEqual(newestFirst.slice(2));
  });
});

describe('unpublished saved properties', () => {
  it.each(['draft', 'archived'])(
    'hides a property moved to %s but keeps the row, and republishing restores it',
    async (status) => {
      const property = await createListing(owner.id);
      await save(me.token, property._id);

      await Property.updateOne({ _id: property._id }, { status });
      expect((await listIds(me.token)).body.propertyIds).toEqual([]);
      const hidden = await list(me.token);
      expect(hidden.body.properties).toEqual([]);
      expect(hidden.body.meta.total).toBe(0);
      expect(await SavedProperty.countDocuments({ userId: me.id, propertyId: property._id })).toBe(1);

      await Property.updateOne({ _id: property._id }, { status: 'published' });
      expect((await listIds(me.token)).body.propertyIds).toEqual([String(property._id)]);
      expect((await list(me.token)).body.properties.map((p) => p._id)).toEqual([String(property._id)]);
    }
  );
});

describe('DELETE /api/v1/saved-properties/:propertyId', () => {
  it('removes the save and is idempotent', async () => {
    const property = await createListing(owner.id);
    await save(me.token, property._id);

    const first = await unsave(me.token, property._id);
    const second = await unsave(me.token, property._id);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await SavedProperty.countDocuments({ userId: me.id })).toBe(0);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await unsave(me.token, 'not-an-id');
    expect(res.status).toBe(400);
  });

  it("does not touch other users' saves", async () => {
    const property = await createListing(owner.id);
    await save(me.token, property._id);
    await save(other.token, property._id);

    await unsave(me.token, property._id);
    expect(await SavedProperty.countDocuments({ userId: me.id })).toBe(0);
    expect(await SavedProperty.countDocuments({ userId: other.id, propertyId: property._id })).toBe(1);
  });
});

describe('cleanup', () => {
  it('single property deletion removes its saved rows only', async () => {
    const gone = await createListing(owner.id);
    const kept = await createListing(owner.id);
    await save(me.token, gone._id);
    await save(other.token, gone._id);
    await save(me.token, kept._id);

    const result = await propertyService.deletePropertyById(gone._id, { _id: owner.id, role: 'user' });
    expect(result).toEqual({});
    expect(await SavedProperty.countDocuments({ propertyId: gone._id })).toBe(0);
    expect(await SavedProperty.countDocuments({ propertyId: kept._id })).toBe(1);
  });

  it('bulk property deletion removes their saved rows only', async () => {
    const a = await createListing(owner.id);
    const b = await createListing(owner.id);
    const kept = await createListing(owner.id);
    await save(me.token, a._id);
    await save(other.token, b._id);
    await save(me.token, kept._id);

    const result = await propertyService.bulkDeletePropertiesByIds([a._id, b._id]);
    expect(result.deletedCount).toBe(2);
    expect(await SavedProperty.countDocuments({ propertyId: { $in: [a._id, b._id] } })).toBe(0);
    expect(await SavedProperty.countDocuments({ propertyId: kept._id })).toBe(1);
  });

  it("account deletion removes the user's saves and others' saves of their listings, and nothing else", async () => {
    // A = me, B = other
    const aListing = await createListing(me.id);
    const ownersListing = await createListing(owner.id);
    const thirdListing = await createListing(owner.id);
    await save(me.token, ownersListing._id); // A's own save of another user's property
    await save(other.token, aListing._id); // B's save of A's property
    await save(other.token, thirdListing._id); // B's save of a third property

    expect(await SavedProperty.countDocuments({ userId: me.id, propertyId: ownersListing._id })).toBe(1);
    expect(await SavedProperty.countDocuments({ userId: other.id, propertyId: aListing._id })).toBe(1);
    expect(await SavedProperty.countDocuments({ userId: other.id, propertyId: thirdListing._id })).toBe(1);
    expect(await SavedProperty.countDocuments({})).toBe(3);

    const res = await request(app)
      .delete('/api/auth/me')
      .set(auth(me.token))
      .send({ password: 'password123' });
    expect(res.status).toBe(200);

    expect(await SavedProperty.countDocuments({ userId: me.id, propertyId: ownersListing._id })).toBe(0);
    expect(await SavedProperty.countDocuments({ userId: other.id, propertyId: aListing._id })).toBe(0);
    expect(await SavedProperty.countDocuments({ userId: other.id, propertyId: thirdListing._id })).toBe(1);
    expect(await SavedProperty.countDocuments({})).toBe(1);
  });
});
