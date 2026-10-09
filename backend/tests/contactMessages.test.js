process.env.MONGODB_DB_NAME = 'homenest_test_contact_messages';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const ContactMessage = require('../src/models/ContactMessage');

const app = createApp();

const PUBLIC_URL = '/api/v1/contact-messages';
const ADMIN_URL = '/api/v1/admin/contact-messages';
const SUCCESS_BODY = { success: true, message: 'Thanks, we will get back to you soon!' };

const validBody = (overrides = {}) => ({
  name: 'Asha Verma',
  email: 'asha@example.com',
  message: 'I would like to know more about your listings.',
  ...overrides,
});

async function registerUser() {
  const email = `contact-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await registerVerified(app, { name: 'Contact Tester', email, password: 'password123' });
  return { token: tokenFromResponse(response), user: response.body.user };
}

async function createAdmin() {
  const credentials = await registerUser();
  await User.findByIdAndUpdate(credentials.user.id, { role: 'admin' });
  return credentials.token;
}

async function createMessage(overrides = {}) {
  return ContactMessage.create({ ...validBody(), ipAddress: '10.0.0.1', ...overrides });
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), ContactMessage.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('public contact messages', () => {
  it('creates a message and returns the success body', async () => {
    const response = await request(app).post(PUBLIC_URL).send(validBody());

    expect(response.status).toBe(201);
    expect(response.body).toEqual(SUCCESS_BODY);

    const docs = await ContactMessage.find({});
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      name: 'Asha Verma',
      email: 'asha@example.com',
      message: 'I would like to know more about your listings.',
    });
  });

  it('stores the request ip address without exposing it in the response', async () => {
    const response = await request(app).post(PUBLIC_URL).send(validBody());

    const doc = await ContactMessage.findOne({}).select('+ipAddress');
    expect(doc.ipAddress).toMatch(/127\.0\.0\.1|::1/);
    expect(JSON.stringify(response.body)).not.toContain(doc.ipAddress);
    expect(response.body).not.toHaveProperty('ipAddress');
  });

  it('lowercases the email and normalises the phone number', async () => {
    const response = await request(app)
      .post(PUBLIC_URL)
      .send(validBody({ email: 'Asha@Example.COM', phone: '+91 98765-43210' }));

    expect(response.status).toBe(201);
    const doc = await ContactMessage.findOne({});
    expect(doc.email).toBe('asha@example.com');
    expect(doc.phone).toBe('+919876543210');
  });

  it.each([
    ['a bad email', { email: 'not-an-email' }],
    ['a name that is too short', { name: 'A' }],
    ['a message under 10 characters', { message: 'too short' }],
    ['a message over 2000 characters', { message: 'a'.repeat(2001) }],
    ['an invalid phone', { phone: 'call-me-maybe' }],
    ['a missing name', { name: undefined }],
    ['a missing email', { email: undefined }],
    ['a missing message', { message: undefined }],
    ['a name that is an object', { name: { first: 'Asha' } }],
    ['an email that is an array', { email: ['asha@example.com'] }],
    ['a message that is a number', { message: 1234567890123 }],
    ['a phone that is an object', { phone: { number: '9876543210' } }],
  ])('rejects %s with 400 and creates nothing', async (_label, overrides) => {
    const response = await request(app).post(PUBLIC_URL).send(validBody(overrides));

    expect(response.status).toBe(400);
    expect(response.body.error.message).toEqual(expect.any(String));
    expect(await ContactMessage.countDocuments()).toBe(0);
  });

  it('rejects an empty body with 400', async () => {
    const response = await request(app).post(PUBLIC_URL).send({});

    expect(response.status).toBe(400);
    expect(await ContactMessage.countDocuments()).toBe(0);
  });

  it('accepts a message of exactly 2000 characters', async () => {
    const response = await request(app).post(PUBLIC_URL).send(validBody({ message: 'a'.repeat(2000) }));

    expect(response.status).toBe(201);
    expect(await ContactMessage.countDocuments()).toBe(1);
  });

  it('ignores client supplied status and ipAddress', async () => {
    const response = await request(app)
      .post(PUBLIC_URL)
      .send(validBody({ status: 'archived', ipAddress: '1.2.3.4' }));

    expect(response.status).toBe(201);
    const doc = await ContactMessage.findOne({}).select('+ipAddress');
    expect(doc.status).toBe('new');
    expect(doc.ipAddress).not.toBe('1.2.3.4');
    expect(doc.ipAddress).toMatch(/127\.0\.0\.1|::1/);
  });

  it('answers a honeypot submission like a real one without saving it', async () => {
    const real = await request(app).post(PUBLIC_URL).send(validBody());
    const countAfterReal = await ContactMessage.countDocuments();

    const spam = await request(app).post(PUBLIC_URL).send(validBody({ website: 'spam' }));

    expect(spam.status).toBe(real.status);
    expect(spam.body).toEqual(real.body);
    expect(await ContactMessage.countDocuments()).toBe(countAfterReal);
  });
});

describe('contact message rate limit (real route, limiter active)', () => {
  // The limiter skips itself under jest (NODE_ENV=test). Flip it for these
  // requests only, so the real app and the real route are what gets exercised.
  const originalNodeEnv = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = 'development';
  });
  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('does not count rejected submissions, then returns 429 through the normal error shape after 5 accepted ones', async () => {
    // A visitor who mistypes a few times must not lose their budget.
    for (let i = 0; i < 6; i += 1) {
      const bad = await request(app).post(PUBLIC_URL).send(validBody({ name: 'A' }));
      expect(bad.status).toBe(400);
    }

    for (let i = 0; i < 5; i += 1) {
      const ok = await request(app).post(PUBLIC_URL).send(validBody());
      expect(ok.status).toBe(201);
    }
    const limited = await request(app).post(PUBLIC_URL).send(validBody());
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: { message: 'Too many messages. Please try again later.' } });
    expect(limited.headers['ratelimit-limit']).toBe('5');
  });
});

describe('admin contact messages access control', () => {
  it('rejects requests without a token with 401', async () => {
    const id = new mongoose.Types.ObjectId();

    const list = await request(app).get(ADMIN_URL);
    const update = await request(app).patch(`${ADMIN_URL}/${id}`).send({ status: 'read' });

    expect(list.status).toBe(401);
    expect(update.status).toBe(401);
  });

  it('rejects a normal user token with 403', async () => {
    const { token } = await registerUser();
    const message = await createMessage();
    const headers = { Authorization: `Bearer ${token}` };

    const list = await request(app).get(ADMIN_URL).set(headers);
    const update = await request(app).patch(`${ADMIN_URL}/${message._id}`).set(headers).send({ status: 'read' });

    expect(list.status).toBe(403);
    expect(update.status).toBe(403);
    expect((await ContactMessage.findById(message._id)).status).toBe('new');
  });
});

describe('admin contact messages list', () => {
  const get = async (query = '') => {
    const token = await createAdmin();
    return request(app).get(`${ADMIN_URL}${query}`).set('Authorization', `Bearer ${token}`);
  };

  it('returns messages newest first with meta and no ipAddress', async () => {
    const oldest = await createMessage({ name: 'Oldest Sender', createdAt: new Date('2026-01-01') });
    const newest = await createMessage({ name: 'Newest Sender', createdAt: new Date('2026-03-01') });
    const middle = await createMessage({ name: 'Middle Sender', createdAt: new Date('2026-02-01') });

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.body.messages.map((m) => m.id)).toEqual([newest, middle, oldest].map((m) => String(m._id)));
    expect(response.body.meta).toEqual({ total: 3, page: 1, limit: 20, totalPages: 1 });
    response.body.messages.forEach((item) => expect(item).not.toHaveProperty('ipAddress'));
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.1');
  });

  it('filters by status', async () => {
    await createMessage({ status: 'new' });
    await createMessage({ status: 'read' });
    await createMessage({ status: 'read' });

    const response = await get('?status=read');

    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(2);
    expect(response.body.messages.every((m) => m.status === 'read')).toBe(true);
    expect(response.body.meta.total).toBe(2);
  });

  it.each([
    ['an unknown status', '?status=banana'],
    ['page=0', '?page=0'],
    ['a non numeric limit', '?limit=abc'],
  ])('rejects %s with 400', async (_label, query) => {
    const response = await get(query);
    expect(response.status).toBe(400);
  });

  it('caps limit at 50', async () => {
    const response = await get('?limit=500');

    expect(response.status).toBe(200);
    expect(response.body.meta.limit).toBe(50);
  });

  it('paginates results', async () => {
    await createMessage({ createdAt: new Date('2026-01-01') });
    await createMessage({ createdAt: new Date('2026-02-01') });
    await createMessage({ createdAt: new Date('2026-03-01') });

    const response = await get('?limit=2&page=2');

    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(1);
    expect(response.body.meta).toEqual({ total: 3, page: 2, limit: 2, totalPages: 2 });
  });
});

describe('admin contact messages update', () => {
  const patch = async (id, body) => {
    const token = await createAdmin();
    return request(app).patch(`${ADMIN_URL}/${id}`).set('Authorization', `Bearer ${token}`).send(body);
  };

  it('updates the status and returns the message without ipAddress', async () => {
    const message = await createMessage();

    const response = await patch(message._id, { status: 'read' });

    expect(response.status).toBe(200);
    expect(response.body.contactMessage).toMatchObject({ id: String(message._id), status: 'read' });
    expect(response.body.contactMessage).not.toHaveProperty('ipAddress');
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.1');
    expect((await ContactMessage.findById(message._id)).status).toBe('read');
  });

  it('rejects an invalid status with 400', async () => {
    const message = await createMessage();

    const response = await patch(message._id, { status: 'banana' });

    expect(response.status).toBe(400);
    expect((await ContactMessage.findById(message._id)).status).toBe('new');
  });

  it('rejects a malformed id with 400', async () => {
    const response = await patch('not-an-object-id', { status: 'read' });
    expect(response.status).toBe(400);
  });

  it('returns 404 for a valid id that does not exist', async () => {
    const response = await patch(new mongoose.Types.ObjectId(), { status: 'read' });
    expect(response.status).toBe(404);
  });

  it('rejects extra fields with 400 and changes nothing', async () => {
    const message = await createMessage();

    const response = await patch(message._id, { status: 'archived', name: 'Hacked Name', message: 'Tampered message body' });

    expect(response.status).toBe(400);
    const doc = await ContactMessage.findById(message._id);
    expect(doc.name).toBe('Asha Verma');
    expect(doc.message).toBe('I would like to know more about your listings.');
    expect(doc.status).toBe('new');
  });
});
