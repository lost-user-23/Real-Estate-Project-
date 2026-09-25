process.env.MONGODB_DB_NAME = 'homenest_test_category';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Category = require('../src/models/Category');

const app = createApp();

async function registerUser(overrides = {}) {
  const email = overrides.email || `user-${new mongoose.Types.ObjectId()}@example.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email, password: 'password123', ...overrides });
  return { token: res.body.token, user: res.body.user };
}

async function makeAdmin(userId) {
  await User.findByIdAndUpdate(userId, { role: 'admin' });
}

async function registerAdmin() {
  const { token, user } = await registerUser();
  await makeAdmin(user.id);
  return { token, user };
}

const validPayload = {
  name: 'Apartments',
  slug: 'apartments',
  icon: 'building',
};

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), Category.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('GET /api/v1/categories', () => {
  it('is public and does not return 404', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).not.toBe(404);
  });

  it('returns categories with the expected shape', async () => {
    await Category.create({ name: 'Villas', slug: 'villas', icon: 'home', listingCount: 5 });

    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(res.body.categories).toHaveLength(1);

    const category = res.body.categories[0];
    expect(category).toEqual({
      id: expect.any(String),
      name: 'Villas',
      slug: 'villas',
      listingCount: 5,
      icon: 'home',
    });
  });
});

describe('POST /api/v1/categories', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/v1/categories').send(validPayload);
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  it('creates a category as admin', async () => {
    const { token } = await registerAdmin();
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.category).toEqual({
      id: expect.any(String),
      name: validPayload.name,
      slug: validPayload.slug,
      icon: validPayload.icon,
      listingCount: 0,
    });
  });

  it('rejects an invalid name', async () => {
    const { token } = await registerAdmin();
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload, name: '' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing slug', async () => {
    const { token } = await registerAdmin();
    const rest = { ...validPayload };
    delete rest.slug;
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send(rest);
    expect(res.status).toBe(400);
  });

  it('returns 409 on a duplicate slug', async () => {
    const { token } = await registerAdmin();
    await Category.create(validPayload);

    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload);
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/v1/categories/:id', () => {
  it('rejects unauthenticated requests', async () => {
    const category = await Category.create(validPayload);
    const res = await request(app)
      .patch(`/api/v1/categories/${category._id}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const { token } = await registerUser();
    const category = await Category.create(validPayload);
    const res = await request(app)
      .patch(`/api/v1/categories/${category._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(403);
  });

  it('supports partial updates and preserves omitted fields', async () => {
    const { token } = await registerAdmin();
    const category = await Category.create(validPayload);

    const res = await request(app)
      .patch(`/api/v1/categories/${category._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ listingCount: 42 });

    expect(res.status).toBe(200);
    expect(res.body.category.listingCount).toBe(42);
    expect(res.body.category.name).toBe(validPayload.name);
    expect(res.body.category.slug).toBe(validPayload.slug);
    expect(res.body.category.icon).toBe(validPayload.icon);
  });

  it('rejects invalid field values', async () => {
    const { token } = await registerAdmin();
    const category = await Category.create(validPayload);

    const res = await request(app)
      .patch(`/api/v1/categories/${category._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ listingCount: -5 });

    expect(res.status).toBe(400);
  });

  it('returns 409 on a duplicate slug', async () => {
    const { token } = await registerAdmin();
    await Category.create({ name: 'Villas', slug: 'villas', icon: 'home' });
    const category = await Category.create(validPayload);

    const res = await request(app)
      .patch(`/api/v1/categories/${category._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'villas' });

    expect(res.status).toBe(409);
  });

  it('returns 404 for a nonexistent category', async () => {
    const { token } = await registerAdmin();
    const res = await request(app)
      .patch(`/api/v1/categories/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/categories/:id', () => {
  it('rejects unauthenticated requests', async () => {
    const category = await Category.create(validPayload);
    const res = await request(app).delete(`/api/v1/categories/${category._id}`);
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const { token } = await registerUser();
    const category = await Category.create(validPayload);
    const res = await request(app)
      .delete(`/api/v1/categories/${category._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('deletes a category as admin', async () => {
    const { token } = await registerAdmin();
    const category = await Category.create(validPayload);

    const res = await request(app)
      .delete(`/api/v1/categories/${category._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(await Category.findById(category._id)).toBeNull();
  });

  it('returns 404 for a nonexistent category', async () => {
    const { token } = await registerAdmin();
    const res = await request(app)
      .delete(`/api/v1/categories/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
