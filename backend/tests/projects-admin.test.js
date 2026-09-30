process.env.MONGODB_DB_NAME = 'homenest_test_projects_admin';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Project = require('../src/models/Project');

const app = createApp();

async function registerUser() {
  const email = `project-admin-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Project Admin Tester', email, password: 'password123' });
  return { token: response.body.token, user: response.body.user };
}

async function createAdminToken() {
  const { token, user } = await registerUser();
  await User.findByIdAndUpdate(user.id, { role: 'admin' });
  return token;
}

function makeProject(overrides = {}) {
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

const validBody = {
  name: 'AUDIT Heights',
  developer: 'Acme Builders',
  city: 'Pune',
  startingPriceInRupees: 3500000,
};

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

describe('admin projects: access control', () => {
  it('forbids a non-admin user on every admin project route', async () => {
    const { token } = await registerUser();
    const project = await makeProject();
    const headers = { Authorization: `Bearer ${token}` };
    const base = '/api/v1/admin/projects';

    const responses = await Promise.all([
      request(app).get(base).set(headers),
      request(app).get(`${base}/${project._id}`).set(headers),
      request(app).post(base).set(headers).send(validBody),
      request(app).patch(`${base}/${project._id}`).set(headers).send({ status: 'draft' }),
      request(app).patch(`${base}/${project._id}/publish`).set(headers),
      request(app).delete(`${base}/${project._id}`).set(headers),
    ]);

    responses.forEach((response) => expect(response.status).toBe(403));
    expect((await Project.findById(project._id)).status).toBe('published');
  });

  it('rejects unauthenticated writes', async () => {
    const project = await makeProject();
    const base = '/api/v1/admin/projects';

    const responses = await Promise.all([
      request(app).post(base).send(validBody),
      request(app).patch(`${base}/${project._id}`).send({ status: 'draft' }),
      request(app).delete(`${base}/${project._id}`),
    ]);

    responses.forEach((response) => expect(response.status).toBe(401));
    expect(await Project.countDocuments()).toBe(1);
  });
});

describe('admin projects: reads', () => {
  it('returns a draft project by id to an admin', async () => {
    const token = await createAdminToken();
    const project = await makeProject({ status: 'draft', publishedAt: null });

    const response = await request(app)
      .get(`/api/v1/admin/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.project).toMatchObject({ name: 'Test Project', status: 'draft' });
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    const token = await createAdminToken();
    const headers = { Authorization: `Bearer ${token}` };

    const missing = await request(app)
      .get(`/api/v1/admin/projects/${new mongoose.Types.ObjectId()}`)
      .set(headers);
    const malformed = await request(app).get('/api/v1/admin/projects/not-an-id').set(headers);

    expect(missing.status).toBe(404);
    expect(malformed.status).toBe(400);
  });

  it('paginates the admin list newest first and validates page params', async () => {
    const token = await createAdminToken();
    const headers = { Authorization: `Bearer ${token}` };
    await makeProject({ name: 'Oldest', status: 'draft', publishedAt: null });
    await makeProject({ name: 'Middle', status: 'archived', publishedAt: null });
    await makeProject({ name: 'Newest' });

    const page1 = await request(app).get('/api/v1/admin/projects?page=1&limit=2').set(headers);
    const page2 = await request(app).get('/api/v1/admin/projects?page=2&limit=2').set(headers);
    const bad = await request(app).get('/api/v1/admin/projects?page=0').set(headers);

    expect(page1.body.projects.map((p) => p.name)).toEqual(['Newest', 'Middle']);
    expect(page1.body.meta).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
    expect(page2.body.projects.map((p) => p.name)).toEqual(['Oldest']);
    expect(bad.status).toBe(400);
  });
});

describe('admin projects: writes', () => {
  it('stamps publishedAt when created as published', async () => {
    const token = await createAdminToken();

    const response = await request(app)
      .post('/api/v1/admin/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, status: 'published' });

    expect(response.status).toBe(201);
    expect(response.body.project.status).toBe('published');
    expect(response.body.project.publishedAt).toEqual(expect.any(String));
  });

  it.each([
    ['an empty name', { name: '   ' }],
    ['a non-numeric price', { startingPriceInRupees: '3500000' }],
    ['a negative price', { startingPriceInRupees: -1 }],
    ['an unknown status', { status: 'live' }],
    ['a non-string possessionLabel', { possessionLabel: 12 }],
  ])('rejects create with %s', async (_label, override) => {
    const token = await createAdminToken();

    const response = await request(app)
      .post('/api/v1/admin/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, ...override });

    expect(response.status).toBe(400);
    expect(await Project.countDocuments()).toBe(0);
  });

  it('rejects an invalid PATCH and leaves the project unchanged', async () => {
    const token = await createAdminToken();
    const project = await makeProject();

    const response = await request(app)
      .patch(`/api/v1/admin/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'live', startingPriceInRupees: -5 });

    expect(response.status).toBe(400);
    const stored = await Project.findById(project._id);
    expect(stored.status).toBe('published');
    expect(stored.startingPriceInRupees).toBe(5000000);
  });

  it('ignores fields that are not editable', async () => {
    const token = await createAdminToken();
    const project = await makeProject();

    const response = await request(app)
      .patch(`/api/v1/admin/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ possessionLabel: 'Dec 2027', publishedAt: '2000-01-01T00:00:00.000Z' });

    expect(response.status).toBe(200);
    expect(response.body.project.possessionLabel).toBe('Dec 2027');
    expect(response.body.project.publishedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns 404 when updating, publishing or deleting an unknown project', async () => {
    const token = await createAdminToken();
    const headers = { Authorization: `Bearer ${token}` };
    const url = `/api/v1/admin/projects/${new mongoose.Types.ObjectId()}`;

    const responses = await Promise.all([
      request(app).patch(url).set(headers).send({ status: 'draft' }),
      request(app).patch(`${url}/publish`).set(headers),
      request(app).delete(url).set(headers),
    ]);

    responses.forEach((response) => expect(response.status).toBe(404));
  });
});

describe('public projects never expose non-published items', () => {
  it('hides draft and archived projects from the list and the home page endpoint', async () => {
    await makeProject({ name: 'Live' });
    await makeProject({ name: 'Draft', status: 'draft', publishedAt: null });
    await makeProject({ name: 'Archived', status: 'archived' });

    const list = await request(app).get('/api/v1/projects');
    const home = await request(app).get('/api/v1/projects/new');

    expect(list.body.projects.map((p) => p.name)).toEqual(['Live']);
    expect(list.body.meta.total).toBe(1);
    expect(home.body.projects.map((p) => p.name)).toEqual(['Live']);
  });

  it('serves a published project by id, then hides it after an admin unpublishes it', async () => {
    const token = await createAdminToken();
    const project = await makeProject();
    const publicUrl = `/api/v1/projects/${project._id}`;

    expect((await request(app).get(publicUrl)).status).toBe(200);

    await request(app)
      .patch(`/api/v1/admin/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'archived' });

    expect((await request(app).get(publicUrl)).status).toBe(404);
  });

  it('removes a deleted project from public reads', async () => {
    const token = await createAdminToken();
    const project = await makeProject();

    const deletion = await request(app)
      .delete(`/api/v1/admin/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deletion.status).toBe(204);
    expect((await request(app).get(`/api/v1/projects/${project._id}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/projects')).body.projects).toEqual([]);
  });

  it('rejects invalid pagination on the public list', async () => {
    const response = await request(app).get('/api/v1/projects?limit=abc');
    expect(response.status).toBe(400);
  });
});
