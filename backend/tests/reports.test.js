process.env.MONGODB_DB_NAME = 'homenest_test_reports';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const config = require('../src/config');
const User = require('../src/models/User');
const Report = require('../src/models/Report');
const { REPORT_REASONS } = Report;
const Property = require('../src/models/Property');

const app = createApp();

async function registerUser() {
  const email = `report-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await registerVerified(app, { name: 'Report Tester', email, password: 'password123' });
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

async function createProperty(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return Property.create({
    _id: id,
    slug: `report-flat-${id}`,
    title: 'Report Test Flat',
    intent: 'rent',
    propertyType: 'apartment',
    areaSqft: 900,
    priceInRupees: 30000,
    city: 'Pune',
    locality: 'Baner',
    status: 'published',
    publishedAt: new Date(),
    ...overrides,
  });
}

async function createReport(overrides = {}) {
  return Report.create({
    listingUrlOrId: 'listing-123',
    reason: 'Fraudulent listing',
    ...overrides,
  });
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), Report.deleteMany({}), Property.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('public reports', () => {
  it('creates a report without authentication and leaves reporterId null', async () => {
    const response = await request(app)
      .post('/api/v1/reports')
      .send({ listingUrlOrId: 'listing-abc', reason: 'Something else' });

    expect(response.status).toBe(201);
    expect(response.body.report.status).toBe('open');
    expect(response.body.report.reporterId).toBeNull();
  });

  it('attaches reporterId when a valid token is provided', async () => {
    const { token, user } = await registerUser();
    const response = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ listingUrlOrId: 'listing-abc', reason: 'Something else' });

    expect(response.status).toBe(201);
    expect(response.body.report.reporterId).toBe(user.id);
  });

  it('reports tracked: true only when attached to a valid logged-in reporter', async () => {
    const { token } = await registerUser();
    const body = { listingUrlOrId: 'listing-abc', reason: 'Something else' };

    const loggedIn = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${token}`).send(body);
    const anonymous = await request(app).post('/api/v1/reports').send({ ...body, listingUrlOrId: 'other' });
    await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${token}`);
    const loggedOut = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...body, listingUrlOrId: 'third' });

    expect(loggedIn.body.tracked).toBe(true);
    expect(anonymous.body.tracked).toBe(false);
    expect(loggedOut.status).toBe(201);
    expect(loggedOut.body.tracked).toBe(false);
    expect(loggedOut.body.report.reporterId).toBeNull();
  });

  it.each([
    ['missing', undefined],
    ['invalid', 'not-a-real-token'],
    ['expired', () => jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, config.jwtSecret, { expiresIn: -10 })],
  ])('never fails the request when the token is %s', async (_label, tokenOrFactory) => {
    const token = typeof tokenOrFactory === 'function' ? tokenOrFactory() : tokenOrFactory;
    const req = request(app).post('/api/v1/reports');
    if (token) req.set('Authorization', `Bearer ${token}`);

    const response = await req.send({ listingUrlOrId: 'listing-abc', reason: 'Something else' });

    expect(response.status).toBe(201);
    expect(response.body.report.reporterId).toBeNull();
  });

  it('rejects a missing reason or listingUrlOrId', async () => {
    const response = await request(app).post('/api/v1/reports').send({ reason: '' });
    expect(response.status).toBe(400);
  });
});

describe('admin reports', () => {
  it('requires admin authentication', async () => {
    const response = await request(app).get('/api/v1/admin/reports');
    expect(response.status).toBe(401);
  });

  it('lists reports with pagination metadata', async () => {
    const token = await createAdmin();
    await createReport();
    await createReport({ listingUrlOrId: 'listing-456' });

    const response = await request(app)
      .get('/api/v1/admin/reports')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.reports).toHaveLength(2);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('shows a report submitted through the public endpoint', async () => {
    const token = await createAdmin();
    const submitted = await request(app)
      .post('/api/v1/reports')
      .send({ listingUrlOrId: '/property/sunny-flat', reason: 'Suspected duplicate listing', details: 'Same photos' });
    expect(submitted.status).toBe(201);

    const response = await request(app)
      .get('/api/v1/admin/reports')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.reports).toHaveLength(1);
    expect(response.body.reports[0]).toMatchObject({
      listingUrlOrId: '/property/sunny-flat',
      reason: 'Suspected duplicate listing',
      details: 'Same photos',
      status: 'open',
    });
  });

  it('updates only the status field', async () => {
    const token = await createAdmin();
    const report = await createReport();
    const headers = { Authorization: `Bearer ${token}` };

    const update = await request(app)
      .patch(`/api/v1/admin/reports/${report._id}`)
      .set(headers)
      .send({ status: 'resolved' });

    expect(update.status).toBe(200);
    expect(update.body.report.status).toBe('resolved');
  });

  it('rejects a body containing fields other than status', async () => {
    const token = await createAdmin();
    const report = await createReport();

    const response = await request(app)
      .patch(`/api/v1/admin/reports/${report._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved', reason: 'tampered' });

    expect(response.status).toBe(400);
  });

  it('rejects an invalid status value', async () => {
    const token = await createAdmin();
    const report = await createReport();

    const response = await request(app)
      .patch(`/api/v1/admin/reports/${report._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'not-a-status' });

    expect(response.status).toBe(400);
  });
});


describe('report to listing resolution', () => {
  const post = (body) => request(app).post('/api/v1/reports').send({ reason: 'Something else', ...body });

  it('keeps a valid propertyId that exists', async () => {
    const property = await createProperty();
    const res = await post({ listingUrlOrId: 'anything', propertyId: String(property._id) });

    expect(res.status).toBe(201);
    expect(res.body.report.propertyId).toBe(String(property._id));
  });

  it('stores null for a propertyId that does not exist', async () => {
    const res = await post({ listingUrlOrId: 'anything', propertyId: String(new mongoose.Types.ObjectId()) });

    expect(res.status).toBe(201);
    expect(res.body.report.propertyId).toBeNull();
  });

  it('rejects a malformed propertyId', async () => {
    const res = await post({ listingUrlOrId: 'anything', propertyId: 'abcdefghijkl' });
    expect(res.status).toBe(400);
  });

  it('resolves a /property/<slug> path', async () => {
    const property = await createProperty();
    const res = await post({ listingUrlOrId: `/property/${property.slug}` });

    expect(res.body.report.propertyId).toBe(String(property._id));
    expect(res.body.report.listingUrlOrId).toBe(`/property/${property.slug}`);
  });

  it('resolves a full https URL with a query string and hash', async () => {
    const property = await createProperty();
    const text = `https://homenest.example/property/${property.slug}?utm=x#photos`;
    const res = await post({ listingUrlOrId: text });

    expect(res.body.report.propertyId).toBe(String(property._id));
    expect(res.body.report.listingUrlOrId).toBe(text);
  });

  it('resolves a 24 character hex id', async () => {
    const property = await createProperty();
    const res = await post({ listingUrlOrId: String(property._id) });

    expect(res.body.report.propertyId).toBe(String(property._id));
  });

  it.each([
    'listing-abc',
    '/property/',
    '/property/Not_A_Slug!',
    '/property/%E0%A4%A',
    '/property/no-such-property-anywhere',
    'ftp://homenest.example/property/some-slug',
    '/other/some-slug',
  ])('leaves propertyId null for %s', async (text) => {
    const res = await post({ listingUrlOrId: text });

    expect(res.status).toBe(201);
    expect(res.body.report.propertyId).toBeNull();
    expect(res.body.report.listingUrlOrId).toBe(text);
  });

  it('does not include the property object in the public response', async () => {
    const property = await createProperty();
    const res = await post({ listingUrlOrId: `/property/${property.slug}` });

    expect(res.body.report).not.toHaveProperty('property');
    expect(JSON.stringify(res.body)).not.toContain(property.title);
  });
});

