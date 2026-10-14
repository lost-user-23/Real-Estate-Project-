const http = require('http');
const https = require('https');
const { fetchImage, createImageFetcher, isBlockedAddress, MAX_BYTES } = require('../src/utils/safeImageFetch');

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0',
    '100.64.0.1', '224.0.0.1', '255.255.255.255', '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', 'not-an-ip',
  ])('blocks %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '151.101.1.69', '2606:4700:4700::1111'])('allows %s', (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

describe('fetchImage: private targets are refused before any network call', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    'http://127.0.0.1/a.jpg',
    'http://10.0.0.5/a.jpg',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/a.jpg',
    'http://[::ffff:7f00:1]/a.jpg',
    'http://localhost/a.jpg',
    'http://0.0.0.0/a.jpg',
  ])('%s', async (url) => {
    const httpSpy = jest.spyOn(http, 'request');
    const httpsSpy = jest.spyOn(https, 'request');
    await expect(fetchImage(url)).rejects.toThrow(/private|reserved/);
    // For IP literals no request is made at all; for "localhost" the request is
    // started but its own DNS lookup is refused, so no socket is ever opened.
    if (!url.includes('localhost')) {
      expect(httpSpy).not.toHaveBeenCalled();
      expect(httpsSpy).not.toHaveBeenCalled();
    }
  });

  it('refuses non-http schemes and credentials', async () => {
    await expect(fetchImage('ftp://example.com/a.jpg')).rejects.toThrow(/http/);
    await expect(fetchImage('file:///etc/passwd')).rejects.toThrow(/http/);
    await expect(fetchImage('https://user:pw@example.com/a.jpg')).rejects.toThrow(/credentials/);
    await expect(fetchImage('not a url')).rejects.toThrow(/valid URL/);
  });
});

// The rules below are exercised against a real local server, so they use a fetcher
// that is allowed to reach 127.0.0.1. The exported fetchImage never is.
describe('fetchImage: download rules', () => {
  const local = createImageFetcher(() => false);
  let server;
  let base;
  const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const route = req.url;
      if (route === '/ok.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        return res.end(PNG);
      }
      if (route === '/page.html') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end('<html></html>');
      }
      if (route === '/vector.svg') {
        res.writeHead(200, { 'content-type': 'image/svg+xml' });
        return res.end('<svg/>');
      }
      if (route === '/huge-declared.png') {
        res.writeHead(200, { 'content-type': 'image/png', 'content-length': String(MAX_BYTES + 1) });
        return res.end();
      }
      if (route === '/huge-streamed.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        const chunk = Buffer.alloc(1024 * 1024);
        let sent = 0;
        const write = () => {
          while (sent <= 11) {
            sent += 1;
            if (!res.write(chunk)) return res.once('drain', write);
          }
          return res.end();
        };
        return write();
      }
      if (route === '/missing.png') {
        res.writeHead(404);
        return res.end();
      }
      if (route === '/hop') {
        res.writeHead(302, { location: '/ok.png' });
        return res.end();
      }
      if (route === '/loop') {
        res.writeHead(302, { location: '/loop' });
        return res.end();
      }
      if (route === '/slow') {
        res.writeHead(200, { 'content-type': 'image/png' });
        return undefined; // never finishes
      }
      res.writeHead(500);
      return res.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it('downloads an image and reports its content type', async () => {
    const result = await local(`${base}/ok.png`);
    expect(result.contentType).toBe('image/png');
    expect(result.buffer.equals(PNG)).toBe(true);
  });

  it('follows a redirect', async () => {
    expect((await local(`${base}/hop`)).contentType).toBe('image/png');
  });

  it('stops after 5 redirects', async () => {
    await expect(local(`${base}/loop`)).rejects.toThrow(/Too many redirects/);
  });

  it('refuses a redirect into a blocked address', async () => {
    const redirector = http.createServer((req, res) => {
      res.writeHead(302, { location: 'http://10.0.0.5/secret.png' });
      res.end();
    });
    await new Promise((resolve) => redirector.listen(0, '127.0.0.1', resolve));
    const onlyLoopbackAllowed = createImageFetcher((address) => address !== '127.0.0.1');
    await expect(onlyLoopbackAllowed(`http://127.0.0.1:${redirector.address().port}/a.png`)).rejects.toThrow(/private|reserved/);
    await new Promise((resolve) => redirector.close(resolve));
  });

  it('rejects a non-image content type and SVG', async () => {
    await expect(local(`${base}/page.html`)).rejects.toThrow(/Not an image/);
    await expect(local(`${base}/vector.svg`)).rejects.toThrow(/Not an image/);
  });

  it('rejects files over 10 MB, whether declared or streamed', async () => {
    await expect(local(`${base}/huge-declared.png`)).rejects.toThrow(/10 MB/);
    await expect(local(`${base}/huge-streamed.png`)).rejects.toThrow(/10 MB/);
  });

  it('rejects a non-200 answer', async () => {
    await expect(local(`${base}/missing.png`)).rejects.toThrow(/status 404/);
  });

  it('gives up on a response that never finishes', async () => {
    const quick = createImageFetcher(() => false, { timeoutMs: 300 });
    await expect(quick(`${base}/slow`)).rejects.toThrow(/timed out/);
  });
});
