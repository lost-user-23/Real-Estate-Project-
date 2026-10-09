process.env.MONGODB_DB_NAME = 'homenest_test_builders';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const Project = require('../src/models/Project');

const app = createApp();

let counter = 0;
function projectDoc(overrides = {}) {
  counter += 1;
  return {
    name: `Project ${counter}`,
    developer: 'Acme Builders',
    city: 'Pune',
    locality: 'Baner',
    startingPriceInRupees: 5000000,
    status: 'published',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const createProject = (overrides) => Project.create(projectDoc(overrides));

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Project.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('GET /api/v1/builders', () => {
  it('returns published builders with pagination metadata', async () => {
    await Project.insertMany(Array.from({ length: 25 }, (_, index) =>
      projectDoc({ developer: `Developer ${String(index).padStart(2, '0')}` })
    ));

    const firstPage = await request(app).get('/api/v1/builders');
    const secondPage = await request(app).get('/api/v1/builders?page=2');

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.builders).toHaveLength(20);
    expect(firstPage.body.builders[0]).toEqual({
      name: 'Developer 00',
      slug: expect.any(String),
      city: 'Pune',
      publishedProjectCount: 1,
    });
    expect(firstPage.body.meta).toEqual({ total: 25, page: 1, limit: 20, totalPages: 2 });
    expect(secondPage.body.builders).toHaveLength(5);
    expect(secondPage.body.meta.page).toBe(2);
  });

  it('caps the requested page size at 50', async () => {
    await Project.insertMany(Array.from({ length: 55 }, (_, index) =>
      projectDoc({ developer: `Developer ${String(index).padStart(2, '0')}` })
    ));

    const res = await request(app).get('/api/v1/builders?limit=500');

    expect(res.status).toBe(200);
    expect(res.body.builders).toHaveLength(50);
    expect(res.body.meta).toEqual({ total: 55, page: 1, limit: 50, totalPages: 2 });
  });

  it('filters by city case-insensitively and counts only published projects', async () => {
    await createProject({ developer: 'Acme Builders', city: 'Pune' });
    await createProject({ developer: 'Acme Builders', city: 'Delhi' });
    await createProject({ developer: 'Draft Builder', city: 'Pune', status: 'draft', publishedAt: null });
    await createProject({ developer: 'Archived Builder', city: 'Pune', status: 'archived' });

    const res = await request(app).get('/api/v1/builders?city=pUnE');

    expect(res.status).toBe(200);
    expect(res.body.builders).toEqual([
      {
        name: 'Acme Builders',
        slug: expect.any(String),
        city: 'Pune',
        publishedProjectCount: 1,
      },
    ]);
    expect(res.body.meta.total).toBe(1);
  });

  it('rejects invalid pagination and city params with the unified error shape', async () => {
    const res = await request(app).get('/api/v1/builders?page=0&limit=abc&city=%20');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
    expect(res.body.error.details).toHaveLength(3);
  });

  it('orders by published project count descending and then builder name', async () => {
    await createProject({ developer: 'Zeta' });
    await createProject({ developer: 'Alpha' });
    await createProject({ developer: 'Mid' });
    await createProject({ developer: 'Mid' });
    await createProject({ developer: 'Big' });
    await createProject({ developer: 'Big' });
    await createProject({ developer: 'Big' });

    const res = await request(app).get('/api/v1/builders');

    expect(res.body.builders.map(({ name, publishedProjectCount }) => [name, publishedProjectCount])).toEqual([
      ['Big', 3],
      ['Mid', 2],
      ['Alpha', 1],
      ['Zeta', 1],
    ]);
  });
});

describe('GET /api/v1/builders/:slug', () => {
  it('returns builder details and only their published projects', async () => {
    await createProject({ name: 'Published one' });
    await createProject({ name: 'Published two', city: 'Delhi' });
    await createProject({ name: 'Draft', status: 'draft', publishedAt: null });
    await createProject({ name: 'Archived', status: 'archived' });

    const list = await request(app).get('/api/v1/builders');
    const { slug } = list.body.builders[0];
    const res = await request(app).get(`/api/v1/builders/${encodeURIComponent(slug)}`);

    expect(res.status).toBe(200);
    expect(res.body.builder).toEqual(
      expect.objectContaining({
        name: 'Acme Builders',
        slug,
        city: 'Delhi',
        publishedProjectCount: 2,
      })
    );
    expect(res.body.builder.projects.map(({ name }) => name).sort()).toEqual(['Published one', 'Published two']);
    expect(res.body.builder.projects.every(({ status }) => status === 'published')).toBe(true);
  });

  it('returns 404 for an unknown slug and a builder with no published projects', async () => {
    const published = await createProject({ developer: 'Draft Only' });
    const list = await request(app).get('/api/v1/builders');
    const slug = list.body.builders[0].slug;
    await Project.updateOne({ _id: published._id }, { status: 'draft', publishedAt: null });

    const unknown = await request(app).get('/api/v1/builders/no-such-builder');
    const draftOnly = await request(app).get(`/api/v1/builders/${encodeURIComponent(slug)}`);

    const forged = await request(app).get('/api/v1/builders/draft-only~bm90LXRoZS1uYW1l');
    expect(forged.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: { message: 'Builder not found' } });
    expect((await request(app).get('/api/v1/builders')).body.builders).toHaveLength(0);
    expect(draftOnly.status).toBe(404);
  });
});