describe('admin reports with property', () => {
  it('returns the property summary on list, detail and status update', async () => {
    const token = await createAdmin();
    const property = await createProperty({ status: 'archived' });
    const report = await createReport({ propertyId: property._id });
    const headers = { Authorization: `Bearer ${token}` };
    const expected = {
      id: String(property._id),
      slug: property.slug,
      title: 'Report Test Flat',
      city: 'Pune',
      locality: 'Baner',
      status: 'archived',
    };

    const list = await request(app).get('/api/v1/admin/reports').set(headers);
    const detail = await request(app).get(`/api/v1/admin/reports/${report._id}`).set(headers);
    const update = await request(app).patch(`/api/v1/admin/reports/${report._id}`).set(headers).send({ status: 'reviewing' });

    expect(list.body.reports[0].property).toEqual(expected);
    expect(list.body.reports[0].propertyId).toBe(String(property._id));
    expect(detail.body.report.property).toEqual(expected);
    expect(update.body.report.property).toEqual(expected);
  });

  it('returns property null when the property was deleted, and when none was linked', async () => {
    const token = await createAdmin();
    const property = await createProperty();
    const deleted = await createReport({ propertyId: property._id });
    const unlinked = await createReport({ listingUrlOrId: 'nothing' });
    await Property.deleteOne({ _id: property._id });

    const res = await request(app).get('/api/v1/admin/reports').set('Authorization', `Bearer ${token}`);
    const byId = Object.fromEntries(res.body.reports.map((r) => [r._id, r]));

    expect(byId[String(deleted._id)].property).toBeNull();
    expect(byId[String(deleted._id)].propertyId).toBe(String(property._id));
    expect(byId[String(unlinked._id)].property).toBeNull();
  });
});

describe('report validation caps', () => {
  const post = (body) => request(app).post('/api/v1/reports').send({ listingUrlOrId: 'x', reason: 'Something else', ...body });

  it.each([
    ['listingUrlOrId', 500],
    ['details', 2000],
  ])('accepts %s at %i characters and rejects one more', async (field, max) => {
    const ok = await post({ [field]: 'a'.repeat(max) });
    const tooLong = await post({ [field]: 'a'.repeat(max + 1) });

    expect(ok.status).toBe(201);
    expect(tooLong.status).toBe(400);
    expect(JSON.stringify(tooLong.body)).toContain(field);
  });
});

