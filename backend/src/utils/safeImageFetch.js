// Downloads one image from a URL given by an outside party (the scraper), so it
// must not be possible to use it to reach our own network (SSRF).
//
//   const { buffer, contentType } = await fetchImage(url);
//
// Guards:
//   - http and https only, no user:pass@ in the URL
//   - the address every connection actually uses must be public. The check runs
//     inside the socket's own DNS lookup, so a hostname that resolves to a
//     private address (or changes its answer between two lookups) is refused
//     at connect time; IP-literal hosts are checked up front.
//   - at most 5 redirects, each one re-checked the same way
//   - 10 seconds in total, 10 MB at most, and an image content type
const http = require('http');
const https = require('https');
const net = require('net');
const dns = require('dns');
const { URL } = require('url');

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10 * 1000;
const MAX_BYTES = 10 * 1024 * 1024;

// Ranges that are never a legitimate public image host.
const blocked = new net.BlockList();
[
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
].forEach(([address, prefix]) => blocked.addSubnet(address, prefix, 'ipv4'));
[
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001::', 32],
  ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
].forEach(([address, prefix]) => blocked.addSubnet(address, prefix, 'ipv6'));

// An IPv4 address written as IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1) is judged
// as the IPv4 address it wraps. URL parsing normalizes every spelling to hex.
function unwrapMappedIpv4(address) {
  let host;
  try {
    host = new URL(`http://[${address}]`).hostname.slice(1, -1);
  } catch {
    return null;
  }
  const match = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
  if (!match) return null;
  const hi = parseInt(match[1], 16);
  const lo = parseInt(match[2], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

function isBlockedAddress(address) {
  const family = net.isIP(address);
  if (family === 0) return true; // not an address: never connect
  if (family === 6) {
    const wrapped = unwrapMappedIpv4(address);
    if (wrapped) return isBlockedAddress(wrapped);
  }
  return blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

class ImageFetchError extends Error {}

function fail(message) {
  return new ImageFetchError(message);
}

// Builds a fetcher around a "is this address off limits" test. Production uses
// isBlockedAddress; tests build one that allows 127.0.0.1 to reach a local server.
function createImageFetcher(isBlocked, { timeoutMs = TIMEOUT_MS } = {}) {
  function guardedLookup(hostname, options, callback) {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: net.isIP(addresses) }];
      if (list.length === 0 || list.some(({ address }) => isBlocked(address))) {
        return callback(fail('Image host resolves to a private or reserved address'));
      }
      if (options && options.all) return callback(null, list);
      return callback(null, list[0].address, list[0].family);
    });
  }

  // One request, no redirect following. Resolves { response } with the stream
  // paused, or { redirect } with the Location header.
  function requestOnce(url, deadline) {
    return new Promise((resolve, reject) => {
      const transport = url.protocol === 'https:' ? https : http;
      const req = transport.request(
        url,
        { method: 'GET', lookup: guardedLookup, headers: { accept: 'image/*', 'user-agent': 'HomeNestImageImport/1.0' } },
        (res) => {
          const status = res.statusCode || 0;
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            return resolve({ redirect: res.headers.location });
          }
          return resolve({ response: res, req });
        }
      );
      req.on('error', reject);
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        req.destroy(fail('Image download timed out'));
        return;
      }
      req.setTimeout(remaining, () => req.destroy(fail('Image download timed out')));
      req.end();
    });
  }

  function readBody(res, req, deadline) {
    return new Promise((resolve, reject) => {
      const declared = Number(res.headers['content-length']);
      if (Number.isFinite(declared) && declared > MAX_BYTES) {
        req.destroy();
        return reject(fail('Image is larger than 10 MB'));
      }

      const chunks = [];
      let total = 0;
      const timer = setTimeout(() => {
        req.destroy();
        reject(fail('Image download timed out'));
      }, Math.max(deadline - Date.now(), 1));

      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > MAX_BYTES) {
          clearTimeout(timer);
          req.destroy();
          reject(fail('Image is larger than 10 MB'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks));
      });
      res.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      res.on('aborted', () => {
        clearTimeout(timer);
        reject(fail('Image download was interrupted'));
      });
    });
  }

  return async function fetchImage(rawUrl) {
    const deadline = Date.now() + timeoutMs;
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      throw fail('Not a valid URL');
    }

    for (let hops = 0; ; hops += 1) {
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw fail('Only http and https image URLs are allowed');
      if (url.username || url.password) throw fail('Image URLs must not contain credentials');
      const host = url.hostname.replace(/^\[|\]$/g, '');
      if (net.isIP(host) !== 0 && isBlocked(host)) throw fail('Image host is a private or reserved address');

      const result = await requestOnce(url, deadline);
      if (result.redirect) {
        if (hops >= MAX_REDIRECTS) throw fail('Too many redirects');
        try {
          url = new URL(result.redirect, url);
        } catch {
          throw fail('Invalid redirect location');
        }
        continue;
      }

      const { response, req } = result;
      if (response.statusCode !== 200) {
        response.resume();
        throw fail(`Image host answered with status ${response.statusCode}`);
      }
      const contentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      // SVG can carry scripts, so it is not an image we accept.
      if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') {
        req.destroy();
        throw fail(`Not an image (content type "${contentType || 'none'}")`);
      }
      const buffer = await readBody(response, req, deadline);
      if (buffer.length === 0) throw fail('Image is empty');
      return { buffer, contentType };
    }
  };
}

const fetchImage = createImageFetcher(isBlockedAddress);

module.exports = { fetchImage, createImageFetcher, isBlockedAddress, ImageFetchError, MAX_BYTES, MAX_REDIRECTS, TIMEOUT_MS };
