import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../app.js';

// Regression test for real brute-force protection on /login (see
// auth.routes.js's loginLimiter, limit: 10 per 15 minutes per IP) — every
// request in this test comes from the same loopback IP, same as a real
// attacker hammering the endpoint would look like.
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

test('POST /api/auth/login is rate-limited after repeated attempts from the same IP', async () => {
  const email = `ratelimit-${Date.now()}@example.com`;

  await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessName: 'Rate Limit Co', name: 'RL', email, password: 'matkhau123' })
  });

  let lastStatus;
  for (let i = 0; i < 11; i++) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'sai-mat-khau' })
    });
    lastStatus = res.status;
  }

  assert.equal(lastStatus, 429);
});
