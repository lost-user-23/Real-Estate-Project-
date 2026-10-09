process.env.MONGODB_DB_NAME = 'homenest_test_uploads';
process.env.CLOUDINARY_CLOUD_NAME = 'demo';
process.env.CLOUDINARY_API_KEY = '123456789012345';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.CLOUDINARY_FOLDER = 'property-images';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');

const app = createApp();

const creds = { name: 'Upload User', email: 'upload@example.com', password: 'password123' };

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

describe('upload rate limiting', () => {
  it('returns 429 with a JSON message once the per-user limit is exceeded', async () => {
    const express = require('express');
    const { createLimiter } = require('../src/middleware/uploadRateLimiter');
    const errorHandler = require('../src/middleware/errorHandler');
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development'; // limiters are skipped under test
    try {
      const limited = express();
      limited.use((req, res, next) => { req.user = { _id: 'u1' }; next(); });
      limited.post('/x', createLimiter({ windowMs: 60000, max: 2 }, 'Too many uploads.'), (req, res) => res.json({ ok: true }));
      limited.use(errorHandler);

      await request(limited).post('/x');
      await request(limited).post('/x');
      const res = await request(limited).post('/x');
      expect(res.status).toBe(429);
      expect(res.body.error.message).toMatch(/too many uploads/i);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe('POST /api/v1/uploads/image', () => {
  const cloudinaryV2 = require('../src/config/cloudinary').v2;
  let token;

  beforeEach(async () => {
    const reg = await registerVerified(app, creds);
    token = tokenFromResponse(reg);
    jest.spyOn(cloudinaryV2.uploader, 'upload_stream').mockImplementation((opts, cb) => ({
      end: () => cb(null, { secure_url: `https://res.cloudinary.com/demo/${opts.folder}/x.jpg`, public_id: `${opts.folder}/x` }),
    }));
  });
  afterEach(() => jest.restoreAllMocks());

  const send = (buf, name, type) =>
    request(app).post('/api/v1/uploads/image').set('Authorization', `Bearer ${token}`).attach('image', buf, { filename: name, contentType: type });

  it('uploads a valid image', async () => {
    const res = await send(Buffer.alloc(1024), 'a.jpg', 'image/jpeg');
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ url: expect.stringContaining('property-images/'), publicId: expect.any(String) });
  });

  it('rejects files over 5 MB with 400 and never calls Cloudinary', async () => {
    const res = await send(Buffer.alloc(5 * 1024 * 1024 + 1), 'big.jpg', 'image/jpeg');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/too large.*5 MB/i);
    expect(cloudinaryV2.uploader.upload_stream).not.toHaveBeenCalled();
  });

  it.each([['a.gif', 'image/gif'], ['a.svg', 'image/svg+xml'], ['a.pdf', 'application/pdf'], ['a.jpg.exe', 'image/jpeg']])(
    'rejects %s with 400',
    async (name, type) => {
      const res = await send(Buffer.alloc(100), name, type);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/only jpg, jpeg, png, webp/i);
      expect(cloudinaryV2.uploader.upload_stream).not.toHaveBeenCalled();
    }
  );

  it('rejects a request without a file and an unauthenticated request', async () => {
    const none = await request(app).post('/api/v1/uploads/image').set('Authorization', `Bearer ${token}`);
    expect(none.status).toBe(400);
    const anon = await request(app).post('/api/v1/uploads/image');
    expect(anon.status).toBe(401);
  });
});
