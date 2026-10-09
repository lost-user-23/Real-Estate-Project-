process.env.MONGODB_DB_NAME = 'homenest_test_articles';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Article = require('../src/models/Article');

const app = createApp();

async function registerUser() {
  const email = `article-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await registerVerified(app, { name: 'Article Tester', email, password: 'password123' });
  return { token: tokenFromResponse(response), user: response.body.user };
}

async function promoteToAdmin(userId) {
  await User.findByIdAndUpdate(userId, { role: 'admin' });
}

async function createArticle(overrides = {}) {
  const objectId = new mongoose.Types.ObjectId();
  return Article.create({
    title: 'Test Article',
    slug: `test-article-${objectId}`,
    status: 'published',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), Article.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('public articles', () => {
  it('lists only published articles with property-style pagination metadata', async () => {
    await createArticle({ slug: 'published-article' });
    await createArticle({ slug: 'draft-article', status: 'draft', publishedAt: null });

    const response = await request(app).get('/api/v1/articles');

    expect(response.status).toBe(200);
    expect(response.body.articles.map((article) => article.slug)).toEqual(['published-article']);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it.each(['draft', 'archived'])('does not expose %s articles by slug', async (status) => {
    const article = await createArticle({ status });
    const response = await request(app).get(`/api/v1/articles/${article.slug}`);
    expect(response.status).toBe(404);
  });
});

describe('admin articles', () => {
  async function createAdmin() {
    const credentials = await registerUser();
    await promoteToAdmin(credentials.user.id);
    return credentials.token;
  }

  it('requires admin authentication', async () => {
    const response = await request(app).get('/api/v1/admin/articles');
    expect(response.status).toBe(401);
  });

  it('creates with a generated slug and draft status by default', async () => {
    const token = await createAdmin();
    const response = await request(app)
      .post('/api/v1/admin/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'A Guide to Home Buying!' });

    expect(response.status).toBe(201);
    expect(response.body.article.slug).toBe('a-guide-to-home-buying');
    expect(response.body.article.status).toBe('draft');
    expect(response.body.article.publishedAt).toBeNull();
  });

  it('validates and preserves an explicit slug when the title changes', async () => {
    const token = await createAdmin();
    const created = await request(app)
      .post('/api/v1/admin/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Original title', slug: 'seo-friendly-title' });

    const updated = await request(app)
      .patch(`/api/v1/admin/articles/${created.body.article._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Revised title' });

    expect(updated.status).toBe(200);
    expect(updated.body.article.title).toBe('Revised title');
    expect(updated.body.article.slug).toBe('seo-friendly-title');
  });

  it('rejects malformed and duplicate explicit slugs', async () => {
    const token = await createAdmin();
    const baseRequest = request(app)
      .post('/api/v1/admin/articles')
      .set('Authorization', `Bearer ${token}`);

    const malformed = await baseRequest.send({ title: 'Malformed slug', slug: 'Bad Slug!' });
    expect(malformed.status).toBe(400);

    await createArticle({ slug: 'already-taken' });
    const duplicate = await request(app)
      .post('/api/v1/admin/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Duplicate', slug: 'already-taken' });
    expect(duplicate.status).toBe(409);
  });

  it('publishes once and preserves the first published timestamp', async () => {
    const token = await createAdmin();
    const article = await createArticle({ status: 'draft', publishedAt: null });
    const publishUrl = `/api/v1/admin/articles/${article._id}/publish`;

    const first = await request(app)
      .patch(publishUrl)
      .set('Authorization', `Bearer ${token}`);
    const firstPublishedAt = first.body.article.publishedAt;
    const second = await request(app)
      .patch(publishUrl)
      .set('Authorization', `Bearer ${token}`);

    expect(first.status).toBe(200);
    expect(first.body.article.status).toBe('published');
    expect(firstPublishedAt).toEqual(expect.any(String));
    expect(second.body.article.publishedAt).toBe(firstPublishedAt);
  });

  it('lists all statuses and supports updates and deletion', async () => {
    const token = await createAdmin();
    const article = await createArticle({ status: 'archived' });
    const headers = { Authorization: `Bearer ${token}` };

    const list = await request(app).get('/api/v1/admin/articles').set(headers);
    expect(list.status).toBe(200);
    expect(list.body.articles.map((entry) => entry.status)).toContain('archived');

    const update = await request(app)
      .patch(`/api/v1/admin/articles/${article._id}`)
      .set(headers)
      .send({ status: 'draft', excerpt: 'Updated excerpt' });
    expect(update.status).toBe(200);
    expect(update.body.article.excerpt).toBe('Updated excerpt');

    const deletion = await request(app)
      .delete(`/api/v1/admin/articles/${article._id}`)
      .set(headers);
    expect(deletion.status).toBe(204);
  });
});