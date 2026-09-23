const request = require('supertest');
const createApp = require('../src/app');

describe('GET /health', () => {
  const app = createApp();

  it('returns 200 with API status and MongoDB connection status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.mongo).toHaveProperty('status');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('does not expose secrets such as the Mongo connection string', async () => {
    const response = await request(app).get('/health');
    const body = JSON.stringify(response.body);

    expect(body).not.toMatch(/mongodb(\+srv)?:\/\//i);
  });
});
