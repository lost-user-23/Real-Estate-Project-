process.env.MONGODB_DB_NAME = 'homenest_test_projects_builders';

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

describe('GET /api/v1/projects/builders', () => {
  it('is not shadowed by /:id', async () => {
    await createProject();

    const res = await request(app).get('/api/v1/projects/builders');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.builders)).toBe(true);
    expect(res.body.project).toBeUndefined();
  });

  it('counts every published project, well past 50', async () => {
    await Project.insertMany(Array.from({ length: 60 }, () => projectDoc()));

    const res = await request(app).get('/api/v1/projects/builders');

    expect(res.body.builders).toHaveLength(1);
    expect(res.body.builders[0].name).toBe('Acme Builders');
    expect(res.body.builders[0].projectCount).toBe(60);
    expect(res.body.builders[0].projects).toHaveLength(60);
  });

  it('excludes drafts and archived projects, and hides builders with none published', async () => {
    await createProject({ name: 'Live' });
    await createProject({ name: 'Draft', status: 'draft', publishedAt: null });
    await createProject({ name: 'Archived', status: 'archived' });
    await createProject({ developer: 'Draft Only Co', status: 'draft', publishedAt: null });

    const res = await request(app).get('/api/v1/projects/builders');

    expect(res.body.builders.map((b) => b.name)).toEqual(['Acme Builders']);
    expect(res.body.builders[0].projectCount).toBe(1);
    expect(res.body.builders[0].projects.map((p) => p.name)).toEqual(['Live']);
  });

  it('returns builders as name, projectCount, cities and serialized projects', async () => {
    await createProject({ name: 'Pune one', city: 'Pune' });
    await createProject({ name: 'Delhi one', city: 'Delhi' });

    const res = await request(app).get('/api/v1/projects/builders');

    const [builder] = res.body.builders;
    expect(Object.keys(builder).sort()).toEqual(['cities', 'name', 'projectCount', 'projects']);
    expect(builder.cities).toEqual(['Delhi', 'Pune']);
    expect(builder.projects[0]).toEqual(
      expect.objectContaining({ _id: expect.any(String), name: expect.any(String), developer: 'Acme Builders' })
    );
  });

  it('filters by city, ignoring case, and counts only that city', async () => {
    await createProject({ developer: 'Acme Builders', city: 'Pune' });
    await createProject({ developer: 'Acme Builders', city: 'Delhi' });
    await createProject({ developer: 'Delhi Only', city: 'Delhi' });

    const res = await request(app).get('/api/v1/projects/builders?city=pUnE');

    expect(res.status).toBe(200);
    expect(res.body.builders).toHaveLength(1);
    expect(res.body.builders[0].projectCount).toBe(1);
    expect(res.body.builders[0].cities).toEqual(['Pune']);
  });

  it('orders by projectCount desc, then name asc', async () => {
    await createProject({ developer: 'Zeta' });
    await createProject({ developer: 'Alpha' });
    await createProject({ developer: 'Mid' });
    await createProject({ developer: 'Mid' });
    await createProject({ developer: 'Big' });
    await createProject({ developer: 'Big' });
    await createProject({ developer: 'Big' });

    const res = await request(app).get('/api/v1/projects/builders');

    expect(res.body.builders.map((b) => [b.name, b.projectCount])).toEqual([
      ['Big', 3],
      ['Mid', 2],
      ['Alpha', 1],
      ['Zeta', 1],
    ]);
  });

  it('lists projects newest published first within a builder', async () => {
    await createProject({ name: 'Old', publishedAt: new Date('2025-01-01') });
    await createProject({ name: 'New', publishedAt: new Date('2026-06-01') });
    await createProject({ name: 'Middle', publishedAt: new Date('2025-09-01') });

    const res = await request(app).get('/api/v1/projects/builders');

    expect(res.body.builders[0].projects.map((p) => p.name)).toEqual(['New', 'Middle', 'Old']);
  });

  it('caps the response at 50 builders', async () => {
    await Project.insertMany(Array.from({ length: 55 }, (_, i) => projectDoc({ developer: `Dev ${i}` })));

    const res = await request(app).get('/api/v1/projects/builders');

    expect(res.body.builders).toHaveLength(50);
  });

  it('groups on the developer string as stored, so spelling variants stay separate', async () => {
    await createProject({ developer: 'DLF' });
    await createProject({ developer: 'dlf' });

    const res = await request(app).get('/api/v1/projects/builders');

    expect(res.body.builders.map((b) => b.name).sort()).toEqual(['DLF', 'dlf']);
  });

  it.each([
    ['repeated city', '?city=a&city=b'],
    ['blank city', '?city=%20'],
  ])('rejects %s with 400', async (_name, qs) => {
    const res = await request(app).get(`/api/v1/projects/builders${qs}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });
});
