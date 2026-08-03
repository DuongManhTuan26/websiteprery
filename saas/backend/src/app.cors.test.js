import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from './app.js';

// Regression test for a real bug: the embeddable widget (widget.routes.js,
// public/widget.js) is designed to run on arbitrary third-party sites, but
// the app's CORS was originally a single blanket policy restricted to the
// dashboard's own origin — meaning a widget embedded anywhere else would
// be silently blocked by the browser. Fixed in app.js by giving
// /api/widget and /api/uploads/widget their own permissive, credentials-
// free CORS policy ahead of the strict one everything else uses.
let server;
let baseUrl;

before(async () => {
  server = createServer(createApp());
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
});

async function preflight(path, origin) {
  return fetch(`${baseUrl}${path}`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST'
    }
  });
}

test('widget endpoints allow cross-origin requests from an arbitrary third-party site', async () => {
  const res = await preflight('/api/widget/start', 'https://some-customer-site.example');
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://some-customer-site.example');
  assert.equal(res.headers.get('access-control-allow-credentials'), null);
});

test('the public widget upload endpoint also allows an arbitrary origin', async () => {
  const res = await preflight('/api/uploads/widget', 'https://some-customer-site.example');
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://some-customer-site.example');
});

test('authenticated dashboard endpoints do not reflect an arbitrary origin', async () => {
  const res = await preflight('/api/dashboard/summary', 'https://some-customer-site.example');
  assert.notEqual(res.headers.get('access-control-allow-origin'), 'https://some-customer-site.example');
});

test('authenticated dashboard endpoints allow the real configured frontend origin, with credentials', async () => {
  const res = await preflight('/api/dashboard/summary', 'http://localhost:5173');
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
});