describe('report reasons', () => {
  const post = (reason) => request(app).post('/api/v1/reports').send({ listingUrlOrId: 'x', reason });

  it('rejects a reason that is not in the list', async () => {
    const res = await post('Because I felt like it');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('reason');
  });

  it('rejects an overlong reason', async () => {
    const res = await post('a'.repeat(201));
    expect(res.status).toBe(400);
  });

  it.each(REPORT_REASONS)('accepts %s', async (reason) => {
    expect((await post(reason)).status).toBe(201);
  });
});

describe('duplicate report guard', () => {
  const send = (token, body = {}) => {
    const req = request(app).post('/api/v1/reports');
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send({ listingUrlOrId: 'listing-dup', reason: 'Something else', ...body });
  };

  it('rejects a second live report on the same listing from a logged-in user', async () => {
    const { token } = await registerUser();
    expect((await send(token)).status).toBe(201);

    const second = await send(token);
    expect(second.status).toBe(409);
    expect(second.body.error.message).toMatch(/already reported/i);
    expect(await Report.countDocuments()).toBe(1);
  });

  it('also matches on the resolved property when the text differs', async () => {
    const { token } = await registerUser();
    const property = await createProperty();
    expect((await send(token, { listingUrlOrId: `/property/${property.slug}` })).status).toBe(201);
    expect((await send(token, { listingUrlOrId: String(property._id) })).status).toBe(409);
  });

  it('blocks while reviewing, allows again once resolved or rejected', async () => {
    const { token } = await registerUser();
    await send(token);

    await Report.updateMany({}, { status: 'reviewing' });
    expect((await send(token)).status).toBe(409);

    await Report.updateMany({}, { status: 'resolved' });
    expect((await send(token)).status).toBe(201);

    await Report.updateMany({}, { status: 'rejected' });
    expect((await send(token)).status).toBe(201);
  });

  it('does not block other users or other listings', async () => {
    const a = await registerUser();
    const b = await registerUser();
    expect((await send(a.token)).status).toBe(201);
    expect((await send(b.token)).status).toBe(201);
    expect((await send(a.token, { listingUrlOrId: 'other-listing' })).status).toBe(201);
  });

  it('does not dedupe anonymous reports', async () => {
    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(201);
  });
});

describe('GET /reports/mine', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/v1/reports/mine')).status).toBe(401);
  });

  it('returns only the callers own reports, newest first, with a safe shape', async () => {
    const me = await registerUser();
    const other = await registerUser();
    const property = await createProperty();
    const older = await createReport({ reporterId: me.user.id, propertyId: property._id, listingUrlOrId: 'older', details: 'secret' });
    await Report.updateOne({ _id: older._id }, { createdAt: new Date(Date.now() - 60000) });
    const newer = await createReport({ reporterId: me.user.id, listingUrlOrId: 'newer' });
    await createReport({ reporterId: other.user.id, listingUrlOrId: 'not-mine' });
    await createReport({ listingUrlOrId: 'anonymous' });

    const res = await request(app).get('/api/v1/reports/mine').set('Authorization', `Bearer ${me.token}`);

    expect(res.status).toBe(200);
    expect(res.body.reports.map((r) => r.id)).toEqual([String(newer._id), String(older._id)]);
    expect(res.body.reports[1]).toEqual({
      id: String(older._id),
      listing: { reference: 'older', title: 'Report Test Flat', slug: property.slug },
      reason: 'Fraudulent listing',
      status: 'open',
      createdAt: expect.any(String),
    });
    expect(res.body.reports[0].listing).toEqual({ reference: 'newer', title: null, slug: null });
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 2, totalPages: 1 });
    expect(JSON.stringify(res.body)).not.toMatch(/secret|reporterId|details/);
  });

  it('paginates and rejects a bad page', async () => {
    const me = await registerUser();
    await createReport({ reporterId: me.user.id });
    await createReport({ reporterId: me.user.id });
    const headers = { Authorization: `Bearer ${me.token}` };

    const res = await request(app).get('/api/v1/reports/mine?limit=1&page=2').set(headers);
    expect(res.body.reports).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect((await request(app).get('/api/v1/reports/mine?page=0').set(headers)).status).toBe(400);
  });
});

describe('report rate limit (limiter active)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('allows 5 reports per hour per IP, then returns 429; rejected reports do not count', async () => {
    process.env.NODE_ENV = 'development';
    const send = (body = {}) =>
      request(app).post('/api/v1/reports').send({ listingUrlOrId: 'x', reason: 'Something else', ...body });

    // Invalid submissions do not spend the budget.
    for (let i = 0; i < 6; i += 1) expect((await send({ reason: 'nope' })).status).toBe(400);

    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await send()).status);
    const limited = await send();

    expect(statuses.every((status) => status === 201)).toBe(true);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: { message: 'Too many reports. Please try again later.' } });
  });
});
