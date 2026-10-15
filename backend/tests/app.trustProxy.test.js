const request = require('supertest');
const express = require('express');
const createApp = require('../src/app');

describe('trust proxy setting', () => {
  const original = process.env.TRUST_PROXY_HOPS;

  afterEach(() => {
    if (original === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = original;
  });

  it.each([
    [undefined, 0],
    ['', 0],
    ['0', 0],
    ['1', 1],
    ['2', 2],
    ['true', 0],
    ['-1', 0],
    ['1.5', 0],
    ['abc', 0],
  ])('TRUST_PROXY_HOPS=%p sets trust proxy to %p', (value, expected) => {
    if (value === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = value;
    expect(createApp().get('trust proxy')).toBe(expected);
  });

  it('with one hop, req.ip is the address the proxy appended, not one the client forged', async () => {
    process.env.TRUST_PROXY_HOPS = '1';
    const app = createApp();
    // Probe route on a copy of the setting, so the real app's routes stay untouched.
    const probe = express();
    probe.set('trust proxy', app.get('trust proxy'));
    probe.get('/ip', (req, res) => res.json({ ip: req.ip }));

    const res = await request(probe).get('/ip').set('X-Forwarded-For', '6.6.6.6, 203.0.113.7');
    expect(res.body.ip).toBe('203.0.113.7');
  });

  const ipSeenBy = async (hops, forwardedFor) => {
    process.env.TRUST_PROXY_HOPS = hops;
    const probe = express();
    probe.set('trust proxy', createApp().get('trust proxy'));
    probe.get('/ip', (req, res) => res.json({ ip: req.ip }));
    return (await request(probe).get('/ip').set('X-Forwarded-For', forwardedFor)).body.ip;
  };

  it('with zero hops, X-Forwarded-For is ignored entirely (a client cannot pick its rate-limit key)', async () => {
    expect(await ipSeenBy('0', '8.8.8.8')).toMatch(/127\.0\.0\.1|::1/);
  });

  it('with one hop and no real proxy, a client-sent header IS trusted, so the hop count must match the real topology', async () => {
    // Documents why TRUST_PROXY_HOPS must equal the deployed proxy count.
    expect(await ipSeenBy('1', '8.8.8.8')).toBe('8.8.8.8');
  });
});
