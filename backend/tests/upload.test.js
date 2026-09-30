process.env.MONGODB_DB_NAME = 'homenest_test_uploads';
process.env.CLOUDINARY_CLOUD_NAME = 'demo';
process.env.CLOUDINARY_API_KEY = '123456789012345';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.CLOUDINARY_FOLDER = 'property-images';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const cloudinary = require('../src/config/cloudinary');

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

describe('POST /api/v1/uploads/signature', () => {
  it('returns a signed Cloudinary upload payload for an authenticated user', async () => {
    const registerRes = await request(app).post('/api/auth/register').send(creds);

    const res = await request(app)
      .post('/api/v1/uploads/signature')
      .set('Authorization', `Bearer ${registerRes.body.token}`)
      .send({ filename: 'demo.jpg' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      cloudName: 'demo',
      apiKey: '123456789012345',
      folder: `property-images/${registerRes.body.user.id}`,
      resourceType: 'image',
      uploadUrl: expect.stringContaining('api.cloudinary.com'),
    });
    expect(res.body.signature).toEqual(expect.any(String));
    expect(res.body.timestamp).toEqual(expect.any(Number));
  });

  it('ignores a client-supplied folder and signs the server-chosen one', async () => {
    const registerRes = await request(app).post('/api/auth/register').send(creds);
    const expectedFolder = `property-images/${registerRes.body.user.id}`;

    const res = await request(app)
      .post('/api/v1/uploads/signature')
      .set('Authorization', `Bearer ${registerRes.body.token}`)
      .send({ folder: 'someone-else/../admin', resourceType: 'raw' });

    expect(res.status).toBe(200);
    expect(res.body.folder).toBe(expectedFolder);
    expect(res.body.resourceType).toBe('image');
    // The signature must cover the server folder, not the one the client sent.
    const expectedSignature = cloudinary.utils.api_sign_request(
      { timestamp: res.body.timestamp, folder: expectedFolder },
      'test-secret'
    );
    expect(res.body.signature).toBe(expectedSignature);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/v1/uploads/signature').send({ folder: 'anything' });

    expect(res.status).toBe(401);
    expect(res.body.signature).toBeUndefined();
  });
});
