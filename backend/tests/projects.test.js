process.env.MONGODB_DB_NAME = 'homenest_test_projects';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Project = require('../src/models/Project');

const app = createApp();

async function registerUser() {
  const email = `project-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await registerVerified(app, { name: 'Project Tester', email, password: 'password123' });
  return { token: tokenFromResponse(response), user: response.body.user };
}

async function promoteToAdmin(userId) {
  await User.findByIdAndUpdate(userId, { role: 'admin' });
}

async function createAdmin() {
  const credentials = await registerUser();
  await promoteToAdmin(credentials.user.id);
  return credentials.token;
}

async function createProject(overrides = {}) {
  return Project.create({
    name: 'Test Project',
    developer: 'Test Developer',
    city: 'Bengaluru',
    startingPriceInRupees: 5000000,
    status: 'published',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), Project.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('public projects', () => {
  it('lists only published projects with property-style pagination metadata', async () => {
    await createProject({ name: 'Published Project' });
    await createProject({ name: 'Draft Project', status: 'draft', publishedAt: null });

    const response = await request(app).get('/api/v1/projects');

    expect(response.status).toBe(200);
    expect(response.body.projects.map((project) => project.name)).toEqual(['Published Project']);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it.each(['draft', 'archived'])('does not expose %s projects by id', async (status) => {
    const project = await createProject({ status, publishedAt: null });
    const response = await request(app).get(`/api/v1/projects/${project._id}`);
    expect(response.status).toBe(404);
  });

  it('returns the newest 4 published projects for the home page, ordered by publishedAt desc', async () => {
    for (let i = 0; i < 5; i += 1) {
      await createProject({
        name: `Project ${i}`,
        publishedAt: new Date(2026, 0, i + 1),
      });
    }
    await createProject({ name: 'Draft Project', status: 'draft', publishedAt: null });

    const response = await request(app).get('/api/v1/projects/new');

    expect(response.status).toBe(200);
    expect(response.body.projects).toHaveLength(4);
    expect(response.body.projects.map((project) => project.name)).toEqual([
      'Project 4',
      'Project 3',
      'Project 2',
      'Project 1',
    ]);
  });
});

describe('admin projects', () => {
  it('requires admin authentication', async () => {
    const response = await request(app).get('/api/v1/admin/projects');
    expect(response.status).toBe(401);
  });

  it('creates with draft status by default', async () => {
    const token = await createAdmin();
    const response = await request(app)
      .post('/api/v1/admin/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Heights', developer: 'Acme Builders', city: 'Pune', startingPriceInRupees: 3500000 });

    expect(response.status).toBe(201);
    expect(response.body.project.status).toBe('draft');
    expect(response.body.project.publishedAt).toBeNull();
  });

  it('rejects a missing required field', async () => {
    const token = await createAdmin();
    const response = await request(app)
      .post('/api/v1/admin/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Missing Fields' });

    expect(response.status).toBe(400);
  });

  it('publishes once and preserves the first published timestamp', async () => {
    const token = await createAdmin();
    const project = await createProject({ status: 'draft', publishedAt: null });
    const publishUrl = `/api/v1/admin/projects/${project._id}/publish`;

    const first = await request(app)
      .patch(publishUrl)
      .set('Authorization', `Bearer ${token}`);
    const firstPublishedAt = first.body.project.publishedAt;
    const second = await request(app)
      .patch(publishUrl)
      .set('Authorization', `Bearer ${token}`);

    expect(first.status).toBe(200);
    expect(first.body.project.status).toBe('published');
    expect(firstPublishedAt).toEqual(expect.any(String));
    expect(second.body.project.publishedAt).toBe(firstPublishedAt);
  });

  it('reverts to draft through PATCH while preserving publishedAt', async () => {
    const token = await createAdmin();
    const project = await createProject();
    const headers = { Authorization: `Bearer ${token}` };
    const originalPublishedAt = project.publishedAt.toISOString();

    const response = await request(app)
      .patch(`/api/v1/admin/projects/${project._id}`)
      .set(headers)
      .send({ status: 'draft' });

    expect(response.status).toBe(200);
    expect(response.body.project.status).toBe('draft');
    expect(response.body.project.publishedAt).toBe(originalPublishedAt);
  });

  it('lists all statuses and supports updates and deletion', async () => {
    const token = await createAdmin();
    const project = await createProject({ status: 'archived' });
    const headers = { Authorization: `Bearer ${token}` };

    const list = await request(app).get('/api/v1/admin/projects').set(headers);
    expect(list.status).toBe(200);
    expect(list.body.projects.map((entry) => entry.status)).toContain('archived');

    const update = await request(app)
      .patch(`/api/v1/admin/projects/${project._id}`)
      .set(headers)
      .send({ status: 'draft', possessionLabel: 'Ready to move' });
    expect(update.status).toBe(200);
    expect(update.body.project.possessionLabel).toBe('Ready to move');

    const deletion = await request(app)
      .delete(`/api/v1/admin/projects/${project._id}`)
      .set(headers);
    expect(deletion.status).toBe(204);
  });
});
