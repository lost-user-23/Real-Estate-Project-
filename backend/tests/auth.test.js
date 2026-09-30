process.env.MONGODB_DB_NAME = 'homenest_test_auth';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');

const app = createApp();

const creds = { name: 'Test User', email: 'Test@Example.com', password: 'password123' };

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('POST /api/auth/register', () => {
  it('registers a new user and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.role).toBe('user');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(400);
  });

  it('treats email uniqueness as case-insensitive', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...creds, email: creds.email.toUpperCase() });
    expect(res.status).toBe(400);
  });

  it('rejects missing password', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('rejects missing email', async () => {
    const res = await request(app).post('/api/auth/register').send({ password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('ignores a client-supplied role (no privilege escalation)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...creds, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
  });

  it('rejects a password shorter than the minimum length', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weak@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed email address', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(creds);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('is case-insensitive on email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email.toUpperCase(), password: creds.password });
    expect(res.status).toBe(200);
  });

  it('rejects an incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email without a distinguishable message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('rejects missing password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: creds.email });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('rejects when no token is supplied', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed/invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects an Authorization header without the Bearer scheme', async () => {
    const reg = await request(app).post('/api/auth/register').send(creds);
    const res = await request(app).get('/api/auth/me').set('Authorization', reg.body.token);
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const reg = await request(app).post('/api/auth/register').send(creds);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a valid token whose user was since deleted', async () => {
    const reg = await request(app).post('/api/auth/register').send(creds);
    await User.deleteMany({});
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(401);
  });
});

describe('unexpected errors in register and login', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('register passes a database failure to the error handler as a generic 500', async () => {
    jest.spyOn(User, 'findOne').mockRejectedValueOnce(new Error('db exploded: secret detail'));
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Internal server error' } });
  });

  it('login passes a database failure to the error handler as a generic 500', async () => {
    jest.spyOn(User, 'findOne').mockImplementationOnce(() => {
      throw new Error('db exploded: secret detail');
    });
    const res = await request(app).post('/api/auth/login').send(creds);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Internal server error' } });
  });

  it('register still reports a duplicate-key race as "User already exists"', async () => {
    const duplicate = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    jest.spyOn(User, 'create').mockRejectedValueOnce(duplicate);
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User already exists');
  });
});
